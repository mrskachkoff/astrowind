import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { signToken, verifyToken } from '../../lambda/payments-shared.mjs';

// Generated fresh per test run rather than a hardcoded literal — this is a
// disposable test fixture, not a credential, but a random value keeps it
// from ever looking like one (and reads the same to a human either way).
const SECRET = randomBytes(32).toString('hex');

test('sign/verify round-trip recovers the exact payload', () => {
  const payload = { inv: 'inv_123', sku: 'trustprompt-business', exp: Date.now() + 60_000 };
  const token = signToken(payload, SECRET);
  const verified = verifyToken(token, SECRET);
  assert.deepEqual(verified, payload);
});

test('token has the documented base64url(payload).base64url(mac) shape', () => {
  const token = signToken({ a: 1 }, SECRET);
  const parts = token.split('.');
  assert.equal(parts.length, 2);
  assert.match(parts[0], /^[A-Za-z0-9_-]+$/);
  assert.match(parts[1], /^[A-Za-z0-9_-]+$/);
});

test('expired token is rejected', () => {
  const token = signToken({ inv: 'inv_1', exp: Date.now() - 1000 }, SECRET);
  assert.equal(verifyToken(token, SECRET), null);
});

test('token with no exp field never expires (caller opts in to expiry)', () => {
  const token = signToken({ inv: 'inv_1' }, SECRET);
  assert.deepEqual(verifyToken(token, SECRET), { inv: 'inv_1' });
});

test('tampered payload is rejected', () => {
  const token = signToken({ inv: 'inv_1', sku: 'trustprompt-business', exp: Date.now() + 60_000 }, SECRET);
  const [, mac] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ inv: 'inv_EVIL', sku: 'trustprompt-business' })).toString(
    'base64url'
  );
  assert.equal(verifyToken(`${tamperedPayload}.${mac}`, SECRET), null);
});

test('tampered mac is rejected', () => {
  const token = signToken({ inv: 'inv_1', exp: Date.now() + 60_000 }, SECRET);
  const [payloadB64] = token.split('.');
  assert.equal(verifyToken(`${payloadB64}.deadbeef`, SECRET), null);
});

test('wrong secret is rejected', () => {
  const token = signToken({ inv: 'inv_1', exp: Date.now() + 60_000 }, SECRET);
  assert.equal(verifyToken(token, 'a-completely-different-secret'), null);
});

test('malformed tokens are rejected without throwing', () => {
  for (const bad of ['', 'no-dot-here', 'a.b.c', null, undefined, 42, '.']) {
    assert.equal(verifyToken(bad, SECRET), null);
  }
});
