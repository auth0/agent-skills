# Unified Auth0 Skill — Architecture & Framework Detection

**Date:** 2026-07-02
**Branch:** `worktree-single-skill`
**Status:** Approved design — ready for implementation plan

## Context

The `worktree-single-skill` branch consolidated ~45 individual Auth0 skills into
a **single `auth0` router skill** backed by a flat pool of reference files
(`framework-*`, `feature-*`, `tooling-*`, `pattern-*`). The router `SKILL.md`
detects intent → framework → tooling and loads 2–3 reference files.

The re-architecture implements RAPID Option B (one always-on skill, deterministic
file-based router) from
https://oktainc.atlassian.net/wiki/spaces/~5f5f175142547c007107cc9a/pages/940835138.

Two problems remain:

1. **Framework detection only works when an Auth0 SDK is already installed.** The
   router keys entirely off Auth0 SDK packages (`@auth0/auth0-react`, etc.). A
   developer who hasn't installed an SDK yet — the common case when *adding* auth
   — gets no framework match and falls straight through to "ask the developer."
2. The branch is behind `main`, which added a standalone `auth0-dpop` skill and
   updated `acul-screen-generator` / `auth0-vue`. The branch also still ships a
   second skill (`acul-screen-generator`) alongside the "one skill," and has an
   unreachable reference file (`framework-php-api.md`).

## Goals

1. Rebase onto latest `main`; bring in `auth0-dpop` and the acul/vue updates.
2. Fold `auth0-dpop` into the one skill, routed like MFA (intent row, no
   SDK-signal detection). Delete the standalone skill.
3. Fold `acul-screen-generator` into the one skill (B1); reconcile its richer
   material with `feature-acul.md`. Delete the standalone skill so there is
   genuinely **one** skill.
4. Make framework detection work **before** an Auth0 SDK is installed — from
   non-Auth0 workspace signals and from the prompt.
5. Fix router variant reachability (B2) and add a CI reachability check (B3).
6. Ship architecture docs (why we unified, what the structure is) under `docs/`
   and a contributor guide for extending the unified skill.

## Non-goals

- No net-new Auth0 *capability* content (S1 in the review notes). Folding dpop
  and acul is repackaging existing content, not new features.
- No change to Tier-1 (Auth0-SDK-present) detection behavior — it stays
  byte-for-byte so existing users don't regress.

## Design

### Framework detection: three-tier cascade (router Step 2)

Restructure Step 2 from a single SDK-package lookup into a cascade. **First tier
that yields a framework wins.**

- **Tier 1 — Auth0 SDK present (unchanged).** Today's tables. Strongest signal:
  the developer already committed to a framework + variant. Preserved exactly.
- **Tier 2 — Non-Auth0 workspace signals.** When no Auth0 SDK is found, read the
  *same* project files for framework fingerprints that don't depend on Auth0:
  - Node: `next` → nextjs, `nuxt` → nuxt, `@angular/core` → angular, `vue` → vue,
    `express` → express (variant by intent), `fastify` → fastify, plain `react`
    (no meta-framework) → react/spa-js.
  - Python: `fastapi` → fastapi-api, `flask` → flask.
  - Java: `spring-boot` → springboot-api.
  - PHP: `laravel/framework` → laravel (variant by intent), else `php`.
  - Go: `go.mod` present + HTTP server → go.
  - Native: `Package.swift`/`.xcodeproj` → swift, `pubspec.yaml` → flutter,
    `*.csproj` → .NET variant.

  A new **`references/framework-signals.md`** holds this non-Auth0 dependency →
  framework table. It is a *detection aid*, not a loadable target — the
  reachability checker must whitelist it (not require it to be routed to).
- **Tier 3 — Prompt-derived.** No workspace signal → parse the developer's
  message for a framework name ("my Next.js app", "add auth to my Go API"). A
  keyword → framework table lives in the router `SKILL.md`.

**Signal priority:** Auth0 SDK (Tier 1) > non-Auth0 workspace deps (Tier 2) >
prompt (Tier 3). When Tier 2 and Tier 3 disagree materially, or a base framework
has web-vs-API variants that neither tier disambiguates, the router **states what
it detected and asks one question** rather than silently picking. This is what
closes the B2 class of bug at the routing layer.

### Web-app vs API variant disambiguation (B2 fix)

