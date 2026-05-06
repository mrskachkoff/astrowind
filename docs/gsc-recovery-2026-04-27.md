# GSC Recovery Report - 2026-04-27

## Executive Summary

Google Search Console export data from 2026-04-27 still reports historical crawl issues for `https://solutions.futurion.es`, but live checks show the production site is now technically healthy for the intended canonical URL set.

- Production fix already deployed: commit `f4df141` (`Fix indexed page crawl graph`).
- Live homepage returns `200`, has `index,follow`, and has a self-referencing canonical.
- Live sitemap index returns `200` and points to one sitemap containing exactly `46` canonical URLs.
- Priority canonical pages return `200`, have `index,follow`, and have self-referencing canonicals.
- Representative exported `404`, redirect-error, and page-with-redirect URLs now return `301` to intended canonical destinations.

Conclusion: the main remaining work is GSC validation and recrawl management, not another production code fix.

## GSC Export Summary

Source exports reviewed:

- `/Users/eur-es-testmdm/Downloads/solutions.futurion.es-Coverage-2026-04-27`
- `/Users/eur-es-testmdm/Downloads/solutions.futurion.es-Coverage-Valid-2026-04-27`
- `/Users/eur-es-testmdm/Downloads/solutions.futurion.es-Coverage-Drilldown-2026-04-27*`

Coverage issue counts from the 2026-04-27 export:

| GSC status                                            | Count | Current interpretation                                                                                 |
| ----------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------ |
| Redirect error                                        |     7 | Stale; sampled rows now redirect live.                                                                 |
| Not found (404)                                       |    16 | Stale; sampled rows now redirect live.                                                                 |
| Page with redirect                                    |    17 | Expected for legacy/no-slash/HTTP variants.                                                            |
| Crawled - currently not indexed                       |    31 | Mix of canonical pages and no-slash variants; request indexing only for canonical trailing-slash URLs. |
| Excluded by `noindex` tag                             |    39 | Likely expected for tag/category/archive pages unless a future drilldown proves otherwise.             |
| Alternate page with proper canonical tag              |     8 | Needs drilldown export before action.                                                                  |
| Duplicate, Google chose different canonical than user |     1 | Needs drilldown export before action.                                                                  |
| Discovered - currently not indexed                    |     0 | No action needed.                                                                                      |

## Live Verification

Checked on 2026-04-27 against production.

Sitemap:

- `https://solutions.futurion.es/sitemap-index.xml` returns `200`.
- `https://solutions.futurion.es/sitemap-0.xml` contains `46` URLs.

Priority canonical pages checked:

| URL                                                    | Live result                           |
| ------------------------------------------------------ | ------------------------------------- |
| `https://solutions.futurion.es/`                       | `200`, `index,follow`, self-canonical |
| `https://solutions.futurion.es/services/`              | `200`, `index,follow`, self-canonical |
| `https://solutions.futurion.es/medcore-private-ai/`    | `200`, `index,follow`, self-canonical |
| `https://solutions.futurion.es/automation-roadmap/`    | `200`, `index,follow`, self-canonical |
| `https://solutions.futurion.es/es/servicios/`          | `200`, `index,follow`, self-canonical |
| `https://solutions.futurion.es/es/medcore-ia-privada/` | `200`, `index,follow`, self-canonical |

Representative redirects checked:

| Exported URL                                                       | Live result                                        |
| ------------------------------------------------------------------ | -------------------------------------------------- |
| `https://solutions.futurion.es/es/agentes-ia-sanidad-riesgos-rgpd` | `301` to `/es/es-agentes-ia-sanidad-riesgos-rgpd/` |
| `https://solutions.futurion.es/free-ai-audit`                      | `301` to `/automation-roadmap/`                    |
| `https://solutions.futurion.es/es/presentando-medcore-private-ai`  | `301` to `/es/es-presentando-medcore-private-ai/`  |
| `https://solutions.futurion.es/medcore-private-ai`                 | `301` to `/medcore-private-ai/`                    |

## GSC Actions

Do these in Google Search Console:

1. Resubmit `https://solutions.futurion.es/sitemap-index.xml`.
2. Start validation for `Not found (404)`.
3. Start validation for `Redirect error`.
4. Start validation for `Page with redirect`.
5. For `Crawled - currently not indexed`, inspect and request indexing only for canonical trailing-slash URLs. Do not request indexing for no-slash variants that redirect.
6. Do not try to force indexing for tag/category/archive pages unless the missing `Excluded by noindex` drilldown shows an important canonical page is accidentally noindexed.

## Priority URL Inspection List

Inspect these first and request indexing where the live URL is canonical and indexable:

- `https://solutions.futurion.es/`
- `https://solutions.futurion.es/services/`
- `https://solutions.futurion.es/medcore-private-ai/`
- `https://solutions.futurion.es/automation-roadmap/`
- `https://solutions.futurion.es/es/servicios/`
- `https://solutions.futurion.es/es/medcore-ia-privada/`
- Latest English article canonicals returning `200`
- Latest Spanish article canonicals returning `200`

## Additional GSC Exports To Pull

The current files include summary counts but not drilldown tables for these issue types:

- `Excluded by noindex`
- `Alternate page with proper canonical tag`
- `Duplicate, Google chose different canonical than user`

Useful follow-up exports:

- Drilldown table for `Excluded by noindex`.
- Drilldown table for `Alternate page with proper canonical tag`.
- Drilldown table for `Duplicate, Google chose different canonical than user`.
- URL Inspection details for the homepage and 5-10 priority pages, especially Google-selected canonical and last crawl date.

## Working Assumptions

- Most `Excluded by noindex` rows are intentional tag/category/archive pages.
- The main technical issue was stale broken-URL noise plus older trailing-slash/canonical crawl data.
- The live site is ready for validation; Google now needs recrawl time.
