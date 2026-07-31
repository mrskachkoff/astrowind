/**
 * Shared helpers for the four payment Lambdas (checkout, webhook, fulfil,
 * access). Nothing here talks to AWS clients directly except via SDK objects
 * passed in by the caller — this module has no module-scope AWS client
 * instances of its own, so it stays trivially unit-testable with `node --test`
 * (no AWS/network mocking needed, per tmp/payments.md §8).
 *
 * Patterns copied from lambda/trustprompt-download.mjs rather than reinvented:
 * SSM SecureString fetch with caching, in-memory per-IP rate limiting,
 * honeypot/timestamp anti-bot check, jsonResponse/sanitize, the
 * ALLOWED_ORIGINS CORS allowlist, and the HMAC-token shape used by
 * mintRenewToken/verifyRenewToken.
 */

import { GetParameterCommand } from '@aws-sdk/client-ssm';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { CATALOGUE, CODE_TO_SKU, VAT_RATE, vatCents, grossCents } from './payments-catalogue.mjs';

export { CATALOGUE, CODE_TO_SKU, VAT_RATE, vatCents, grossCents };

// Same 4 origins as trustprompt-download.mjs / contact-form.mjs, plus the
// astrowind app's own preview domain (solutions.futurion.es is served by the
// "astrowind" Amplify app, d28krvybaddvuy — a different app id than the one
// trustprompt-download.mjs's ALLOWED_ORIGINS names).
export const ALLOWED_ORIGINS = new Set([
  'https://solutions.futurion.es',
  'https://futurion.es',
  'https://www.futurion.es',
  'https://main.d28krvybaddvuy.amplifyapp.com',
]);

/** Mirrors the origin/referer gate at trustprompt-download.mjs:321-328. */
export function isAllowedOrigin(event, allowedOrigins = ALLOWED_ORIGINS) {
  const origin = event.headers?.origin || '';
  const referer = event.headers?.referer || '';
  if (origin) return allowedOrigins.has(origin);
  return [...allowedOrigins].some((o) => referer.startsWith(o));
}

// --- Generic response/sanitize helpers (byte-identical shape to the existing Lambdas) --

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function sanitize(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

// --- Rate limiting (in-memory, resets on cold start) ------------------------
// Factory, not a single module-scope Map, so each Lambda (checkout vs access)
// gets its own independent bucket instead of sharing one across handlers that
// happen to import this module.

export function createRateLimiter({ maxRequests, windowMs, maxTrackedIps = 5000 }) {
  const limits = new Map();
  return function checkRateLimit(ip) {
    const now = Date.now();

    if (limits.size > maxTrackedIps) {
      for (const [key, record] of limits) {
        if (now > record.resetAt) limits.delete(key);
      }
    }

    const record = limits.get(ip);
    if (!record || now > record.resetAt) {
      limits.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (record.count >= maxRequests) return false;
    record.count++;
    return true;
  };
}

// --- Timestamp verification (same window as trustprompt-download.mjs) ------

export const MIN_ELAPSED_MS = 3 * 1000;
export const MAX_ELAPSED_MS = 30 * 60 * 1000;

export function isTimestampValid(ts, { minElapsedMs = MIN_ELAPSED_MS, maxElapsedMs = MAX_ELAPSED_MS } = {}) {
  const elapsed = Date.now() - ts;
  return elapsed >= minElapsedMs && elapsed <= maxElapsedMs;
}

// --- SSM SecureString cache --------------------------------------------------
// Keyed by parameter name so all four Lambdas can share the module if they
// ever run in the same execution environment. Caches the in-flight promise
// (not just the resolved value) so two concurrent cold-start invocations
// requesting the same secret issue one GetParameter call, not two — a small
// improvement over trustprompt-download.mjs's plain "if falsy" guard.

const secretCache = new Map();

export async function getSecret(ssmClient, name) {
  if (!secretCache.has(name)) {
    secretCache.set(
      name,
      ssmClient.send(new GetParameterCommand({ Name: name, WithDecryption: true })).then((out) => out.Parameter.Value)
    );
  }
  return secretCache.get(name);
}

// --- SES send, with the same DRY_RUN_SES escape hatch -----------------------

export async function sendEmail(sesClient, { from, to, replyTo, subject, text, html }) {
  if (process.env.DRY_RUN_SES === '1') {
    console.log('DRY_RUN_SES=1, skipping SES send:', subject);
    return { dryRun: true };
  }

  const out = await sesClient.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: Array.isArray(to) ? to : [to] },
      ReplyToAddresses: replyTo ? [replyTo] : undefined,
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: html ? { Data: html, Charset: 'UTF-8' } : undefined,
        },
      },
    })
  );
  return { messageId: out.MessageId };
}

