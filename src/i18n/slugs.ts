/**
 * Slug mapping between English and Spanish page paths.
 * Keys are the canonical English paths (without language prefix).
 * Values are the corresponding paths for each locale.
 */
export const slugMap: Record<string, Record<string, string>> = {
  en: {
    '/': '/',
    '/about': '/about',
    '/services': '/services',
    '/pricing': '/pricing',
    '/contact': '/contact',
    '/free-ai-audit': '/free-ai-audit',
    '/medcore-private-ai': '/medcore-private-ai',
    '/medical-ai-demo': '/medical-ai-demo',
    '/privacy': '/privacy',
    '/terms': '/terms',
    '/blog': '/blog',
  },
  es: {
    '/': '/es',
    '/about': '/es/nosotros',
    '/services': '/es/servicios',
    '/pricing': '/es/precios',
    '/contact': '/es/contacto',
    '/free-ai-audit': '/es/auditoria-ia-gratuita',
    '/medcore-private-ai': '/es/medcore-ia-privada',
    '/medical-ai-demo': '/es/demo-ia-medica',
    '/privacy': '/es/privacidad',
    '/terms': '/es/terminos',
    '/blog': '/es/blog',
  },
};

/** Reverse map: from localized path back to canonical English key */
const reverseMap: Record<string, string> = {};
for (const locale of Object.keys(slugMap)) {
  for (const [canonical, localized] of Object.entries(slugMap[locale])) {
    reverseMap[localized] = canonical;
  }
}

/**
 * Given a localized path (e.g. "/es/servicios"), returns the canonical English key (e.g. "/services").
 * Falls back to stripping the /es/ prefix if no mapping found.
 */
export function getCanonicalPath(localizedPath: string): string {
  const clean = localizedPath.replace(/\/$/, '') || '/';
  if (reverseMap[clean]) return reverseMap[clean];
  // Fallback: strip /es/ prefix
  if (clean.startsWith('/es/')) return '/' + clean.slice(4);
  if (clean === '/es') return '/';
  return clean;
}

/**
 * Given a canonical English path and a target locale, returns the localized path.
 */
export function getLocalizedSlug(canonicalPath: string, lang: 'en' | 'es'): string {
  const clean = canonicalPath.replace(/\/$/, '') || '/';
  return slugMap[lang]?.[clean] ?? (lang === 'es' ? '/es' + clean : clean);
}
