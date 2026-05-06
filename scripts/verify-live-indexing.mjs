import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback = '') => {
  const idx = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return fallback;
  const token = args[idx];
  if (token.includes('=')) return token.split('=').slice(1).join('=');
  return args[idx + 1] ?? fallback;
};

const site = arg('site', 'https://solutions.futurion.es').replace(/\/$/, '');
const redirectsPath = path.resolve(arg('redirects', 'amplify-redirects.json'));
const postsDir = path.resolve(arg('posts', 'src/data/post'));
const timeoutMs = Number(arg('timeout', '15000'));
const siteOrigin = new URL(site).origin;

const requestHeaders = {
  'User-Agent': 'FuturionSEOCheck/1.0',
  'Cache-Control': 'no-cache',
};

function stripExt(filename) {
  return filename.replace(/\.(md|mdx)$/i, '');
}

function toSiteUrl(pathname) {
  return new URL(pathname, `${site}/`).href;
}

function normalizeLocation(location) {
  if (!location) return '';
  const url = new URL(location, site);
  return `${url.pathname}${url.search}${url.hash}`;
}

function normalizeHref(rawHref) {
  if (!rawHref) return '';
  return new URL(rawHref, site).href;
}

async function fetchLive(url, options = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  return await fetch(url, {
    headers: requestHeaders,
    redirect: 'manual',
    signal,
    ...options,
  });
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'));
  return match?.[1] ?? '';
}

