# AGENTS.md — Project Agent Instructions

## 1. Model variables

Use model variables instead of hardcoding provider-specific model names in workflow rules.

### 1.1 GPT model mapping

| Variable | Model | Intended use |
|---|---|---|
| `$FRONTIER_MODEL` | `gpt-5.5` | Frontier model for complex coding, research, and real-world work. Current top-tier model. |
| `$STANDARD_MODEL` | `gpt-5.4` | Strong model for everyday coding. |
| `$FAST_MODEL` | `gpt-5.4-mini` | Small, fast, and cost-efficient model for simpler coding tasks. |

### 1.3 Variable usage rules

Use variables in instructions, worker briefs, and delegation rules.

Do not hardcode model names unless the task specifically requires a provider-specific model.

Default selection:

- Use `$FRONTIER_MODEL` for complex architecture, high-stakes work, difficult debugging, deep research, production-impacting decisions, and final orchestration.
- Use `$STANDARD_MODEL` for everyday coding, source conflict analysis, architectural trade-off analysis, independent verification, and moderately complex reasoning.
- Use `$FAST_MODEL` for simple source gathering, summarization, mechanical checks, repetitive processing, and low-risk tasks.

---

## 2. Stage map and workflow

Before touching anything, write the full stage plan.

Stage-map rules:

- Number stages.
- Give each stage a brief expected output.
- Each stage must produce one verifiable artifact.
- If a stage produces nothing checkable, merge it with the next stage.
- The stage map is a living document, not a contract.
- Update the map when new information invalidates the plan.

Replan budget:

- At most two full replans per run.
- Renumbering or splitting one stage does not count as a full replan.
- Reordering or rewriting the stage map does count.
- If a third structural replan seems necessary, stop and return the ambiguity for user decision.

Default workflow:

1. Understand the request.
2. Write the stage map.
3. Inspect relevant files, docs, and project context.
4. Identify assumptions.
5. Diagnose before changing.
6. Propose the smallest safe change.
7. Ask approval if modification is needed.
8. Apply only the approved change.
9. Run relevant checks.
10. Report evidence.

For bugs, use:

```text
Symptom:
Hypothesis:
Check:
Evidence:
Root cause:
Fix options:
Recommended fix:
QA plan:
```

---

## 3. Delegation

You are the delegated orchestrator.

Run stages in order.

For independent, parallelizable sub-parts, you may spawn workers when authorized in the briefing.

Delegation rules:

- Match the worker model to the stage’s difficulty.
- Use `$FAST_MODEL` for simple source gathering, summarization, mechanical checks, and repetitive processing.
- Use `$STANDARD_MODEL` for technical judgment, source conflict analysis, architectural trade-off analysis, or independent verification.
- Use `$FRONTIER_MODEL` for orchestration, complex coding, complex research, production-impacting judgment, high-stakes decisions, and real-world work.
- Do not do bulk mechanical work inline on `$FRONTIER_MODEL` when `$FAST_MODEL` can produce the same verifiable artifact.
- Workers do not spawn workers.
- Do not split a single coherent thought just to use subagents.
- Workers produce research or verification artifacts; the orchestrator makes the final recommendation.

Good delegation:

- Research X while the orchestrator does Y.
- Process a specific list of files.
- Verify an artifact independently.
- Compare official documentation with field reports for one option.

Bad delegation:

- Splitting one coherent reasoning task only to use subagents.
- Delegating without a concrete artifact.
- Delegating without a checkable output.
- Letting workers decide final project direction.

Every worker brief must include:

```text
Worker model:
Specific task:
Expected artifact:
Where to save output:
Pass condition:
Operational rules:
```

Pass these operational rules to subagents verbatim:

