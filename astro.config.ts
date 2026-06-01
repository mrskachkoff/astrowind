import { readdirSync, readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'astro/config';

import sitemap, { type LinkItem, type SitemapItem } from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import partytown from '@astrojs/partytown';
import icon from 'astro-icon';

import compress from 'astro-compress';
import yaml from 'js-yaml';
import type { AstroIntegration } from 'astro';

import astrowind from './vendor/integration';

import { slugMap } from './src/i18n/slugs';
import { readingTimeRemarkPlugin, responsiveTablesRehypePlugin, lazyImagesRehypePlugin } from './src/utils/frontmatter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasExternalScripts = false;
const whenExternalScripts = (items: (() => AstroIntegration) | (() => AstroIntegration)[] = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

const SITE_URL = 'https://solutions.futurion.es';
const POSTS_DIR = path.resolve(__dirname, 'src/data/post');

type Language = 'en' | 'es';
type PostFrontmatter = {
  publishDate?: Date | string;
  updateDate?: Date | string;
  draft?: boolean;
  lang?: Language;
  translationOf?: string;
};
type SitemapPost = {
  slug: string;
  lang: Language;
  translationOf?: string;
  url: string;
  lastmod?: string;
  draft: boolean;
};

function stripPostExtension(fileName: string): string {
  return fileName.replace(/\.(md|mdx)$/i, '');
}

function withTrailingSlash(pathname: string): string {
  const leadingPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (leadingPathname === '/') return '/';
  return leadingPathname.endsWith('/') ? leadingPathname : `${leadingPathname}/`;
}

function toSiteUrl(pathname: string): string {
  return new URL(withTrailingSlash(pathname), SITE_URL).href;
}

function normalizeSiteUrl(rawUrl: string): string {
  const url = new URL(rawUrl, SITE_URL);
  url.hash = '';
  url.search = '';
  url.pathname = withTrailingSlash(url.pathname);
  return url.href;
}

function createAlternateLinks(enUrl: string, esUrl: string): LinkItem[] {
  return [
    { lang: 'en', url: enUrl },
    { lang: 'es', url: esUrl },
    { lang: 'x-default', url: enUrl },
  ];
}

function addAlternateGroup(alternateLinksByUrl: Map<string, LinkItem[]>, enUrl: string, esUrl: string): void {
  const links = createAlternateLinks(enUrl, esUrl);
  alternateLinksByUrl.set(enUrl, links);
  alternateLinksByUrl.set(esUrl, links);
}

function parsePostFrontmatter(filePath: string): PostFrontmatter {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};

  const parsed = yaml.load(match[1]);
  return parsed && typeof parsed === 'object' ? (parsed as PostFrontmatter) : {};
}

function dateToIso(value: unknown): string | undefined {
  if (!value) return undefined;

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function loadSitemapPosts(): SitemapPost[] {
  return readdirSync(POSTS_DIR)
    .filter((fileName) => /\.(md|mdx)$/i.test(fileName))
    .sort()
    .map((fileName) => {
      const slug = stripPostExtension(fileName);
      const frontmatter = parsePostFrontmatter(path.join(POSTS_DIR, fileName));
      const lang: Language = frontmatter.lang === 'es' || slug.startsWith('es-') ? 'es' : 'en';
      const translationOf =
        typeof frontmatter.translationOf === 'string' ? stripPostExtension(frontmatter.translationOf) : undefined;
      const url = lang === 'es' ? toSiteUrl(`/es/${slug}`) : toSiteUrl(`/${slug}`);

      return {
        slug,
        lang,
        translationOf,
        url,
        lastmod: dateToIso(frontmatter.updateDate ?? frontmatter.publishDate),
        draft: frontmatter.draft === true,
      };
    });
}

function buildSitemapData(): {
  indexableSitemapUrls: Set<string>;
  alternateLinksByUrl: Map<string, LinkItem[]>;
  postLastmodByUrl: Map<string, string>;
} {
  const indexableSitemapUrls = new Set<string>();
  const alternateLinksByUrl = new Map<string, LinkItem[]>();
  const postLastmodByUrl = new Map<string, string>();

  for (const [canonicalPath, enPath] of Object.entries(slugMap.en)) {
    const esPath = slugMap.es[canonicalPath];
    if (!esPath) continue;

    const enUrl = toSiteUrl(enPath);
    const esUrl = toSiteUrl(esPath);
    indexableSitemapUrls.add(enUrl);
    indexableSitemapUrls.add(esUrl);
    addAlternateGroup(alternateLinksByUrl, enUrl, esUrl);
  }

  const posts = loadSitemapPosts().filter((post) => !post.draft);
  const postsBySlug = new Map(posts.map((post) => [post.slug, post]));
  const seenPairs = new Set<string>();

  for (const post of posts) {
    indexableSitemapUrls.add(post.url);
    if (post.lastmod) postLastmodByUrl.set(post.url, post.lastmod);
  }

  for (const post of posts) {
    if (!post.translationOf) continue;

    const translatedPost = postsBySlug.get(post.translationOf);
    if (!translatedPost || translatedPost.lang === post.lang) continue;

    const enPost = post.lang === 'en' ? post : translatedPost;
    const esPost = post.lang === 'es' ? post : translatedPost;
    const pairKey = `${enPost.url}|${esPost.url}`;
    if (seenPairs.has(pairKey)) continue;

    seenPairs.add(pairKey);
    addAlternateGroup(alternateLinksByUrl, enPost.url, esPost.url);
  }

  return { indexableSitemapUrls, alternateLinksByUrl, postLastmodByUrl };
}

function createSitemapSerializer(
  alternateLinksByUrl: Map<string, LinkItem[]>,
  postLastmodByUrl: Map<string, string>
): (item: SitemapItem) => SitemapItem | undefined {
  return (item) => {
    const url = normalizeSiteUrl(item.url);
    const links = alternateLinksByUrl.get(url);
    const lastmod = postLastmodByUrl.get(url);
    const serializedItem: SitemapItem = { url };

    if (links) {
      serializedItem.links = links.map((link) => ({ ...link }));
    }

    if (lastmod) {
      serializedItem.lastmod = lastmod;
    }

    return serializedItem;
  };
}

const sitemapData = buildSitemapData();

export default defineConfig({
  output: 'static',
  site: 'https://solutions.futurion.es',

  redirects: {
    '/pricing': '/automation-roadmap/',
    '/es/precios': '/es/hoja-de-ruta-de-automatizacion/',

    '/services': '/medcore-private-ai/',
    '/es/servicios': '/es/medcore-ia-privada/',

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
    '/es-eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria':
      '/es/es-eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria/',
    '/es/eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria':
      '/es/es-eipd-evaluacion-impacto-proteccion-datos-ia-sanitaria/',
    '/es-european-sovereign-cloud-ia-sanitaria': '/es/es-european-sovereign-cloud-ia-sanitaria/',
    '/es/european-sovereign-cloud-ia-sanitaria': '/es/es-european-sovereign-cloud-ia-sanitaria/',
    '/es-automatizacion-responsable': '/es/es-automatizacion-responsable/',
    '/es/automatizacion-responsable': '/es/es-automatizacion-responsable/',
    '/es-barreras-control-privacidad-ia-sanitaria-presidio-openai-privacy-filter':
      '/es/es-barreras-control-privacidad-ia-sanitaria-presidio-openai-privacy-filter/',
    '/es/barreras-control-privacidad-ia-sanitaria-presidio-openai-privacy-filter':
      '/es/es-barreras-control-privacidad-ia-sanitaria-presidio-openai-privacy-filter/',
    '/es-flujos-atencion-sanitaria-personalizada': '/es/es-flujos-atencion-sanitaria-personalizada/',
    '/es/flujos-atencion-sanitaria-personalizada': '/es/es-flujos-atencion-sanitaria-personalizada/',
    '/es-guia-cumplimiento-rgpd-consultas-sanitarias': '/es/es-guia-cumplimiento-rgpd-consultas-sanitarias/',
    '/es/guia-cumplimiento-rgpd-consultas-sanitarias': '/es/es-guia-cumplimiento-rgpd-consultas-sanitarias/',
    '/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana':
      '/es/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana/',
    '/es/retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana':
      '/es/es-retirada-openevidence-ue-reino-unido-sanidad-on-premise-nube-soberana/',
    '/es-por-que-sanidad-necesita-ia-local': '/es/es-por-que-sanidad-necesita-ia-local/',
    '/es/por-que-sanidad-necesita-ia-local': '/es/es-por-que-sanidad-necesita-ia-local/',
    '/es-presentando-medcore-private-ai': '/es/es-presentando-medcore-private-ai/',
    '/es/presentando-medcore-private-ai': '/es/es-presentando-medcore-private-ai/',
    '/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd':
      '/es/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd/',
    '/es/revision-subprocesadores-gestion-riesgos-proveedores-rgpd':
      '/es/es-revision-subprocesadores-gestion-riesgos-proveedores-rgpd/',
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
      filter: (page) => {
        try {
          return sitemapData.indexableSitemapUrls.has(normalizeSiteUrl(page));
        } catch {
          return false;
        }
      },
      serialize: createSitemapSerializer(sitemapData.alternateLinksByUrl, sitemapData.postLastmodByUrl),
      namespaces: {
        news: false,
        xhtml: true,
        image: false,
        video: false,
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

    // Dev-only: AstroWind sets trailingSlash:'always', which makes Astro's dev
    // server 404 the `/_image` optimizer endpoint (no trailing slash) so images
    // don't render in `npm run dev`. Relax it to 'ignore' in dev only; production
    // keeps 'always' for canonical trailing-slash URLs.
    {
      name: 'dev-image-endpoint-trailingslash-fix',
      hooks: {
        'astro:config:setup': ({ command, updateConfig }) => {
          if (command === 'dev') {
            updateConfig({ trailingSlash: 'ignore' });
          }
        },
      },
    },
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
