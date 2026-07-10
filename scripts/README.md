# `scripts/`

Repository-level tooling that validates the `auth0` skill. Nothing here ships
inside the skill — these are CI/pre-merge gates that keep `SKILL.md` and its
`references/` pool honest. They fall into two independent groups:

- **Router-integrity checks** — prove the router in `SKILL.md` is structurally
  sound and routes every request to the right reference file. Deterministic and
  offline (no model in the loop), so they run in CI on every change.
- **Security scan** — runs Snyk's agent-skill scanner over each skill and fails
  the build on High/Critical findings.

Each checker is paired with a `test_*.py` unit-test file that exercises the
checker's own parsing/logic against small synthetic fixtures (so a bug in the
*checker* is caught, not just a bug in the skill).

---

## Router-integrity checks

The router in `SKILL.md` runs in four steps: **1 · detect intent** → **2 · detect
framework** → **3 · detect tooling** → **4 · load reference files**. These
checkers form a layered pipeline over that flow. Each proves a different
property, and the later ones depend on the earlier ones holding:

| Layer | Checker | Question it answers |
|---|---|---|
| Structure | `check_router_reachability.py` | Is every reference file reachable from `SKILL.md` in exactly one hop, with no broken or sideways links? |
| Detect framework (Step 2) | `check_framework_detection.py` | Do a project's signals walk the framework-detection cascade to the *right* framework? |
| Detect tooling (Step 3) | `check_tooling_detection.py` | Do a project's signals walk the tooling cascade to the *right* tooling reference (Terraform vs. CLI default)? |
| Load references (Step 4) | `check_routing_evals.py` | Given a resolved intent + framework + tooling, does the router load exactly the right reference files? |

**What is *not* mechanically checked** (stated so a green run isn't misread as
total coverage):

- **Step 1 · intent selection** — mapping a free-text developer request to an
  intent key (`integrate`, `feature:mfa`, …) is a natural-language judgment, so
  no deterministic checker simulates it; that belongs to live activation evals.
  What *is* enforced is the intent *table*: `check_routing_evals.py` extracts the
  Step 1 intent keys and requires them to be symmetric with the Step 4 sections
  (no dead routes, no unreachable sections).
- **The Step 2 Tier 3 rows and the Step 3 MCP row** — framework-named-in-prose
  (Tier 3) and "Auth0 MCP server active in this session" are prose/runtime
  signals with no file token to model. Each excluded case is documented in the
  relevant checker's module docstring and cases file.

Run all of them locally the way CI does (from the repo root):

```bash
python3 scripts/check_router_reachability.py  plugins/auth0/skills/auth0
python3 scripts/check_framework_detection.py  plugins/auth0/skills/auth0
python3 scripts/check_tooling_detection.py    plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py        plugins/auth0/skills/auth0
```

Each prints `PASS: …` and exits `0`, or prints the specific failures and exits
`1`. They are invoked in CI by [`.github/workflows/skillsaw.yml`](../.github/workflows/skillsaw.yml)
(each checker preceded by its `pytest` unit tests) and again by the skill's own
[`validate-skill.sh`](../plugins/auth0/skills/auth0/scripts/validate-skill.sh)
structural gate.

### `check_router_reachability.py`

Enforces the router's **one-hop invariants**. Claude Code follows only a single
hop from the router, so the reference pool must be flat: `SKILL.md` points at
every reference, and no reference points at another. It fails if:

1. a `references/*.md` file exists but nothing in `SKILL.md` routes to it (an
   **orphan** — unreachable, so it can never load);
2. `SKILL.md` routes to a reference file that doesn't exist (a **broken route**);
3. a reference file takes a **second hop** to another reference — via a markdown/
   HTML link, a bare `references/x.md` path, a backticked `x.md`, or a
   `Read: references/x.md` verb. All of these are defects, including stale links
   left behind by earlier consolidation.

Paired tests: `test_check_router_reachability.py`.

### `check_framework_detection.py`

Proves **Step 2** of the router — the framework-detection cascade — resolves a
set of project signals to the correct framework. This is where the subtle
regressions hide: the cascade is "stop at the first match", so row *order*
carries meaning (the Ionic/Capacitor rows must be checked before the plain
framework rows, `@auth0/nextjs-auth0` before `@auth0/auth0-react`, expo before
react-native, and so on). Reorder two rows and the router silently mis-routes —
nothing else in CI would catch it.

The checker does **not** hardcode a mirror of the tables. It parses the Tier 1
and Tier 2 detection tables straight out of `SKILL.md` (in document order, which
*is* the precedence order), models each row as an ordered AND of clauses —
OR-groups, single required tokens, and negated `(no `x`)` tokens — then walks
"first rule whose signals are all satisfied wins" and applies the web-vs-API
variant table. See the module docstring for the exact clause grammar.