```text
Verify before flag. Before flagging any problem — verify it actually exists. Grep, diff, run it, or check the source directly. Never report a problem that hasn't been confirmed present. An unverified flag, meaning a warning raised because evidence wasn't found rather than because a fault was found, is itself an error: it manufactures doubt where none is warranted and sends the user chasing ghosts. Absence of evidence is not the finding. Web silence in particular is never grounds for a warning against the user's firsthand information. Confirm, then flag.

Warning threshold. Across a multi-stage run, minor concerns accumulate that aren't worth halting on individually. Keep a running count. At three accumulated warnings, unless the briefing sets a different number, stop and surface all of them at once before continuing. A concern that is independently material and confirmed does not wait for the threshold.

Find-and-replace safety. When editing files with sed, or any substring replace, always anchor on word boundaries. A bare edge replace will mangle Ledger into garbage. Use \bword\b, not bare word. Prefer a targeted string-replace on a unique anchor over sed. Never use bare unanchored sed. After any replace pass, grep for glued or malformed compound words before presenting.
```

---

## 4. Project overview

Fill this section only with facts confirmed from the repository or explicitly supplied by the project owner.

```text
Project purpose:
Futurion Solutions — Astrowind is a bilingual Astro static site for https://solutions.futurion.es.

Main runtime:
Node.js / Astro static-site build pipeline. Verify exact package manager and scripts from the repository before running commands.

Frameworks:
Astro; Astrowind theme/project structure. Verify additional integrations from the repository before relying on them.

Primary database:
None confirmed. Treat the site as static unless repository inspection proves otherwise.

Deployment target:
Static site deployment for https://solutions.futurion.es. Verify hosting and deployment process from repository or project documentation before deploying.
```

Important paths:

| Path | Purpose |
|---|---|
| `astro.config.ts` | Astro configuration; Spanish post redirects must be added here. |
| `public/llms.txt` | AI engine index; every new article must be registered here. |
| `src/data/post/` | Blog post source directory for English and Spanish Markdown posts. |
| `src/data/post/<slug>.md` | English post file path; canonical URL is `/<slug>`. |
| `src/data/post/es-<slug>.md` | Spanish post file path; canonical URL is `/es/es-<slug>`. |

Rules:

- Add paths only after confirming them from the repository or from explicit project-owner instructions.
- Do not invent architecture.
- Keep this section short and operational.

---

## 5. Project commands

All commands in this section must be verified before relying on them.

### 5.1 Setup

```bash
<<< install/setup command >>>
```

### 5.2 Run locally

```bash
<<< local run command >>>
```

### 5.3 Test

```bash
<<< test command >>>
```

### 5.4 Lint / format / typecheck

```bash
<<< lint command >>>
<<< format check command >>>
<<< typecheck command >>>
```

### 5.5 Build

```bash
<<< build command >>>
```

### 5.6 Database

Read-only inspection:

```bash
<<< read-only database command >>>
```

Migrations require approval:

```bash
<<< migration command >>>
```

### 5.7 Logs

```bash
<<< logs command >>>
```

### 5.8 Deployment

Deployments require approval.

```bash
<<< deployment command or process >>>
```

Before deployment, provide:

```text
Change summary:
Risk:
Rollback plan:
Pre-deploy checks:
Post-deploy checks:
```

---

## 6. Coding conventions

Follow existing project style.

Before writing code:

1. Inspect nearby files.
2. Match naming conventions.
3. Match formatting.
4. Match error handling.
5. Match logging style.
6. Avoid new dependencies unless approved.

Rules:

- Make minimal changes.
- Do not reformat unrelated code.
- Do not rename unrelated symbols.
- Do not change public APIs unless required.
- Do not introduce broad abstractions for a local fix.
- Add or update tests when behavior changes.
- Prefer targeted string replacement on a unique anchor.
- Never use bare unanchored `sed` or broad substring replacement.
- Anchor word replacements on word boundaries.
- After replacement, grep for malformed compound words before delivery.

Adding or upgrading dependencies requires approval.

Before proposing a dependency, provide:

```text
Dependency:
Reason:
Alternatives:
Security/maintenance status:
Runtime/build impact:
Rollback:
```

