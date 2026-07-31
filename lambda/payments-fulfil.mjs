/**
 * Lambda handler for payment fulfilment (tmp/payments.md §5.3).
 *
 * Invoked asynchronously with `{ invoiceId }` (bank transfer, from
 * payments-webhook.mjs) or `{ stripeSessionId }` (card, from
 * payments-stripe-webhook.mjs) — never trusts the webhook payload.
 *
 * Transfer path: re-fetches the invoice from Qonto (the only trusted source)
 * and requires `status === 'paid'` there.
 *
 * Card path: re-fetches the Checkout Session from Stripe (the only trusted
 * source for that path) and requires `payment_status === 'paid'` with the
 * exact catalogue amount. Stripe's proof is independent of Qonto — the Qonto
 * invoice for a card sale does not exist yet at this point. This handler
 * creates it now (via the shared buildInvoicePayload) and immediately calls
 * `POST /v2/client_invoices/{id}/mark_as_paid`, so Qonto stays the single
 * invoice series and system of record for both payment methods. If
 * mark_as_paid itself fails, fulfilment still proceeds — Stripe already
 * proved payment, so withholding the customer's licence over a bookkeeping
 * call failing would be the wrong failure mode; an internal alert asks a
 * human to mark the invoice paid manually (tmp/payments.md §11).
 *
 * Either path then emails the customer their entitlement (licence) or
 * deposit confirmation, plus an internal sales notification. There is no
 * order database and no status endpoint: fulfilment arrives by email, so SES
 * failures are allowed to throw and let Lambda's async-invocation retry (2x)
 * try again — unlike trustprompt-download.mjs, which deliberately swallows
 * SES failures because the user did nothing wrong, here the only way the
 * customer ever gets their access link is this email.
 *
 * Duplicate webhook deliveries re-run all of this — the customer may get a
 * second, equally valid email. Accepted (tmp/payments.md §11). On the card
 * path, a duplicate delivery must not create a SECOND Qonto invoice for the
 * same order — findInvoiceByOrderRef (payments-shared.mjs) guards that.
 */

import { SSMClient } from '@aws-sdk/client-ssm';
import { SESClient } from '@aws-sdk/client-ses';
import {
  getSecret,
  sendEmail,
  CATALOGUE,
  grossCents,
  parseOrderRef,
  signToken,
  amountToCents,
  createQontoClient,
  buildInvoicePayload,
  findInvoiceByOrderRef,
} from './payments-shared.mjs';
import { getAccessToken } from './payments-oauth.mjs';
import { createStripeClient } from './payments-stripe.mjs';

const ssm = new SSMClient({ region: 'eu-west-3' });
const ses = new SESClient({ region: 'eu-west-3' });

const FROM_EMAIL = 'solutions@futurion.es';
const INTERNAL_EMAIL = process.env.INTERNAL_EMAIL || 'solutions@futurion.es';
const ENTITLEMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// How far back to look for an already-created invoice for this order ref
// before creating a new one — generous, since Stripe can retry a webhook
// delivery for up to several days.
const CARD_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

function getQontoToken() {
  return getAccessToken(ssm, {
    oauthBaseUrl: process.env.QONTO_OAUTH_BASE_URL,
    stagingToken: process.env.QONTO_STAGING_TOKEN,
  });
}

async function getEntitlementSecret() {
  return getSecret(ssm, '/futurion/payments/entitlement-secret');
}

async function getStripeSecretKey() {
  return getSecret(ssm, '/futurion/payments/stripe-secret-key');
}

async function sendInternalAlert(subject, text) {
  try {
    await sendEmail(ses, { from: FROM_EMAIL, to: INTERNAL_EMAIL, subject: `[Payments Alert] ${subject}`, text });
  } catch (err) {
    console.error('Failed to send internal alert email:', err);
  }
}

function buildAccessUrl(token, locale) {
  return locale === 'es'
    ? `https://solutions.futurion.es/es/pago/acceso/#token=${token}`
    : `https://solutions.futurion.es/payment/access/#token=${token}`;
}

function formatEuros(cents) {
  return `€${(cents / 100).toFixed(2)}`;
}

