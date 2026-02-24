import en from './en.json';
import es from './es.json';
import { getCanonicalPath, getLocalizedSlug, slugMap } from './slugs';
import { getBlogTranslationMap } from './blogTranslations';

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

/** Set of canonical paths that have explicit entries in the static slug map */
const knownStaticPages = new Set(Object.keys(slugMap.en));

/**
 * Given the current URL and a target language, compute the equivalent URL in that language.
 * Checks blog translation map first (for posts linked via translationOf), then falls back to static slug map.
 * For blog posts without a translation, returns the blog index instead of a broken URL.
 */
export async function getAlternateLanguageUrl(currentUrl: URL, targetLang: Locale): Promise<string> {
  const pathname = currentUrl.pathname.replace(/\/$/, '') || '/';

  // Check blog translation map for posts with translationOf links
  const blogMap = await getBlogTranslationMap();
  const blogTranslation = blogMap[pathname];
  if (blogTranslation) {
    const translationIsEs = blogTranslation.startsWith('/es/') || blogTranslation === '/es';
    // Only use the blog translation if it matches the target language
    if ((targetLang === 'es' && translationIsEs) || (targetLang === 'en' && !translationIsEs)) {
      return blogTranslation;
    }
    // The current page IS in the target language — return the current path
    return pathname;
  }

  // Use the static slug map for known pages
  const canonicalPath = getCanonicalPath(pathname);
  if (knownStaticPages.has(canonicalPath)) {
    return getLocalizedSlug(canonicalPath, targetLang);
  }

  // Unknown path (likely a blog post without a translation) — fall back to blog index
  return targetLang === 'es' ? '/es/blog' : '/blog';
}
