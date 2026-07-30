import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decimalStringToCents, centsToDecimalString, amountToCents } from '../../lambda/payments-shared.mjs';
import { CATALOGUE, grossCents } from '../../lambda/payments-catalogue.mjs';

test('"3509.00" <-> 350900 round-trips exactly', () => {
  assert.equal(decimalStringToCents('3509.00'), 350900);
  assert.equal(centsToDecimalString(350900), '3509.00');
});

test('round-trips every catalogue gross amount without float error', () => {
  for (const entry of Object.values(CATALOGUE)) {
    const gross = grossCents(entry.netCents);
    const decimal = centsToDecimalString(gross);
    assert.equal(decimalStringToCents(decimal), gross, `round-trip failed for ${decimal}`);
  }
});

test('handles amounts with no fractional part', () => {
  assert.equal(decimalStringToCents('100'), 10000);
  assert.equal(centsToDecimalString(10000), '100.00');
});

test('handles single-digit fractional part (pads to cents)', () => {
  assert.equal(decimalStringToCents('100.5'), 10050);
});

test('handles the classic float trap correctly (0.1 + 0.2 style values)', () => {
  // 3509.00 * 100 as a float is fine, but values like 19.10 are the ones that
  // break with parseFloat-then-round tricks; string math must not care.
  assert.equal(decimalStringToCents('19.10'), 1910);
  assert.equal(decimalStringToCents('0.29'), 29);
});

test('rejects non-numeric or malformed strings instead of silently coercing', () => {
  for (const bad of ['abc', '12.345', '12.3.4', '', null, undefined, 42, 'NaN', 'Infinity']) {
    assert.equal(decimalStringToCents(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('negative amounts (e.g. a credit note) round-trip too', () => {
  assert.equal(decimalStringToCents('-50.00'), -5000);
  assert.equal(centsToDecimalString(-5000), '-50.00');
});

// D2 regression: Qonto's invoice/payment-link responses serialize money as
// { value, currency }, not a bare decimal string. lambda/payments-fulfil.mjs
// used to call decimalStringToCents(invoice.total_amount) directly, which
// silently returned null for every real invoice — every paid order aborted
// as an amount mismatch. amountToCents is the fix: it unwraps the object.
test('amountToCents converts the {value, currency} response shape', () => {
  assert.equal(amountToCents({ value: '3509.00', currency: 'EUR' }), 350900);
  assert.equal(amountToCents({ value: '0.29', currency: 'EUR' }), 29);
});

test('amountToCents round-trips every catalogue gross amount', () => {
  for (const entry of Object.values(CATALOGUE)) {
    const gross = grossCents(entry.netCents);
    assert.equal(amountToCents({ value: centsToDecimalString(gross), currency: 'EUR' }), gross);
  }
});

test('amountToCents rejects a non-EUR currency instead of silently accepting it', () => {
  assert.equal(amountToCents({ value: '100.00', currency: 'USD' }), null);
  assert.equal(amountToCents({ value: '100.00', currency: 'GBP' }), null);
});

test('amountToCents rejects the bare-string shape and other malformed input (the D2 regression)', () => {
  for (const bad of ['3509.00', null, undefined, 42, {}, { value: '10.00' }, { currency: 'EUR' }, []]) {
    assert.equal(amountToCents(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});
