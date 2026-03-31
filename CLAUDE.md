# Futurion Solutions — Astrowind Project

Bilingual Astro static site: **English (default)** + **Spanish (`/es/`)**.

Site domain: `https://solutions.futurion.es`

---

## Post file naming convention

| Language | File path | Canonical URL |
|----------|-----------|---------------|
| English (EN) | `src/data/post/<slug>.md` | `/<slug>` |
| Spanish (ES) | `src/data/post/es-<slug>.md` | `/es/es-<slug>` |

The `es-` prefix in the filename becomes part of the URL — Astro prepends `/es/` from routing, resulting in `/es/es-<slug>`.

---

## MANDATORY: Redirects when publishing an ES post

Every new `es-<slug>.md` post MUST have two redirects added to `astro.config.ts` **in the same commit as the post files**. Two broken URL variants are predictably hit by crawlers:

```ts
// In astro.config.ts → redirects object:
'/es-<slug>': '/es/es-<slug>',       // root-level hit, missing /es/ prefix
'/es/<slug>': '/es/es-<slug>',       // /es/ present but es- prefix missing from slug
```

**Never wait for Google Search Console to report 404s.** Add these proactively.

---

## MANDATORY: Register every new article in `public/llms.txt`

`public/llms.txt` is the AI engine index (used by ChatGPT, Perplexity, etc.). Every new article must be added **in the same commit as the post files**.

- EN articles → `## Blog articles (English)` section
- ES articles → `## Artículos del blog (Español)` section

Format:
```
- [Article Title](https://solutions.futurion.es/<canonical-url>): One-line description
```

---

## Publishing checklist — complete before every commit

- [ ] EN file: `src/data/post/<slug>.md` with `lang: en`
- [ ] ES file: `src/data/post/es-<slug>.md` with `lang: es`
- [ ] Two redirects added in `astro.config.ts` for the ES post
- [ ] EN entry added to `public/llms.txt` → `## Blog articles (English)`
- [ ] ES entry added to `public/llms.txt` → `## Artículos del blog (Español)`

---

## Common mistakes

| Mistake | Correct approach |
|---------|-----------------|
| ES filename without `es-` prefix | Always `es-<slug>.md` |
| Publishing ES post without redirects | Add both variants to `astro.config.ts` in same commit |
| Waiting for GSC to report 404s | Add redirects proactively at publish time |
| Publishing article without updating `llms.txt` | Register in `public/llms.txt` in same commit |

---

## Key files

- `astro.config.ts` — redirects object (lines ~27–55)
- `public/llms.txt` — AI engine index
- `src/data/post/` — all blog post markdown files
