import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoicePayload } from '../../lambda/payments-shared.mjs';
import { CATALOGUE } from '../../lambda/payments-catalogue.mjs';

// buildInvoicePayload is the single builder shared by both payment paths:
// the transfer path calls it before payment (payments-checkout.mjs), the
// card path calls it after Stripe confirms payment (payments-fulfil.mjs).
// They must produce an identical shape so the two paths can never drift.

const entry = CATALOGUE['trustprompt-business'];

test('quantity is the string "1", not the number 1 (the 62387f7 regression)', () => {
  // Qonto's API rejects a numeric quantity: "json: cannot unmarshal number
  // into Go struct field InvoiceItem.items.quantity of type string" — a live
  // 422 in sandbox. This must never regress on either payment path.
  const payload = buildInvoicePayload({
    clientId: 'client_123',
    entry,
    locale: 'en',
    orderRef: 'WEB-TPBU-EN-a1b2c3d4e5f6',
  });
  assert.equal(payload.items[0].quantity, '1');
  assert.equal(typeof payload.items[0].quantity, 'string');
});

test('produces the same shape for the transfer path (with iban) and the card path (without)', () => {
  const transferPayload = buildInvoicePayload({
    clientId: 'client_123',
    entry,
    locale: 'es',
    orderRef: 'WEB-TPBU-ES-a1b2c3d4e5f6',
    iban: 'ES0000000000000000000000',
  });
  const cardPayload = buildInvoicePayload({
    clientId: 'client_123',
    entry,
    locale: 'es',
    orderRef: 'WEB-TPBU-ES-a1b2c3d4e5f6',
  });

  assert.deepEqual(transferPayload.payment_methods, { iban: 'ES0000000000000000000000' });
  assert.equal('payment_methods' in cardPayload, false);

  // Everything else about the two payloads is identical.
  const transferRest = { ...transferPayload };
  delete transferRest.payment_methods;
  assert.deepEqual(transferRest, cardPayload);
});

test('sets currency EUR, purchase_order to the given orderRef, and issue/due date to today', () => {
  const payload = buildInvoicePayload({
    clientId: 'client_123',
    entry,
    locale: 'en',
    orderRef: 'WEB-TPBU-EN-a1b2c3d4e5f6',
  });
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(payload.currency, 'EUR');
  assert.equal(payload.purchase_order, 'WEB-TPBU-EN-a1b2c3d4e5f6');
  assert.equal(payload.issue_date, today);
  assert.equal(payload.due_date, today);
});

test('the single line item uses the locale-correct offer title and description', () => {
  const en = buildInvoicePayload({ clientId: 'c', entry, locale: 'en', orderRef: 'WEB-TPBU-EN-a1b2c3d4e5f6' });
  const es = buildInvoicePayload({ clientId: 'c', entry, locale: 'es', orderRef: 'WEB-TPBU-ES-a1b2c3d4e5f6' });

  assert.equal(en.items[0].title, `${entry.name.en} — ${entry.offer.en}`);
  assert.equal(en.items[0].description, entry.description.en);
  assert.equal(es.items[0].title, `${entry.name.es} — ${entry.offer.es}`);
  assert.equal(es.items[0].description, entry.description.es);
});

test('unit_price is the net amount as a decimal string, at the fixed 21% VAT rate', () => {
  const payload = buildInvoicePayload({
    clientId: 'client_123',
    entry,
    locale: 'en',
    orderRef: 'WEB-TPBU-EN-a1b2c3d4e5f6',
  });
  assert.deepEqual(payload.items[0].unit_price, { value: '2900.00', currency: 'EUR' });
  assert.equal(payload.items[0].vat_rate, '0.21');
});

test('every catalogue entry produces a valid payload with no float artifacts in unit_price', () => {
  for (const [sku, catalogueEntry] of Object.entries(CATALOGUE)) {
    const payload = buildInvoicePayload({
      clientId: 'client_123',
      entry: catalogueEntry,
      locale: 'en',
      orderRef: `WEB-${catalogueEntry.code}-EN-000000000000`,
    });
    assert.match(payload.items[0].unit_price.value, /^\d+\.\d{2}$/, `bad unit_price for ${sku}`);
  }
});
