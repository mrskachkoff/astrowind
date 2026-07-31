#!/usr/bin/env node
/**
 * One-off, owner-run script: performs the Qonto OAuth 2.0 authorization-code
 * flow once (human consent in a browser is unavoidable — there is no
 * client_credentials grant, docs.qonto.com/get-started/business-api/
 * authentication/oauth/oauth-flow.md, verified July 2026) and stores the
 * resulting tokens in SSM for lambda/payments-oauth.mjs to use and rotate.
 *
 * Run once per environment (sandbox first, then production). Prints nothing
 * secret to stdout except the one-time authorization URL and, briefly, a
 * summary once tokens are stored — the tokens themselves go straight to SSM.
 *
 * Usage:
 *   export QONTO_OAUTH_BASE_URL=https://oauth-sandbox.staging.qonto.co   # prod: https://oauth.qonto.com
 *   export QONTO_CLIENT_ID="<from the Qonto Developer Portal>"
 *   export QONTO_CLIENT_SECRET="<from the Qonto Developer Portal>"
 *   export QONTO_REDIRECT_URI="<the redirect_uri registered for this app>"
 *   export QONTO_STAGING_TOKEN="<from the Qonto Developer Portal>"        # sandbox only
 *   export SSM_REGION=eu-west-3                                          # optional, default eu-west-3
 *   node lambda/scripts/qonto-oauth-bootstrap.mjs
 *
 * The script prints a consent URL. Open it, approve the requested scopes,
 * then paste back the `code` query-string value from the redirect (valid for
 * only 10 minutes) when prompted.
 *
 * Scopes requested match everything the payment Lambdas call: offline_access
 * (required for a refresh token), client.read/write, client_invoices.read,
 * client_invoice.write (also covers POST .../mark_as_paid, used by the card
 * path once Stripe confirms payment), webhook, organization.read (used for
 * the one-off connectivity check). No payment_link.* scope — the Qonto
 * payment-link/Mollie card path has been replaced by Stripe.
 */

import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';

const oauthBaseUrl = process.env.QONTO_OAUTH_BASE_URL;
const clientId = process.env.QONTO_CLIENT_ID;
const clientSecret = process.env.QONTO_CLIENT_SECRET;
const redirectUri = process.env.QONTO_REDIRECT_URI;
const stagingToken = process.env.QONTO_STAGING_TOKEN;
const ssmRegion = process.env.SSM_REGION || 'eu-west-3';

if (!oauthBaseUrl || !clientId || !clientSecret || !redirectUri) {
  console.error(
    'Missing required env vars: QONTO_OAUTH_BASE_URL, QONTO_CLIENT_ID, QONTO_CLIENT_SECRET, QONTO_REDIRECT_URI'
  );
  process.exit(1);
}

const SCOPES = [
  'offline_access',
  'organization.read',
  'client.read',
  'client.write',
  'client_invoices.read',
  'client_invoice.write',
  'webhook',
].join(' ');

const state = randomBytes(16).toString('hex');

const authUrl = new URL(`${oauthBaseUrl}/oauth2/auth`);
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('scope', SCOPES);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('state', state);

console.log('Open this URL, sign in, and approve the requested access:\n');
console.log(authUrl.toString());
console.log(
  `\nYou will be redirected to ${redirectUri}?code=...&state=${state}\n` +
    'Verify the "state" value in the redirect matches the one printed above before continuing ' +
    '(a mismatch means this is not the response to the request you just made — do not proceed).'
);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question('\nPaste the "code" value from the redirect (10-minute TTL): ')).trim();
rl.close();

if (!code) {
  console.error('No code provided, aborting.');
  process.exit(1);
}

const form = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: clientId,
  client_secret: clientSecret,
  redirect_uri: redirectUri,
  code,
});

const res = await fetch(`${oauthBaseUrl}/oauth2/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    ...(stagingToken ? { 'X-Qonto-Staging-Token': stagingToken } : {}),
  },
  body: form.toString(),
});

const body = await res.json().catch(() => null);

if (!res.ok || !body?.access_token || !body?.refresh_token) {
  console.error(`Token exchange failed (HTTP ${res.status}). Response:`);
  console.error(JSON.stringify(body, null, 2));
  console.error(
    '\nCommon causes: the code already expired (10 min), the code was already used, or redirect_uri ' +
      'does not exactly match what is registered on the Developer Portal.'
  );
  process.exit(1);
}

if (!body.scope?.includes('offline_access')) {
  console.error('Response did not confirm the offline_access scope — no refresh_token guaranteed. Aborting.');
  process.exit(1);
}

const ssm = new SSMClient({ region: ssmRegion });

await ssm.send(
  new PutParameterCommand({
    Name: '/futurion/payments/oauth-client',
    Type: 'SecureString',
    Overwrite: true,
    Value: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })
);

await ssm.send(
  new PutParameterCommand({
    Name: '/futurion/payments/oauth-refresh-token',
    Type: 'SecureString',
    Overwrite: true,
    Value: body.refresh_token,
  })
);

await ssm.send(
  new PutParameterCommand({
    Name: '/futurion/payments/oauth-access-token',
    Type: 'SecureString',
    Overwrite: true,
    Value: JSON.stringify({
      access_token: body.access_token,
      expires_at: Date.now() + body.expires_in * 1000,
    }),
  })
);

console.log('\nStored client credentials, refresh token, and access token in SSM:');
console.log('  /futurion/payments/oauth-client');
console.log('  /futurion/payments/oauth-refresh-token');
console.log('  /futurion/payments/oauth-access-token');
console.log(`\nGranted scopes: ${body.scope}`);
console.log('Nothing secret was printed above this line. Do not paste this terminal output anywhere.');
