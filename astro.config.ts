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

const indexableSitemapUrls = new Set([
  'https://solutions.futurion.es/',
  'https://solutions.futurion.es/about/',
  'https://solutions.futurion.es/automation-roadmap/',
  'https://solutions.futurion.es/blog/',
  'https://solutions.futurion.es/contact/',
  'https://solutions.futurion.es/medcore-private-ai/',
  'https://solutions.futurion.es/pricing/',
  'https://solutions.futurion.es/privacy/',
  'https://solutions.futurion.es/services/',
  'https://solutions.futurion.es/terms/',
  'https://solutions.futurion.es/es/',
  'https://solutions.futurion.es/es/blog/',
  'https://solutions.futurion.es/es/contacto/',
  'https://solutions.futurion.es/es/hoja-de-ruta-de-automatizacion/',
  'https://solutions.futurion.es/es/medcore-ia-privada/',
  'https://solutions.futurion.es/es/nosotros/',
  'https://solutions.futurion.es/es/precios/',
  'https://solutions.futurion.es/es/privacidad/',
  'https://solutions.futurion.es/es/servicios/',
  'https://solutions.futurion.es/es/terminos/',
  'https://solutions.futurion.es/5-tasks-clinic-stop-doing-manually/',
  'https://solutions.futurion.es/ai-agents-healthcare-gdpr-risks/',
  'https://solutions.futurion.es/consultant-or-decision-maker-ai-clinical-accountability/',
  'https://solutions.futurion.es/data-protection-impact-assessment-healthcare-ai/',
  'https://solutions.futurion.es/dental-clinics-automate-workflows-compliance/',
  'https://solutions.futurion.es/european-sovereign-cloud-healthcare-ai/',
  'https://solutions.futurion.es/gdpr-compliance-small-healthcare-providers-guide/',
  'https://solutions.futurion.es/gdpr-subprocessor-management-eu-healthcare/',
  'https://solutions.futurion.es/healthcare-automation-architecture/',
  'https://solutions.futurion.es/introducing-medcore-private-ai/',
  'https://solutions.futurion.es/openevidence-eu-uk-withdrawal-private-on-prem-sovereign-cloud/',
  'https://solutions.futurion.es/personalized-patient-treatment-workflows-healthcare/',
  'https://solutions.futurion.es/why-healthcare-needs-on-premise-ai/',
  'https://solutions.futurion.es/why-hybrid-ai-solutions-matter-healthcare/',
  'https://solutions.futurion.es/es/es-5-tareas-clinica-dejar-hacer-manualmente/',
  'https://solutions.futurion.es/es/es-agentes-ia-sanidad-riesgos-rgpd/',
  'https://solutions.futurion.es/es/es-automatizacion-responsable/',
  'https://solutions.futurion.es/es/es-clinicas-dentales-automatizar-flujos-conformidad/',
  'https://solutions.futurion.es/es/es-consultora-o-decisora-ia-responsabilidad-clinica/',
  'https://solutions.futurion.es/es/es-eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria/',
  'https://solutions.futurion.es/es/es-european-sovereign-cloud-ia-sanitaria/',
  'https://solutions.futurion.es/es/es-flujos-atencion-sanitaria-personalizada/',
  'https://solutions.futurion.es/es/es-guia-cumplimiento-rgpd-consultas-sanitarias/',
  'https://solutions.futurion.es/es/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana/',
  'https://solutions.futurion.es/es/es-por-que-sanidad-necesita-ia-local/',
  'https://solutions.futurion.es/es/es-presentando-medcore-private-ai/',
  'https://solutions.futurion.es/es/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd/',
  'https://solutions.futurion.es/es/es-soluciones-ia-hibridas-sanidad/',
]);

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
    '/es-automatizacion-responsable': '/es/es-automatizacion-responsable/',
    '/es/automatizacion-responsable': '/es/es-automatizacion-responsable/',
    '/es-flujos-atencion-sanitaria-personalizada': '/es/es-flujos-atencion-sanitaria-personalizada/',
    '/es/flujos-atencion-sanitaria-personalizada': '/es/es-flujos-atencion-sanitaria-personalizada/',
    '/es-guia-cumplimiento-rgpd-consultas-sanitarias': '/es/es-guia-cumplimiento-rgpd-consultas-sanitarias/',
    '/es/guia-cumplimiento-rgpd-consultas-sanitarias': '/es/es-guia-cumplimiento-rgpd-consultas-sanitarias/',
    '/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana': '/es/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana/',
    '/es/retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana': '/es/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana/',
    '/es-por-que-sanidad-necesita-ia-local': '/es/es-por-que-sanidad-necesita-ia-local/',
    '/es/por-que-sanidad-necesita-ia-local': '/es/es-por-que-sanidad-necesita-ia-local/',
    '/es-presentando-medcore-private-ai': '/es/es-presentando-medcore-private-ai/',
    '/es/presentando-medcore-private-ai': '/es/es-presentando-medcore-private-ai/',
    '/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd': '/es/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd/',
    '/es/revision-subprocesadores-gestion-riesgos-proveedores-rgpd': '/es/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd/',
    '/es-soluciones-ia-hibridas-sanidad': '/es/es-soluciones-ia-hibridas-sanidad/',
    '/es/soluciones-ia-hibridas-sanidad': '/es/es-soluciones-ia-hibridas-sanidad/',

    // Legacy root Spanish tag URLs discovered by Google Search Console.
    '/tag/agentes-ia': '/es/tag/agentes-ia/',
    '/tag/sanidad': '/es/tag/sanidad/',
    '/tag/clinicas-dentales': '/es/tag/clinicas-dentales/',
    '/tag/privacidad-de-datos': '/es/tag/privacidad-de-datos/',
    '/tag/ia': '/es/tag/ia/',
    '/tag/ia-hibrida': '/es/tag/ia-hibrida/',
    '/tag/acuerdos-de-tratamiento-de-datos': '/es/tag/acuerdos-de-tratamiento-de-datos/',
    '/tag/proteccion-de-datos': '/es/tag/proteccion-de-datos/',
    '/tag/transferencias-internacionales-de-datos': '/es/tag/transferencias-internacionales-de-datos/',

    // Spanish post: rename to follow required es- prefix
    '/es-agentes-ia-sanidad-riesgos-rgpd': '/es/es-agentes-ia-sanidad-riesgos-rgpd/',
    '/es/agentes-ia-sanidad-riesgos-rgpd': '/es/es-agentes-ia-sanidad-riesgos-rgpd/',
    '/agentes-ia-sanidad-riesgos-rgpd': '/es/es-agentes-ia-sanidad-riesgos-rgpd/',

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
      filter: (page) => indexableSitemapUrls.has(page.endsWith('/') ? page : `${page}/`),
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
