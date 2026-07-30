import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature, parseSignatureHeader } from '../../lambda/payments-webhook.mjs';

// Qonto's official published test vector (docs.qonto.com/api-reference/
// business-api/webhooks/setup.md, verified July 2026):
//   Payload received: {"test":"data"}
//   X-Qonto-Signature header: t=1704110400,v1=56aff06dc227db80d6568a5070f912c601c31f20451745d257cbc0b5dfa93805
//   Secret: test-secret
const VECTOR_BODY = '{"test":"data"}';
const VECTOR_SECRET = 'test-secret';
const VECTOR_HEADER = 't=1704110400,v1=56aff06dc227db80d6568a5070f912c601c31f20451745d257cbc0b5dfa93805';
const VECTOR_TIME_MS = 1704110400 * 1000;

test('official Qonto test vector verifies (checked at its own timestamp)', () => {
  assert.equal(verifySignature(VECTOR_BODY, VECTOR_HEADER, VECTOR_SECRET, { now: VECTOR_TIME_MS }), true);
});

test('parseSignatureHeader extracts timestamp and signature', () => {
  assert.deepEqual(parseSignatureHeader(VECTOR_HEADER), {
    timestamp: '1704110400',
    signature: '56aff06dc227db80d6568a5070f912c601c31f20451745d257cbc0b5dfa93805',
  });
});

test('malformed header shapes are rejected', () => {
  for (const bad of [undefined, null, '', 'not-the-right-shape', 'v1=abc', 't=123', 't=abc,v1=xyz']) {
    assert.equal(parseSignatureHeader(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('a body tampered with after signing is rejected', () => {
  const tamperedBody = '{"test":"tampered"}';
  assert.equal(verifySignature(tamperedBody, VECTOR_HEADER, VECTOR_SECRET, { now: VECTOR_TIME_MS }), false);
});

test('wrong secret is rejected', () => {
  assert.equal(verifySignature(VECTOR_BODY, VECTOR_HEADER, 'a-different-secret', { now: VECTOR_TIME_MS }), false);
});

test('a signature computed without the timestamp prefix (old, wrong scheme) is rejected', () => {
  const wrongSchemeSignature = createHmac('sha256', VECTOR_SECRET).update(VECTOR_BODY, 'utf8').digest('hex');
  const header = `t=1704110400,v1=${wrongSchemeSignature}`;
  assert.equal(verifySignature(VECTOR_BODY, header, VECTOR_SECRET, { now: VECTOR_TIME_MS }), false);
});

test('a stale timestamp (outside the replay window) is rejected even with a valid signature', () => {
  // Verifying "now" far away from the vector's own timestamp — a real replay
  // of a captured delivery, long after it was sent.
  const now = VECTOR_TIME_MS + 10 * 60 * 1000; // 10 minutes later
  assert.equal(verifySignature(VECTOR_BODY, VECTOR_HEADER, VECTOR_SECRET, { now }), false);
});

test('a timestamp just inside the 5-minute window is accepted', () => {
  const now = VECTOR_TIME_MS + 4 * 60 * 1000;
  assert.equal(verifySignature(VECTOR_BODY, VECTOR_HEADER, VECTOR_SECRET, { now }), true);
});

test('missing or empty signature header is rejected', () => {
  assert.equal(verifySignature('{}', '', VECTOR_SECRET, { now: VECTOR_TIME_MS }), false);
  assert.equal(verifySignature('{}', undefined, VECTOR_SECRET, { now: VECTOR_TIME_MS }), false);
  assert.equal(verifySignature('{}', null, VECTOR_SECRET, { now: VECTOR_TIME_MS }), false);
});
