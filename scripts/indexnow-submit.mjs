import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Submits the built sitemap's URLs to IndexNow (Bing/Yandex/Seznam — not Google).
// Run manually after an approved deploy: node scripts/indexnow-submit.mjs
// Optional: --dry-run to print the payload without submitting.

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const HOST = 'solutions.futurion.es';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

// The IndexNow key is public by design (it is served at the site root as <key>.txt);
// public/<key>.txt is the single source of truth.
async function findKey() {
  const entries = await readdir(path.resolve('public'));
  const keyFiles = entries.filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (keyFiles.length !== 1) {
    console.error(`[indexnow] expected exactly one <32-hex-key>.txt in public/, found ${keyFiles.length}.`);
    process.exit(1);
  }
  const name = keyFiles[0].replace(/\.txt$/, '');
  const content = (await readFile(path.resolve('public', keyFiles[0]), 'utf8')).trim();
  if (content !== name) {
    console.error(`[indexnow] public/${keyFiles[0]} content does not match its filename.`);
    process.exit(1);
  }
  return name;
}

const KEY = await findKey();

const sitemapPath = path.resolve('dist/sitemap-0.xml');
const xml = await readFile(sitemapPath, 'utf8').catch(() => {
  console.error(`[indexnow] ${sitemapPath} not found — run \`npm run build\` first.`);
  process.exit(1);
});

const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) {
  console.error('[indexnow] no <loc> entries found in sitemap — aborting.');
  process.exit(1);
}

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: `https://${HOST}/${KEY}.txt`,
  urlList: urls,
};

console.log(`[indexnow] ${urls.length} URLs from sitemap-0.xml`);
if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

// IndexNow returns 200 (submitted) or 202 (key validation pending); anything else is an error.
if (res.status === 200 || res.status === 202) {
  console.log(`[indexnow] OK (HTTP ${res.status}) — ${urls.length} URLs submitted.`);
} else {
  console.error(`[indexnow] FAILED (HTTP ${res.status}): ${await res.text()}`);
  process.exit(1);
}
