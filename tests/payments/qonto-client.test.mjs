import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQontoClient, QontoApiError } from '../../lambda/payments-shared.mjs';

// createQontoClient wraps global fetch — stub it per test rather than hit the
// network, so these stay pure-function tests (no real Qonto call is ever
// made from this repo, per tmp/payments.md).
function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => {
    globalThis.fetch = original;
  };
}

test('sends Authorization: Bearer <token> using the getToken callback', async () => {
  let capturedHeaders;
  const restore = stubFetch(async (url, init) => {
    capturedHeaders = init.headers;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  try {
    const client = createQontoClient({
      baseUrl: 'https://thirdparty.qonto.com',
      getToken: async () => 'an-access-token',
    });
    await client.get('/v2/organization');
    assert.equal(capturedHeaders.Authorization, 'Bearer an-access-token');
    assert.equal('X-Qonto-Staging-Token' in capturedHeaders, false);
  } finally {
    restore();
  }
});

test('getToken is called fresh on every request (so a refreshed token is picked up without recreating the client)', async () => {
  let calls = 0;
  const restore = stubFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  try {
    const client = createQontoClient({
      baseUrl: 'https://thirdparty.qonto.com',
      getToken: async () => {
        calls += 1;
        return `token-${calls}`;
      },
    });
    await client.get('/v2/organization');
    await client.get('/v2/organization');
    assert.equal(calls, 2);
  } finally {
    restore();
  }
});

// Sandbox requires this header on every request (docs.qonto.com/get-started/
// general/sandbox-access, verified July 2026).
test('sandbox client (stagingToken set) sends X-Qonto-Staging-Token on every request', async () => {
  let capturedHeaders;
  const restore = stubFetch(async (url, init) => {
    capturedHeaders = init.headers;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  try {
    const client = createQontoClient({
      baseUrl: 'https://thirdparty-sandbox.staging.qonto.co',
      getToken: async () => 'an-access-token',
      stagingToken: 'staging-token-value',
    });
    await client.get('/v2/organization');
    assert.equal(capturedHeaders['X-Qonto-Staging-Token'], 'staging-token-value');

    await client.post('/v2/client_invoices', { foo: 'bar' });
    assert.equal(capturedHeaders['X-Qonto-Staging-Token'], 'staging-token-value');
  } finally {
    restore();
  }
});

test('GET composes baseUrl + path with no body', async () => {
  let capturedUrl;
  let capturedMethod;
  let capturedBody;
  const restore = stubFetch(async (url, init) => {
    capturedUrl = url;
    capturedMethod = init.method;
    capturedBody = init.body;
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  });
  try {
    const client = createQontoClient({ baseUrl: 'https://thirdparty.qonto.com', getToken: async () => 'a' });
    const result = await client.get('/v2/clients?filter[x]=1');
    assert.equal(capturedUrl, 'https://thirdparty.qonto.com/v2/clients?filter[x]=1');
    assert.equal(capturedMethod, 'GET');
    assert.equal(capturedBody, undefined);
    assert.deepEqual(result, { items: [] });
  } finally {
    restore();
  }
});

test('POST serializes the body as JSON', async () => {
  let capturedBody;
  const restore = stubFetch(async (url, init) => {
    capturedBody = init.body;
    return new Response(JSON.stringify({ id: 'inv_1' }), { status: 200 });
  });
  try {
    const client = createQontoClient({ baseUrl: 'https://thirdparty.qonto.com', getToken: async () => 'a' });
    await client.post('/v2/client_invoices', { currency: 'EUR', client_id: 'c_1' });
    assert.equal(capturedBody, JSON.stringify({ currency: 'EUR', client_id: 'c_1' }));
  } finally {
    restore();
  }
});

test('non-ok response throws QontoApiError with status and parsed body', async () => {
  const restore = stubFetch(async () => new Response(JSON.stringify({ error: 'not_found' }), { status: 404 }));
  try {
    const client = createQontoClient({ baseUrl: 'https://thirdparty.qonto.com', getToken: async () => 'a' });
    await assert.rejects(
      () => client.get('/v2/client_invoices/missing'),
      (err) => {
        assert.ok(err instanceof QontoApiError);
        assert.equal(err.status, 404);
        assert.deepEqual(err.body, { error: 'not_found' });
        return true;
      }
    );
  } finally {
    restore();
  }
});

test('non-JSON response body does not throw a parse error', async () => {
  const restore = stubFetch(async () => new Response('not json', { status: 200 }));
  try {
    const client = createQontoClient({ baseUrl: 'https://thirdparty.qonto.com', getToken: async () => 'a' });
    const result = await client.get('/v2/whatever');
    assert.deepEqual(result, { raw: 'not json' });
  } finally {
    restore();
  }
});
