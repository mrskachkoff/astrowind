/**
 * Lambda handler for the Qonto checkout Function URL (tmp/payments.md §5.1).
 *
 * POST only. Validates the checkout form, finds-or-creates the customer as a
 * Qonto client, creates a Qonto client invoice, and returns its hosted
 * invoice_url for the browser to redirect to. No database: Qonto is the
 * system of record; the only local state is an in-memory per-IP rate limit
 * (resets on cold start, same accepted limitation as
 * lambda/trustprompt-download.mjs).
 *
 * IMPORTANT — not verified against a live Qonto account: the exact Qonto
 * request/response field names below (client search/create, invoice create,
 * unpaid-invoice filter) follow tmp/payments.md §5.1 and the Qonto docs
 * headings it cites. This machine has never called the Qonto API. Confirm
 * every field name against the sandbox during the tmp/payments.md §10
 * sandbox verification gate before any production traffic.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { SESClient } from '@aws-sdk/client-ses';
import {
  isAllowedOrigin,
  jsonResponse,
  sanitize,
  createRateLimiter,
  isTimestampValid,
  getSecret,
  sendEmail,
  CATALOGUE,
  vatCents,
  grossCents,
  mintOrderRef,
  parseOrderRef,
  isValidSpanishTaxId,
  normalizeSpanishTaxId,
  createQontoClient,
  centsToDecimalString,
} from './payments-shared.mjs';

const ssm = new SSMClient({ region: 'eu-west-3' });
const ses = new SESClient({ region: 'eu-west-3' });

const FROM_EMAIL = 'solutions@futurion.es';
const INTERNAL_EMAIL = process.env.INTERNAL_EMAIL || 'solutions@futurion.es';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_FIELD_LENGTH = 200;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUPLICATE_ORDER_WINDOW_MS = 30 * 60 * 1000;

// 5/hour per IP — same shape as trustprompt-download.mjs's checkRateLimit,
// but its own independent bucket (a bot hammering /checkout should not affect
// the download endpoint's budget, or vice versa).
const checkRateLimit = createRateLimiter({ maxRequests: 5, windowMs: 60 * 60 * 1000 });

const ALLOWED_TOP_LEVEL_FIELDS = new Set(['sku', 'locale', 'customer', 'termsAccepted', '_t', 'website']);
const ALLOWED_CUSTOMER_FIELDS = new Set(['companyName', 'taxId', 'contactName', 'email', 'billingAddress']);
const ALLOWED_ADDRESS_FIELDS = new Set(['line1', 'postalCode', 'city', 'province', 'country']);

function hasOnlyAllowedKeys(obj, allowed) {
  return (
    Boolean(obj) && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).every((k) => allowed.has(k))
  );
}

async function getQontoAuthHeader() {
  return getSecret(ssm, '/futurion/payments/qonto-auth');
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

    // --- Business logic: find/create Qonto client, then create an invoice ---

    const authHeader = await getQontoAuthHeader();
    const qonto = createQontoClient({ baseUrl: process.env.QONTO_API_BASE_URL, authHeader });

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
        const created = await qonto.post('/v2/clients', {
          name: companyName,
          tax_identification_number: taxId,
          email,
          locale,
          billing_address: { first_line: line1, zip_code: postalCode, city, province, country_code: 'ES' },
        });
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

    // Duplicate-order guard — best-effort, not transactional (tmp/payments.md
    // §11): worst case is two unpaid invoices, one paid, the other expiring
    // unpaid. A failed lookup here must not block checkout.
    try {
      const unpaid = await qonto.get(
        `/v2/client_invoices?filter[client_id]=${encodeURIComponent(clientId)}&filter[status]=unpaid`
      );
      const cutoff = Date.now() - DUPLICATE_ORDER_WINDOW_MS;
      const existing = (unpaid.client_invoices ?? []).find((inv) => {
        const parsed = parseOrderRef(inv.purchase_order);
        return parsed && parsed.sku === sku && new Date(inv.created_at).getTime() > cutoff;
      });
      if (existing) {
        console.log(JSON.stringify({ event: 'checkout_duplicate_reused', orderRef: existing.purchase_order, sku }));
        return jsonResponse(200, {
          orderRef: existing.purchase_order,
          invoiceUrl: existing.invoice_url,
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

    const orderRef = mintOrderRef(sku, locale);
    const today = new Date().toISOString().slice(0, 10);

    const invoiceBody = {
      client_id: clientId,
      currency: 'EUR',
      issue_date: today,
      due_date: today,
      purchase_order: orderRef,
      payment_methods: { iban: process.env.QONTO_BANK_IBAN },
      items: [
        {
          title: `${catalogueEntry.name[locale]} — ${catalogueEntry.offer[locale]}`,
          description: catalogueEntry.description[locale],
          quantity: 1,
          unit_price: { value: centsToDecimalString(catalogueEntry.netCents), currency: 'EUR' },
          vat_rate: '0.21',
        },
      ],
    };

    let created;
    try {
      const invoice = await qonto.post('/v2/client_invoices', invoiceBody);
      created = invoice.client_invoice ?? invoice;
    } catch (err) {
      // Timeout/5xx after a possible partial success on Qonto's side: retry
      // once via a list-by-purchase_order lookup before creating a genuine
      // duplicate invoice.
      console.error('Qonto invoice creation failed, checking for a partial success:', err);
      try {
        const retryLookup = await qonto.get(
          `/v2/client_invoices?filter[purchase_order]=${encodeURIComponent(orderRef)}`
        );
        created = (retryLookup.client_invoices ?? [])[0];
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
      })
    );

    return jsonResponse(200, {
      orderRef,
      invoiceUrl: created.invoice_url,
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
