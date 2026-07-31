/**
 * Lambda handler for the Stripe webhook Function URL — the card-payment
 * counterpart to payments-webhook.mjs (Qonto, bank transfer).
 *
 * POST only, from Stripe (not the browser — no CORS/origin allowlist here).
 * Verifies the HMAC signature over the *exact raw body bytes*, filters for a
 * paid `checkout.session.completed` event, and async-invokes the fulfil
 * Lambda with only the session id — the webhook payload itself is never
 * trusted or forwarded; fulfil always re-fetches the session from Stripe as
 * the only trusted source.
 *
 * Hard rule (same as payments-webhook.mjs): this handler makes NO Stripe or
 * SES calls. The only work here is a signature check (secret cached after
 * cold start) and one async Lambda invoke.
 *
 * Signature verification: Stripe's `Stripe-Signature` header uses the same
 * shape as Qonto's `X-Qonto-Signature` — `t={timestamp},v1={signature}` over
 * `{timestamp}.{raw_body}`, HMAC-SHA256 — except Stripe may send more than
 * one `v1` value (e.g. during a signing-secret rotation). The shared
 * verifier in payments-shared.mjs accepts a match against any v1 value.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { jsonResponse, getSecret, verifySignature } from './payments-shared.mjs';

const ssm = new SSMClient({ region: 'eu-west-3' });
const lambda = new LambdaClient({ region: 'eu-west-3' });

const SIGNATURE_HEADER = 'stripe-signature';

async function getWebhookSecret() {
  return getSecret(ssm, '/futurion/payments/stripe-webhook-secret');
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
      console.error(JSON.stringify({ event: 'stripe_webhook_signature_invalid' }));
      return jsonResponse(401, { code: 'invalid_signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      // Signed but not valid JSON — nothing we can act on; ack so Stripe
      // doesn't retry a request that will never parse.
      return jsonResponse(200, { ok: true });
    }

    const object = payload?.data?.object ?? {};
    let fulfilPayload = null;

    if (payload?.type === 'checkout.session.completed' && object.payment_status === 'paid' && object.id) {
      fulfilPayload = { stripeSessionId: object.id };
    }

    if (!fulfilPayload) {
      // Either an event type we don't act on, or a session that completed
      // without being paid (e.g. a delayed-settlement method — not offered
      // here, but defensive) — we only act on paid sessions.
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

    console.log(JSON.stringify({ event: 'stripe_webhook_fulfil_invoked', ...fulfilPayload }));
    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error('Unhandled error in payments-stripe-webhook handler:', err);
    return jsonResponse(500, { code: 'server_error' });
  }
}
