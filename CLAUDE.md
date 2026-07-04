# Git workflow

- **Always push to `main`.** Commit changes directly to `main` and run `git push origin main`.
- **Never create a branch.** Do not create feature branches, do not open PRs, and do not ask which branch to use — unless the user explicitly asks for a branch or PR.
- Pushing to `main` triggers the AWS Amplify deploy, so ensure `npm run build` and `npm run verify:seo` pass before pushing.
