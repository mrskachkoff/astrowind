/**
 * Lambda handler for the checkout Function URL (tmp/payments.md §5.1).
 *
 * POST only. Validates the checkout form, finds-or-creates the customer as a
 * Qonto client, then branches on the customer's own choice of
 * `paymentMethod`:
 *
 *   - 'transfer': creates a Qonto client invoice now and returns its hosted
 *     `invoice_url` (bank transfer). Unchanged from the original design.
 *   - 'card': creates NO Qonto invoice yet — goes straight to a Stripe
 *     Checkout Session and returns its hosted `url`. The Qonto invoice is
 *     created (and immediately marked paid) by payments-fulfil.mjs only
 *     after Stripe confirms payment, so an abandoned card checkout never
 *     burns an invoice number. See lambda/payments-stripe.mjs.
 *
 * There is no silent fallback between the two anymore: the customer chose,
 * and a provider failure on their chosen method is a hard error with an
 * internal alert, not a downgrade to the other method.
 *
 * No database: Qonto is the system of record for the transfer path, Stripe
 * (until fulfilled into a Qonto invoice) for the card path; the only local
 * state is an in-memory per-IP rate limit (resets on cold start, same
 * accepted limitation as lambda/trustprompt-download.mjs).
 *
 * Qonto auth is OAuth 2.0 (lambda/payments-oauth.mjs) — required because
 * POST /v2/webhook_subscriptions is OAuth-only (the bank-transfer webhook
 * this checkout ultimately depends on). Stripe auth is a static secret key.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { SESClient } from '@aws-sdk/client-ses';
import {
  isAllowedOrigin,
  jsonResponse,
  sanitize,
  createRateLimiter,
  isTimestampValid,
  sendEmail,
  getSecret,
  CATALOGUE,
  vatCents,
  grossCents,
  mintOrderRef,
  parseOrderRef,
  isValidSpanishTaxId,
  normalizeSpanishTaxId,
  createQontoClient,
  buildClientCreatePayload,
  buildInvoicePayload,
  findInvoiceByOrderRef,
} from './payments-shared.mjs';
import { getAccessToken } from './payments-oauth.mjs';
import { createStripeClient } from './payments-stripe.mjs';

const ssm = new SSMClient({ region: 'eu-west-3' });
const ses = new SESClient({ region: 'eu-west-3' });

const FROM_EMAIL = 'solutions@futurion.es';
const INTERNAL_EMAIL = process.env.INTERNAL_EMAIL || 'solutions@futurion.es';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_FIELD_LENGTH = 200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_ORDER_WINDOW_MS = 30 * 60 * 1000;
const RETRY_LOOKUP_WINDOW_MS = 5 * 60 * 1000;

// 5/hour per IP — same shape as trustprompt-download.mjs's checkRateLimit,
// but its own independent bucket (a bot hammering /checkout should not affect
// the download endpoint's budget, or vice versa).
const checkRateLimit = createRateLimiter({ maxRequests: 5, windowMs: 60 * 60 * 1000 });

const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  'sku',
  'locale',
  'paymentMethod',
  'customer',
  'termsAccepted',
  '_t',
  'website',
]);
const ALLOWED_CUSTOMER_FIELDS = new Set(['companyName', 'taxId', 'contactName', 'email', 'billingAddress']);
const ALLOWED_ADDRESS_FIELDS = new Set(['line1', 'postalCode', 'city', 'province', 'country']);

function hasOnlyAllowedKeys(obj, allowed) {
  return (
    Boolean(obj) && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every((k) => allowed.has(k))
  );
}

function getQontoToken() {
  return getAccessToken(ssm, {
    oauthBaseUrl: process.env.QONTO_OAUTH_BASE_URL,
    stagingToken: process.env.QONTO_STAGING_TOKEN,
  });
}

async function getStripeSecretKey() {
  return getSecret(ssm, '/futurion/payments/stripe-secret-key');
}

function buildThankYouUrl(locale) {
  const base = process.env.CHECKOUT_SUCCESS_URL || 'https://solutions.futurion.es';
  const path = locale === 'es' ? '/es/pago/gracias/' : '/payment/thank-you/';
  return `${base}${path}?session_id={CHECKOUT_SESSION_ID}`;
}

function buildCancelUrl(locale, sku) {
  const base = process.env.CHECKOUT_CANCEL_URL || 'https://solutions.futurion.es';
  const path = locale === 'es' ? '/es/pago/' : '/checkout/';
  return `${base}${path}?sku=${encodeURIComponent(sku)}`;
}

async function sendInternalAlert(subject, text) {
  try {
    await sendEmail(ses, {
      from: FROM_EMAIL,
      to: INTERNAL_EMAIL,
      subject: `[Payments Alert] ${subject}`,
      text,
    });
  } catch (err) {
    // An alert-email failure must never block or crash the handler.
    console.error('Failed to send internal alert email:', err);
  }
}

export async function handler(event) {
  try {
    if (event.requestContext?.http?.method !== 'POST') {
      return jsonResponse(405, { code: 'method_not_allowed' });
    }

    if (!isAllowedOrigin(event)) {
      return jsonResponse(403, { code: 'forbidden' });
    }

    const ip = event.requestContext?.http?.sourceIp || 'unknown';

    const rawBody = event.body || '';
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return jsonResponse(400, { code: 'bad_request' });
    }

    let body;
    try {
      body = JSON.parse(rawBody || '{}');
    } catch {
      return jsonResponse(400, { code: 'bad_request' });
    }

    if (!hasOnlyAllowedKeys(body, ALLOWED_TOP_LEVEL_FIELDS)) {
      return jsonResponse(400, { code: 'bad_request' });
    }
    if (body.customer !== undefined && !hasOnlyAllowedKeys(body.customer, ALLOWED_CUSTOMER_FIELDS)) {
      return jsonResponse(400, { code: 'bad_request' });
    }
    if (
      body.customer?.billingAddress !== undefined &&
      !hasOnlyAllowedKeys(body.customer.billingAddress, ALLOWED_ADDRESS_FIELDS)
    ) {
      return jsonResponse(400, { code: 'bad_request' });
    }

    // --- Validation, in the exact order specified by tmp/payments.md §5.1 ---

    // Honeypot — bots fill the hidden "website" field. Fake success, no work done.
    if (body.website) {
      console.log('Honeypot triggered, ignoring checkout submission');
      return jsonResponse(200, { ok: true });
    }

    const ts = Number(body._t);
    if (!ts || !isTimestampValid(ts)) {
      return jsonResponse(403, { code: 'expired' });
    }

    if (!checkRateLimit(ip)) {
      return jsonResponse(429, { code: 'rate_limited' });
    }

    const sku = typeof body.sku === 'string' ? body.sku : '';
    const catalogueEntry = CATALOGUE[sku];
    if (!catalogueEntry) {
      return jsonResponse(400, { code: 'invalid_sku' });
    }

    const locale = body.locale === 'es' ? 'es' : body.locale === 'en' ? 'en' : null;
    if (!locale) {
      return jsonResponse(400, { code: 'invalid_locale' });
    }

    const paymentMethod =
      body.paymentMethod === 'card' ? 'card' : body.paymentMethod === 'transfer' ? 'transfer' : null;
    if (!paymentMethod) {
      return jsonResponse(400, { code: 'invalid_payment_method' });
    }

    const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
    const billingAddress =
      customer.billingAddress && typeof customer.billingAddress === 'object' ? customer.billingAddress : {};

    if (billingAddress.country !== 'ES') {
      return jsonResponse(400, { code: 'invalid_country' });
    }

    const taxId = normalizeSpanishTaxId(customer.taxId);
    if (!isValidSpanishTaxId(taxId)) {
      return jsonResponse(400, { code: 'invalid_tax_id' });
    }

    const email = sanitize(customer.email, 254);
    if (!email || !EMAIL_REGEX.test(email)) {
      return jsonResponse(400, { code: 'invalid_email' });
    }

    const companyName = sanitize(customer.companyName, MAX_FIELD_LENGTH);
    const contactName = sanitize(customer.contactName, MAX_FIELD_LENGTH);
    const line1 = sanitize(billingAddress.line1, MAX_FIELD_LENGTH);
    const postalCode = sanitize(billingAddress.postalCode, MAX_FIELD_LENGTH);
    const city = sanitize(billingAddress.city, MAX_FIELD_LENGTH);
    const province = sanitize(billingAddress.province, MAX_FIELD_LENGTH);

    if (!companyName || !contactName || !line1 || !postalCode || !city || !province) {
      return jsonResponse(400, { code: 'invalid_fields' });
    }

    if (body.termsAccepted !== true) {
      return jsonResponse(400, { code: 'terms_required' });
    }

    // --- Business logic: find/create Qonto client (both payment methods need
    // a Qonto client — the card path passes its id through to Stripe metadata
    // so fulfil can create the invoice against it once payment is proven) ---

    const qonto = createQontoClient({
      baseUrl: process.env.QONTO_API_BASE_URL,
      getToken: getQontoToken,
      stagingToken: process.env.QONTO_STAGING_TOKEN,
    });

    let clientId;
    try {
      const search = await qonto.get(`/v2/clients?filter[tax_identification_number]=${encodeURIComponent(taxId)}`);
      const matches = search.clients ?? [];

      if (matches.length > 1) {
        // Never overwrite or guess — an anonymous checkout must not touch an
        // ambiguous existing customer record.
        await sendInternalAlert(
          'Manual review: duplicate Qonto clients',
          `Tax ID ${taxId} matches ${matches.length} Qonto clients. No invoice was created.\n` +
            `Client IDs: ${matches.map((c) => c.id).join(', ')}`
        );
        return jsonResponse(503, { code: 'manual_review' });
      }

      if (matches.length === 1) {
        clientId = matches[0].id;
      } else {
        const created = await qonto.post(
          '/v2/clients',
          buildClientCreatePayload({ companyName, taxId, email, locale, line1, postalCode, city })
        );
        clientId = created.client?.id ?? created.id;
      }
    } catch (err) {
      console.error('Qonto client lookup/create failed:', err);
      return jsonResponse(502, { code: 'server_error' });
    }

    if (!clientId) {
      console.error('Qonto client id missing after lookup/create');
      return jsonResponse(502, { code: 'server_error' });
    }

    const orderRef = mintOrderRef(sku, locale);

    // --- Card path: Stripe Checkout Session, no Qonto invoice yet ----------

    if (paymentMethod === 'card') {
      const stripe = createStripeClient({ secretKey: await getStripeSecretKey() });
      let session;
      try {
        session = await stripe.createCheckoutSession({
          orderRef,
          sku,
          entry: catalogueEntry,
          locale,
          email,
          clientId,
          successUrl: buildThankYouUrl(locale),
          cancelUrl: buildCancelUrl(locale, sku),
          grossCents: grossCents(catalogueEntry.netCents),
        });
      } catch (err) {
        console.error('Stripe checkout session creation failed:', err);
        await sendInternalAlert(
          'Stripe checkout session creation failed',
          `Order ${orderRef} (client ${clientId}, SKU ${sku}) could not create a Stripe session. Customer saw an error.`
        );
        return jsonResponse(502, { code: 'server_error' });
      }

      if (!session?.url) {
        console.error('Stripe session created without a url:', session?.id);
        await sendInternalAlert(
          'Stripe checkout session missing url',
          `Order ${orderRef} — session ${session?.id ?? 'unknown'} was created but has no url.`
        );
        return jsonResponse(502, { code: 'server_error' });
      }

      console.log(
        JSON.stringify({
          event: 'checkout_created',
          orderRef,
          clientId,
          sku,
          paymentMethod: 'card',
          stripeSessionId: session.id,
        })
      );

      return jsonResponse(200, {
        orderRef,
        paymentUrl: session.url,
        invoiceUrl: null,
        paymentMethod: 'card',
        product: catalogueEntry.product,
        offer: catalogueEntry.offer[locale],
        netCents: catalogueEntry.netCents,
        vatCents: vatCents(catalogueEntry.netCents),
        grossCents: grossCents(catalogueEntry.netCents),
        currency: 'EUR',
      });
    }

    // --- Transfer path: create the Qonto invoice now, as before ------------

    // Duplicate-order guard — best-effort, not transactional (tmp/payments.md
    // §11): worst case is two unpaid invoices, one paid, the other expiring
    // unpaid. A failed lookup here must not block checkout.
    //
    // GET /v2/client_invoices supports ONLY filter[status] and
    // filter[created_at_from/to] (plus due_date/updated_at/paging) — there is
    // no filter[client_id] and no filter[purchase_order] (verified against
    // Qonto's OpenAPI, July 2026). So the query narrows by status+time only,
    // and the client id / order ref / SKU match happens in JS.
    try {
      const cutoffIso = new Date(Date.now() - DUPLICATE_ORDER_WINDOW_MS).toISOString();
      const unpaid = await qonto.get(
        `/v2/client_invoices?filter[status]=unpaid&filter[created_at_from]=${encodeURIComponent(cutoffIso)}&per_page=100`
      );
      const existing = (unpaid.client_invoices ?? []).find((inv) => {
        const parsed = parseOrderRef(inv.purchase_order);
        return parsed && parsed.sku === sku && inv.client?.id === clientId;
      });
      if (existing) {
        console.log(JSON.stringify({ event: 'checkout_duplicate_reused', orderRef: existing.purchase_order, sku }));
        return jsonResponse(200, {
          orderRef: existing.purchase_order,
          paymentUrl: existing.invoice_url,
          invoiceUrl: existing.invoice_url,
          paymentMethod: 'transfer',
          product: catalogueEntry.product,
          offer: catalogueEntry.offer[locale],
          netCents: catalogueEntry.netCents,
          vatCents: vatCents(catalogueEntry.netCents),
          grossCents: grossCents(catalogueEntry.netCents),
          currency: 'EUR',
        });
      }
    } catch (err) {
      console.error('Duplicate-order lookup failed, proceeding to create a new invoice:', err);
    }

    const invoiceBody = buildInvoicePayload({
      clientId,
      entry: catalogueEntry,
      locale,
      orderRef,
      iban: process.env.QONTO_BANK_IBAN,
    });

    let created;
    try {
      const invoice = await qonto.post('/v2/client_invoices', invoiceBody);
      created = invoice.client_invoice ?? invoice;
    } catch (err) {
      // Timeout/5xx after a possible partial success on Qonto's side: retry
      // once via a recent-invoices lookup, matched on the exact purchase_order
      // in JS (there is no server-side filter for it) before creating a
      // genuine duplicate invoice. NEVER take [0] of an unfiltered list — an
      // unmatched result must fall through to a fresh creation attempt.
      console.error('Qonto invoice creation failed, checking for a partial success:', err);
      try {
        created = await findInvoiceByOrderRef(qonto, orderRef, RETRY_LOOKUP_WINDOW_MS);
        if (!created) return jsonResponse(502, { code: 'server_error' });
      } catch (retryErr) {
        console.error('Qonto invoice retry lookup failed:', retryErr);
        return jsonResponse(502, { code: 'server_error' });
      }
    }

    // Structured log — never log tax IDs, addresses, or the API key.
    console.log(
      JSON.stringify({
        event: 'checkout_created',
        orderRef,
        invoiceId: created.id,
        clientId,
        sku,
        paymentMethod: 'transfer',
      })
    );

    return jsonResponse(200, {
      orderRef,
      paymentUrl: created.invoice_url,
      invoiceUrl: created.invoice_url,
      paymentMethod: 'transfer',
      product: catalogueEntry.product,
      offer: catalogueEntry.offer[locale],
      netCents: catalogueEntry.netCents,
      vatCents: vatCents(catalogueEntry.netCents),
      grossCents: grossCents(catalogueEntry.netCents),
      currency: 'EUR',
    });
  } catch (err) {
    console.error('Unhandled error in payments-checkout handler:', err);
    return jsonResponse(500, { code: 'server_error' });
  }
}
