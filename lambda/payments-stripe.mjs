/**
 * Stripe API client — the card-checkout path (tmp/payments.md §5.1/§5.3).
 *
 * Card data never touches our infrastructure: the customer pays on a
 * Stripe-hosted Checkout Session page. Native fetch, form-encoded bodies, no
 * new npm dependency — mirrors createQontoClient's shape in
 * payments-shared.mjs (10s timeout, JSON-in/error-mapped-out), but Stripe's
 * REST API takes `application/x-www-form-urlencoded` bodies with bracket
 * notation for nested fields (`line_items[0][price_data][currency]`), not
 * JSON.
 *
 * Only `card` is ever offered (payment_method_types: ['card']) — no Apple
 * Pay/PayPal/delayed-settlement methods, so there is exactly one Stripe event
 * to handle (checkout.session.completed) and no async_payment_succeeded/
 * failed pair to reconcile.
 */

const DEFAULT_BASE_URL = 'https://api.stripe.com';

export class StripeApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'StripeApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Flattens a nested object into Stripe's bracket-notation form fields, e.g.
 * `{ line_items: [{ price_data: { currency: 'eur' } }] }` ->
 * `line_items[0][price_data][currency]=eur`. Arrays use numeric indices;
 * plain values are URL-encoded as usual.
 */
export function formEncode(obj, prefix = '') {
  const params = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fieldKey = prefix ? `${prefix}[${key}]` : key;
    appendField(params, fieldKey, value);
  }
  return params.join('&');
}

function appendField(params, key, value) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => appendField(params, `${key}[${i}]`, item));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || v === null) continue;
      appendField(params, `${key}[${k}]`, v);
    }
  } else {
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
}

export function createStripeClient({ secretKey, baseUrl = DEFAULT_BASE_URL, timeoutMs = 10_000 }) {
  async function request(method, path, { body, idempotencyKey } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: body !== undefined ? formEncode(body) : undefined,
        signal: controller.signal,
      });

      const text = await res.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { raw: text };
      }

      if (!res.ok) {
        throw new StripeApiError(`Stripe API error ${res.status} on ${method} ${path}`, {
          status: res.status,
          body: json,
        });
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /**
     * Creates a card-only Checkout Session for one catalogue line item.
     * `orderRef` is both the idempotency key (a resubmitted form with the
     * same order ref must not create a second session) and the value Stripe
     * hands back unmodified as `client_reference_id` on every event, so
     * fulfilment can find/parse our order without trusting anything else in
     * the webhook payload.
     */
    createCheckoutSession({ orderRef, sku, entry, locale, email, clientId, successUrl, cancelUrl, grossCents }) {
      const productName = `${entry.name[locale]} — ${entry.offer[locale]}`;
      const vatNote = locale === 'es' ? 'IVA incluido' : 'VAT included';
      return request('POST', '/v1/checkout/sessions', {
        idempotencyKey: orderRef,
        body: {
          mode: 'payment',
          payment_method_types: ['card'],
          client_reference_id: orderRef,
          customer_email: email,
          locale: locale === 'es' ? 'es' : 'en',
          metadata: { sku, orderRef, locale, clientId },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'eur',
                unit_amount: grossCents,
                product_data: { name: `${productName} (${vatNote})` },
              },
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
      });
    },

    /** The only trusted source of truth for a session — never the webhook payload. */
    retrieveCheckoutSession(id) {
      return request('GET', `/v1/checkout/sessions/${encodeURIComponent(id)}`);
    },
  };
}
