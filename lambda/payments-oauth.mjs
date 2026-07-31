/**
 * OAuth 2.0 access-token management for the payment Lambdas
 * (tmp/payments.md §3 — Token architecture).
 *
 * Qonto's Business API key auth does NOT cover the endpoint this feature
 * depends on — POST /v2/webhook_subscriptions (registering the fulfilment
 * webhook) is OAuth-only (docs.qonto.com/get-started/business-api/
 * authentication/introduction.md, verified July 2026). So all four payment
 * Lambdas use OAuth exclusively rather than mixing it with the API key.
 *
 * Storage (SSM SecureStrings, eu-west-3, matching the existing
 * /futurion/payments/* convention):
 *   /futurion/payments/oauth-client         {"client_id","client_secret"}  (read-only here)
 *   /futurion/payments/oauth-refresh-token  the current refresh token       (read + write)
 *   /futurion/payments/oauth-access-token   {"access_token","expires_at"}   (read + write)
 * Populated once per environment by lambda/scripts/qonto-oauth-bootstrap.mjs.
 *
 * Token lifetimes (docs.qonto.com/get-started/business-api/authentication/
 * oauth/oauth-flow.md, verified July 2026): access_token 1 hour, refresh_token
 * 90 days and ONE-TIME USE — each refresh returns a new refresh_token that
 * must be stored before the old one can be used again — with a documented
 * 60-second grace period after first use, which covers the common
 * concurrent-refresh race between two warm Lambda instances.
 */

import { GetParameterCommand, PutParameterCommand } from '@aws-sdk/client-ssm';

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh proactively with 5 min of life left
const CLIENT_PARAM = '/futurion/payments/oauth-client';
const REFRESH_TOKEN_PARAM = '/futurion/payments/oauth-refresh-token';
const ACCESS_TOKEN_PARAM = '/futurion/payments/oauth-access-token';

// Per-warm-instance cache — avoids an SSM round trip on every request within
// the same execution environment. Unlike payments-shared.mjs's getSecret()
// cache (which never changes for the life of the instance), this one is
// intentionally mutable: it gets overwritten every time this instance
// performs a refresh.
let cachedAccessToken = null; // { access_token, expires_at }

export class OAuthError extends Error {
  constructor(message, { code } = {}) {
    super(message);
    this.name = 'OAuthError';
    this.code = code;
  }
}

/** Exported for unit testing the expiry math without a network call. */
export function isFresh(token, marginMs = REFRESH_MARGIN_MS) {
  return (
    Boolean(token?.access_token) && typeof token.expires_at === 'number' && token.expires_at - Date.now() > marginMs
  );
}

async function readJsonParameter(ssm, name) {
  const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  try {
    return JSON.parse(out.Parameter.Value);
  } catch {
    throw new OAuthError(`SSM parameter ${name} is not valid JSON`, { code: 'oauth_config_invalid' });
  }
}

async function readStringParameter(ssm, name) {
  const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  return out.Parameter.Value;
}

async function writeSecureString(ssm, name, value) {
  await ssm.send(new PutParameterCommand({ Name: name, Value: value, Type: 'SecureString', Overwrite: true }));
}

/**
 * Parses a token-endpoint response body into the shape this module stores.
 * Exported as a pure function so the refresh-response handling is
 * unit-testable without a network call.
 */
export function parseTokenResponse(body, now = Date.now()) {
  if (!body || typeof body.access_token !== 'string' || typeof body.expires_in !== 'number') {
    return null;
  }
  return {
    access_token: body.access_token,
    expires_at: now + body.expires_in * 1000,
    refresh_token: typeof body.refresh_token === 'string' ? body.refresh_token : null,
  };
}

async function refreshAccessToken({ ssm, oauthBaseUrl, stagingToken }) {
  const [{ client_id, client_secret }, refreshToken] = await Promise.all([
    readJsonParameter(ssm, CLIENT_PARAM),
    readStringParameter(ssm, REFRESH_TOKEN_PARAM),
  ]);

  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id,
    client_secret,
    refresh_token: refreshToken,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let res;
  try {
    res = await fetch(`${oauthBaseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(stagingToken ? { 'X-Qonto-Staging-Token': stagingToken } : {}),
      },
      body: form.toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = null;
  }

  if (!res.ok) {
    // Never log the response body — some OAuth error payloads echo back
    // request parameters. Log the HTTP status and Qonto's `error` code only.
    throw new OAuthError(`Qonto token refresh failed with ${res.status}`, {
      code: body?.error === 'invalid_grant' ? 'oauth_refresh_conflict' : 'oauth_refresh_failed',
    });
  }

  const parsed = parseTokenResponse(body);
  if (!parsed) {
    throw new OAuthError('Qonto token refresh returned an unexpected response shape', {
      code: 'oauth_refresh_failed',
    });
  }

  // Store the new refresh token FIRST — losing it (vs. losing the access
  // token, which just costs one more refresh) is the only unrecoverable
  // failure, since refresh tokens are one-time use.
  if (parsed.refresh_token) {
    await writeSecureString(ssm, REFRESH_TOKEN_PARAM, parsed.refresh_token);
  }
  const accessTokenRecord = { access_token: parsed.access_token, expires_at: parsed.expires_at };
  await writeSecureString(ssm, ACCESS_TOKEN_PARAM, JSON.stringify(accessTokenRecord));

  cachedAccessToken = accessTokenRecord;
  return accessTokenRecord.access_token;
}

/**
 * Returns a valid access token, refreshing it if needed. Order of attempts:
 *   1. warm-instance in-memory cache
 *   2. the access token stored in SSM (another instance may have just
 *      refreshed it)
 *   3. perform a refresh
 * On `invalid_grant` (another instance rotated the refresh token between our
 * read and our POST, outside the documented 60s grace window) re-reads SSM
 * once more before giving up — the other instance's refresh should already
 * be visible by then. If it's still not fresh, throws with code
 * `oauth_refresh_conflict` for the caller to alert on.
 */
export async function getAccessToken(ssm, { oauthBaseUrl, stagingToken } = {}) {
  if (isFresh(cachedAccessToken)) return cachedAccessToken.access_token;

  try {
    const stored = await readJsonParameter(ssm, ACCESS_TOKEN_PARAM);
    if (isFresh(stored)) {
      cachedAccessToken = stored;
      return stored.access_token;
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'oauth_access_token_read_failed', message: err.message }));
  }

  try {
    return await refreshAccessToken({ ssm, oauthBaseUrl, stagingToken });
  } catch (err) {
    if (err instanceof OAuthError && err.code === 'oauth_refresh_conflict') {
      try {
        const stored = await readJsonParameter(ssm, ACCESS_TOKEN_PARAM);
        if (isFresh(stored, 0)) {
          cachedAccessToken = stored;
          return stored.access_token;
        }
      } catch {
        // fall through to the original error below
      }
    }
    throw err;
  }
}
