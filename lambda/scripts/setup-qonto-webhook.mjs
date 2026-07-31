#!/usr/bin/env node
/**
 * One-off, owner-run script: creates the Qonto webhook subscription for
 * `v1/client-invoices` events (the bank-transfer path) pointing at the
 * deployed payments-webhook Function URL, and stores the signing secret in
 * SSM before the request is sent (never scraped out of this script's
 * stdout). The card path is Stripe now — its webhook subscription is created
 * directly in the Stripe Dashboard/CLI, not by this script.
 *
 * Run lambda/scripts/qonto-oauth-bootstrap.mjs first — this script reads the
 * OAuth tokens it stores, because `POST /v2/webhook_subscriptions` is
 * OAuth-only (docs.qonto.com/api-reference/business-api/webhooks/
 * create-a-webhook-subscription.md, verified July 2026); the API key does
 * not work here.
 *
 * Usage (run once per environment — sandbox first, then production):
 *   export QONTO_API_BASE_URL=https://thirdparty-sandbox.staging.qonto.co
 *   export QONTO_OAUTH_BASE_URL=https://oauth-sandbox.staging.qonto.co
 *   export QONTO_STAGING_TOKEN="<from the Qonto Developer Portal>"  # sandbox only — omit in production
 *   export WEBHOOK_TARGET_URL="https://<webhook-function-url>.lambda-url.eu-west-3.on.aws/"
 *   export SSM_REGION=eu-west-3  # optional, default eu-west-3
 *   node lambda/scripts/setup-qonto-webhook.mjs
 */

import { randomBytes } from 'node:crypto';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';
import { createQontoClient } from '../payments-shared.mjs';
import { getAccessToken } from '../payments-oauth.mjs';

const baseUrl = process.env.QONTO_API_BASE_URL;
const oauthBaseUrl = process.env.QONTO_OAUTH_BASE_URL;
const targetUrl = process.env.WEBHOOK_TARGET_URL;
const stagingToken = process.env.QONTO_STAGING_TOKEN;
const ssmRegion = process.env.SSM_REGION || 'eu-west-3';

if (!baseUrl || !oauthBaseUrl || !targetUrl) {
  console.error('Missing required env vars: QONTO_API_BASE_URL, QONTO_OAUTH_BASE_URL, WEBHOOK_TARGET_URL');
  process.exit(1);
}

const ssm = new SSMClient({ region: ssmRegion });

// Generate the webhook signing secret ourselves and store it before the
// request, rather than asking Qonto to generate one and having to copy it
// out of this script's stdout — the secret only ever exists in SSM.
const webhookSecret = randomBytes(36).toString('base64'); // 48 chars, within Qonto's 32-128 range
await ssm.send(
  new PutParameterCommand({
    Name: '/futurion/payments/webhook-secret',
    Type: 'SecureString',
    Overwrite: true,
    Value: webhookSecret,
  })
);
console.log('Stored a new webhook signing secret in SSM: /futurion/payments/webhook-secret');

const qonto = createQontoClient({
  baseUrl,
  getToken: () => getAccessToken(ssm, { oauthBaseUrl, stagingToken }),
  stagingToken,
});

console.log(`Creating a Qonto webhook subscription at ${baseUrl} -> ${targetUrl} ...`);

// POST /v2/webhook_subscriptions with callback_url/types/secret (verified
// against Qonto's OpenAPI, July 2026 — the previous version of this script
// posted to the non-existent /v2/webhooks with target_url/event_types,
// which 404s).
const response = await qonto.post('/v2/webhook_subscriptions', {
  callback_url: targetUrl,
  types: ['v1/client-invoices'],
  secret: webhookSecret,
  description: 'solutions.futurion.es checkout fulfilment (bank transfer)',
});

console.log('Qonto response:');
console.log(JSON.stringify(response, null, 2));
console.log('\nThe webhook subscription is active. The signing secret was already stored in SSM above.');