### 6.1 Futurion/Astrowind article publishing rules

Use these rules for every blog article change.

#### File naming and canonical URLs

- English posts must live at `src/data/post/<slug>.md`.
- English post canonical URL: `/<slug>`.
- Spanish posts must live at `src/data/post/es-<slug>.md`.
- Spanish post canonical URL: `/es/es-<slug>`.
- The `es-` prefix is part of the Spanish slug. Astro also prepends `/es/`, so the final Spanish canonical path is `/es/es-<slug>`.

#### Mandatory Spanish redirects

Every new Spanish post must add both redirects in `astro.config.ts` in the same commit as the post:

```ts
// In astro.config.ts -> redirects object
'/es-<slug>': '/es/es-<slug>', // root-level hit, missing /es/ prefix
'/es/<slug>': '/es/es-<slug>', // /es/ present but es- prefix missing from slug
```

Rules:

- Add redirects proactively at publish time.
- Do not wait for Google Search Console or 404 reports.
- Do not publish a Spanish post without these two redirects.

#### Mandatory `public/llms.txt` registration

Every new article must be registered in `public/llms.txt` in the same commit.

- Add English articles under `## Blog articles (English)`.
- Add Spanish articles under `## Artículos del blog (Español)`.
- Use this format exactly:

```md
- [Article Title](https://solutions.futurion.es/<canonical-url>): One-line description
```

#### Publishing checklist before commit

- [ ] EN file exists at `src/data/post/<slug>.md` with `lang: en`.
- [ ] ES file exists at `src/data/post/es-<slug>.md` with `lang: es`.
- [ ] `astro.config.ts` has `'/es-<slug>': '/es/es-<slug>'`.
- [ ] `astro.config.ts` has `'/es/<slug>': '/es/es-<slug>'`.
- [ ] `public/llms.txt` has the English entry under `## Blog articles (English)`.
- [ ] `public/llms.txt` has the Spanish entry under `## Artículos del blog (Español)`.

#### Common publishing mistakes to prevent

- Spanish filename missing the `es-` prefix.
- Spanish post published without both redirects.
- Redirects added only after search-console errors or 404s appear.
- Article published without updating `public/llms.txt`.

---

## 7. Testing, validation, and evidence

Every stage must define a pass condition that can fail.

Valid checks include:

- A named test command that runs and passes.
- A file that exists in the expected shape.
- A source actually fetched and read.
- An output diffed against the spec.
- A rendered document opened and read back.
- A data quality assertion run against raw data.
- A command output, file path, log line, or comparison.

Invalid checks:

- “I reviewed it.”
- “Looks right.”
- “Should work.”
- “Probably correct.”
- “Verified” without naming the artifact, command, file, source, or comparison.

Rules:

- Every check must name the exact command, file, source, or comparison.
- If a stage has no failable check, say so and mark the output unverified.
- If a fix at stage N invalidates a prior stage’s output, re-run that prior stage’s check before continuing.
- Worker output gets the same treatment: re-run or spot-check its named check before building on it.
- Before flagging a problem, verify it actually exists.
- Run the smallest relevant test first.
- Run broader checks when the change affects shared code.
- Report exact commands and results.
- If a check fails, report it clearly.
- If a check is skipped, explain why.

Use this format:

```text
Checks run:
- command/source/file/comparison: result

Evidence:
- file/path, output, log, test result, source URL, or observed behavior

Not tested:
- item: reason
```

---

## 8. Domain-specific verification

### 8.1 Software

Before writing:

- Read the full relevant section.
- List the files actually opened.
- Any file touched by the diff that was not opened is a gap.

Required checks:

- Named test command runs and passes.
- Tests are added or updated alongside behavior changes.
- At least one error path is exercised, with output shown.
- A suite never run does not count as passing.

### 8.2 Futurion/Astrowind article publishing

Before writing or publishing any article:

