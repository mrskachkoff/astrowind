import { getAsset } from './utils/permalinks';
import { useTranslations, getLocalizedPath } from './i18n/utils';
import type { Locale } from './i18n/utils';
import type { ImageMetadata } from 'astro';

import imgTrustPrompt from '~/assets/images/trustprompt.png';
import imgTrustCore from '~/assets/images/trustcore.png';
import imgTrustAuto from '~/assets/images/trustauto.png';

export function getHeaderData(lang: Locale = 'en') {
  const t = useTranslations(lang);
  return {
    links: [
      {
        text: t('nav.products'),
        links: [
          {
            text: 'TrustPrompt',
            href: getLocalizedPath('/products/trustprompt', lang),
            logo: imgTrustPrompt as ImageMetadata,
          },
          {
            text: 'TrustCore',
            href: getLocalizedPath('/products/trustcore', lang),
            logo: imgTrustCore as ImageMetadata,
          },
          {
            text: 'TrustAuto',
            href: getLocalizedPath('/products/trustauto', lang),
            logo: imgTrustAuto as ImageMetadata,
          },
        ],
      },
      {
        text: t('nav.services'),
        links: [
          {
            text: t('nav.medcorePrivateAi'),
            href: getLocalizedPath('/medcore-private-ai', lang),
          },
          {
            text: t('nav.freeAiAudit'),
            href: getLocalizedPath('/automation-roadmap', lang),
          },
        ],
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
    actions: [],
  };
}

export function getFooterData(lang: Locale = 'en') {
  const t = useTranslations(lang);
  return {
    links: [
      {
        title: t('footer.products'),
        links: [
          {
            text: 'TrustPrompt',
            href: getLocalizedPath('/products/trustprompt', lang),
            logo: imgTrustPrompt as ImageMetadata,
          },
          {
            text: 'TrustCore',
            href: getLocalizedPath('/products/trustcore', lang),
            logo: imgTrustCore as ImageMetadata,
          },
          {
            text: 'TrustAuto',
            href: getLocalizedPath('/products/trustauto', lang),
            logo: imgTrustAuto as ImageMetadata,
          },
        ],
      },
      {
        title: t('footer.services'),
        links: [
          { text: t('footer.medcorePrivateAi'), href: getLocalizedPath('/medcore-private-ai', lang) },
          { text: t('footer.freeAiAudit'), href: getLocalizedPath('/automation-roadmap', lang) },
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
      { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset(lang === 'es' ? '/es/rss.xml' : '/rss.xml') },
    ],
    footNote: `
    &copy; ${new Date().getFullYear()} Futurion Solutions. ${t('footer.allRightsReserved')}.
  `,
  };
}

// Backward-compatible exports for any code still using the old static imports
export const headerData = getHeaderData('en');
export const footerData = getFooterData('en');
