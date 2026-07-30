import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mintOrderRef, parseOrderRef, ORDER_REF_REGEX } from '../../lambda/payments-shared.mjs';
import { CATALOGUE } from '../../lambda/payments-catalogue.mjs';

test('mint/parse round-trip recovers the original SKU and locale', () => {
  for (const [sku, entry] of Object.entries(CATALOGUE)) {
    for (const locale of ['en', 'es']) {
      const ref = mintOrderRef(sku, locale);
      assert.match(ref, ORDER_REF_REGEX);
      assert.ok(ref.length <= 40, 'must fit Qonto purchase_order max length');
      assert.equal(ref, `WEB-${entry.code}-${locale.toUpperCase()}-${ref.slice(-12)}`);

      const parsed = parseOrderRef(ref);
      assert.deepEqual(parsed, { sku, code: entry.code, locale, orderRef: ref });
    }
  }
});

test('mint produces a fresh 12-hex-char random suffix each call', () => {
  const a = mintOrderRef('trustprompt-business', 'en');
  const b = mintOrderRef('trustprompt-business', 'en');
  assert.notEqual(a, b);
  assert.match(a.slice(-12), /^[a-f0-9]{12}$/);
});

test('mint rejects unknown SKU or locale', () => {
  assert.throws(() => mintOrderRef('not-a-sku', 'en'));
  assert.throws(() => mintOrderRef('trustprompt-business', 'fr'));
});

test('parse rejects malformed refs', () => {
  const malformed = [
    'WEB-TPBU-EN-shorthex',
    'WEB-TPBU-en-a1b2c3d4e5f6', // lowercase locale
    'WEB-TPBU-FR-a1b2c3d4e5f6', // unknown locale
    'WEB-TPBU-EN-a1b2c3d4e5f6extra',
    'web-TPBU-EN-a1b2c3d4e5f6',
    '',
    null,
    undefined,
    42,
    'WEB-TPBU-EN-a1b2c3d4e5f', // 11 hex chars
  ];
  for (const bad of malformed) {
    assert.equal(parseOrderRef(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('parse silently ignores a well-shaped ref whose code is not in our catalogue', () => {
  // Futurion also invoices manually via Qonto — a ref like this is not ours.
  assert.equal(parseOrderRef('WEB-ZZZZ-EN-a1b2c3d4e5f6'), null);
});