// --- Order reference: WEB-<CODE>-<LOCALE>-<random hex12> (tmp/payments.md §4) --
// 24 chars total, well under Qonto's 40-char purchase_order limit.

export const ORDER_REF_REGEX = /^WEB-([A-Z0-9]{4})-(EN|ES)-[a-f0-9]{12}$/;

export function mintOrderRef(sku, locale) {
  const entry = CATALOGUE[sku];
  if (!entry) throw new Error(`mintOrderRef: unknown SKU "${sku}"`);
  const localeUpper = String(locale).toUpperCase();
  if (localeUpper !== 'EN' && localeUpper !== 'ES') {
    throw new Error(`mintOrderRef: unknown locale "${locale}"`);
  }
  const random = randomBytes(6).toString('hex'); // 12 hex chars
  return `WEB-${entry.code}-${localeUpper}-${random}`;
}

/**
 * Parses an order ref back into { sku, code, locale, orderRef }, or returns
 * null if it doesn't match our shape or its code isn't in the catalogue.
 * Per §4: an invoice whose purchase_order doesn't match is not ours — ignore
 * it silently (Futurion also invoices manually via Qonto for other work).
 */
export function parseOrderRef(ref) {
  if (typeof ref !== 'string') return null;
  const match = ORDER_REF_REGEX.exec(ref);
  if (!match) return null;
  const [, code, localeUpper] = match;
  const sku = CODE_TO_SKU[code];
  if (!sku) return null;
  return { sku, code, locale: localeUpper.toLowerCase(), orderRef: ref };
}

// --- Stateless HMAC tokens ----------------------------------------------------
// base64url(JSON payload) . base64url(HMAC-SHA256(JSON payload, secret))
// Constant-time compare via timingSafeEqual. Used for both the entitlement
// token (payments-fulfil.mjs -> payments-access.mjs) and any other
// stateless-token need in this feature.

export function signToken(payload, secret) {
  const payloadJson = JSON.stringify(payload);
  const mac = createHmac('sha256', secret).update(payloadJson).digest('base64url');
  const payloadB64 = Buffer.from(payloadJson, 'utf8').toString('base64url');
  return `${payloadB64}.${mac}`;
}

/** Returns the decoded payload object, or null if invalid/tampered/expired. */
export function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const [payloadB64, mac] = token.split('.');
  if (!payloadB64 || !mac) return null;

  let payloadJson;
  try {
    payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expectedMac = createHmac('sha256', secret).update(payloadJson).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }

  if (typeof payload.exp === 'number' && Date.now() > payload.exp) return null;
  return payload;
}

// --- Spanish NIF / NIE / CIF checksum validation ------------------------------
// Standard published algorithm (letter-mod-23 for NIF/NIE; digit/letter
// control-character sum for CIF). Verified here against three independently
// known-valid identifiers: NIF 12345678Z, NIE X1234567L, CIF B65410011.