Frameworks with a web/API split must keep **all** variants reachable:
`express`/`express-jwt`, `php`/`php-api`, `aspnetcore-auth`/`aspnetcore-api`,
`laravel`/`laravel-api`, `fastify`/`fastify-api`, plus `fastapi-api` and
`springboot-api`.

Disambiguation is **intent-first, then ask**: infer from prompt/workspace
(building a UI/login → web; protecting endpoints / no frontend → API); if still
ambiguous, ask the developer. Concretely:
- Add the missing `php-api` route (no row currently emits it — the orphaned
  `framework-php-api.md`).
- Audit every other web/API pair for an explicit disambiguation rule.

### dpop routing (like MFA)

- Add `feature:dpop` intent row to Step 1 (triggers: "DPoP", "bind tokens to the
  client", "sender-constrained tokens", "prevent token theft / replay").
- Step 4 loads `references/feature-dpop.md` + `tooling-{tooling}.md`; if a SPA
  framework is detected (vue/react/angular/spa-js), also load its
  `framework-*.md`. DPoP is SPA-only — the feature file states the SSR
  exclusion.
- Content: port `auth0-dpop/SKILL.md` + `references/examples.md` +
  `references/integration.md` into `references/feature-dpop.md`, flattening any
  reference→reference links.

### ACUL fold-in (B1)

- Reconcile the standalone `acul-screen-generator` material (`screen-catalog.md`,
  `theming-patterns.md`, `acul-react-sdk.md`, `acul-js-sdk.md`, `cli-commands.md`,
  `social-providers.md`, plus its post-generation build-validation phase from
  main) into `references/feature-acul.md`, preserving the richer content.
- Keep the `feature:acul` intent row. Delete the standalone skill directory.
- Update README so only `auth0` is listed.

### Reachability check (B3)

New `scripts/check-router-reachability.py`, run in CI alongside skillsaw:
1. Parse router `SKILL.md`; enumerate every `references/*.md` filename it can
   emit (including the `{framework}`/`{tooling}` template expansions against the
   known framework/tooling value sets).
2. Assert every file in `references/` is reachable (catches orphans like
   `php-api`). Whitelist `framework-signals.md` (a detection aid, not routed).
3. Assert no reference file links to another reference file (Claude Code linking
   rule).

### Naming conventions (established, documented)

- `feature-<name>.md` — capability spanning frameworks (mfa, organizations,
  custom-domains, acul, branding, migration, **dpop**).
- `framework-<name>.md` — one SDK/framework integration.
- `tooling-<name>.md` — cli / mcp / terraform.
- `pattern-<name>.md` — cross-cutting guidance.
- `framework-signals.md` — Tier-2 non-Auth0 detection table (detection aid).

### Documentation

- **`docs/architecture.md`** — why we unified (one always-on description,
  deterministic file-based router, zero reference→reference links), the
  `feature-`/`framework-`/`tooling-`/`pattern-` structure, and the routing flow
  (intent → framework cascade → tooling → load).
- **Extend `CONTRIBUTING.md`** — "Adding a capability to the unified skill":
  which prefix to use, add a router row, add a Tier-2 workspace signal + Tier-3
  prompt keyword for new frameworks, run the reachability check. Single-sourced;
  `docs/architecture.md` links to it rather than restating.

## Implementation sequence

1. Rebase onto `main`; resolve conflicts keeping the re-architecture.
2. Fold `auth0-dpop` → `feature-dpop.md` + router rows; delete standalone skill.
3. Fold `acul-screen-generator` → reconcile into `feature-acul.md`; delete
   standalone skill; update README.
4. Rewrite router Step 2 as the three-tier cascade; add `framework-signals.md`;
   add prompt keyword table; add variant disambiguation + `php-api` route.
5. Add `scripts/check-router-reachability.py`; wire into CI.
6. Write `docs/architecture.md`; extend `CONTRIBUTING.md`.
7. `uvx skillsaw --strict` + new reachability check must pass.

## Risks / open items

- **Tier-2 fingerprints must not misfire** for projects using a framework but a
  non-standard auth setup. Mitigation: Tier 2 only runs when *no* Auth0 SDK is
  present, and web/API ambiguity always defers to intent-then-ask.
- **ACUL content reconciliation** is the largest single task — risk of dropping
  detail. Mitigation: diff standalone material against `feature-acul.md`
  section-by-section before deleting anything.
- **Reachability checker template expansion** must know the full framework and
  tooling value sets; keep those lists in one place the checker and router agree
  on.
