import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidSpanishTaxId, normalizeSpanishTaxId } from '../../lambda/payments-shared.mjs';

test('valid NIF (independently known test vector)', () => {
  assert.equal(isValidSpanishTaxId('12345678Z'), true);
});

test('valid NIE (independently known test vector)', () => {
  assert.equal(isValidSpanishTaxId('X1234567L'), true);
  assert.equal(isValidSpanishTaxId('Y1234567X'), true); // Y prefix -> digit 1
});

test('valid CIF, digit-only control letter (B): independently known test vector', () => {
  assert.equal(isValidSpanishTaxId('B65410011'), true);
});

test('valid CIF, letter-only control letter (self-computed, cross-checked by hand)', () => {
  // letter K is letter-only-control; computed by hand against the algorithm.
  assert.equal(isValidSpanishTaxId('K1234567D'), true);
});

test('invalid: wrong NIF control letter', () => {
  assert.equal(isValidSpanishTaxId('12345678A'), false);
});

test('invalid: wrong CIF control digit', () => {
  assert.equal(isValidSpanishTaxId('B65410012'), false);
});

test('invalid: garbage input', () => {
  for (const bad of ['', 'not-an-id', '1234', null, undefined, 12345678, 'XXXXXXXXX']) {
    assert.equal(isValidSpanishTaxId(bad), false, `expected false for ${JSON.stringify(bad)}`);
  }
});

test('accepts spaces/dashes and is case-insensitive', () => {
  assert.equal(isValidSpanishTaxId('b-6541-0011'), true);
  assert.equal(isValidSpanishTaxId(' 12345678z '), true);
});

test('normalizeSpanishTaxId strips whitespace/dashes and upcases', () => {
  assert.equal(normalizeSpanishTaxId(' b-6541-0011 '), 'B65410011');
  assert.equal(normalizeSpanishTaxId(42), '');
});
