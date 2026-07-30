/**
 * Single source of truth for what Futurion sells online: SKU codes, prices
 * (integer cents, EUR only), VAT math, and the EN/ES display copy for both
 * the checkout page and Qonto invoice line items.
 *
 * Imported by four places that must never disagree on a price:
 *   - lambda/payments-checkout.mjs / payments-fulfil.mjs / payments-access.mjs
 *   - src/components/widgets/CheckoutForm.astro (relative import at build time)
 *
 * Rules (see tmp/payments.md §3):
 *   - Currency is always EUR.
 *   - All money is integer cents. The browser only ever sends a SKU key —
 *     prices are always computed server-side from this file.
 *   - vatCents/grossCents are the ONLY computations ever done on money here;
 *     never use floating-point arithmetic on a price anywhere else.
 *   - An unknown SKU is a 400, not a fallback price.
 */

export const VAT_RATE = 0.21; // Qonto line-item serialization: send "0.21" as a decimal string

/**
 * @typedef {Object} CatalogueEntry
 * @property {string} code       4-char order-ref code (see payments-shared.mjs mintOrderRef)
 * @property {string} product    'TrustPrompt' | 'TrustCore' | 'TrustAuto'
 * @property {'licence'|'deposit'} kind
 * @property {number} netCents   integer cents, ex-VAT
 * @property {boolean} download  true if a successful payment unlocks a download (payments-access.mjs)
 * @property {{en: string, es: string}} name          display name for the checkout panel
 * @property {{en: string, es: string}} offer         short offer/tier label
 * @property {{en: string, es: string}} description   one-line factual invoice line-item description
 */

/** @type {Readonly<Record<string, CatalogueEntry>>} */
export const CATALOGUE = Object.freeze({
  'trustprompt-small-team': {
    code: 'TPST',
    product: 'TrustPrompt',
    kind: 'licence',
    netCents: 99000,
    download: true,
    name: { en: 'TrustPrompt', es: 'TrustPrompt' },
    offer: { en: 'Small Team (up to 25 users)', es: 'Equipo pequeño (hasta 25 usuarios)' },
    description: {
      en: 'TrustPrompt Small Team licence, one year, up to 25 users.',
      es: 'Licencia TrustPrompt Equipo Pequeño, un año, hasta 25 usuarios.',
    },
  },
  'trustprompt-business': {
    code: 'TPBU',
    product: 'TrustPrompt',
    kind: 'licence',
    netCents: 290000,
    download: true,
    name: { en: 'TrustPrompt', es: 'TrustPrompt' },
    offer: { en: 'Business (up to 100 users)', es: 'Empresa (hasta 100 usuarios)' },
    description: {
      en: 'TrustPrompt Business licence, one year, up to 100 users.',
      es: 'Licencia TrustPrompt Empresa, un año, hasta 100 usuarios.',
    },
  },
  'trustprompt-growth': {
    code: 'TPGR',
    product: 'TrustPrompt',
    kind: 'licence',
    netCents: 590000,
    download: true,
    name: { en: 'TrustPrompt', es: 'TrustPrompt' },
    offer: { en: 'Growth (up to 250 users)', es: 'Crecimiento (hasta 250 usuarios)' },
    description: {
      en: 'TrustPrompt Growth licence, one year, up to 250 users.',
      es: 'Licencia TrustPrompt Crecimiento, un año, hasta 250 usuarios.',
    },
  },
  'trustcore-starter-1-seat': {
    code: 'TCS1',
    product: 'TrustCore',
    kind: 'licence',
    netCents: 34800,
    download: true,
    name: { en: 'TrustCore', es: 'TrustCore' },
    offer: { en: 'Starter (1 seat)', es: 'Starter (1 puesto)' },
    description: {
      en: 'TrustCore Starter licence, one year, 1 seat.',
      es: 'Licencia TrustCore Starter, un año, 1 puesto.',
    },
  },
  'trustcore-team-10-seats': {
    code: 'TC10',
    product: 'TrustCore',
    kind: 'licence',
    netCents: 288000,
    download: true,
    name: { en: 'TrustCore', es: 'TrustCore' },
    offer: { en: 'Team (10 seats)', es: 'Team (10 puestos)' },
    description: {
      en: 'TrustCore Team licence, one year, 10 seats.',
      es: 'Licencia TrustCore Team, un año, 10 puestos.',
    },
  },
  'trustcore-business-50-seats': {
    code: 'TC50',
    product: 'TrustCore',
    kind: 'licence',
    netCents: 1140000,
    download: true,
    name: { en: 'TrustCore', es: 'TrustCore' },
    offer: { en: 'Business (50 seats)', es: 'Business (50 puestos)' },
    description: {
      en: 'TrustCore Business licence, one year, 50 seats.',
      es: 'Licencia TrustCore Business, un año, 50 puestos.',
    },
  },
  'trustauto-quick-win-deposit': {
    code: 'TAQW',
    product: 'TrustAuto',
    kind: 'deposit',
    netCents: 150000,
    download: false,
    name: { en: 'TrustAuto', es: 'TrustAuto' },
    offer: { en: 'Quick-Win Implementation — deposit', es: 'Implementación de Mejora Inmediata — depósito' },
    description: {
      en: 'TrustAuto Quick-Win Implementation deposit, credited against the final project invoice.',
      es: 'Depósito de Implementación de Mejora Inmediata TrustAuto, se abona en la factura final del proyecto.',
    },
  },
  'trustauto-comprehensive-deposit': {
    code: 'TACO',
    product: 'TrustAuto',
    kind: 'deposit',
    netCents: 500000,
    download: false,
    name: { en: 'TrustAuto', es: 'TrustAuto' },
    offer: { en: 'Comprehensive Package — deposit', es: 'Paquete Completo — depósito' },
    description: {
      en: 'TrustAuto Comprehensive Package deposit, credited against the final project invoice.',
      es: 'Depósito de Paquete Completo TrustAuto, se abona en la factura final del proyecto.',
    },
  },
});

/** Reverse lookup used by payments-shared.mjs to turn an order-ref CODE back into a SKU key. */
export const CODE_TO_SKU = Object.freeze(
  Object.fromEntries(Object.entries(CATALOGUE).map(([sku, entry]) => [entry.code, sku]))
);

/** Integer-cents VAT at the fixed 21% rate. Never use floats for money. */
export function vatCents(netCents) {
  return Math.round((netCents * 21) / 100);
}

/** Integer-cents gross (net + VAT). */
export function grossCents(netCents) {
  return netCents + vatCents(netCents);
}
