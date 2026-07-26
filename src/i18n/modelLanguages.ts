/**
 * TrustPrompt model download languages.
 *
 * This is a UI hint list, NOT an access-control list. `available` only
 * controls the "coming soon" label shown to the user — the actual gate is
 * lambda/trustprompt-download.mjs, which lists the live S3 dist/ prefix on
 * every request and is the sole source of truth.
 *
 * Keep the `code` values in sync with LOCALE_PREFIX in
 * lambda/trustprompt-download.mjs. These are S3 prefix names chosen by the
 * model-release process, not ISO 639-1 codes — note in particular jp (not
 * ja), cn (not zh), tk (not tr).
 *
 * When a new language build ships, flip its `available` flag here and
 * redeploy the site — otherwise the "coming soon" label keeps showing even
 * though the download itself already works.
 */

export interface ModelLanguage {
  code: string;
  en: string;
  es: string;
  available: boolean;
}

export const MODEL_LANGUAGES: readonly ModelLanguage[] = [
  { code: 'en', en: 'English', es: 'Inglés', available: true },
  { code: 'es', en: 'Spanish', es: 'Español', available: true },
  { code: 'fr', en: 'French', es: 'Francés', available: false },
  { code: 'de', en: 'German', es: 'Alemán', available: false },
  { code: 'it', en: 'Italian', es: 'Italiano', available: false },
  { code: 'nl', en: 'Dutch', es: 'Neerlandés', available: false },
  { code: 'pt', en: 'Portuguese', es: 'Portugués', available: false },
  { code: 'hi', en: 'Hindi', es: 'Hindi', available: false },
  { code: 'te', en: 'Telugu', es: 'Telugu', available: false },
  { code: 'ar', en: 'Arabic', es: 'Árabe', available: false },
  { code: 'jp', en: 'Japanese', es: 'Japonés', available: false },
  { code: 'tk', en: 'Turkish', es: 'Turco', available: false },
  { code: 'cn', en: 'Chinese', es: 'Chino', available: false },
] as const;
