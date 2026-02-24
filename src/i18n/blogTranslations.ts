import { getCollection } from 'astro:content';
import { cleanSlug, trimSlash, POST_PERMALINK_PATTERN } from '~/utils/permalinks';

/**
 * Builds a bidirectional map of blog post URL pathnames between EN and ES.
 * Cached via module-level promise so the collection is queried only once.
 */

function buildPermalink(slug: string): string {
  const permalink = POST_PERMALINK_PATTERN.replace('%slug%', slug)
    .replace('%id%', '')
    .replace('%category%', '')
    .replace('%year%', '')
    .replace('%month%', '')
    .replace('%day%', '')
    .replace('%hour%', '')
    .replace('%minute%', '')
    .replace('%second%', '');

  return permalink
    .split('/')
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');
}

type TranslationMap = Record<string, string>;

let mapPromise: Promise<TranslationMap> | null = null;

async function buildMap(): Promise<TranslationMap> {
  const posts = await getCollection('post');
  const map: TranslationMap = {};

  // Index posts by file id → { lang, urlPath }
  const postIndex = new Map<string, { lang: string; urlPath: string }>();
  for (const post of posts) {
    const slug = cleanSlug(post.id);
    const permalink = buildPermalink(slug);
    const lang = post.data.lang || 'en';
    const urlPath = lang === 'es' ? `/es/${permalink}` : `/${permalink}`;
    postIndex.set(post.id, { lang, urlPath });
  }

  // Build bidirectional map using translationOf (ES posts point to EN post ids)
  for (const post of posts) {
    const translationOf = post.data.translationOf;
    if (!translationOf) continue;

    const thisEntry = postIndex.get(post.id);
    const otherEntry = postIndex.get(translationOf);

    if (thisEntry && otherEntry) {
      map[thisEntry.urlPath] = otherEntry.urlPath;
      map[otherEntry.urlPath] = thisEntry.urlPath;
    }
  }

  return map;
}

export async function getBlogTranslationMap(): Promise<TranslationMap> {
  if (!mapPromise) {
    mapPromise = buildMap();
  }
  return mapPromise;
}
