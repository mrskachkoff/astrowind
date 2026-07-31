import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifySignature, parseSignatureHeader } from '../../lambda/payments-shared.mjs';

// Stripe's Stripe-Signature header uses the same {t}.{raw_body} HMAC-SHA256
// scheme as Qonto's X-Qonto-Signature (covered by webhook-sig.test.mjs
// against Qonto's own published vector), but Stripe can send MORE THAN ONE
// v1 value on a single header — e.g. during a webhook signing-secret
// rotation, Stripe signs with both the old and new secret so deliveries
// verify against either one during the overlap window. A parser that only
// recognizes a single v1 value (the original Qonto-shaped implementation)
// rejects every real multi-scheme Stripe delivery. This is the regression
// this file exists to catch.

const SECRET = 'whsec_test_secret';
const BODY = '{"id":"evt_test","type":"checkout.session.completed"}';
const TIMESTAMP = '1700000000';
const NOW_MS = Number(TIMESTAMP) * 1000;

function sign(secret, timestamp = TIMESTAMP, body = BODY) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

test('a single-v1 Stripe-shaped header verifies (same scheme as Qonto)', () => {
  const header = `t=${TIMESTAMP},v1=${sign(SECRET)}`;
  assert.equal(verifySignature(BODY, header, SECRET, { now: NOW_MS }), true);
});

test('a multi-scheme header (v0 + v1, as Stripe sends) verifies against v1', () => {
  const v0 = 'deadbeef00112233'; // an unrelated scheme we never check
  const header = `t=${TIMESTAMP},v0=${v0},v1=${sign(SECRET)}`;
  assert.equal(verifySignature(BODY, header, SECRET, { now: NOW_MS }), true);
});

test('a rotating-secret header with TWO v1 values verifies if EITHER matches', () => {
  const oldSecretSig = sign('whsec_old_secret');
  const newSecretSig = sign(SECRET);
  const header = `t=${TIMESTAMP},v1=${oldSecretSig},v1=${newSecretSig}`;
  // Verifying with the new secret must accept the delivery even though the
  // first v1 value in the header doesn't match it.
  assert.equal(verifySignature(BODY, header, SECRET, { now: NOW_MS }), true);
});

test('a multi-v1 header where NONE match the secret is rejected', () => {
  const header = `t=${TIMESTAMP},v1=${sign('whsec_old_secret')},v1=${sign('whsec_another_old_secret')}`;
  assert.equal(verifySignature(BODY, header, SECRET, { now: NOW_MS }), false);
});

test('parseSignatureHeader collects every v1 value, ignoring v0', () => {
  const header = `t=${TIMESTAMP},v0=ignored,v1=aaa,v1=bbb`;
  assert.deepEqual(parseSignatureHeader(header), { timestamp: TIMESTAMP, signatures: ['aaa', 'bbb'] });
});

test('a body tampered with after signing is rejected even with multiple v1 values', () => {
  const header = `t=${TIMESTAMP},v1=${sign('whsec_old_secret')},v1=${sign(SECRET)}`;
  const tamperedBody = '{"id":"evt_test","type":"checkout.session.completed","amount":999999}';
  assert.equal(verifySignature(tamperedBody, header, SECRET, { now: NOW_MS }), false);
});

test('a stale timestamp is rejected regardless of how many v1 values are present', () => {
  const header = `t=${TIMESTAMP},v1=${sign('whsec_old_secret')},v1=${sign(SECRET)}`;
  const now = NOW_MS + 10 * 60 * 1000; // 10 minutes later, outside the 5-minute window
  assert.equal(verifySignature(BODY, header, SECRET, { now }), false);
});

test('a header with no v1 value at all (only v0) is rejected', () => {
  const header = `t=${TIMESTAMP},v0=deadbeef`;
  assert.equal(verifySignature(BODY, header, SECRET, { now: NOW_MS }), false);
  assert.equal(parseSignatureHeader(header), null);
});
