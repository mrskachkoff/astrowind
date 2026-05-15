import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const outputPath = path.resolve('amplify-redirects.json');
const postsDir = path.resolve('src/data/post');
const args = new Set(process.argv.slice(2));

const staticRedirects = [
  ['/free-ai-audit', '/automation-roadmap/'],
  ['/es/auditoria-ia-gratuita', '/es/hoja-de-ruta-de-automatizacion/'],
];

// Trailing-slash enforcement for all indexable static pages.
// Amplify may serve both /about and /about/ without redirect; these rules ensure
// the canonical (trailing-slash) URL is always the one Google lands on.
const trailingSlashPages = [
  '/about',
  '/services',
  '/pricing',
  '/contact',
  '/automation-roadmap',
  '/medcore-private-ai',
  '/privacy',
  '/terms',
  '/blog',
  '/es',
  '/es/nosotros',
  '/es/servicios',
  '/es/precios',
  '/es/contacto',
  '/es/hoja-de-ruta-de-automatizacion',
  '/es/medcore-ia-privada',
  '/es/privacidad',
  '/es/terminos',
  '/es/blog',
];

const legacySpanishTagRedirects = [
  ['agentes-ia', '/es/tag/agentes-ia/'],
  ['sanidad', '/es/tag/sanidad/'],
  ['clinicas-dentales', '/es/tag/clinicas-dentales/'],
  ['privacidad-de-datos', '/es/tag/privacidad-de-datos/'],
  ['ia', '/es/tag/ia/'],
  ['ia-hibrida', '/es/tag/ia-hibrida/'],
  ['acuerdos-de-tratamiento-de-datos', '/es/tag/acuerdos-de-tratamiento-de-datos/'],
  ['proteccion-de-datos', '/es/tag/proteccion-de-datos/'],
  ['transferencias-internacionales-de-datos', '/es/tag/transferencias-internacionales-de-datos/'],
];

// Historical URL that was published before the Spanish es- slug policy was enforced.
const rootSpanishAliases = new Set(['agentes-ia-sanidad-riesgos-rgpd']);

function stripExt(filename) {
  return filename.replace(/\.(md|mdx)$/i, '');
}

function addRule(rules, source, target) {
  rules.push({ source, target, status: '301', condition: null });
}

function addSlashVariants(rules, source, target) {
  const clean = source.replace(/\/$/, '') || '/';
  addRule(rules, clean, target);
  if (clean !== '/') addRule(rules, `${clean}/`, target);
}

async function buildRules() {
  const allFiles = (await readdir(postsDir)).filter((file) => /\.(md|mdx)$/i.test(file)).sort();
  const esFiles = allFiles.filter((file) => /^es-.+\.(md|mdx)$/i.test(file));
  const enFiles = allFiles.filter((file) => !/^es-/i.test(file));
  const rules = [];

  // Trailing-slash enforcement for static pages
  for (const page of trailingSlashPages) {
    addRule(rules, page, `${page}/`);
  }

  // Trailing-slash enforcement for EN blog post canonical URLs
  for (const file of enFiles) {
    const slug = stripExt(file);
    addRule(rules, `/${slug}`, `/${slug}/`);
  }

  // Trailing-slash enforcement for ES blog post canonical URLs
  for (const file of esFiles) {
    const slug = stripExt(file);
    addRule(rules, `/es/${slug}`, `/es/${slug}/`);
  }

  for (const [source, target] of staticRedirects) {
    addSlashVariants(rules, source, target);
  }

  for (const [tagSlug, target] of legacySpanishTagRedirects) {
    addSlashVariants(rules, `/tag/${tagSlug}`, target);
  }

  for (const file of esFiles) {
    const slug = stripExt(file);
    const unprefixedSlug = slug.replace(/^es-/, '');
    const target = `/es/${slug}/`;

    addSlashVariants(rules, `/${slug}`, target);
    addSlashVariants(rules, `/es/${unprefixedSlug}`, target);

    if (rootSpanishAliases.has(unprefixedSlug)) {
      addSlashVariants(rules, `/${unprefixedSlug}`, target);
    }
  }

  return rules;
}

function renderRules(rules) {
  return `${JSON.stringify(rules, null, 2)}\n`;
}

async function main() {
  const rendered = renderRules(await buildRules());

  if (args.has('--check')) {
    const current = await readFile(outputPath, 'utf8');
    if (current !== rendered) {
      throw new Error('amplify-redirects.json is out of date. Run npm run generate:amplify-redirects.');
    }
    console.log('[generate-amplify-redirects] OK');
    return;
  }

  await import('node:fs/promises').then(({ writeFile }) => writeFile(outputPath, rendered));
  console.log(`[generate-amplify-redirects] Wrote ${outputPath}`);
}

main().catch((err) => {
  console.error(`[generate-amplify-redirects] FAILED: ${err.message}`);
  process.exit(1);
});
