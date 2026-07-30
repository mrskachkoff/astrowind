import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTokenResponse, isFresh } from '../../lambda/payments-oauth.mjs';

// Pure-function tests only — no network, no AWS SDK. The token-endpoint HTTP
// call and SSM read/write live in getAccessToken/refreshAccessToken, which
// this module deliberately keeps thin wrappers around these two functions so
// the actual decision logic (is this token still good? did the response
// parse into something usable?) is testable without mocking fetch or SSM.

test('parseTokenResponse extracts access_token, computes expires_at from expires_in, and carries refresh_token', () => {
  const now = 1_700_000_000_000;
  const parsed = parseTokenResponse({ access_token: 'at_1', expires_in: 3600, refresh_token: 'rt_1' }, now);
  assert.deepEqual(parsed, { access_token: 'at_1', expires_at: now + 3600 * 1000, refresh_token: 'rt_1' });
});

test('parseTokenResponse tolerates a response with no refresh_token (a plain access-token-only reply)', () => {
  const now = 1_700_000_000_000;
  const parsed = parseTokenResponse({ access_token: 'at_1', expires_in: 3600 }, now);
  assert.deepEqual(parsed, { access_token: 'at_1', expires_at: now + 3600 * 1000, refresh_token: null });
});

test('parseTokenResponse rejects malformed or incomplete responses instead of returning a half-built record', () => {
  for (const bad of [
    null,
    undefined,
    {},
    { access_token: 'at_1' }, // missing expires_in
    { expires_in: 3600 }, // missing access_token
    { access_token: 123, expires_in: 3600 }, // wrong type
    { access_token: 'at_1', expires_in: '3600' }, // wrong type
  ]) {
    assert.equal(parseTokenResponse(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

// isFresh compares expires_at against the real Date.now() (it takes no `now`
// parameter — the module's own getAccessToken always wants the actual
// current time), so these tests build expires_at relative to Date.now()
// rather than a fixed timestamp.

test('isFresh: a token with well over the 5-minute margin left is fresh', () => {
  const token = { access_token: 'at_1', expires_at: Date.now() + 30 * 60 * 1000 };
  assert.equal(isFresh(token, 5 * 60 * 1000), true);
});

test('isFresh: a token expiring inside the margin is NOT fresh (must be refreshed proactively)', () => {
  const token = { access_token: 'at_1', expires_at: Date.now() + 60 * 1000 }; // 1 min left, margin is 5 min
  assert.equal(isFresh(token, 5 * 60 * 1000), false);
});

test('isFresh: an already-expired token is never fresh', () => {
  const now = Date.now();
  const token = { access_token: 'at_1', expires_at: now - 1000 };
  assert.equal(isFresh(token), false);
});

test('isFresh: null/undefined/malformed tokens are never fresh', () => {
  for (const bad of [null, undefined, {}, { access_token: 'at_1' }, { expires_at: Date.now() + 999999 }]) {
    assert.equal(isFresh(bad), false, `expected false for ${JSON.stringify(bad)}`);
  }
});

test('isFresh: a zero margin still requires expires_at to be strictly in the future', () => {
  const now = Date.now();
  assert.equal(isFresh({ access_token: 'at_1', expires_at: now + 1000 }, 0), true);
  assert.equal(isFresh({ access_token: 'at_1', expires_at: now - 1000 }, 0), false);
});
