import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const outputPath = path.resolve('amplify-redirects.json');
const postsDir = path.resolve('src/data/post');
const args = new Set(process.argv.slice(2));

const staticRedirects = [
  ['/free-ai-audit', '/automation-roadmap/'],
  ['/es/auditoria-ia-gratuita', '/es/hoja-de-ruta-de-automatizacion/'],
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
  const files = (await readdir(postsDir)).filter((file) => /^es-.+\.(md|mdx)$/i.test(file)).sort();
  const rules = [];

  for (const [source, target] of staticRedirects) {
    addSlashVariants(rules, source, target);
  }

  for (const file of files) {
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
