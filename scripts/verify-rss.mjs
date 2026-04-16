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

const mode = arg('mode', 'dist');
const distDir = arg('dist', 'dist');
const site = arg('site', 'https://solutions.futurion.es');
const postsDir = path.resolve('src/data/post');

function stripExt(filename) {
  return filename.replace(/\.(md|mdx)$/i, '');
}

function parseFrontmatterDate(raw) {
  const match = raw.match(/^publishDate:\s*['"]?([^'"\n]+)['"]?/m);
  if (!match) return new Date(0);
  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function parseFrontmatterLang(raw, filename) {
  const match = raw.match(/^lang:\s*['"]?([^'"\n]+)['"]?/m);
  if (match?.[1]) return match[1].trim();
  return filename.startsWith('es-') ? 'es' : 'en';
}

async function loadLatestByLang() {
  const files = (await readdir(postsDir)).filter((f) => /\.(md|mdx)$/i.test(f));
  const entries = [];

  for (const file of files) {
    const fullPath = path.join(postsDir, file);
    const raw = await readFile(fullPath, 'utf8');
    const slug = stripExt(file);
    const lang = parseFrontmatterLang(raw, file);
    const publishDate = parseFrontmatterDate(raw);
    entries.push({ file, slug, lang, publishDate });
  }

  const pickLatest = (lang) =>
    entries
      .filter((e) => e.lang === lang)
      .sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime() || b.slug.localeCompare(a.slug))[0];

  const latestEn = pickLatest('en');
  const latestEs = pickLatest('es');

  if (!latestEn || !latestEs) {
    throw new Error('Could not determine latest EN/ES posts from src/data/post');
  }

  return { latestEn, latestEs };
}

async function getFeedXml(feedPath) {
  if (mode === 'live') {
    const url = `${site.replace(/\/$/, '')}${feedPath}`;
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    return await res.text();
  }

  const filePath = path.join(path.resolve(distDir), feedPath.replace(/^\//, ''));
  return await readFile(filePath, 'utf8');
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} is missing expected URL fragment: ${needle}`);
  }
}

async function main() {
  const { latestEn, latestEs } = await loadLatestByLang();

  const [enXml, esXml] = await Promise.all([getFeedXml('/rss.xml'), getFeedXml('/es/rss.xml')]);

  const enNeedle = `/${latestEn.slug}/`;
  const esNeedle = `/es/${latestEs.slug}/`;

  assertIncludes(enXml, enNeedle, 'EN RSS');
  assertIncludes(esXml, esNeedle, 'ES RSS');

  console.log(`[verify-rss] OK (${mode})`);
  console.log(`[verify-rss] EN latest slug: ${latestEn.slug}`);
  console.log(`[verify-rss] ES latest slug: ${latestEs.slug}`);
}

main().catch((err) => {
  console.error(`[verify-rss] FAILED: ${err.message}`);
  process.exit(1);
});
