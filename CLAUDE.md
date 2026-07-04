# Git workflow

- **Always push to `main`.** Commit changes directly to `main` and run `git push origin main`.
- **Never create a branch.** Do not create feature branches, do not open PRs, and do not ask which branch to use — unless the user explicitly asks for a branch or PR.
- Pushing to `main` triggers the AWS Amplify deploy, so ensure `npm run build` and `npm run verify:seo` pass before pushing.

# Engineering honesty & rigor (non-negotiable)

- **Never say "done / fixed / all clear" without showing the evidence** — the exact command output or
  log lines that prove it. No blanket "all fixed."
- **Distinguish precisely:** vulnerabilities ≠ deprecations ≠ warnings ≠ peer notices. Never collapse
  them into one claim, and never answer about one when asked about another.
- **Answer the exact question asked.** Do not substitute an easier or adjacent question.
- **State scope:** say what is in this repo vs. external/infrastructure (e.g. Amplify's own build
  toolchain), and name what is *not* fixed and why.
- **No shortcuts to make it easy for myself.** If a fix cannot be verified, say so; do not claim it.
- **Don't offload research onto the user.** Never ask them to decide things they can't be expected to
  know (library internals, dependency mechanics, best practice). Research it myself, then present
  **options with a recommendation** — not open questions. Reserve questions for genuine
  product/preference choices only the user can determine.

## Never hide, suppress, or fake a fix (hard rule)

- **Never suppress a finding to make output look clean.** No `.snyk` ignores, no silencing
  deprecation/lint/scanner warnings, no "mark false positive and move on." The only acceptable
  outcomes for a security/scan finding are: **(a) actually fix it** (upgrade, override, refactor), or
  **(b) leave it fully visible** and tell the user plainly it is unfixed and why.
- **Never claim "fixed / done / clean" without showing the proof** (command output, rescan result).
- **Never declare something "unfixable" without exhausting real fixes first** — check newer major
  versions, `overrides`, alternative packages, and code refactors, and show what was tried. "I gave
  up" is not "it can't be done."
- **Never disguise an unfixed problem as fixed**, and never answer an easier adjacent question than the
  one asked.

# Known build-time npm warnings (not bugs, not ours to fix)

Amplify deploy logs contain `npm warn deprecated ...` lines. Before claiming anything is "broken" or
"fixed," separate the two sources:

- **Amplify's global CLI toolchain (NOT this repo).** The bulk of the deprecation warnings (`inflight`,
  `vue@2`, `svgo@1`, `request`, `highlight.js@9`, etc.) come from Amplify's own build step
  `npm install -g @aws-amplify/cli bower cypress grunt-cli hugo-extended vuepress yarn`. They are not in
  our `package.json` or lockfile and **cannot** be removed from this repo. Ignore them.
- **Our tree = 0 deprecated packages.** Verify with an isolated Amplify-equivalent install:
  copy `package.json` + `package-lock.json` + `.npmrc` to a temp dir, run `npm ci`, and grep for
  `deprecated`. Expected: empty. (The former lone offender, `whatwg-encoding` under
  `astro-icon → cheerio → encoding-sniffer`, is removed via the `encoding-sniffer` npm `override`.)
- **`.npmrc` `legacy-peer-deps=true`** exists because `@astrolib/seo@1.0.0-beta.8` (its latest version)
  declares a peer range of `astro ^1–^5` while this repo runs `astro@7`. It is a *suppressed peer
  note*, not a deprecation, and does not appear in deploy logs. Leave it; revisit if `@astrolib/seo`
  ships astro-7 support.
