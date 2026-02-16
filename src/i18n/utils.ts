import en from './en.json';
import es from './es.json';
import { getCanonicalPath, getLocalizedSlug } from './slugs';

const translations: Record<string, Record<string, unknown>> = { en, es };

export type Locale = 'en' | 'es';

/**
 * Extract locale from a URL. Checks for /es/ prefix.
 */
export function getLangFromUrl(url: URL): Locale {
  const pathname = url.pathname;
  if (pathname.startsWith('/es/') || pathname === '/es') {
    return 'es';
  }
  return 'en';
}

/**
 * Returns a t() function for the given locale.
 * Supports dot-notation keys like "nav.services".
 */
export function useTranslations(lang: Locale) {
  return function t(key: string): string {
    const keys = key.split('.');
    let value: unknown = translations[lang];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
        value = (value as Record<string, unknown>)[k];
      } else {
        // Fallback to English
        let fallback: unknown = translations['en'];
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in (fallback as Record<string, unknown>)) {
            fallback = (fallback as Record<string, unknown>)[fk];
          } else {
            return key; // Key not found
          }
        }
        return typeof fallback === 'string' ? fallback : key;
      }
    }
    return typeof value === 'string' ? value : key;
  };
}

/**
 * Convert an English canonical path to a localized path for the target locale.
 */
export function getLocalizedPath(path: string, lang: Locale): string {
  return getLocalizedSlug(path, lang);
}

/**
 * Given the current URL and a target language, compute the equivalent URL in that language.
 */
export function getAlternateLanguageUrl(currentUrl: URL, targetLang: Locale): string {
  const pathname = currentUrl.pathname.replace(/\/$/, '') || '/';
  const canonicalPath = getCanonicalPath(pathname);
  return getLocalizedSlug(canonicalPath, targetLang);
}