function findCanonical(html) {
  const tag =
    html.match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i)?.[0] ??
    html.match(/<link[^>]+href=["'][^"']+["'][^>]+rel=["'][^"']*canonical[^"']*["'][^>]*>/i)?.[0] ??
    '';

  return getAttr(tag, 'href');
}

function findMetaRobots(html) {
  const tag =
    html.match(/<meta[^>]+name=["']robots["'][^>]*>/i)?.[0] ??
    html.match(/<meta[^>]+content=["'][^"']*["'][^>]+name=["']robots["'][^>]*>/i)?.[0] ??
    '';

  return getAttr(tag, 'content');
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);
}

function extractAlternateHreflangs(html) {
  return [...html.matchAll(/<link[^>]+rel=["'][^"']*alternate[^"']*["'][^>]*>/gi)]
    .map((match) => match[0])
    .map((tag) => ({ hreflang: getAttr(tag, 'hreflang'), href: getAttr(tag, 'href') }))
    .filter((item) => item.hreflang && item.href);
}

function hasArticleJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(
    (match) => match[1]
  );

  return scripts.some(
    (raw) =>
      /"@type"\s*:\s*"(?:Article|BlogPosting|NewsArticle)"/i.test(raw) ||
      /"@type"\s*:\s*\[[^\]]*"(?:Article|BlogPosting|NewsArticle)"/i.test(raw)
  );
}

function robotsAllowsRoot(robotsTxt) {
  const lines = robotsTxt
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter(Boolean);

  let appliesToAll = false;

  for (const line of lines) {
    const [rawKey, ...rawValue] = line.split(':');
    const key = rawKey?.trim().toLowerCase();
    const value = rawValue.join(':').trim().toLowerCase();

    if (key === 'user-agent') {
      appliesToAll = value === '*';
      continue;
    }

    if (appliesToAll && key === 'disallow' && value === '/') {
      return false;
    }
  }

  return true;
}

async function loadPosts() {
  const files = (await readdir(postsDir)).filter((file) => /\.(md|mdx)$/i.test(file)).sort();

  return files.map((file) => {
    const slug = stripExt(file);
    const lang = slug.startsWith('es-') ? 'es' : 'en';
    const url = lang === 'es' ? `${site}/es/${slug}/` : `${site}/${slug}/`;
    return { file, slug, lang, url };
  });
}

async function readText(url, errors, label) {
  try {
    const res = await fetchLive(url);
    const text = await res.text();
    if (res.status !== 200) {
      errors.push(`${label}: expected HTTP 200, got ${res.status}`);
    }
    return { res, text };
  } catch (err) {
    errors.push(`${label}: ${err.message}`);
    return { res: null, text: '' };
  }
}

async function checkRedirects(errors) {
  const rules = JSON.parse(await readFile(redirectsPath, 'utf8'));

  for (const rule of rules) {
    const expectedStatus = Number(rule.status);
    const sourceUrl = toSiteUrl(rule.source);

    try {
      const res = await fetchLive(sourceUrl);
      const location = normalizeLocation(res.headers.get('location'));

      if (res.status !== expectedStatus || location !== rule.target) {
        let detail = '';
        if (res.status === 200) {
          const html = await res.text();
          const metaRobots = findMetaRobots(html);
          const metaRefresh = /http-equiv=["']refresh["']/i.test(html);
          detail = `; meta refresh: ${metaRefresh}; meta robots: ${metaRobots || 'none'}`;
        }

        errors.push(
          `redirect ${rule.source}: expected ${expectedStatus} -> ${rule.target}, got ${res.status} -> ${
            location || 'none'
          }${detail}`
        );
      }
    } catch (err) {
      errors.push(`redirect ${rule.source}: ${err.message}`);
    }
  }

  return rules.length;
}

async function checkSitemaps(errors) {
  const sitemapIndexUrl = `${site}/sitemap-index.xml`;
  const { text: sitemapIndexXml } = await readText(sitemapIndexUrl, errors, 'sitemap-index.xml');
  const sitemapUrls = extractLocs(sitemapIndexXml);
  const pageUrls = new Set();

  if (!sitemapUrls.length) {
    errors.push('sitemap-index.xml: no child sitemap URLs found');
  }

  for (const sitemapUrl of sitemapUrls) {
    const { text } = await readText(sitemapUrl, errors, sitemapUrl);
    for (const url of extractLocs(text)) {
      pageUrls.add(url);
    }
  }

  if (!pageUrls.size) {
    errors.push('sitemaps: no page URLs found');
  }

  const pageHtml = new Map();

  for (const url of pageUrls) {
    if (new URL(url).origin !== siteOrigin) {
      errors.push(`sitemap URL is outside site origin: ${url}`);
      continue;
    }

    try {
      const res = await fetchLive(url);
      const html = await res.text();
      pageHtml.set(url, html);

      const xRobots = res.headers.get('x-robots-tag') ?? '';
      const metaRobots = findMetaRobots(html);
      const canonical = normalizeHref(findCanonical(html));

      if (res.status !== 200) {
        errors.push(`sitemap page ${url}: expected HTTP 200, got ${res.status}`);
      }

      if (/noindex/i.test(xRobots)) {
        errors.push(`sitemap page ${url}: X-Robots-Tag contains noindex`);
      }

      if (/noindex/i.test(metaRobots)) {
        errors.push(`sitemap page ${url}: meta robots contains noindex`);
      }

      if (canonical !== url) {
        errors.push(`sitemap page ${url}: expected self-canonical, got ${canonical || 'none'}`);
      }
    } catch (err) {
      errors.push(`sitemap page ${url}: ${err.message}`);
    }
  }

  return { sitemapUrls, pageUrls, pageHtml };
}

async function checkRobots(errors) {
  const robotsUrl = `${site}/robots.txt`;
  const { text } = await readText(robotsUrl, errors, 'robots.txt');

  if (!text.includes(`${site}/sitemap-index.xml`)) {
    errors.push(`robots.txt: missing Sitemap reference to ${site}/sitemap-index.xml`);
  }

  if (!robotsAllowsRoot(text)) {
    errors.push('robots.txt: User-agent * disallows root crawl');
  }
}

async function checkPostDiscovery(errors, posts, pageUrls, pageHtml) {
  const [rss, esRss, llms] = await Promise.all([
    readText(`${site}/rss.xml`, errors, 'rss.xml'),
    readText(`${site}/es/rss.xml`, errors, 'es/rss.xml'),
    readText(`${site}/llms.txt`, errors, 'llms.txt'),
  ]);

  for (const post of posts) {
    if (!pageUrls.has(post.url)) {
      errors.push(`${post.file}: missing from live sitemap`);
    }

    if (!llms.text.includes(post.url)) {
      errors.push(`${post.file}: missing from live llms.txt`);
    }

    const feed = post.lang === 'es' ? esRss.text : rss.text;
    const feedLabel = post.lang === 'es' ? 'Spanish RSS' : 'English RSS';
    if (!feed.includes(post.url)) {
      errors.push(`${post.file}: missing from live ${feedLabel}`);
    }

    const html = pageHtml.get(post.url);
    if (!html) continue;

    if (!hasArticleJsonLd(html)) {
      errors.push(`${post.file}: live page is missing Article JSON-LD`);
    }

    if (!extractAlternateHreflangs(html).length) {
      errors.push(`${post.file}: live page is missing hreflang alternates`);
    }
  }
}

async function main() {
  const errors = [];
  const posts = await loadPosts();

  const redirectCount = await checkRedirects(errors);
  await checkRobots(errors);
  const { sitemapUrls, pageUrls, pageHtml } = await checkSitemaps(errors);
  await checkPostDiscovery(errors, posts, pageUrls, pageHtml);

  if (errors.length) {
    throw new Error(
      `Found ${errors.length} live indexing issue(s):\n${errors.map((error) => `- ${error}`).join('\n')}`
    );
  }

  console.log('[verify-live-indexing] OK');
  console.log(`[verify-live-indexing] Redirect sources checked: ${redirectCount}`);
  console.log(`[verify-live-indexing] Child sitemaps checked: ${sitemapUrls.length}`);
  console.log(`[verify-live-indexing] Sitemap page URLs checked: ${pageUrls.size}`);
  console.log(`[verify-live-indexing] Blog posts checked in RSS and llms.txt: ${posts.length}`);
}

main().catch((err) => {
  console.error(`[verify-live-indexing] FAILED: ${err.message}`);
  process.exit(1);
});
