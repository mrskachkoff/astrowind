import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formEncode } from '../../lambda/payments-stripe.mjs';

// Stripe's REST API takes application/x-www-form-urlencoded bodies with
// bracket notation for nested objects/arrays, not JSON — a shape most
// fetch-based clients get wrong on the first try. These tests pin the exact
// encoding a real Checkout Session creation call depends on.

test('flat fields encode as plain key=value pairs', () => {
  const encoded = formEncode({ mode: 'payment', client_reference_id: 'WEB-TPBU-ES-abc123' });
  assert.equal(encoded, 'mode=payment&client_reference_id=WEB-TPBU-ES-abc123');
});

test('nested objects use bracket notation', () => {
  const encoded = formEncode({ price_data: { currency: 'eur', unit_amount: 350900 } });
  assert.equal(encoded, 'price_data%5Bcurrency%5D=eur&price_data%5Bunit_amount%5D=350900');
});

test('arrays use numeric indices, matching Stripe line_items[0][...] shape', () => {
  const encoded = formEncode({
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: 100 } }],
  });
  assert.equal(
    encoded,
    'line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=eur&' +
      'line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=100'
  );
});

test('undefined and null values are omitted, not encoded as "undefined"/"null"', () => {
  const encoded = formEncode({ a: 'x', b: undefined, c: null, d: 'y' });
  assert.equal(encoded, 'a=x&d=y');
});

test('product names with special characters are URL-escaped', () => {
  const encoded = formEncode({ name: 'TrustPrompt — Business & Growth (IVA incluido)' });
  assert.equal(decodeURIComponent(encoded.split('=')[1]), 'TrustPrompt — Business & Growth (IVA incluido)');
});

test('a realistic checkout-session body round-trips through decodeURIComponent field by field', () => {
  const body = {
    mode: 'payment',
    payment_method_types: ['card'],
    client_reference_id: 'WEB-TPBU-ES-a1b2c3d4e5f6',
    metadata: { sku: 'trustprompt-business', locale: 'es' },
  };
  const encoded = formEncode(body);
  const pairs = Object.fromEntries(encoded.split('&').map((p) => p.split('=').map(decodeURIComponent)));
  assert.equal(pairs.mode, 'payment');
  assert.equal(pairs['payment_method_types[0]'], 'card');
  assert.equal(pairs.client_reference_id, 'WEB-TPBU-ES-a1b2c3d4e5f6');
  assert.equal(pairs['metadata[sku]'], 'trustprompt-business');
  assert.equal(pairs['metadata[locale]'], 'es');
});