const NIF_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const NIF_RE = /^[0-9]{8}[A-Z]$/;
const NIE_RE = /^[XYZ][0-9]{7}[A-Z]$/;
const CIF_RE = /^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/;
const CIF_DIGIT_ONLY = new Set(['A', 'B', 'E', 'H']); // control char must be a digit
const CIF_LETTER_ONLY = new Set(['K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'W']); // must be a letter
// All other first letters (C, D, F, G, J, U, V) accept either.

export function normalizeSpanishTaxId(raw) {
  if (typeof raw !== 'string') return '';
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

function isValidNifOrNie(id) {
  if (NIF_RE.test(id)) {
    const number = parseInt(id.slice(0, 8), 10);
    return NIF_LETTERS[number % 23] === id[8];
  }
  if (NIE_RE.test(id)) {
    const prefixDigit = { X: '0', Y: '1', Z: '2' }[id[0]];
    const number = parseInt(prefixDigit + id.slice(1, 8), 10);
    return NIF_LETTERS[number % 23] === id[8];
  }
  return false;
}

function isValidCif(id) {
  const match = CIF_RE.exec(id);
  if (!match) return false;
  const [, letter, digits, control] = match;

  let evenSum = 0; // digits at 2nd/4th/6th position (index 1,3,5) — summed directly
  let oddSum = 0; // digits at 1st/3rd/5th/7th position (index 0,2,4,6) — doubled, digit-summed
  for (let i = 0; i < digits.length; i++) {
    const d = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = d * 2;
      oddSum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      evenSum += d;
    }
  }
  const total = evenSum + oddSum;
  const controlDigit = (10 - (total % 10)) % 10;
  const controlLetter = 'JABCDEFGHI'[controlDigit];

  if (CIF_DIGIT_ONLY.has(letter)) return control === String(controlDigit);
  if (CIF_LETTER_ONLY.has(letter)) return control === controlLetter;
  return control === String(controlDigit) || control === controlLetter;
}

/** Accepts a NIF, NIE, or CIF (any spacing/dashing); validates its checksum. */
export function isValidSpanishTaxId(raw) {
  const id = normalizeSpanishTaxId(raw);
  return isValidNifOrNie(id) || isValidCif(id);
}

// --- Webhook signature verification (shared shape: Qonto AND Stripe) --------
// Both providers sign `{timestamp}.{raw_body}` with HMAC-SHA256 and deliver it
// as `t={timestamp},v1={signature}[,v1={signature}...]`. Qonto's header always
// has exactly one v1 value; Stripe's can carry more than one (e.g. during a
// webhook signing-secret rotation, or an unrelated v0 scheme) — a parser that
// only recognizes a single v1 rejects every real Stripe delivery. This parser
// collects ALL v1 values and verification accepts a match against any of them.

export const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000; // reject stale/replayed deliveries

/**
 * Parses `t={timestamp},v1={sig}[,v1={sig}...][,v0={sig}...]` into
 * { timestamp, signatures: string[] } (only v1 values are collected — v0 is a
 * different, unrelated scheme neither provider asks us to check), or null if
 * the header is missing a timestamp or has no v1 value at all.
 */
export function parseSignatureHeader(header) {
  if (typeof header !== 'string') return null;

  let timestamp = null;
  const signatures = [];
  for (const part of header.trim().split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1') signatures.push(value);
  }

  if (!timestamp || !/^\d+$/.test(timestamp)) return null;
  if (signatures.length === 0 || !signatures.every((s) => /^[0-9a-f]+$/.test(s))) return null;
  return { timestamp, signatures };
}

export function verifySignature(
  rawBody,
  signatureHeader,
  secret,
  { now = Date.now(), maxAgeMs = MAX_SIGNATURE_AGE_MS } = {}
) {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const timestampMs = Number(parsed.timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > maxAgeMs) return false;

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuf = Buffer.from(expected);

  return parsed.signatures.some((sig) => {
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
}

// --- Client-invoice payload builder (shared by the transfer and card paths) --
// The bank-transfer path creates this invoice up front; the card path creates
// it only after Stripe confirms payment (payments-fulfil.mjs). Both must build
// an identical shape so they can never drift.

export function buildInvoicePayload({ clientId, entry, locale, orderRef, iban }) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    client_id: clientId,
    currency: 'EUR',
    issue_date: today,
    due_date: today,
    purchase_order: orderRef,
    ...(iban ? { payment_methods: { iban } } : {}),
    items: [
      {
        title: `${entry.name[locale]} — ${entry.offer[locale]}`,
        description: entry.description[locale],
        // Qonto's API rejects a numeric quantity: "json: cannot unmarshal
        // number into Go struct field InvoiceItem.items.quantity of type
        // string" (verified against a live 422 in sandbox, July 2026).
        quantity: '1',
        unit_price: { value: centsToDecimalString(entry.netCents), currency: 'EUR' },
        vat_rate: '0.21',
      },
    ],
  };
}

/**
 * Time-boxed lookup for an invoice by its EXACT purchase_order. There is no
 * server-side filter[purchase_order] or filter[client_id] on
 * GET /v2/client_invoices (verified against Qonto's OpenAPI, July 2026) — only
 * filter[status] and filter[created_at_from/to] — so the match happens in JS.
 * Used by: the checkout Lambda's post-creation-failure retry check (was a
 * possible partial success?), and the fulfil Lambda's card-path idempotency
 * guard (a replayed Stripe webhook must reuse the invoice, not create a
 * second one). NEVER take [0] of the unfiltered list — an unmatched result
 * must fall through to a fresh creation attempt.
 */
export async function findInvoiceByOrderRef(qonto, orderRef, windowMs) {
  const cutoffIso = new Date(Date.now() - windowMs).toISOString();
  const list = await qonto.get(
    `/v2/client_invoices?filter[created_at_from]=${encodeURIComponent(cutoffIso)}&per_page=100`
  );
  return (list.client_invoices ?? []).find((inv) => inv.purchase_order === orderRef) || null;
}

// --- Qonto client-creation payload builder -----------------------------------
// Pure function so the exact field names (a source of a real bug, D3: the
// original implementation sent kind-less payloads with first_line/province
// instead of the required kind/currency + street_address/province_code) are
// unit-testable without a network call. docs.qonto.com/api-reference/
// business-api/clients/create-a-client.md, verified July 2026: kind and
// currency are both required for a client to be usable for invoicing, and
// the billing_address sub-object field names are street_address, zip_code,
// city, province_code, country_code.
//
// province_code is NOT a generic "state/region" field — Qonto's own field
// description is "Province code of the client's billing address. It is
// required only for Italian organizations", max 2 chars, and Qonto validates
// that length regardless of the client's country. The original implementation
// sent the free-text Spanish province name (e.g. "Madrid") into it, which
// 422s on every single checkout: "Field validation for 'province_code'
// failed on the 'max' tag" (reproduced live against the Qonto sandbox, July
// 2026 — this was never caught because client-payload.test.mjs only asserted
// field NAMES, never called the live API). Since Spain-only checkout (§1) has
// no Qonto field for the region, `province` is accepted here but
// deliberately not forwarded to Qonto at all.

export function buildClientCreatePayload({ companyName, taxId, email, locale, line1, postalCode, city }) {
  return {
    kind: 'company',
    name: companyName,
    tax_identification_number: taxId,
    email,
    locale,
    currency: 'EUR',
    billing_address: {
      street_address: line1,
      zip_code: postalCode,
      city,
      country_code: 'ES',
    },
  };
}

// --- Decimal-string <-> integer-cents conversion ------------------------------
// Qonto serializes money as decimal strings ("3509.00"). Never use parseFloat
// on money — do the conversion with string/integer math only.

/** "3509.00" -> 350900. Returns null if the string isn't a plain decimal number. */
export function decimalStringToCents(str) {
  if (typeof str !== 'string') return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(str.trim());
  if (!match) return null;
  const [, sign, intPart, fracPartRaw] = match;
  const fracPart = (fracPartRaw ?? '').padEnd(2, '0');
  const cents = Number(intPart) * 100 + Number(fracPart);
  return sign === '-' ? -cents : cents;
}

/** 350900 -> "3509.00" */
export function centsToDecimalString(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const fracPart = String(abs % 100).padStart(2, '0');
  return `${sign}${intPart}.${fracPart}`;
}

/**
 * Qonto serializes money on invoice *responses* as an object
 * `{ value: "3509.00", currency: "EUR" }`, not a bare decimal string (only
 * request bodies use the bare-string form for `unit_price`). Returns null for
 * anything malformed or non-EUR — never silently coerces a foreign currency.
 */
export function amountToCents(amount) {
  if (!amount || typeof amount !== 'object' || Array.isArray(amount)) return null;
  if (amount.currency !== 'EUR') return null;
  return decimalStringToCents(amount.value);
}

// --- Qonto API client ----------------------------------------------------------
// Plain fetch, 10s timeout, JSON in/out. Auth is OAuth 2.0: `Authorization:
// Bearer <access_token>` (see payments-oauth.mjs for how the token is
// obtained/refreshed). Verified against Qonto docs, July 2026: the API-key
// scheme (`Authorization: <login>:<secret-key>`) does NOT cover the
// endpoint this feature depends on — POST /v2/webhook_subscriptions is
// OAuth-only — so OAuth is used everywhere for one consistent auth path,
// even on the endpoints that would also accept an API key (client/invoice
// reads and writes).
//
// Sandbox-only requirement (docs.qonto.com/get-started/general/sandbox-access,
// verified July 2026): every request to thirdparty-sandbox.staging.qonto.co
// must also carry `X-Qonto-Staging-Token`, a per-application credential from
// the Qonto Developer Portal that bypasses the OneLogin SSO gate in front of
// the whole sandbox environment. It is a no-op in production — Qonto does not
// even accept it there — so `stagingToken` is simply omitted for the
// production client (leave the QONTO_STAGING_TOKEN Lambda env var unset).

export class QontoApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = 'QontoApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * `getToken` is an async function returning the current access token (see
 * payments-oauth.mjs's getAccessToken) — a function, not a plain string, so
 * the client always uses a fresh/non-expired token on every request without
 * the caller having to re-create the client after each refresh.
 */
export function createQontoClient({ baseUrl, getToken, stagingToken, timeoutMs = 10_000 }) {
  async function request(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = await getToken();
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(stagingToken ? { 'X-Qonto-Staging-Token': stagingToken } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
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
        throw new QontoApiError(`Qonto API error ${res.status} on ${method} ${path}`, {
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
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
  };
}
