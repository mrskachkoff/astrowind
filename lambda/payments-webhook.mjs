/**
 * Lambda handler for the Qonto webhook Function URL (tmp/payments.md §5.2).
 *
 * POST only, from Qonto (not the browser — no CORS/origin allowlist here).
 * Verifies the HMAC signature over the *exact raw body bytes*, filters for a
 * paid `v1/client-invoices` event, and async-invokes the fulfil Lambda with
 * only the invoice id — the webhook payload itself is never trusted or
 * forwarded; fulfil always re-fetches the invoice from Qonto as the only
 * trusted source.
 *
 * This handler only ever sees the bank-transfer path now. Card payments went
 * through Qonto's payment-link/Mollie connection, which has been removed —
 * card checkout is Stripe (lambda/payments-stripe-webhook.mjs).
 *
 * Hard rule: this handler makes NO Qonto or SES calls. Qonto's delivery
 * budget is ~1 second; the only work here is a signature check (after the
 * first cold start, the secret is cached) and one async Lambda invoke.
 *
 * Signature verification (docs.qonto.com/api-reference/business-api/
 * webhooks/setup.md, verified July 2026): header
 * `X-Qonto-Signature: t={timestamp},v1={signature}`; the signed payload is
 * `{timestamp}.{raw_body}`, HMAC-SHA256 with the subscription secret. This
 * is doc-verified, not inferred — confirmed against the docs' own published
 * test vector (payload `{"test":"data"}`, secret `test-secret`). The verifier
 * itself lives in payments-shared.mjs, shared with the Stripe webhook — both
 * providers sign `{t}.{raw_body}` the same way.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { jsonResponse, getSecret, parseOrderRef, verifySignature } from './payments-shared.mjs';

const ssm = new SSMClient({ region: 'eu-west-3' });
const lambda = new LambdaClient({ region: 'eu-west-3' });

const SIGNATURE_HEADER = 'x-qonto-signature';

async function getWebhookSecret() {
  return getSecret(ssm, '/futurion/payments/webhook-secret');
}

export async function handler(event) {
  try {
    if (event.requestContext?.http?.method !== 'POST') {
      return jsonResponse(405, { code: 'method_not_allowed' });
    }

    // Exact raw bytes as delivered, BEFORE any JSON parsing — the signature
    // is computed over these bytes, not over a re-serialized object.
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'utf8');

    const signatureHeader = event.headers?.[SIGNATURE_HEADER];
    const secret = await getWebhookSecret();

    if (!verifySignature(rawBody, signatureHeader, secret)) {
      // Log the category only — never the signature or body.
      console.error(JSON.stringify({ event: 'webhook_signature_invalid' }));
      return jsonResponse(401, { code: 'invalid_signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      // Signed but not valid JSON — nothing we can act on; ack so Qonto
      // doesn't retry a request that will never parse.
      return jsonResponse(200, { ok: true });
    }

    const data = payload?.data ?? {};
    let fulfilPayload = null;

    if (payload?.type === 'v1/client-invoices') {
      // The bank-transfer path — the only path this webhook handles now.
      const parsed = parseOrderRef(data.purchase_order);
      if (parsed && data.status === 'paid') {
        fulfilPayload = { invoiceId: data.id };
      }
    }

    if (!fulfilPayload) {
      // Either not one of our orders (Futurion also invoices manually via
      // Qonto), an event type we don't act on, or a non-paid transition
      // (draft/created/updated noise) — we only act on paid transitions.
      return jsonResponse(200, { ok: true });
    }

    try {
      await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.FULFIL_FUNCTION_NAME,
          InvocationType: 'Event',
          Payload: Buffer.from(JSON.stringify(fulfilPayload)),
        })
      );
    } catch (err) {
      console.error('Failed to async-invoke fulfil Lambda:', err);
      return jsonResponse(500, { code: 'server_error' });
    }

    console.log(JSON.stringify({ event: 'webhook_fulfil_invoked', ...fulfilPayload }));
    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('Unhandled error in payments-webhook handler:', err);
    return jsonResponse(500, { code: 'server_error' });
  }
}
