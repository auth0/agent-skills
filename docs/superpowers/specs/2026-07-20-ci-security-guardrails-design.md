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

**Fork-PR token caveat:** `SNYK_TOKEN` is a repo secret; GitHub withholds secrets
from `pull_request` runs triggered by forks. For untrusted external PRs the
agent-scan job will lack a token. Resolution (decide in plan): either (a)
maintainer-triggered re-run via a label + `workflow_dispatch`, or (b) a
carefully scoped `pull_request_target` that checks out the PR head **without**
granting it write scope or running its code. `gitleaks` (§3) needs no token and
always runs, so secret leakage is caught on every PR regardless.

### 3. Secret scanning on the diff — `gitleaks`

New CI gate + `make` target running `gitleaks` over the repo/diff. Blocks
committed Auth0 client secrets, tokens, API keys. Ships a `.gitleaks.toml`
allowlist for the **intentional** angle-bracket placeholders (`<client-secret>`,
`<your-tenant>`, etc.) introduced by #145/#149/#150, so the hardening already
done is not re-flagged. No token required → runs on fork PRs. Covers AST04 /
Secret Detection.

### 4. `scripts/` safety — enable skillsaw supply-chain rules

Enable skillsaw's built-in `hooks-dangerous` and `settings-dangerous` rules
(config-only in `.skillsaw.yaml`). Catches `curl | bash`, download-and-execute,
base64 obfuscation, and dangerous env vars in any `scripts/` or settings the
agent might execute. Covers AST02 / AST03 / Malicious Code. Pin the skillsaw
version (already done: `0.16.0`) so rule sets are deterministic.

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
- **pre-commit hooks** — CI is the main gate; `make check` covers local use.
- **Skill sandboxing / permissions manifest** — research confirms even ClawHub
  has no enforced sandbox; we will not invent one.

## Success criteria

- `make check` runs the full lint + scan suite locally and exits non-zero on any
  failure; CI invokes the same targets.
- agent-scan findings are produced for `references/*.md`, not just `SKILL.md`.
- A committed test secret is blocked by `gitleaks`; the existing angle-bracket
  placeholders are **not** flagged.
- A `scripts/` file containing `curl … | bash` is flagged by skillsaw.
- CONTRIBUTING documents every gate with a local reproduction command.
- The existing green tree still passes (no regressions in current gates).
