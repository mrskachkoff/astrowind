import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import icon from 'astro-icon';

import compress from 'astro-compress';
import type { AstroIntegration } from 'astro';

import astrowind from './vendor/integration';

import { readingTimeRemarkPlugin, responsiveTablesRehypePlugin, lazyImagesRehypePlugin } from './src/utils/frontmatter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

export default defineConfig({
  output: 'static',

  redirects: {
    '/es/auditoria-ia-gratuita': '/es/hoja-de-ruta-de-automatizacion',
    '/es-clinicas-dentales-automatizar-flujos-conformidad': '/es/es-clinicas-dentales-automatizar-flujos-conformidad',
    '/es-soluciones-ia-hibridas-sanidad': '/es/es-soluciones-ia-hibridas-sanidad',
    '/es-guia-cumplimiento-rgpd-consultas-sanitarias': '/es/es-guia-cumplimiento-rgpd-consultas-sanitarias',
    '/es-por-que-sanidad-necesita-ia-local': '/es/es-por-que-sanidad-necesita-ia-local',
    '/es/clinicas-dentales-automatizar-flujos-conformidad': '/es/es-clinicas-dentales-automatizar-flujos-conformidad',
    '/es/soluciones-ia-hibridas-sanidad': '/es/es-soluciones-ia-hibridas-sanidad',
    '/tag/agentes-ia': '/es/tag/agentes-ia',
    '/tag/sanidad': '/es/tag/sanidad',
    '/tag/clinicas-dentales': '/es/tag/clinicas-dentales',
    '/tag/privacidad-de-datos': '/es/tag/privacidad-de-datos',
    '/tag/ia': '/es/tag/ia',
    '/tag/ia-hibrida': '/es/tag/ia-hibrida',
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  integrations: [
    sitemap({
      filter: (page) => !page.includes('/tag/'),
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en',
          es: 'es',
        },
      },
    }),
    mdx(),
    icon({
      include: {
        tabler: ['*'],
        'flat-color-icons': [
          'template',
          'gallery',
          'approval',
          'document',
          'advertising',
          'currency-exchange',
          'voice-presentation',
          'business-contact',
          'database',
        ],
      },
    }),

    ...whenExternalScripts(() =>
      partytown({
        config: { forward: ['dataLayer.push'] },
      })
    ),

    compress({
      CSS: true,
      HTML: {
        'html-minifier-terser': {
          removeAttributeQuotes: false,
        },
      },
      Image: false,
      JavaScript: true,
      SVG: false,
      Logger: 1,
    }),

    astrowind({
      config: './src/config.yaml',
    }),
  ],

  image: {
    domains: ['cdn.pixabay.com', 'images.unsplash.com'],
  },

  markdown: {
    remarkPlugins: [readingTimeRemarkPlugin],
    rehypePlugins: [responsiveTablesRehypePlugin, lazyImagesRehypePlugin],
  },

  vite: {
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
  },
});
