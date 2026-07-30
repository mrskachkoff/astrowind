/**
 * Lambda handler for payment fulfilment (tmp/payments.md §5.3).
 *
 * Invoked asynchronously by payments-webhook.mjs with `{ invoiceId }` (bank
 * transfer) or `{ invoiceId, paymentLinkId }` (card/Apple Pay/PayPal) — never
 * trusts the webhook payload. Re-fetches the invoice from Qonto (the only
 * trusted source for the amount and customer), verifies it is genuinely paid
 * at the exact catalogue amount, then emails the customer their entitlement
 * (licence) or deposit confirmation, plus an internal sales notification.
 * There is no order database and no status endpoint: fulfilment arrives by
 * email, so SES failures are allowed to throw and let Lambda's
 * async-invocation retry (2x, tmp/payments.md §5.2) try again — unlike
 * trustprompt-download.mjs, which deliberately swallows SES failures because
 * the user did nothing wrong, here the only way the customer ever gets their
 * access link is this email.
 *
 * Payment proof: `invoice.status === 'paid'` OR (a `paymentLinkId` is
 * present AND its own status is `paid` AND it points back at this invoice AND
 * its amount matches). It is unverified whether a card payment marks the
 * client invoice `paid` immediately — the payment-link check is the
 * card-payment proof path; confirm the real timing during the tmp/payments.md
 * §6 sandbox gate.
 *
 * Duplicate webhook deliveries re-run all of this — the customer may get a
 * second, equally valid email. Accepted (tmp/payments.md §11).
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
} from './payments-shared.mjs';
import { getAccessToken } from './payments-oauth.mjs';

const ssm = new SSMClient({ region: 'eu-west-3' });
const ses = new SESClient({ region: 'eu-west-3' });

const FROM_EMAIL = 'solutions@futurion.es';
const INTERNAL_EMAIL = process.env.INTERNAL_EMAIL || 'solutions@futurion.es';
const ENTITLEMENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getQontoToken() {
  return getAccessToken(ssm, {
    oauthBaseUrl: process.env.QONTO_OAUTH_BASE_URL,
    stagingToken: process.env.QONTO_STAGING_TOKEN,
  });
}

async function getEntitlementSecret() {
  return getSecret(ssm, '/futurion/payments/entitlement-secret');
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
  const paymentLinkId = event?.paymentLinkId;
  if (!invoiceId) {
    console.error('payments-fulfil invoked without an invoiceId');
    return;
  }

  const qonto = createQontoClient({
    baseUrl: process.env.QONTO_API_BASE_URL,
    getToken: getQontoToken,
    stagingToken: process.env.QONTO_STAGING_TOKEN,
  });

  // The only trusted source — the webhook that triggered this invocation is
  // a hint, never proof.
  let invoice;
  try {
    const res = await qonto.get(`/v2/client_invoices/${encodeURIComponent(invoiceId)}`);
    invoice = res.client_invoice ?? res;
  } catch (err) {
    console.error('Failed to re-fetch invoice from Qonto:', err);
    throw err; // transient Qonto outage — let the async-invocation retry handle it
  }

  const parsed = parseOrderRef(invoice.purchase_order);
  const entry = parsed ? CATALOGUE[parsed.sku] : null;
  const expectedGross = entry ? grossCents(entry.netCents) : null;

  // Payment proof: the invoice itself is paid, OR a payment link points back
  // at this exact invoice, is itself paid, and matches the expected amount.
  // (docs.qonto.com/api-reference/business-api/payments-transfers/
  // payment-links/*, verified July 2026.) Card-payment webhooks carry a
  // paymentLinkId; whether the client invoice's own status also flips to
  // `paid` promptly for a card payment is unverified — this dual check
  // covers both cases without assuming either.
  let paidViaInvoice = invoice.status === 'paid';
  let paidViaPaymentLink = false;

  if (!paidViaInvoice && paymentLinkId) {
    try {
      const linkRes = await qonto.get(`/v2/payment_links/${encodeURIComponent(paymentLinkId)}`);
      const link = linkRes.payment_link ?? linkRes;
      paidViaPaymentLink =
        link.status === 'paid' &&
        link.resource_id === invoiceId &&
        expectedGross !== null &&
        amountToCents(link.amount) === expectedGross;
    } catch (err) {
      console.error('Failed to re-fetch payment link from Qonto:', err);
      throw err; // transient Qonto outage — let the async-invocation retry handle it
    }
  }

  if ((!paidViaInvoice && !paidViaPaymentLink) || invoice.currency !== 'EUR' || !parsed || !entry) {
    console.log(
      JSON.stringify({
        event: 'fulfil_skipped',
        invoiceId,
        paymentLinkId: paymentLinkId || null,
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

  const clientEmail = invoice.client?.email;
  const clientCompany = invoice.client?.name || 'Unknown';

  if (!clientEmail) {
    console.error(JSON.stringify({ event: 'fulfil_missing_client_email', invoiceId }));
    await sendInternalAlert(
      'Fulfilment failed: no client email on invoice',
      `Invoice ${invoiceId} has no client email on file.`
    );
    return;
  }

  const t = COPY[parsed.locale] || COPY.en;
  const grossLabel = formatEuros(expectedGross);
  let customerMessageId;

  if (entry.kind === 'licence') {
    const entitlementSecret = await getEntitlementSecret();
    const token = signToken(
      { inv: invoiceId, sku: parsed.sku, exp: Date.now() + ENTITLEMENT_TTL_MS },
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
      `Qonto invoice id: ${invoiceId}`,
      `Client: ${clientCompany}`,
    ].join('\n'),
  });

  console.log(
    JSON.stringify({
      event: 'fulfilled',
      invoiceId,
      orderRef: parsed.orderRef,
      sku: parsed.sku,
      customerMessageId,
      internalMessageId: internalResult.messageId,
    })
  );
}
