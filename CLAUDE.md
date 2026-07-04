# Git workflow

- **Always push to `main`.** Commit changes directly to `main` and run `git push origin main`.
- **Never create a branch.** Do not create feature branches, do not open PRs, and do not ask which branch to use — unless the user explicitly asks for a branch or PR.
- Pushing to `main` triggers the AWS Amplify deploy, so ensure `npm run build` and `npm run verify:seo` pass before pushing.

# The rule: no fake success (non-negotiable)

**Do the real work and show the proof. Never make something look done, fixed, or clean when it isn't.**

Every time I report work, all of these must be true in the same message — each is yes/no, check it:

1. **Proof is shown.** The exact command / scan / test output that proves the claim is pasted here.
   No proof pasted → I write "not verified," never "done" or "fixed."
2. **The real question is answered** — the exact one asked, not an easier nearby one
   (e.g. "deprecations" is not "vulnerabilities"; if I'm answering a different question, I say so).
3. **Every finding is fixed or visible.** Each warning / vuln / error is either genuinely fixed, or
   left fully visible with a plain "not fixed — here's why." Never silenced, `.snyk`-ignored, hidden,
   or called "unfixable" without showing what I actually tried.
4. **I did my own research.** I don't push decisions onto the user that they can't be expected to know;
   I find the answer and bring options with a recommendation.

If any of the four is not true, I say so plainly in that message instead of dressing it up.

# Known build-time npm warnings (not bugs, not ours to fix)

Amplify deploy logs contain `npm warn deprecated ...` lines. Before claiming anything is "broken" or
"fixed," separate the two sources:

- **Amplify's global CLI toolchain (NOT this repo).** The bulk of the deprecation warnings (`inflight`,
  `vue@2`, `svgo@1`, `request`, `highlight.js@9`, etc.) come from Amplify's own build step
  `npm install -g @aws-amplify/cli bower cypress grunt-cli hugo-extended vuepress yarn`. They are not in
  our `package.json` or lockfile and **cannot** be removed from this repo. Leave them visible in the
  logs; never present them as our bug, and never silence one of *our own* findings to match.
- **Our tree = 0 deprecated packages.** Verify with an isolated Amplify-equivalent install:
  copy `package.json` + `package-lock.json` + `.npmrc` to a temp dir, run `npm ci`, and grep for
  `deprecated`. Expected: empty. (The former lone offender, `whatwg-encoding` under
  `astro-icon → cheerio → encoding-sniffer`, is removed via the `encoding-sniffer` npm `override`.)
- **`.npmrc` `legacy-peer-deps=true`** exists because `@astrolib/seo@1.0.0-beta.8` (its latest version)
  declares a peer range of `astro ^1–^5` while this repo runs `astro@7`. This is a documented, accepted
  peer mismatch (recorded here in the open, not hidden), not a deprecation. Keep it; revisit if
  `@astrolib/seo` ships astro-7 support.
