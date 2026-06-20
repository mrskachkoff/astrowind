import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// Verifies that the built site has no broken internal links (404s) and that every
// amplify-redirects.json rule resolves to a real page. Runs entirely against dist/.
//
//   - Crawls every dist/**/*.html, extracts internal href/src targets, and confirms
//     each resolves to a generated file (a real page OR an Astro redirect stub).
//   - For amplify-redirects.json: confirms every target resolves to a real file, and
//     flags double-redirect chains (target is itself a redirect stub) and sources
//     that shadow a real (non-stub) page.

const site = 'https://solutions.futurion.es';
const distDir = path.resolve('dist');
const amplifyRedirectsPath = path.resolve('amplify-redirects.json');

const fileExists = async (p) => {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
};

function withTrailingSlash(pathname) {
  const leading = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (leading === '/') return '/';
  return leading.endsWith('/') ? leading : `${leading}/`;
}

// A path has a "file" shape if its last segment contains a dot (e.g. /rss.xml, /img.png).
function looksLikeFile(pathname) {
  const last = pathname.split('/').filter(Boolean).pop() ?? '';
  return last.includes('.');
}

// Map a site pathname to the candidate dist files that could serve it. A non-file
// page path can be served either as `<path>/index.html` or as a `<path>.html` sibling
// (Astro emits the error page as 404.html, not 404/index.html). Returns [] if the
// pathname cannot map inside dist.
function pathnameToDistFiles(pathname) {
  const clean = decodeURIComponent(pathname.replace(/[?#].*$/, ''));
  if (!clean.startsWith('/')) return [];

  const rels = [];
  if (clean === '/') {
    rels.push('index.html');
  } else if (looksLikeFile(clean)) {
    rels.push(clean.replace(/^\/+/, ''));
  } else {
    const noSlash = clean.replace(/\/+$/, '').replace(/^\/+/, '');
    rels.push(path.join(noSlash, 'index.html'));
    rels.push(`${noSlash}.html`);
  }

  const distRoot = `${distDir}${path.sep}`;
  return rels
    .map((rel) => path.resolve(distDir, rel))
    .filter((resolved) => resolved === distDir || resolved.startsWith(distRoot));
}

// The primary dist file for a pathname (used for stub detection on a known-existing path).
async function existingDistFile(pathname) {
  for (const candidate of pathnameToDistFiles(pathname)) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

// Detect an Astro static redirect stub (meta-refresh page) vs a real content page.
async function isRedirectStub(distFile) {
  if (!distFile.endsWith('.html')) return false;
  let html;
  try {
    html = await readFile(distFile, 'utf8');
  } catch {
    return false;
  }
  return /http-equiv\s*=\s*(["'])refresh\1/i.test(html) && /url=/.test(html);
}

async function listHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listHtmlFiles(full)));
    } else if (/\.html$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

// Allowlist for an on-site root-relative pathname: must begin with a single "/"
// (not "//", which is protocol-relative) and contain no URL scheme. Anything that is
// not an explicit internal path (mailto:, tel:, data:, javascript:, #anchor, external
// http(s), protocol-relative) simply fails to match and is ignored.
const INTERNAL_PATH_RE = /^\/(?!\/)[^\s]*$/;

// Extract internal link targets (href/src) from an HTML string.
function extractInternalTargets(html) {
  const targets = new Set();
  const attrRe = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    let raw = m[2].trim();
    if (!raw) continue;

    // Normalize absolute on-site URLs to their pathname; drop true externals.
    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        if (url.origin !== new URL(site).origin) continue; // external
        raw = url.pathname; // already scheme-free, query/hash dropped below anyway
      } catch {
        continue;
      }
    }

    // Allowlist: only accept explicit on-site root-relative paths.
    if (!INTERNAL_PATH_RE.test(raw)) continue;

    const pathnameOnly = raw.replace(/[?#].*$/, '');
    if (!pathnameOnly) continue;
    targets.add(pathnameOnly);
  }
  return targets;
}

async function checkInternalLinks() {
  const htmlFiles = await listHtmlFiles(distDir);
  const broken = [];
  const missingTrailingSlash = [];
  const resolveCache = new Map();

  async function resolves(pathname) {
    if (resolveCache.has(pathname)) return resolveCache.get(pathname);
    const ok = (await existingDistFile(pathname)) !== null;
    resolveCache.set(pathname, ok);
    return ok;
  }

  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const label = path.relative(process.cwd(), file);
    for (const target of extractInternalTargets(html)) {
      if (await resolves(target)) {
        // Flag page links that omit the canonical trailing slash (soft issue).
        if (!looksLikeFile(target) && target !== '/' && !target.endsWith('/')) {
          if (await resolves(withTrailingSlash(target))) {
            missingTrailingSlash.push({ label, target });
          }
        }
        continue;
      }
      // Not found directly — try the trailing-slash canonical before declaring 404.
      if (!looksLikeFile(target) && (await resolves(withTrailingSlash(target)))) {
        missingTrailingSlash.push({ label, target });
        continue;
      }
      broken.push({ label, target });
    }
  }

  return { broken, missingTrailingSlash, scanned: htmlFiles.length };
}

async function checkAmplifyRedirects() {
  const raw = await readFile(amplifyRedirectsPath, 'utf8');
  const rules = JSON.parse(raw);
  const brokenTargets = [];
  const doubleRedirects = [];
  const shadowedPages = [];

  const normalize = (p) => {
    const clean = p.replace(/[?#].*$/, '');
    return looksLikeFile(clean) ? clean : withTrailingSlash(clean);
  };

  for (const rule of rules) {
    const { source, target } = rule;

    // Target must resolve to a real generated file.
    const targetFile = await existingDistFile(target);
    if (!targetFile) {
      brokenTargets.push({ source, target });
      continue;
    }
    // Flag double-redirect: target itself is a redirect stub.
    if (await isRedirectStub(targetFile)) {
      doubleRedirects.push({ source, target });
    }

    // Flag a source that shadows real content: the source's own canonical form is a
    // real (non-stub) page, yet it is redirected elsewhere. A plain trailing-slash
    // enforcement (source canonical === target canonical) is NOT a shadow.
    if (normalize(source) !== normalize(target)) {
      const sourceFile = await existingDistFile(source);
      if (sourceFile && !(await isRedirectStub(sourceFile))) {
        shadowedPages.push({ source, target });
      }
    }
  }

  return { brokenTargets, doubleRedirects, shadowedPages, ruleCount: rules.length };
}

async function main() {
  const errors = [];
  const warnings = [];

  const links = await checkInternalLinks();
  for (const { label, target } of links.broken) {
    errors.push(`${label}: broken internal link -> ${target}`);
  }
  for (const { label, target } of links.missingTrailingSlash) {
    warnings.push(`${label}: internal link missing trailing slash -> ${target}`);
  }

  const redirects = await checkAmplifyRedirects();
  for (const { source, target } of redirects.brokenTargets) {
    errors.push(`amplify-redirects: target 404 -> ${source} => ${target}`);
  }
  for (const { source, target } of redirects.doubleRedirects) {
    warnings.push(`amplify-redirects: double redirect (target is itself a redirect) -> ${source} => ${target}`);
  }
  for (const { source, target } of redirects.shadowedPages) {
    warnings.push(`amplify-redirects: source shadows a real page -> ${source} => ${target}`);
  }

  if (warnings.length) {
    console.warn(`[verify-internal-links] ${warnings.length} warning(s):\n${warnings.map((w) => `- ${w}`).join('\n')}`);
  }

  if (errors.length) {
    throw new Error(`Found ${errors.length} link/redirect issue(s):\n${errors.map((e) => `- ${e}`).join('\n')}`);
  }

  console.log(
    `[verify-internal-links] OK (${links.scanned} HTML pages crawled, ${redirects.ruleCount} redirect rules checked)`
  );
}

main().catch((err) => {
  console.error(`[verify-internal-links] FAILED: ${err.message}`);
  process.exit(1);
});