It runs two checks:

- **coverage** — every framework the cascade can actually emit is exercised by
  at least one case in `tests/detection-cases.json`. This is what stops a newly
  added framework row from shipping with zero test coverage; the reachable set
  is computed from the tables themselves, so it excludes prose-only rows that
  carry no mechanical signal (Tier 3, and the `*.csproj` MAUI/WinForms/WPF/ASP.NET
  flavor splits — deliberately out of scope, documented in the docstring).
- **per-case** — each case's signals resolve to its `expect_framework`, and that
  framework has a `references/framework-<slug>.md` file to load.

Data: `tests/detection-cases.json`. Paired tests:
`test_check_framework_detection.py`.

### `check_tooling_detection.py`

Proves **Step 3** of the router — the tooling cascade — resolves a project's
signals to the correct `tooling-<x>.md`. Like Step 2 it is "stop at the first
match", so row order matters: the specific `terraform/` / `*.tf` row must be
checked before the `Anything else (default)` catch-all, which resolves to the
Auth0 CLI. It parses the Step 3 table out of `SKILL.md` (no hardcoded mirror),
models each row's backticked signals (with OR-groups), recognizes the default
row, and walks the cascade.

Same two-check shape as the Step 2 checker:

- **coverage** — every tooling the cascade can emit is exercised by a case in
  `tests/tooling-cases.json`.
- **per-case** — each case's signals resolve to its `expect_tooling`, and that
  tooling has a `references/tooling-<slug>.md` file.

The `tooling-mcp.md` row keys off "Auth0 MCP server active in this agent
session" — a session-*runtime* signal, not a file on disk — so it carries no
mechanical signal and is deliberately out of scope (documented in the docstring
and `tooling-cases.json`), the same way Step 2's prose rows are excluded.

Data: `tests/tooling-cases.json`. Paired tests:
`test_check_tooling_detection.py`.

### `check_routing_evals.py`

Proves **Step 4** of the router — the reference-load table — is sound *given* an
already-resolved intent, framework, and tooling. Where the detection checker validates
"which framework?", this validates "for this intent + framework + tooling, which
reference files load?". It runs three checks:

- **intent symmetry** — every Step 1 intent has a matching `### <intent>` section
  in Step 4 (no dead routes), and every Step 4 section is reachable from a Step 1
  row (no unreachable sections left behind by a rename).
- **case coverage** — every Step 4 section is exercised by at least one routing
  case (the same "no silent gaps" guard as the detection checker's coverage).
- **per-case routes** — for each case, the intent resolves to a section, every
  expected reference file exists, and `expect_refs` matches the route the section
  actually computes. It expands `{framework}`/`{tooling}` placeholders and models
  the `If …` conditionals against the case's fields, so a combo case like "MFA in
  a Next.js app" can't silently omit `framework-nextjs.md`, and `expect_refs`
  can't list a file the section would never route to.

Data: `tests/routing-cases.json`. Paired tests: `test_check_routing_evals.py`.

> These offline checks lock down the routing *table* that live activation evals
> depend on; they do not replace those live evals.

---

## Security scan

Run by [`.github/workflows/snyk_agent_scan.yml`](../.github/workflows/snyk_agent_scan.yml)
on PRs and pushes to `main`. Two pieces:

### `scan_all_skills.sh`

Discovers every `plugins/*/skills/*/SKILL.md`, runs `snyk-agent-scan` over each
(with one retry on failure), and writes a `snyk-agent-scan-skill-<name>.json`
report per skill. The scanner version is pinned via `SNYK_AGENT_SCAN_VERSION`
(default in the script). The CI workflow inlines an equivalent scan loop; this
script is the local/standalone equivalent.

### `check_snyk_findings.py`

Reads the `snyk-agent-scan-*.json` reports and **fails the build** (exit `1`) on
any blocking finding — error codes plus a few specific warnings (`W007`, `W008`,
`W012`). Findings can be waived via `.snyk-agent-scan-ignore.json` at the repo
root, which matches on finding code plus a URL (or URL pattern) and, optionally,
a specific skill; each ignore entry carries a human-readable `reason` that the
script prints so waivers stay auditable.

---

## Conventions

- **Run from the repo root.** The checkers take the skill directory as an
  argument (`plugins/auth0/skills/auth0`) and default to it when omitted.
- **Every checker has unit tests.** When you change a checker's parsing or
  logic, update its `test_*.py` alongside it — CI runs the tests before the
  checker so a broken checker fails fast on a clear message.
- **No silent caps.** When a checker deliberately excludes something from its
  mechanical scope (e.g. prose-only detection rows), that exclusion is documented
  in the checker's module docstring and/or the cases file, so a green run is
  never misread as "everything is covered".
