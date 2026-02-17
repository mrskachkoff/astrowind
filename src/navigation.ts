import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';
import { useTranslations, getLocalizedPath } from './i18n/utils';
import type { Locale } from './i18n/utils';

export function getHeaderData(lang: Locale = 'en') {
  const t = useTranslations(lang);
  return {
    links: [
      {
        text: t('nav.services'),
        links: [
          {
            text: t('nav.forSmallPractices'),
            href: getLocalizedPath('/services', lang),
          },
          {
            text: t('nav.medcorePrivateAi'),
            href: getLocalizedPath('/medcore-private-ai', lang),
          },
          {
            text: t('nav.freeAiAudit'),
            href: getLocalizedPath('/free-ai-audit', lang),
          },
          {
            text: t('nav.pricing'),
            href: getLocalizedPath('/pricing', lang),
          },
        ],
      },
      {
        text: t('nav.freeAiAudit'),
        href: getLocalizedPath('/free-ai-audit', lang),
      },
      {
        text: t('nav.blog'),
        href: getLocalizedPath('/blog', lang),
      },
      {
        text: t('nav.about'),
        href: getLocalizedPath('/about', lang),
      },
      {
        text: t('nav.contact'),
        href: getLocalizedPath('/contact', lang),
      },
    ],
    actions: [{ text: t('nav.bookFreeAudit'), href: getLocalizedPath('/free-ai-audit', lang) }],
  };
}

export function getFooterData(lang: Locale = 'en') {
  const t = useTranslations(lang);
  return {
    links: [
      {
        title: t('footer.services'),
        links: [
          { text: t('footer.smallPracticeAutomation'), href: getLocalizedPath('/services', lang) },
          { text: t('footer.medcorePrivateAi'), href: getLocalizedPath('/medcore-private-ai', lang) },
          { text: t('footer.freeAiAudit'), href: getLocalizedPath('/free-ai-audit', lang) },
          { text: t('footer.pricing'), href: getLocalizedPath('/pricing', lang) },
        ],
      },
      {
        title: t('footer.company'),
        links: [
          { text: t('footer.about'), href: getLocalizedPath('/about', lang) },
          { text: t('footer.blog'), href: getLocalizedPath('/blog', lang) },
          { text: t('footer.contact'), href: getLocalizedPath('/contact', lang) },
        ],
      },
      {
        title: t('footer.legal'),
        links: [
          { text: t('footer.privacyPolicy'), href: getLocalizedPath('/privacy', lang) },
          { text: t('footer.termsOfService'), href: getLocalizedPath('/terms', lang) },
        ],
      },
    ],
    secondaryLinks: [
      { text: t('footer.terms'), href: getLocalizedPath('/terms', lang) },
      { text: t('footer.privacyPolicy'), href: getLocalizedPath('/privacy', lang) },
    ],
    socialLinks: [
      { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: 'https://linkedin.com/in/ivan-skachkov' },
      { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
    ],
    footNote: `
    &copy; ${new Date().getFullYear()} Futurion Solutions. ${t('footer.allRightsReserved')}.
  `,
  };
}

// Backward-compatible exports for any code still using the old static imports
export const headerData = getHeaderData('en');
export const footerData = getFooterData('en');
