import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClientCreatePayload } from '../../lambda/payments-shared.mjs';

// D3 regression: POST /v2/clients requires `kind` and `currency` for the
// client to be usable for invoicing, and its billing_address sub-object uses
// street_address/zip_code/city/country_code — NOT first_line, which the
// original implementation sent. Both bugs would 422 on every first-time
// customer.
//
// D5 regression: `province_code` is NOT a generic state/region field — it is
// Italy-only ("required only for Italian organizations", max 2 chars) and
// Qonto validates that length regardless of the client's country. Sending a
// free-text Spanish province name (e.g. "Madrid") into it 422s on every
// single checkout: "Field validation for 'province_code' failed on the 'max'
// tag" (reproduced live against the Qonto sandbox, July 2026 — the previous
// version of this test only asserted field NAMES, never called the live API,
// so it never caught this). billing_address must not include province_code
// at all for a Spain-only checkout.

const INPUT = {
  companyName: 'Acme SL',
  taxId: 'B12345678',
  email: 'billing@acme.example',
  locale: 'es',
  line1: 'Calle Mayor 1',
  postalCode: '28001',
  city: 'Madrid',
};

test('includes the required kind and currency fields', () => {
  const payload = buildClientCreatePayload(INPUT);
  assert.equal(payload.kind, 'company');
  assert.equal(payload.currency, 'EUR');
});

test('billing_address uses the real Qonto field names, not first_line, and omits province_code entirely', () => {
  const payload = buildClientCreatePayload(INPUT);
  assert.deepEqual(payload.billing_address, {
    street_address: 'Calle Mayor 1',
    zip_code: '28001',
    city: 'Madrid',
    country_code: 'ES',
  });
  assert.equal('first_line' in payload.billing_address, false);
  assert.equal('province' in payload.billing_address, false);
  assert.equal('province_code' in payload.billing_address, false);
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
