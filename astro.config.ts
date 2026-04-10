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
  site: 'https://solutions.futurion.es',

  redirects: {
    '/free-ai-audit': '/automation-roadmap/',

    // Spanish utility pages
    '/es/auditoria-ia-gratuita': '/es/hoja-de-ruta-de-automatizacion/',

    // Mandatory: redirects for Spanish posts (canonical: /es/es-<slug>/)
    '/es-5-tareas-clinica-dejar-hacer-manualmente': '/es/es-5-tareas-clinica-dejar-hacer-manualmente/',
    '/es/5-tareas-clinica-dejar-hacer-manualmente': '/es/es-5-tareas-clinica-dejar-hacer-manualmente/',
    '/es-clinicas-dentales-automatizar-flujos-conformidad': '/es/es-clinicas-dentales-automatizar-flujos-conformidad/',
    '/es/clinicas-dentales-automatizar-flujos-conformidad': '/es/es-clinicas-dentales-automatizar-flujos-conformidad/',
    '/es-consultora-o-decisora-ia-responsabilidad-clinica': '/es/es-consultora-o-decisora-ia-responsabilidad-clinica/',
    '/es/consultora-o-decisora-ia-responsabilidad-clinica': '/es/es-consultora-o-decisora-ia-responsabilidad-clinica/',
    '/es-eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria': '/es/es-eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria/',
    '/es/eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria': '/es/es-eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria/',
    '/es-european-sovereign-cloud-ia-sanitaria': '/es/es-european-sovereign-cloud-ia-sanitaria/',
    '/es/european-sovereign-cloud-ia-sanitaria': '/es/es-european-sovereign-cloud-ia-sanitaria/',
    '/es-guia-cumplimiento-rgpd-consultas-sanitarias': '/es/es-guia-cumplimiento-rgpd-consultas-sanitarias/',
    '/es/guia-cumplimiento-rgpd-consultas-sanitarias': '/es/es-guia-cumplimiento-rgpd-consultas-sanitarias/',
    '/es-por-que-sanidad-necesita-ia-local': '/es/es-por-que-sanidad-necesita-ia-local/',
    '/es/por-que-sanidad-necesita-ia-local': '/es/es-por-que-sanidad-necesita-ia-local/',
    '/es-presentando-medcore-private-ai': '/es/es-presentando-medcore-private-ai/',
    '/es/presentando-medcore-private-ai': '/es/es-presentando-medcore-private-ai/',
    '/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd': '/es/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd/',
    '/es/revision-subprocesadores-gestion-riesgos-proveedores-rgpd': '/es/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd/',
    '/es-soluciones-ia-hibridas-sanidad': '/es/es-soluciones-ia-hibridas-sanidad/',
    '/es/soluciones-ia-hibridas-sanidad': '/es/es-soluciones-ia-hibridas-sanidad/',

    // Spanish post: rename to follow required es- prefix
    '/es-agentes-ia-sanidad-riesgos-rgpd': '/es/es-agentes-ia-sanidad-riesgos-rgpd/',
    '/es/agentes-ia-sanidad-riesgos-rgpd': '/es/es-agentes-ia-sanidad-riesgos-rgpd/',
    '/agentes-ia-sanidad-riesgos-rgpd': '/es/es-agentes-ia-sanidad-riesgos-rgpd/',

    // Tags (ensure Spanish tag routes)
    '/tag/agentes-ia': '/es/tag/agentes-ia/',
    '/tag/sanidad': '/es/tag/sanidad/',
    '/tag/clinicas-dentales': '/es/tag/clinicas-dentales/',
    '/tag/privacidad-de-datos': '/es/tag/privacidad-de-datos/',
    '/tag/ia': '/es/tag/ia/',
    '/tag/ia-hibrida': '/es/tag/ia-hibrida/',
    '/tag/acuerdos-de-tratamiento-de-datos': '/es/tag/acuerdos-de-tratamiento-de-datos/',
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
