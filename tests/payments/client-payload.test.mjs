import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClientCreatePayload } from '../../lambda/payments-shared.mjs';

// D3 regression: POST /v2/clients requires `kind` and `currency` for the
// client to be usable for invoicing, and its billing_address sub-object uses
// street_address/zip_code/city/province_code/country_code — NOT
// first_line/province, which the original implementation sent. Both bugs
// would 422 on every first-time customer.

const INPUT = {
  companyName: 'Acme SL',
  taxId: 'B12345678',
  email: 'billing@acme.example',
  locale: 'es',
  line1: 'Calle Mayor 1',
  postalCode: '28001',
  city: 'Madrid',
  province: 'Madrid',
};

test('includes the required kind and currency fields', () => {
  const payload = buildClientCreatePayload(INPUT);
  assert.equal(payload.kind, 'company');
  assert.equal(payload.currency, 'EUR');
});

test('billing_address uses the real Qonto field names, not first_line/province', () => {
  const payload = buildClientCreatePayload(INPUT);
  assert.deepEqual(payload.billing_address, {
    street_address: 'Calle Mayor 1',
    zip_code: '28001',
    city: 'Madrid',
    province_code: 'Madrid',
    country_code: 'ES',
  });
  assert.equal('first_line' in payload.billing_address, false);
  assert.equal('province' in payload.billing_address, false);
});

test('carries through name, tax id, email, and locale unchanged', () => {
  const payload = buildClientCreatePayload(INPUT);
  assert.equal(payload.name, 'Acme SL');
  assert.equal(payload.tax_identification_number, 'B12345678');
  assert.equal(payload.email, 'billing@acme.example');
  assert.equal(payload.locale, 'es');
});

test('country_code is always ES regardless of input (Spain-only checkout)', () => {
  const payload = buildClientCreatePayload(INPUT);
  assert.equal(payload.billing_address.country_code, 'ES');
});
