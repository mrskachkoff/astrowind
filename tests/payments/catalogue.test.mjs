import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE, VAT_RATE, vatCents, grossCents } from '../../lambda/payments-catalogue.mjs';

// The eight exact gross totals from tmp/payments.md §3 — must match to the cent.
const EXPECTED_GROSS = {
  'trustprompt-small-team': 119790,
  'trustprompt-business': 350900,
  'trustprompt-growth': 713900,
  'trustcore-starter-1-seat': 42108,
  'trustcore-team-10-seats': 348480,
  'trustcore-business-50-seats': 1379400,
  'trustauto-quick-win-deposit': 181500,
  'trustauto-comprehensive-deposit': 605000,
};

test('VAT_RATE is the fixed 21% Spain rate', () => {
  assert.equal(VAT_RATE, 0.21);
});

test('every catalogue SKU has the expected gross total to the cent', () => {
  for (const [sku, expectedGross] of Object.entries(EXPECTED_GROSS)) {
    const entry = CATALOGUE[sku];
    assert.ok(entry, `catalogue is missing SKU "${sku}"`);
    assert.equal(grossCents(entry.netCents), expectedGross, `${sku}: gross mismatch`);
  }
});

test('every EXPECTED_GROSS key is actually in the catalogue (no drift either way)', () => {
  assert.deepEqual(Object.keys(CATALOGUE).sort(), Object.keys(EXPECTED_GROSS).sort());
});

test('vatCents and grossCents only ever produce integers', () => {
  for (const entry of Object.values(CATALOGUE)) {
    assert.ok(Number.isInteger(vatCents(entry.netCents)));
    assert.ok(Number.isInteger(grossCents(entry.netCents)));
  }
});

test('grossCents = netCents + vatCents for every SKU', () => {
  for (const entry of Object.values(CATALOGUE)) {
    assert.equal(grossCents(entry.netCents), entry.netCents + vatCents(entry.netCents));
  }
});

test('every SKU has a 4-char uppercase code, a valid kind, and a download flag', () => {
  const seenCodes = new Set();
  for (const [sku, entry] of Object.entries(CATALOGUE)) {
    assert.match(entry.code, /^[A-Z0-9]{4}$/, `${sku}: code shape`);
    assert.ok(!seenCodes.has(entry.code), `${sku}: duplicate code ${entry.code}`);
    seenCodes.add(entry.code);
    assert.ok(['licence', 'deposit'].includes(entry.kind), `${sku}: kind`);
    assert.equal(typeof entry.download, 'boolean', `${sku}: download flag`);
  }
});

test('every SKU has non-empty EN and ES display strings', () => {
  for (const [sku, entry] of Object.entries(CATALOGUE)) {
    for (const field of ['name', 'offer', 'description']) {
      assert.ok(entry[field]?.en?.length > 0, `${sku}.${field}.en missing`);
      assert.ok(entry[field]?.es?.length > 0, `${sku}.${field}.es missing`);
    }
  }
});

test('deposit SKUs are download:false, licence SKUs are download:true', () => {
  for (const entry of Object.values(CATALOGUE)) {
    if (entry.kind === 'deposit') assert.equal(entry.download, false);
    if (entry.kind === 'licence') assert.equal(entry.download, true);
  }
});

test('catalogue object is frozen (cannot be mutated at runtime)', () => {
  assert.ok(Object.isFrozen(CATALOGUE));
  const anySku = Object.keys(CATALOGUE)[0];
  assert.throws(() => {
    'use strict';
    CATALOGUE[anySku] = { netCents: 1 };
  });
});
