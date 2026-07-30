/**
 * Lambda handler for the Qonto webhook Function URL (tmp/payments.md §5.2).
 *
 * POST only, from Qonto (not the browser — no CORS/origin allowlist here).
 * Verifies the HMAC signature over the *exact raw body bytes*, filters for a
 * paid `v1/client-invoices` event carrying one of our order refs, and
 * async-invokes the fulfil Lambda with only the invoice id — the webhook
 * payload itself is never trusted or forwarded; fulfil always re-fetches the
 * invoice from Qonto as the only trusted source.
 *
 * Hard rule: this handler makes NO Qonto or SES calls. Qonto's delivery
 * budget is ~1 second; the only work here is a signature check (after the
 * first cold start, the secret is cached) and one async Lambda invoke.
 *
 * NOT verified against a live Qonto webhook delivery: the signature header
 * name (SIGNATURE_HEADER below) is this plan's best inference from
 * https://docs.qonto.com/api-reference/business-api/webhooks/setup.md and
 * MUST be confirmed against an actual delivery during the tmp/payments.md
 * §10 sandbox verification gate.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { jsonResponse, getSecret, parseOrderRef } from './payments-shared.mjs';

const ssm = new SSMClient({ region: 'eu-west-3' });
const lambda = new LambdaClient({ region: 'eu-west-3' });

// TODO confirm exact header name against a real Qonto webhook delivery.
const SIGNATURE_HEADER = 'x-qonto-signature';

async function getWebhookSecret() {
  return getSecret(ssm, '/futurion/payments/webhook-secret');
}

function verifySignature(rawBody, signatureHeader, secret) {
  if (typeof signatureHeader !== 'string' || !signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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

    if (payload?.type !== 'v1/client-invoices') {
      return jsonResponse(200, { ok: true });
    }

    const data = payload.data ?? {};
    const parsed = parseOrderRef(data.purchase_order);

    if (!parsed || data.status !== 'paid') {
      // Either not one of our orders (Futurion also invoices manually via
      // Qonto), or a non-paid transition (draft/created/updated noise) —
      // we only act on paid transitions.
      return jsonResponse(200, { ok: true });
    }

    try {
      await lambda.send(
        new InvokeCommand({
          FunctionName: process.env.FULFIL_FUNCTION_NAME,
          InvocationType: 'Event',
          Payload: Buffer.from(JSON.stringify({ invoiceId: data.id })),
        })
      );
    } catch (err) {
      console.error('Failed to async-invoke fulfil Lambda:', err);
      return jsonResponse(500, { code: 'server_error' });
    }

    console.log(JSON.stringify({ event: 'webhook_fulfil_invoked', invoiceId: data.id }));
    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('Unhandled error in payments-webhook handler:', err);
    return jsonResponse(500, { code: 'server_error' });
  }
}
