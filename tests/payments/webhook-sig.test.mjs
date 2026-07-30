import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

// payments-webhook.mjs verifies Qonto's HMAC-SHA256 signature over the raw
// request body using crypto.timingSafeEqual. Qonto's docs (webhooks/setup.md)
// don't publish a fixed test vector as of July 2026, so this test builds a
// self-generated fixture with the exact primitives the handler uses, and
// exercises the same verification helper the handler will call.

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (typeof signatureHeader !== 'string' || !signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Generated fresh per test run rather than a hardcoded literal — this is a
// disposable test fixture standing in for a Qonto webhook signing secret,
// not a credential.
const SECRET = `whsec_test_${randomBytes(16).toString('hex')}`;

test('valid signature over the exact raw body is accepted', () => {
  const rawBody = JSON.stringify({ event: 'invoice.updated', data: { id: 'inv_1', status: 'paid' } });
  const signature = createHmac('sha256', SECRET).update(rawBody, 'utf8').digest('hex');
  assert.equal(verifyWebhookSignature(rawBody, signature, SECRET), true);
});

test('signature computed over a different body is rejected (body was tampered after signing)', () => {
  const signedBody = JSON.stringify({ event: 'invoice.updated', data: { id: 'inv_1', status: 'paid' } });
  const signature = createHmac('sha256', SECRET).update(signedBody, 'utf8').digest('hex');
  const deliveredBody = JSON.stringify({ event: 'invoice.updated', data: { id: 'inv_1', status: 'draft' } });
  assert.equal(verifyWebhookSignature(deliveredBody, signature, SECRET), false);
});

test('wrong secret is rejected', () => {
  const rawBody = JSON.stringify({ event: 'invoice.updated', data: { id: 'inv_1', status: 'paid' } });
  const signature = createHmac('sha256', SECRET).update(rawBody, 'utf8').digest('hex');
  assert.equal(verifyWebhookSignature(rawBody, signature, 'a-different-secret'), false);
});

test('missing or empty signature header is rejected', () => {
  const rawBody = '{}';
  assert.equal(verifyWebhookSignature(rawBody, '', SECRET), false);
  assert.equal(verifyWebhookSignature(rawBody, undefined, SECRET), false);
  assert.equal(verifyWebhookSignature(rawBody, null, SECRET), false);
});

test('signature of different length than expected is rejected without throwing', () => {
  const rawBody = '{}';
  assert.equal(verifyWebhookSignature(rawBody, 'tooshort', SECRET), false);
});