const COPY = {
  en: {
    licenceSubject: (product) => `Your ${product} purchase — access link inside`,
    licenceIntro: (offer, gross) => `Thank you for your purchase: ${offer}, ${gross} (VAT included).`,
    licenceBody: (url) => `Download and activate your licence here (this link is valid for 7 days):\n${url}`,
    depositSubject: (product) => `Your ${product} deposit is confirmed`,
    depositBody: (offer, gross) =>
      `We've received your deposit for ${offer}: ${gross} (VAT included). It will be credited against your ` +
      `final project invoice. We'll be in touch shortly to schedule the work.`,
    supportLine: 'Questions? Just reply to this email.',
  },
  es: {
    licenceSubject: (product) => `Su compra de ${product} — enlace de acceso incluido`,
    licenceIntro: (offer, gross) => `Gracias por su compra: ${offer}, ${gross} (IVA incluido).`,
    licenceBody: (url) => `Descargue y active su licencia aquí (este enlace es válido durante 7 días):\n${url}`,
    depositSubject: (product) => `Su depósito de ${product} está confirmado`,
    depositBody: (offer, gross) =>
      `Hemos recibido su depósito para ${offer}: ${gross} (IVA incluido). Se abonará en la factura final del ` +
      `proyecto. Nos pondremos en contacto en breve para programar el trabajo.`,
    supportLine: '¿Preguntas? Responda a este correo.',
  },
};

