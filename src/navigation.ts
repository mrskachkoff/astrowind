import { getPermalink, getBlogPermalink, getAsset } from './utils/permalinks';

export const headerData = {
  links: [
    {
      text: 'Services',
      links: [
        {
          text: 'For Small Practices',
          href: getPermalink('/services'),
        },
        {
          text: 'MedCore Private AI',
          href: getPermalink('/medcore-private-ai'),
        },
        {
          text: 'Free AI Audit',
          href: getPermalink('/free-ai-audit'),
        },
        {
          text: 'Pricing',
          href: getPermalink('/pricing'),
        },
      ],
    },
    {
      text: 'Free AI Audit',
      href: getPermalink('/free-ai-audit'),
    },
    {
      text: 'Blog',
      href: getBlogPermalink(),
    },
    {
      text: 'About',
      href: getPermalink('/about'),
    },
    {
      text: 'Contact',
      href: getPermalink('/contact'),
    },
  ],
  actions: [{ text: 'Book Free Audit', href: getPermalink('/free-ai-audit') }],
};

export const footerData = {
  links: [
    {
      title: 'Services',
      links: [
        { text: 'Small Practice Automation', href: getPermalink('/services') },
        { text: 'MedCore Private AI', href: getPermalink('/medcore-private-ai') },
        { text: 'Free AI Audit', href: getPermalink('/free-ai-audit') },
        { text: 'Medical AI Demo', href: getPermalink('/medical-ai-demo') },
        { text: 'Pricing', href: getPermalink('/pricing') },
      ],
    },
    {
      title: 'Company',
      links: [
        { text: 'About', href: getPermalink('/about') },
        { text: 'Blog', href: getBlogPermalink() },
        { text: 'Contact', href: getPermalink('/contact') },
      ],
    },
    {
      title: 'Legal',
      links: [
        { text: 'Privacy Policy', href: getPermalink('/privacy') },
        { text: 'Terms of Service', href: getPermalink('/terms') },
      ],
    },
  ],
  secondaryLinks: [
    { text: 'Terms', href: getPermalink('/terms') },
    { text: 'Privacy Policy', href: getPermalink('/privacy') },
  ],
  socialLinks: [
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: 'https://linkedin.com/in/ivan-skachkov' },
    { ariaLabel: 'RSS', icon: 'tabler:rss', href: getAsset('/rss.xml') },
  ],
  footNote: `
    &copy; ${new Date().getFullYear()} Futurion Solutions. All rights reserved.
  `,
};
