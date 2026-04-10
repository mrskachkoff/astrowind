# Project Instructions (Codex)

## Project

- Project: Futurion Solutions — Astrowind
- Site type: Bilingual Astro static site
- Languages: English (default) and Spanish (`/es/`)
- Domain: `https://solutions.futurion.es`

## Post File Naming

- English posts: `src/data/post/<slug>.md`
  - Canonical URL: `/<slug>`
- Spanish posts: `src/data/post/es-<slug>.md`
  - Canonical URL: `/es/es-<slug>`

Note: The `es-` prefix is part of the slug, and Astro also prepends `/es/`, resulting in `/es/es-<slug>`.

## Mandatory: Redirects for Spanish Posts

Every new Spanish post (`es-<slug>.md`) must add two redirects in `astro.config.ts` **in the same commit**:

```ts
// In astro.config.ts -> redirects object
'/es-<slug>': '/es/es-<slug>', // root-level hit, missing /es/ prefix
'/es/<slug>': '/es/es-<slug>', // /es/ present but es- prefix missing from slug
```

Do not wait for Google Search Console to report 404s. Add these proactively.

## Mandatory: Register Every Article in `public/llms.txt`

`public/llms.txt` is the AI engine index. Every new article must be added **in the same commit**.

- English articles: `## Blog articles (English)`
- Spanish articles: `## Artículos del blog (Español)`

Format:

```
- [Article Title](https://solutions.futurion.es/<canonical-url>): One-line description
```

## Publishing Checklist (Before Every Commit)

- [ ] EN file: `src/data/post/<slug>.md` with `lang: en`
- [ ] ES file: `src/data/post/es-<slug>.md` with `lang: es`
- [ ] Two redirects added in `astro.config.ts` for the ES post
- [ ] EN entry added to `public/llms.txt` -> `## Blog articles (English)`
- [ ] ES entry added to `public/llms.txt` -> `## Artículos del blog (Español)`

## Common Mistakes

- ES filename without `es-` prefix -> Always use `es-<slug>.md`
- Publishing ES post without redirects -> Add both redirects in `astro.config.ts` in the same commit
- Waiting for GSC to report 404s -> Add redirects at publish time
- Publishing article without updating `llms.txt` -> Register in `public/llms.txt` in the same commit

## Key Files

- `astro.config.ts` (redirects object)
- `public/llms.txt` (AI engine index)
- `src/data/post/` (blog posts)