export async function handler(event) {
  const invoiceId = event?.invoiceId;
  const stripeSessionId = event?.stripeSessionId;
  if (!invoiceId && !stripeSessionId) {
    console.error('payments-fulfil invoked without an invoiceId or stripeSessionId');
    return;
  }

  const qonto = createQontoClient({
    baseUrl: process.env.QONTO_API_BASE_URL,
    getToken: getQontoToken,
    stagingToken: process.env.QONTO_STAGING_TOKEN,
  });

  let invoice;
  let parsed;
  let entry;
  let expectedGross;
  let stripeCustomerEmail = null;

  if (stripeSessionId) {
    // --- Card path: Stripe is the payment proof; the Qonto invoice is
    // created (and marked paid) here, not before. ---
    const stripe = createStripeClient({
      secretKey: await getStripeSecretKey(),
      baseUrl: process.env.STRIPE_API_BASE_URL,
    });

    let session;
    try {
      session = await stripe.retrieveCheckoutSession(stripeSessionId);
    } catch (err) {
      console.error('Failed to re-fetch Stripe session:', err);
      throw err; // transient Stripe outage — let the async-invocation retry handle it
    }

    stripeCustomerEmail = session.customer_details?.email || session.customer_email || null;
    parsed = parseOrderRef(session.client_reference_id);
    entry = parsed ? CATALOGUE[parsed.sku] : null;
    expectedGross = entry ? grossCents(entry.netCents) : null;

    const paid = session.payment_status === 'paid';
    const amountOk = expectedGross !== null && session.amount_total === expectedGross;

    if (!paid || session.currency !== 'eur' || !parsed || !entry) {
      console.log(
        JSON.stringify({
          event: 'fulfil_skipped',
          stripeSessionId,
          paymentStatus: session.payment_status,
          currency: session.currency,
          hasOrderRef: Boolean(parsed),
        })
      );
      return;
    }

    if (!amountOk) {
      console.error(
        JSON.stringify({
          event: 'fulfil_amount_mismatch',
          stripeSessionId,
          expectedGross,
          actualGross: session.amount_total,
        })
      );
      await sendInternalAlert(
        'Amount mismatch — fulfilment stopped',
        `Stripe session ${stripeSessionId} (order ${parsed.orderRef}) is paid but amount_total ` +
          `${session.amount_total} does not match the expected gross of ${expectedGross} cents for SKU ` +
          `${parsed.sku}. No Qonto invoice was created and no entitlement was issued.`
      );
      return;
    }

    const clientId = session.metadata?.clientId;

    // Idempotency — a replayed Stripe delivery must reuse the same invoice,
    // never create a second one for the same order ref.
    let found = null;
    try {
      found = await findInvoiceByOrderRef(qonto, parsed.orderRef, CARD_IDEMPOTENCY_WINDOW_MS);
    } catch (err) {
      console.error('Card-path idempotency lookup failed, proceeding to create:', err);
    }

    try {
      if (found) {
        invoice = found;
      } else {
        const invoiceBody = buildInvoicePayload({ clientId, entry, locale: parsed.locale, orderRef: parsed.orderRef });
        const createdRes = await qonto.post('/v2/client_invoices', invoiceBody);
        invoice = createdRes.client_invoice ?? createdRes;
      }
    } catch (err) {
      console.error('Failed to create Qonto invoice for a paid Stripe session:', err);
      throw err; // Stripe already holds the money — retry rather than drop it
    }

    if (invoice.status !== 'paid') {
      try {
        const markRes = await qonto.post(`/v2/client_invoices/${encodeURIComponent(invoice.id)}/mark_as_paid`, {});
        invoice = markRes.client_invoice ?? markRes;
      } catch (err) {
        console.error('Failed to mark Qonto invoice as paid:', err);
        await sendInternalAlert(
          'Manual action needed: mark Qonto invoice as paid',
          `Invoice ${invoice.id} (order ${parsed.orderRef}) was created for a paid Stripe session ` +
            `(${stripeSessionId}) but POST /mark_as_paid failed. Mark it paid manually in Qonto — do not ` +
            `re-invoice. Proceeding to deliver the customer's purchase now; Stripe already proved payment.`
        );
        // Fall through — do not return. Withholding the entitlement here
        // would punish the customer for our own bookkeeping call failing.
      }
    }
  } else {
    // --- Transfer path: re-fetch the invoice, the only trusted source for
    // the amount and customer. ---
    try {
      const res = await qonto.get(`/v2/client_invoices/${encodeURIComponent(invoiceId)}`);
      invoice = res.client_invoice ?? res;
    } catch (err) {
      console.error('Failed to re-fetch invoice from Qonto:', err);
      throw err; // transient Qonto outage — let the async-invocation retry handle it
    }

    parsed = parseOrderRef(invoice.purchase_order);
    entry = parsed ? CATALOGUE[parsed.sku] : null;
    expectedGross = entry ? grossCents(entry.netCents) : null;

    if (invoice.status !== 'paid' || invoice.currency !== 'EUR' || !parsed || !entry) {
      console.log(
        JSON.stringify({
          event: 'fulfil_skipped',
          invoiceId,
          status: invoice.status,
          currency: invoice.currency,
          hasOrderRef: Boolean(parsed),
        })
      );
      return;
    }

    const actualGross = amountToCents(invoice.total_amount);
    if (actualGross !== expectedGross) {
      console.error(JSON.stringify({ event: 'fulfil_amount_mismatch', invoiceId, expectedGross, actualGross }));
      await sendInternalAlert(
        'Amount mismatch — fulfilment stopped',
        `Invoice ${invoiceId} (order ${parsed.orderRef}) is marked paid but total_amount ` +
          `${JSON.stringify(invoice.total_amount)} does not match the expected gross of ${expectedGross} cents ` +
          `for SKU ${parsed.sku}. No entitlement was issued.`
      );
      return;
    }
  }

  // --- Common tail: entitlement/email, shared by both payment methods -----

  const clientEmail = invoice.client?.email || stripeCustomerEmail;
  const clientCompany = invoice.client?.name || 'Unknown';

  if (!clientEmail) {
    console.error(JSON.stringify({ event: 'fulfil_missing_client_email', invoiceId: invoice.id }));
    await sendInternalAlert(
      'Fulfilment failed: no client email on invoice',
      `Invoice ${invoice.id} has no client email on file (and no Stripe customer email, if applicable).`
    );
    return;
  }

  const t = COPY[parsed.locale] || COPY.en;
  const grossLabel = formatEuros(expectedGross);
  let customerMessageId;

  if (entry.kind === 'licence') {
    const entitlementSecret = await getEntitlementSecret();
    const token = signToken(
      { inv: invoice.id, sku: parsed.sku, exp: Date.now() + ENTITLEMENT_TTL_MS },
      entitlementSecret
    );
    const url = buildAccessUrl(token, parsed.locale);

    const subject = t.licenceSubject(entry.product);
    const text = [
      t.licenceIntro(entry.offer[parsed.locale], grossLabel),
      '',
      t.licenceBody(url),
      '',
      t.supportLine,
    ].join('\n');
    const result = await sendEmail(ses, { from: FROM_EMAIL, to: clientEmail, replyTo: FROM_EMAIL, subject, text });
    customerMessageId = result.messageId;
  } else {
    const subject = t.depositSubject(entry.product);
    const text = [t.depositBody(entry.offer[parsed.locale], grossLabel), '', t.supportLine].join('\n');
    const result = await sendEmail(ses, { from: FROM_EMAIL, to: clientEmail, replyTo: FROM_EMAIL, subject, text });
    customerMessageId = result.messageId;
  }

  const internalResult = await sendEmail(ses, {
    from: FROM_EMAIL,
    to: INTERNAL_EMAIL,
    subject: `[Payments] ${entry.product} sold — ${parsed.orderRef}`,
    text: [
      `SKU: ${parsed.sku}`,
      `Gross: ${grossLabel}`,
      `Invoice number: ${invoice.number || 'n/a'}`,
      `Qonto invoice id: ${invoice.id}`,
      `Client: ${clientCompany}`,
    ].join('\n'),
  });

  console.log(
    JSON.stringify({
      event: 'fulfilled',
      invoiceId: invoice.id,
      orderRef: parsed.orderRef,
      sku: parsed.sku,
      customerMessageId,
      internalMessageId: internalResult.messageId,
    })
  );
}
