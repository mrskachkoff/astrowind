import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import yaml from 'js-yaml';
import { parseSitemap } from 'sitemap';
import ts from 'typescript';

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const idx = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return fallback;
  const token = args[idx];
  if (token.includes('=')) return token.split('=').slice(1).join('=');
  return args[idx + 1] ?? fallback;
};

const site = 'https://solutions.futurion.es';
const distDir = path.resolve(arg('dist', 'dist'));
const postsDir = path.resolve('src/data/post');
const slugsPath = path.resolve('src/i18n/slugs.ts');
const expectedAlternateLangs = ['en', 'es', 'x-default'];

function stripPostExtension(fileName) {
  return fileName.replace(/\.(md|mdx)$/i, '');
}

function withTrailingSlash(pathname) {
  const leadingPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (leadingPathname === '/') return '/';
  return leadingPathname.endsWith('/') ? leadingPathname : `${leadingPathname}/`;
}

function toSiteUrl(pathname) {
  return new URL(withTrailingSlash(pathname), site).href;
}

function normalizeSiteUrl(rawUrl) {
  const url = new URL(rawUrl, site);
  url.hash = '';
  url.search = '';
  url.pathname = withTrailingSlash(url.pathname);
  return url.href;
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match?.[2] ?? '';
}

function relTokens(tag) {
  return getAttr(tag, 'rel')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function findCanonicalHrefs(html) {
  return (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((tag) => relTokens(tag).includes('canonical'))
    .map((tag) => getAttr(tag, 'href'));
}

function sitemapUrlToHtmlPath(rawUrl) {
  const url = new URL(rawUrl);
  if (url.origin !== new URL(site).origin) {
    throw new Error(`Sitemap URL is outside site origin: ${rawUrl}`);
  }

  const pathname = decodeURIComponent(withTrailingSlash(url.pathname));
  const relativePath = pathname === '/' ? 'index.html' : path.join(pathname.replace(/^\/+/, ''), 'index.html');
  const htmlPath = path.resolve(distDir, relativePath);
  const distRoot = `${distDir}${path.sep}`;

  if (htmlPath !== distDir && !htmlPath.startsWith(distRoot)) {
    throw new Error(`Sitemap URL resolves outside dist: ${rawUrl}`);
  }

  return htmlPath;
}

function parseFrontmatter(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const parsed = yaml.load(match[1]);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function dateToIso(value) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function linkSignature(linkMap) {
  return expectedAlternateLangs.map((lang) => `${lang}=${linkMap.get(lang) ?? ''}`).join('|');
}

function addAlternateGroup(expectedAlternatesByUrl, groups, enUrl, esUrl, source) {
  const links = new Map([
    ['en', enUrl],
    ['es', esUrl],
    ['x-default', enUrl],
  ]);

  expectedAlternatesByUrl.set(enUrl, links);
  expectedAlternatesByUrl.set(esUrl, links);
  groups.push({ enUrl, esUrl, links, source });
}

async function loadSlugMap() {
  const source = await readFile(slugsPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: slugsPath,
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
  const module = await import(moduleUrl);

  if (!module.slugMap?.en || !module.slugMap?.es) {
    throw new Error('Could not load slugMap from src/i18n/slugs.ts');
  }

  return module.slugMap;
}

async function loadPosts() {
  const files = (await readdir(postsDir)).filter((file) => /\.(md|mdx)$/i.test(file)).sort();
  const posts = [];

  for (const file of files) {
    const fullPath = path.join(postsDir, file);
    const raw = await readFile(fullPath, 'utf8');
    const frontmatter = parseFrontmatter(raw, file);
    const slug = stripPostExtension(file);
    const lang = frontmatter.lang === 'es' || slug.startsWith('es-') ? 'es' : 'en';
    const url = lang === 'es' ? toSiteUrl(`/es/${slug}`) : toSiteUrl(`/${slug}`);

    posts.push({
      file,
      slug,
      lang,
      url,
      draft: frontmatter.draft === true,
      translationOf:
        typeof frontmatter.translationOf === 'string' ? stripPostExtension(frontmatter.translationOf) : undefined,
      lastmod: dateToIso(frontmatter.updateDate ?? frontmatter.publishDate),
    });
  }

  return posts;
}

async function buildExpectedData() {
  const slugMap = await loadSlugMap();
  const posts = await loadPosts();
  const publicPosts = posts.filter((post) => !post.draft);
  const postsBySlug = new Map(publicPosts.map((post) => [post.slug, post]));
  const expectedAlternatesByUrl = new Map();
  const groups = [];
  const expectedLastmodByUrl = new Map();
  const postUrls = new Set();
  const spanishPostAliases = new Set();
  const seenPairs = new Set();

  for (const [canonicalPath, enPath] of Object.entries(slugMap.en)) {
    const esPath = slugMap.es[canonicalPath];
    if (!esPath) continue;
    addAlternateGroup(expectedAlternatesByUrl, groups, toSiteUrl(enPath), toSiteUrl(esPath), `static:${canonicalPath}`);
  }

  for (const post of posts) {
    if (post.lang === 'es' && post.slug.startsWith('es-')) {
      spanishPostAliases.add(post.slug.replace(/^es-/, ''));
    }

    if (post.draft) continue;
    postUrls.add(post.url);
    if (post.lastmod) expectedLastmodByUrl.set(post.url, post.lastmod);
  }

  for (const post of publicPosts) {
    if (!post.translationOf) continue;

    const translatedPost = postsBySlug.get(post.translationOf);
    if (!translatedPost || translatedPost.lang === post.lang) continue;

    const enPost = post.lang === 'en' ? post : translatedPost;
    const esPost = post.lang === 'es' ? post : translatedPost;
    const pairKey = `${enPost.url}|${esPost.url}`;
    if (seenPairs.has(pairKey)) continue;

    seenPairs.add(pairKey);
    addAlternateGroup(expectedAlternatesByUrl, groups, enPost.url, esPost.url, `post:${enPost.slug}`);
  }

  return { expectedAlternatesByUrl, expectedLastmodByUrl, groups, postUrls, spanishPostAliases };
}

async function readSitemapItems(errors) {
  const files = (await readdir(distDir))
    .filter((file) => /^sitemap-\d+\.xml$/i.test(file))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  if (!files.length) {
    throw new Error(`No sitemap chunk files found in ${path.relative(process.cwd(), distDir) || distDir}`);
  }

  const itemsByUrl = new Map();
  const rawItems = [];

  for (const file of files) {
    const fullPath = path.join(distDir, file);
    const raw = await readFile(fullPath, 'utf8');
    const label = path.relative(process.cwd(), fullPath);

    if (!/xmlns:xhtml=(['"])http:\/\/www\.w3\.org\/1999\/xhtml\1/.test(raw)) {
      errors.push(`${label}: missing xmlns:xhtml namespace`);
    }

    if (/<changefreq>/i.test(raw)) {
      errors.push(`${label}: sitemap must not emit <changefreq>`);
    }

    if (/<priority>/i.test(raw)) {
      errors.push(`${label}: sitemap must not emit <priority>`);
    }

    const items = await parseSitemap(Readable.from([raw]));
    for (const item of items) {
      const url = normalizeSiteUrl(item.url);
      const normalizedItem = {
        ...item,
        url,
        links: (item.links ?? []).map((link) => ({ ...link, url: normalizeSiteUrl(link.url) })),
      };

      if (itemsByUrl.has(url)) {
        errors.push(`${label}: duplicate sitemap URL ${url}`);
      }

      itemsByUrl.set(url, normalizedItem);
      rawItems.push({ label, item: normalizedItem });
    }
  }

  return { itemsByUrl, rawItems };
}

function isSpanishPostAlias(rawUrl, spanishPostAliases) {
  const pathname = withTrailingSlash(new URL(rawUrl, site).pathname);
  const match = pathname.match(/^\/es\/([^/]+)\/$/);
  return Boolean(match && spanishPostAliases.has(match[1]));
}

function buildLinkMap(item, errors) {
  const linkMap = new Map();

  for (const link of item.links ?? []) {
    const lang = link.lang || link.hreflang;
    if (!lang) {
      errors.push(`${item.url}: alternate link is missing hreflang`);
      continue;
    }

    if (linkMap.has(lang)) {
      errors.push(`${item.url}: duplicate alternate hreflang "${lang}"`);
    }

    linkMap.set(lang, normalizeSiteUrl(link.url));
  }

  return linkMap;
}

function verifyAlternates(itemsByUrl, expectedAlternatesByUrl, groups, errors) {
  const linkMapsByUrl = new Map();

  for (const [url, expectedLinks] of expectedAlternatesByUrl) {
    const item = itemsByUrl.get(url);
    if (!item) {
      errors.push(`${url}: translated URL is missing from sitemap`);
      continue;
    }

    const linkMap = buildLinkMap(item, errors);
    linkMapsByUrl.set(url, linkMap);

    for (const lang of expectedAlternateLangs) {
      const expectedUrl = expectedLinks.get(lang);
      if (linkMap.get(lang) !== expectedUrl) {
        errors.push(
          `${url}: expected hreflang="${lang}" to point to ${expectedUrl}, got ${linkMap.get(lang) || 'none'}`
        );
      }
    }

    const extraLangs = [...linkMap.keys()].filter((lang) => !expectedAlternateLangs.includes(lang));
    if (extraLangs.length) {
      errors.push(`${url}: unexpected hreflang value(s): ${extraLangs.join(', ')}`);
    }

    const selfLang = expectedLinks.get('en') === url ? 'en' : 'es';
    if (linkMap.get(selfLang) !== url) {
      errors.push(`${url}: missing self-referencing hreflang="${selfLang}"`);
    }
  }

  for (const group of groups) {
    const enLinkMap = linkMapsByUrl.get(group.enUrl);
    const esLinkMap = linkMapsByUrl.get(group.esUrl);
    if (!enLinkMap || !esLinkMap) continue;

    if (linkSignature(enLinkMap) !== linkSignature(esLinkMap)) {
      errors.push(`${group.source}: EN and ES sitemap entries do not have identical reciprocal alternates`);
    }
  }
}

function verifyAliases(rawItems, spanishPostAliases, errors) {
  for (const { label, item } of rawItems) {
    if (isSpanishPostAlias(item.url, spanishPostAliases)) {
      errors.push(`${label}: sitemap URL points to Spanish alias ${item.url}`);
    }

    for (const link of item.links ?? []) {
      if (isSpanishPostAlias(link.url, spanishPostAliases)) {
        errors.push(`${label}: hreflang link points to Spanish alias ${link.url}`);
      }
    }
  }
}

function verifyLastmod(itemsByUrl, expectedLastmodByUrl, postUrls, errors) {
  for (const [url, item] of itemsByUrl) {
    if (!postUrls.has(url)) {
      if (item.lastmod) errors.push(`${url}: non-post sitemap URL must not emit <lastmod>`);
      continue;
    }

    const expectedLastmod = expectedLastmodByUrl.get(url);
    if (!expectedLastmod) {
      if (item.lastmod) errors.push(`${url}: post has no reliable source date but sitemap emits ${item.lastmod}`);
      continue;
    }

    if (item.lastmod !== expectedLastmod) {
      errors.push(`${url}: expected <lastmod>${expectedLastmod}</lastmod>, got ${item.lastmod || 'none'}`);
    }
  }
}

async function verifyPageCanonicals(itemsByUrl, errors) {
  for (const url of itemsByUrl.keys()) {
    let htmlPath;
    let html;

    try {
      htmlPath = sitemapUrlToHtmlPath(url);
      html = await readFile(htmlPath, 'utf8');
    } catch (err) {
      errors.push(`${url}: could not read generated HTML (${err.message})`);
      continue;
    }

    const label = path.relative(process.cwd(), htmlPath);
    const canonicalHrefs = findCanonicalHrefs(html);

    if (canonicalHrefs.length !== 1) {
      errors.push(`${label}: expected exactly one canonical link for ${url}, found ${canonicalHrefs.length}`);
      continue;
    }

    const canonical = canonicalHrefs[0] ? normalizeSiteUrl(canonicalHrefs[0]) : '';
    if (canonical !== url) {
      errors.push(`${label}: expected self-canonical ${url}, got ${canonical || 'none'}`);
    }
  }
}

async function main() {
  const errors = [];
  const { expectedAlternatesByUrl, expectedLastmodByUrl, groups, postUrls, spanishPostAliases } =
    await buildExpectedData();
  const { itemsByUrl, rawItems } = await readSitemapItems(errors);

  verifyAlternates(itemsByUrl, expectedAlternatesByUrl, groups, errors);
  verifyAliases(rawItems, spanishPostAliases, errors);
  verifyLastmod(itemsByUrl, expectedLastmodByUrl, postUrls, errors);
  await verifyPageCanonicals(itemsByUrl, errors);

  if (errors.length) {
    throw new Error(`Found ${errors.length} sitemap SEO issue(s):\n${errors.map((err) => `- ${err}`).join('\n')}`);
  }

  console.log(
    `[verify-sitemap-hreflang] OK (${itemsByUrl.size} URLs, ${groups.length} alternate groups, ${itemsByUrl.size} self-canonicals)`
  );
}

main().catch((err) => {
  console.error(`[verify-sitemap-hreflang] FAILED: ${err.message}`);
  process.exit(1);
});
