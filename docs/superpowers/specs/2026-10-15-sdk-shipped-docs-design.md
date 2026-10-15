# SDK-shipped docs: thin skill references — design

**Date:** 2026-10-15
**Status:** Approved design, pending implementation plan

## Problem

Skill references duplicate content that Auth0 SDKs and auth0.com/docs already
publish. Example: `references/framework-nextjs/index.md` shares 68% of its
non-blank lines verbatim with `skills/SKILL.md` shipped in
`@auth0/nextjs-auth0@4.32.0` (measured with `difflib.SequenceMatcher`). Keeping
both in sync by hand does not scale across ~50 references, and automation is
explicitly out of scope.

Goal: developers who do **not** use this skill should also succeed, because the
SDK itself ships the docs an agent needs. The skill then carries only what no
single SDK or docs page owns, and points the agent at the rest.

## Grounding

- `@auth0/nextjs-auth0@4.32.0` tarball ships `AGENTS.md`, `guides/*.md`,
  `skills/**/SKILL.md` (verified via `npm pack --dry-run`, 2026-10-14).
- `@auth0/auth0-react@2.28.2` and `@auth0/auth0-spa-js@2.28.4` ship only
  `README.md` (same method).
- `next@16.4.1` ships `dist/docs/**.md` — the precedent for in-package docs.
- auth0.com/docs serves a markdown variant of every page by appending `.md`
  (e.g. `https://auth0.com/docs/quickstart/webapp/nextjs.md` →
  `text/markdown`, 38 KB vs 3.6 MB HTML) and an index at
  `https://auth0.com/docs/llms.txt`.
- `evals/behavioral/run-evals.mjs` already runs each case with and without the
  skill and reports the delta (`evals/behavioral/README.md`).

## Decisions

1. **All SDKs ship docs.** This repo defines a contract and coordinates rollout;
   a framework reference is slimmed only once its SDK ships `docs/`.
2. **Discovery = local first, version-pinned GitHub fallback.** Same `docs/`
   path in the repo and the published artifact.
3. **Approach A — thin pointer references.** Router, `references/` layout,
   naming, and depth-3 reachability are unchanged; references shrink.
4. **Feature references are in scope**, delegating to `auth0.com/docs/*.md`.
5. **SDKs ship `docs/**.md`**, not an agent-specific `SKILL.md`.

## 1. Reference shapes

Principle (replaces "WIRING inline, always"): **the skill owns only what no
single SDK or docs page can; everything else is a pointer the agent must
fetch.**

### Framework reference (`framework-*/index.md`, ~60–100 lines)

| Block | Contents |
|---|---|
| Use / don't use | One-line purpose; "when NOT to use → route elsewhere" |
| Install | Package-manager command |
| Tenant setup | Auth0 CLI app creation, callback/logout URLs, env var names (cross-SDK; skill-owned) |
| **Read the SDK docs** (mandatory step) | 1. Local: list `node_modules/<pkg>/docs/` (or `vendor/<pkg>/docs/`), read `docs/README.md`, then the files relevant to the task. 2. Else: same `docs/` path at `github.com/auth0/<repo>` tag `v<installed-version>` via `raw.githubusercontent.com`. 3. Concepts: `https://auth0.com/docs/<page>.md` |
| Agent-only rules | ≤ ~10 Common Mistakes / decisions the SDK docs don't cover |

### Feature reference (`feature-*/index.md`)

| Block | Contents |
|---|---|
| Use / don't use | Same as framework |
| **Read the docs** (mandatory step) | Specific `https://auth0.com/docs/<page>.md` pages; `https://auth0.com/docs/llms.txt` as discovery index |
| WIRING the docs lack | Agent step-blocks, exact Management API / CLI sequences, gotchas (e.g. `--tenant`, merge-before-PUT) |
| DECISION | Triage tables, capability/plan gating — kept inline |

Procedure-heavy features (`feature-custom-domains`, `feature-acul`,
`feature-migration`) keep their step-blocks and lose prose; they shrink less.

### Rules

- **Extract before offload:** copy any agent-only rule into the kept text
  before deleting its source block.
- **Fetches are mandatory steps**, phrased "Read X before writing code", never
  "See also".
- **Greenfield:** install first, then read local docs.
- **Retired** from `docs/architecture.md`: "WIRING inline, always"; "never a
  literal `node_modules` path"; `verified against <pkg>@<ver>` markers (the
  installed package now defines the version).

## 2. SDK docs contract (`docs/sdk-docs-contract.md`)

- **Location:** `docs/` at the SDK repo root, included in the published
  artifact (npm `files`, composer archive, gem, wheel, …). Where artifacts
  can't carry markdown (Android AAR, Swift SPM, NuGet), presence in the repo at
  the release tag suffices; the GitHub fallback covers it.
- **Entry point:** `docs/README.md` — a table of contents, one line per file.
- **Expected topics:** getting started (install, config, env vars, minimal
  login/logout); protecting routes; calling APIs / access tokens; error
  handling (codes and causes); migration (when a major version exists).
  Optional feature guides (MFA, organizations, passkeys, …).
- **Style:** human- and agent-readable; copy-pasteable code; explicit import
  paths; an anti-patterns list. No harness-specific frontmatter.
- **Versioning:** docs at a tag describe that tag. The skill never pins a
  version.
- **Rollout table** in the contract doc: SDK · repo · status
  (`not started` / `shipped`) · first version shipping `docs/`.

## 3. Rollout, gating, testing

### Order

1. **This repo:** write `docs/sdk-docs-contract.md`; rewrite the sourcing
   discipline in `docs/architecture.md` and the framework template in
   `CONTRIBUTING.md` per §1; update the `author-auth0-skill` procedure.
2. **Feature references** (no SDK dependency): exemplars first
   (`audit-pricing` — offload; `universal-portals` — feature WIRING
   stays; `audit-remediation` reviewed and already conforms, no change), then
   `branding`, `mfa`, `organizations`, `dpop`, then `custom-domains`, `acul`,
   `migration`.
3. **Next.js pilot:** PR to `auth0/nextjs-auth0` adding `docs/` (converted from
   its existing `skills/` + `guides/`) to the published package. Slim
   `framework-nextjs` only after that ships in a release.
4. **Remaining SDKs:** slim each reference when its contract row is `shipped`.

### Per-reference merge gate

- `uvx skillsaw --strict`, `scripts/check_router_reachability.py`, and
  `scripts/check_routing_evals.py` pass (paths are unchanged, so routing is
  unaffected).
- The reference's behavioral eval **with skill** scores ≥ its pre-slim score.
- Framework references: record the **without-skill** score before and after
  the SDK ships `docs/` (informational, not a gate — it measures the
  "succeed without our skill" goal).
- References without a graded behavioral case (`audit`, `healthcheck`,
  `universal-portals` today) are gated on the static checks plus an explicit
  extract-before-offload checklist in the PR.

### Graders

Existing code-pattern graders stay. Add one grader for framework cases: the
transcript shows the agent read the SDK `docs/` path or fetched the docs `.md`
page — catches skipping the step and guessing.

### Risks

| Risk | Mitigation |
|---|---|
| No network → GitHub / auth0.com fetch fails | Local `node_modules`/`vendor` read is first; reference keeps install, tenant setup, and mistakes list |
| auth0.com/docs URL churn (not covered by reachability) | Small link-check script over `auth0.com/docs/*.md` URLs in references; run manually or scheduled, not per-PR |
| SDK docs quality drift | Owned by SDK teams; this repo's evals surface it |

## Out of scope

- Automation / generating references from SDK docs.
- `SKILL.md` frontmatter or `description` changes (activation evals unaffected).
