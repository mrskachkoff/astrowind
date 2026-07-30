#!/usr/bin/env node
/**
 * One-off, owner-run script: creates the Qonto webhook subscription for
 * `v1/client-invoices` events pointing at the deployed payments-webhook
 * Function URL, and prints the signing secret Qonto returns.
 *
 * This script has NEVER been run against the real Qonto API from this
 * machine (per tmp/payments.md, no live Qonto call is made by the
 * implementation work — only the owner, with real credentials, runs this).
 * The request path/body below is this plan's best-effort inference from
 * https://docs.qonto.com/api-reference/business-api/webhooks/setup.md;
 * confirm both against the current docs (or the Qonto dashboard's API
 * explorer) before relying on the result, and adjust this script if they
 * differ.
 *
 * Usage (run once per environment — sandbox first, then production):
 *   export QONTO_API_BASE_URL=https://thirdparty-sandbox.staging.qonto.co
 *   export QONTO_AUTH="<login>:<secret-key>"
 *   export WEBHOOK_TARGET_URL="https://<webhook-function-url>.lambda-url.eu-west-3.on.aws/"
 *   node lambda/scripts/setup-qonto-webhook.mjs
 *
 * The printed secret is NOT saved anywhere by this script — copy it
 * immediately into SSM yourself:
 *   aws ssm put-parameter --name /futurion/payments/webhook-secret \
 *     --type SecureString --value "<secret from output>" --region eu-west-3
 *
 * Never commit this script's output (terminal history, logs, a file) — the
 * secret only exists in the Qonto response and in SSM once you've stored it.
 */

import { createQontoClient } from '../payments-shared.mjs';

const baseUrl = process.env.QONTO_API_BASE_URL;
const authHeader = process.env.QONTO_AUTH;
const targetUrl = process.env.WEBHOOK_TARGET_URL;

if (!baseUrl || !authHeader || !targetUrl) {
  console.error('Missing required env vars: QONTO_API_BASE_URL, QONTO_AUTH, WEBHOOK_TARGET_URL');
  process.exit(1);
}

const qonto = createQontoClient({ baseUrl, authHeader });

console.log(`Creating a Qonto webhook subscription at ${baseUrl} -> ${targetUrl} ...`);

// Best-effort request shape — verify against docs/dashboard before trusting
// the result. If Qonto's actual endpoint/body differs, this call will fail
// with a clear 4xx from createQontoClient's QontoApiError rather than
// silently doing the wrong thing.
const response = await qonto.post('/v2/webhooks', {
  target_url: targetUrl,
  event_types: ['v1/client-invoices'],
});

console.log('Qonto response:');
console.log(JSON.stringify(response, null, 2));
console.log('');
console.log('If a signing secret is present above, store it now with:');
console.log('  aws ssm put-parameter --name /futurion/payments/webhook-secret \\');
console.log('    --type SecureString --value "<secret>" --region eu-west-3');
console.log('');
console.log('Do not paste the secret anywhere else (chat, ticket, commit message).');