- Confirm the target language set: English only, Spanish only, or bilingual pair.
- Confirm the slug and canonical URL for each language.
- Inspect `src/data/post/`, `astro.config.ts`, and `public/llms.txt` before editing.
- For Spanish posts, verify both redirect source paths are present in `astro.config.ts`.
- Verify every article entry is present in the correct `public/llms.txt` section.

Required checks:

- `test -f src/data/post/<slug>.md` for every English article file expected.
- `test -f src/data/post/es-<slug>.md` for every Spanish article file expected.
- `grep` or equivalent confirms `lang: en` in English post frontmatter.
- `grep` or equivalent confirms `lang: es` in Spanish post frontmatter.
- `grep` or equivalent confirms both Spanish redirects in `astro.config.ts`.
- `grep` or equivalent confirms each canonical article URL in `public/llms.txt`.
- Run the smallest relevant project validation command available from verified package scripts.

If any required article-publishing check is skipped, list the exact skipped check and reason in the final report.

### 8.3 Research

Before synthesizing:

- Gather sources first.
- Read sources during the current run.
- Delegate option research to lower-tier subagents when authorized.

Required checks:

- Every load-bearing claim maps to a source actually fetched and read.
- Name the URL or document for each load-bearing claim.
- Claims based only on model memory must be labeled as such.
- Distinguish confirmed facts from inferences explicitly.

### 8.4 Data

Before computing:

- Understand the data shape first.
- Print row count.
- Print column list.
- Print a sample.
- State the hypothesis before computing.

Required checks:

- Run quality assertions for nulls, duplicate keys, out-of-range values, and row count vs. source where applicable.
- Show assertion output.
- Recompute at least one subtotal in the deliverable independently from raw rows.

### 8.5 Documents, spreadsheets, and decks

Before building:

- Build from the explicit spec.
- Track each required section, number, and label.

Required checks:

- Diff the artifact against the spec line by line.
- Open the produced file and read it back.
- Confirm every required section, number, and label on the rendered file, not only in the generation code.

### 8.6 Long-running tasks

Before continuing:

- Keep a work log.
- Define done criteria upfront.
- Done criteria must be written and testable.

Required checks:

- Each continuation begins by confirming the log was re-read.
- Name any decision changed by re-reading the log.
- If the log changes no decision, say so.

---

## 9. Option research and ambiguity handling

If a decision affects architecture, data, security, production behavior, or user-visible behavior, do not choose silently.

Before proposing options, research each option from three inputs:

1. **Official documentation**  
   Use vendor docs, framework docs, language docs, API references, RFCs, standards, or project documentation.

2. **Web and community sources**  
   Use relevant forums, issue trackers, GitHub discussions, Stack Overflow, blog posts, postmortems, benchmarks, or field reports.

3. **Model memory**  
   Use prior knowledge only as a labeled input. Do not treat memory as stronger than fetched sources.

Research should be delegated to lower-tier subagents when authorized.

Delegation pattern:

```text
Research task:
Worker model:
Option being evaluated:
Sources required:
- Official documentation
- Web/community/relevant resources
- Model-memory assessment

Expected output:
- Confirmed facts
- Inferences
- Risks
- Trade-offs
- Source list
- Recommendation for or against this option

Pass condition:
- At least one official source fetched and read
- At least one relevant non-official source fetched and read
- Memory-based claims labeled as memory
- Load-bearing claims mapped to named sources
```

Model selection for option research:

- Use `$FAST_MODEL` for locating and summarizing sources.
- Use `$STANDARD_MODEL` for comparing sources, identifying conflicts, and evaluating risks.
- Use `$FRONTIER_MODEL` for final synthesis and recommendation.

For each option, use:

