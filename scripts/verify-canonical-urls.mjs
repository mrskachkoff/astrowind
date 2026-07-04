import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const site = 'https://solutions.futurion.es';
const distDir = path.resolve('dist');
const postsDir = path.resolve('src/data/post');
const sourceFiles = ['public/llms.txt'];

const assetPrefixes = ['/_astro/', '/decapcms/'];
const assetExtensions = new Set([
  '.avif',
  '.css',
  '.gif',
  '.ico',
  '.jpg',
  '.jpeg',
  '.js',
  '.json',
  '.map',
  '.mp4',
  '.pdf',
  '.png',
  '.svg',
  '.txt',
  '.webmanifest',
  '.webp',
  '.woff',
  '.woff2',
  '.xml',
]);

function extensionOf(pathname) {
  const basename = pathname.split('/').pop() ?? '';
  const idx = basename.lastIndexOf('.');
  return idx === -1 ? '' : basename.slice(idx).toLowerCase();
}

// Return the internal page path for a URL, or null if it is not a same-origin page URL.
// Allowlist by positive validation: only root-relative paths or http(s) URLs on our own
// origin are accepted. Every other scheme (mailto:, tel:, data:, javascript:, ...),
// protocol-relative "//host", fragments and cross-origin URLs fall through to null.
function parseInternalPath(rawUrl) {
  if (!rawUrl) return null;

  try {
    // Root-relative path — but not protocol-relative "//host".
    if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
      return new URL(rawUrl, site).pathname;
    }

    // Absolute URL: accept only the http/https schemes on our own origin.
    const parsed = new URL(rawUrl);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.origin === site) {
      return parsed.pathname;
    }
  } catch {
    return null;
  }

  return null;
}

function isAssetPath(pathname) {
  return assetPrefixes.some((prefix) => pathname.startsWith(prefix)) || assetExtensions.has(extensionOf(pathname));
}

function isCanonicalPagePath(pathname) {
  return pathname === '/' || pathname.endsWith('/');
}

function isSpanishAlias(pathname, spanishPostAliases) {
  const match = pathname.match(/^\/es\/([^/]+)\/?$/);
  return Boolean(match && spanishPostAliases.has(match[1]));
}

async function getSpanishPostAliases() {
  const postFiles = await readdir(postsDir);

  return new Set(
    postFiles
      .filter((file) => /^es-.+\.(md|mdx)$/i.test(file))
      .map((file) => file.replace(/\.(md|mdx)$/i, '').replace(/^es-/, ''))
  );
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (/\.(html|xml|txt)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractUrls(content) {
  const urls = [];
  const attrPattern = /\b(?:href|src|action|content)=["']([^"']+)["']/g;
  const absolutePattern = /https:\/\/solutions\.futurion\.es\/[^"'<>\s)]+/g;
  const markdownPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  const xmlTagPattern = /<(?:loc|link|guid)>([^<]+)<\/(?:loc|link|guid)>/g;

  for (const pattern of [attrPattern, absolutePattern, markdownPattern, xmlTagPattern]) {
    for (const match of content.matchAll(pattern)) {
      urls.push(match[1] ?? match[0]);
    }
  }

  return urls;
}

async function main() {
  const errors = [];
  const seenErrors = new Set();
  const files = [...(await listFiles(distDir)), ...sourceFiles.map((file) => path.resolve(file))];
  const spanishPostAliases = await getSpanishPostAliases();

  function addError(message) {
    if (seenErrors.has(message)) return;
    seenErrors.add(message);
    errors.push(message);
  }

  for (const file of files) {
    const content = await readFile(file, 'utf8');
    const label = path.relative(process.cwd(), file);

    for (const rawUrl of extractUrls(content)) {
      const pathname = parseInternalPath(rawUrl);
      if (!pathname || isAssetPath(pathname)) continue;

      if (!isCanonicalPagePath(pathname)) {
        addError(`${label}: internal page URL must end with /: ${rawUrl}`);
      }

      if (isSpanishAlias(pathname, spanishPostAliases)) {
        addError(`${label}: Spanish post URL must use /es/es-<slug>/: ${rawUrl}`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Found ${errors.length} canonical URL issue(s):\n${errors.map((err) => `- ${err}`).join('\n')}`);
  }

  console.log(`[verify-canonical-urls] OK (${files.length} files)`);
}

main().catch((err) => {
  console.error(`[verify-canonical-urls] FAILED: ${err.message}`);
  process.exit(1);
});
