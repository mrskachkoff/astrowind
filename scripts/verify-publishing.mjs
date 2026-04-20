import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const site = 'https://solutions.futurion.es';
const postsDir = path.resolve('src/data/post');
const llmsPath = path.resolve('public/llms.txt');
const scanDirs = ['src/data/post', 'src/pages', 'src/components'];

function stripExt(filename) {
  return filename.replace(/\.(md|mdx)$/i, '');
}

function parseFrontmatter(raw, file) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  return yaml.load(match[1]) ?? {};
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (/\.(astro|md|mdx|ts|tsx|js|jsx|json|txt|yaml|yml)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function fail(errors, message) {
  errors.push(message);
}

async function main() {
  const errors = [];
  const postFiles = (await readdir(postsDir)).filter((file) => /\.(md|mdx)$/i.test(file)).sort();
  const llms = await readFile(llmsPath, 'utf8');
  const scanFiles = (await Promise.all(scanDirs.map((dir) => listFiles(path.resolve(dir))))).flat();
  const scanned = new Map();

  for (const file of scanFiles) {
    scanned.set(file, await readFile(file, 'utf8'));
  }

  for (const file of postFiles) {
    const fullPath = path.join(postsDir, file);
    const raw = await readFile(fullPath, 'utf8');
    const frontmatter = parseFrontmatter(raw, file);
    const slug = stripExt(file);
    const isSpanish = slug.startsWith('es-');
    const expectedLang = isSpanish ? 'es' : 'en';
    const expectedUrl = isSpanish ? `${site}/es/${slug}/` : `${site}/${slug}/`;

    if (frontmatter.lang !== expectedLang) {
      fail(errors, `${file}: expected lang: ${expectedLang}`);
    }

    if (!llms.includes(expectedUrl)) {
      fail(errors, `${file}: public/llms.txt is missing ${expectedUrl}`);
    }

    if (isSpanish) {
      const unprefixedSlug = slug.replace(/^es-/, '');
      const aliasPatterns = [
        `](/es/${unprefixedSlug})`,
        `](/es/${unprefixedSlug}/)`,
        `href="/es/${unprefixedSlug}"`,
        `href="/es/${unprefixedSlug}/"`,
        `${site}/es/${unprefixedSlug}`,
      ];

      for (const [scanFile, content] of scanned) {
        for (const pattern of aliasPatterns) {
          if (content.includes(pattern)) {
            fail(errors, `${path.relative(process.cwd(), scanFile)}: links to Spanish alias ${pattern}`);
          }
        }
      }
    }
  }

  if (errors.length) {
    throw new Error(`Found ${errors.length} publishing issue(s):\n${errors.map((err) => `- ${err}`).join('\n')}`);
  }

  console.log(`[verify-publishing] OK (${postFiles.length} posts)`);
}

main().catch((err) => {
  console.error(`[verify-publishing] FAILED: ${err.message}`);
  process.exit(1);
});
