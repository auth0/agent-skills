# Design: CI security guardrails & contributor DX

**Date:** 2026-07-20
**Status:** Approved — ready for implementation plan

## Problem

The repo was restructured (v2.0, #137) into a single `auth0` skill whose real
surface is **50 `references/*.md` files** loaded on demand by the agent, plus
`SKILL.md`, `scripts/`, and `assets/`. We accept **external OSS pull requests**
and must treat them as **untrusted**. The current validation stack has gaps that
matter for untrusted contributions, and there is no single entrypoint a
contributor can run locally to reproduce CI.

### What already exists (do not rebuild)

- **skillsaw --strict** — frontmatter, structure, naming, `openclaw-metadata`,
  `context-budget`. CI + local. Config in `.skillsaw.yaml` + `.skillsaw/rules.py`.
- **Custom Python gates** — `scripts/check_router_reachability.py`,
  `scripts/check_routing_evals.py` (both with pytest), and
  `plugins/auth0/skills/auth0/scripts/validate-skill.sh`.
- **snyk-agent-scan** (`snyk_agent_scan.yml`) — scans skill markdown for
  skill-specific threats, with `.snyk-agent-scan-ignore.json` allowlist +
  `scripts/check_snyk_findings.py` blocking gate.
- **SCA scan** (`sca_scan.yml`) — Snyk CLI via `auth0/devsecops-tooling`.
- **CodeRabbit** — AI review with per-path instructions (advisory, not a gate).

### Confirmed gaps

1. **agent-scan only scans `SKILL.md`.** `snyk_agent_scan.yml` iterates skill
   dirs and scans `${skill_dir}/SKILL.md` only. The 50 `references/*.md` files —
   the primary prompt-injection / exfiltration surface for an untrusted PR — are
   never scanned.
2. **No secret scanning.** Recent commits (#145, #149, #150) hardened
   secrets/tokens **by hand in review**. Nothing automated blocks a committed
   client secret / token / API key.
3. **`scripts/` safety is advisory only.** Only CodeRabbit's path-instruction
   prompt looks at `scripts/`; there is no deterministic gate for `curl | bash`,
   download-and-execute chains, base64 obfuscation, or dangerous env vars.
4. **No local one-shot entrypoint.** CI runs skillsaw + three Python/pytest gates
   + `validate-skill.sh` as separate steps. A contributor must reconstruct that
   sequence by hand.

## Grounding

Design anchored to published standards, not invented categories:

- **OWASP Agentic Skills Top 10 (AST10)** — launched early 2026; the lens
  ClawHub's own scanner (ClawScan) uses. Relevant categories: AST01 Malicious
  Skills, AST02 Supply Chain Compromise, AST04 Insecure Metadata, AST05
  Untrusted External Instructions, AST08 Poor Scanning.
  <https://owasp.org/www-project-agentic-skills-top-10/>
- **Snyk agent-scan** — Skill Inspector finding categories cover exactly our
  selected surfaces: Prompt Injection, Malicious Code, Secret Detection,
  Third-Party Content Exposure, Unverifiable Dependencies (URLs).
  <https://labs.snyk.io/experiments/skill-scan/> · <https://github.com/snyk/agent-scan>
- **skillsaw supply-chain rules** — `hooks-dangerous` (curl|sh,
  download-and-execute, base64 obfuscation) and `settings-dangerous`
  (`LD_PRELOAD`, `NODE_OPTIONS`, command-execution settings), motivated by the
  2026 "Shai-Hulud" npm attack. <https://skillsaw.org/supply-chain-protection/>
- **ClawHub install does NOT scan at install time** (scanning is post-publish,
  advisory) — so it cannot gate our PRs; our CI must. <https://docs.openclaw.ai/clawhub/cli>

## Decisions (from brainstorm)

- **Audience:** external OSS PRs, treated as untrusted.
- **Gate model:** CI is the authoritative gate; **every CI check must also run
  locally** — no CI-only logic.
- **Scan surfaces (all in scope):** `references/*.md` content, secrets in the
  diff, `scripts/` safety, malicious/typo URLs.
- **Rollout:** hard-fail immediately (tree is green today; no grandfathering).
- **Fork PRs:** out of scope. Token-gated scans run where the secret exists
  (push to `main` / same-repo PRs); fork PRs rely on `gitleaks` (tokenless) plus
  the scan on `main`.
- **URL checking:** rely on Snyk agent-scan's URL findings — **no custom URL
  checker** (avoids an allowlist maintenance surface).
- **Deliverable:** spec **and** implementation this session.

## Approach

Chosen: **maximize existing tools + thin glue.** We already run Snyk agent-scan
and skillsaw; extend their coverage and add one focused new tool (`gitleaks`)
rather than write a custom scanner (rejected: reimplements agent-scan) or lean on
ClawHub (rejected: no install-time scan, cannot gate PRs).

## Components

### 1. Single shared entrypoint — `Makefile`

CI is authoritative and local == CI by construction: CI workflows invoke `make`
targets verbatim; no CI-only logic.

- `make lint` → `skillsaw --strict` + `check_router_reachability.py` +
  `check_routing_evals.py` + `validate-skill.sh` (+ their pytest suites).
- `make scan` → the security gates (§2–§4).
- `make check` → `lint` + `scan`. The one command a contributor runs.

Targets must be runnable on a clean checkout with `uv`/`uvx` available (matching
current CI assumptions). Document required tools in the target output when
missing (actionable error, non-zero exit).

### 2. Expand agent-scan to the full markdown surface

Change `snyk_agent_scan.yml` (and `scripts/scan_all_skills.sh`) so agent-scan
runs over **every markdown file** in each skill (`SKILL.md` + `references/*.md`),
not just `SKILL.md`. The existing `.snyk-agent-scan-ignore.json` allowlist and
`check_snyk_findings.py` blocking gate continue to apply across all scanned
files. Covers: Prompt Injection, Malicious Code, Third-Party Content Exposure,
Unverifiable Dependencies (URLs) → AST05, AST01, AST02.

**Fork PRs are out of scope.** Token-gated scans (agent-scan needs
`SNYK_TOKEN`) run where the secret is available — push to `main` and same-repo
PRs. GitHub withholds secrets from fork-triggered runs; we accept that a fork
PR's agent-scan step is skipped/no-op and the scan runs on `main` (or via a
maintainer re-run) instead. No `pull_request_target` gymnastics.

### 3. Secret scanning — already covered by skillsaw (no new tool)

**Corrected during planning (verified by running skillsaw 0.16.0 locally):**
skillsaw's `content-embedded-secrets` rule is **already active**
(`enabled: auto` → on, `severity: error`) and scans instruction files for
structured tokens (`ghp_…`, `sk-ant-…`, AWS `AKIA…`, private-key blocks, JWTs)
plus generic credential assignments, with a placeholder allowlist
(`<your-key>`, `${VAR}`) and entropy gating. This already covers the markdown
surface (the repo is ~all markdown), so the #145/#149/#150 hardening is
enforced going forward.

**Decision: drop `gitleaks`.** It would only add coverage for non-markdown
files and git history — marginal for an almost-all-markdown repo, and not worth
a new tool + config. Instead, the `make scan` target surfaces the existing
secret rule explicitly (via `skillsaw explain content-embedded-secrets` in docs)
so contributors know it's enforced. If a contributor needs to allow a new
placeholder pattern, they extend `additional-placeholders` in `.skillsaw.yaml`.
Covers AST04 / Secret Detection.

### 4. Supply-chain safety — enable skillsaw hooks/settings rules

**Corrected during planning:** `hooks-dangerous` / `settings-dangerous` scan
**hooks, settings, and skill/agent frontmatter** — NOT standalone `scripts/*.sh`.
They flag `curl | sh`, download-and-execute, `base64`/`eval` obfuscation, and
dangerous settings keys (`apiKeyHelper`, `awsAuthRefresh`, …) / env vars
(`LD_PRELOAD`, `NODE_OPTIONS`, `GIT_SSH_COMMAND`, proxy). Both are **currently
off** (only 51 of ~272 rules run) — enabling them (config-only in
`.skillsaw.yaml`, `severity: error`) is a real AST02 hardening win against the
Shai-Hulud hook-injection class.

**Standalone `scripts/` code** (e.g. `scripts/validate-skill.sh`) is NOT covered
by these rules. Deterministic shell-injection scanning of arbitrary scripts is
out of scope for this pass: that surface is covered by **Snyk agent-scan**
(Malicious Code / Suspicious Downloads categories) and **CodeRabbit's**
`scripts/**` path instruction (advisory). We do not add a custom `scripts/`
linter — the repo has very few scripts and the maintenance cost isn't justified.
Skillsaw version stays pinned (`0.16.0`) so rule sets are deterministic.

### 5. Docs layer — CONTRIBUTING

- New **"Security & validation gates"** section: a table mapping each gate →
  what it checks → how to fix → the `make` target that reproduces it locally.
  Reference OWASP AST10 category names so contributors recognize the standard.
- Short **security expectations for external PRs** note: what we scan and why,
  and that fork PRs may need a maintainer to re-run the token-gated scan.
- Keep single-sourced: CONTRIBUTING remains the source of truth; AGENTS.md links
  to it rather than restating.

## Out of scope (YAGNI)

- **Custom URL/domain checker** — dropped; rely on Snyk agent-scan URL findings.
- **`gitleaks`** — dropped; skillsaw `content-embedded-secrets` already covers
  the markdown secret surface.
- **Custom `scripts/` shell linter** — dropped; covered by agent-scan +
  CodeRabbit; too few scripts to justify.
- **pre-commit hooks** — CI is the main gate; `make check` covers local use.
- **Skill sandboxing / permissions manifest** — research confirms even ClawHub
  has no enforced sandbox; we will not invent one.

## Success criteria

- `make check` runs the full lint + scan suite locally and exits non-zero on any
  failure; CI invokes the same targets.
- agent-scan findings are produced for `references/*.md`, not just `SKILL.md`.
- `content-embedded-secrets` is enabled at `error` severity and the existing
  angle-bracket placeholders are **not** flagged (tree stays green).
- `hooks-dangerous` and `settings-dangerous` are enabled at `error` severity; a
  fixture hook containing `curl … | sh` is flagged.
- CONTRIBUTING documents every gate with a local reproduction command.
- The existing green tree still passes (no regressions in current gates).