```text
Option A:
Description:
Official documentation findings:
Web/community findings:
Model-memory assessment:
Confirmed facts:
Inferences:
Pros:
Cons:
Risk:
Verification needed:

Option B:
Description:
Official documentation findings:
Web/community findings:
Model-memory assessment:
Confirmed facts:
Inferences:
Pros:
Cons:
Risk:
Verification needed:

Option C:
Description:
Official documentation findings:
Web/community findings:
Model-memory assessment:
Confirmed facts:
Inferences:
Pros:
Cons:
Risk:
Verification needed:

Recommendation:
Best option:
Reason:
Sources:
Residual uncertainty:
```

Rules:

- Gather research before synthesizing.
- Every load-bearing claim must map to a source fetched and read in the current run, or be labeled as model memory.
- Distinguish confirmed facts from inferences.
- If official documentation conflicts with community sources, prefer official documentation unless there is verified evidence that the official documentation is outdated, incomplete, or wrong in the project’s actual context.
- If sources are weak or insufficient, say so.
- Do not invent sources.
- Do not present unsourced memory as researched fact.
- If a decision requires more information from the user, provide at least three researched options with trade-offs before recommending one.

If the task requires a third structural replan, stop. The task is ambiguous at the requirements level, not the execution level. Return the ambiguity for user decision instead of continuing.

---

## 10. Git workflow

Before repository changes:

```bash
git status --short
git branch --show-current
git diff --stat
```

After repository changes:

```bash
git status --short
git diff --stat
git diff
```

Do not commit unless asked.

If asked to commit:

1. Show the diff summary first.
2. Run relevant checks.
3. Use a clear commit message.
4. Include only approved changes.
5. Do not include secrets.

Pull requests require explicit approval unless the user directly asks for one.

---

## 11. Warnings and confirmed problems

Verify before flagging.

Before reporting a problem:

- Grep it.
- Diff it.
- Run it.
- Check the source directly.
- Confirm the fault exists.

Never report a problem merely because evidence was not found.

Absence of evidence is not the finding. Web silence is never grounds for a warning against the user’s firsthand information.

Warning threshold:

- Track minor confirmed concerns across the run.
- At three accumulated warnings, stop and surface all of them before continuing.
- A material confirmed issue does not wait for the threshold.

---

## 12. Self-critique before delivery

Before final delivery, read the final output as a skeptical reviewer.

Look for:

- Missing requirements.
- Unverified claims.
- Scope creep.
- Weak checks.
- Broken numbering.
- Contradictions.
- Untested risky changes.
- Unsupported assumptions.
- Duplicate or conflicting rules.

If a real weakness exists:

- Fix it, or
- Flag it clearly.

If genuine checking turns up nothing, say so plainly. Do not manufacture a weakness.

For high-stakes deliverables, spawn a fresh `$STANDARD_MODEL` or `$FAST_MODEL` verifier when authorized. Brief the verifier only with the spec and artifact, not prior reasoning. Have it run the checks cold.

If the task is beyond `$FRONTIER_MODEL` capability, flag it to the user. Name what was attempted and where it failed. Do not produce plausible-sounding wrong output.

---

## 13. Definition of done

A task is done only when:

- The requested change is complete.
- The change is minimal and scoped.
- Stage map was followed or updated within the replan budget.
- Each stage has a named artifact.
- Each stage has a failable check, or is explicitly marked unverified.
- Relevant checks were run.
- Evidence is provided.
- No unrelated files were changed.
- No secrets were exposed.
- Rollback is known if the change is risky.
- Any untested area is explicitly listed.
- Self-critique was performed before delivery.
- Backlog recommendations are separated from completed work.

Completion format:

```text
Stage map:
- stage: artifact: check result

Summary:
Files changed:
Checks run:
Evidence:
Not tested:
Risks:
Rollback:
Self-critique:
Backlog recommendations:
```

---

## 14. Backlog

If unrelated issues are found, do not fix them during the current task.

Add them here:

```text
- [ ] Problem:
      Location:
      Impact:
      Suggested fix:
      Priority:
```

### Pending

- [ ] `<<< problem — location — impact — proposed fix — priority >>>`

### Done

- [x] `<<< problem — fix — verification evidence — date >>>`
