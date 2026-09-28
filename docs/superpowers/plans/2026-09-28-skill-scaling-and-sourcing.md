# Skill Scaling + Sourcing Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the two largest oversized references (`framework-swift`, `feature-branding`) into leaf groups following a canonical framework template and a differentiation-test sourcing discipline, then codify both as authoring rules.

**Architecture:** Each large `index.md` becomes a lean hub that dispatches (via `Read: references/<group>/<leaf>.md` rows, mirroring the existing `framework-node-auth0` split) to document-section leaves. Content that auth0.com/docs or the SDK repo already serves well is replaced with a resilient pointer block; orchestration, decision logic, and exact wiring stay inline. Validation is the existing CI gate — the reachability checker is the red/green signal (name a leaf that does not exist → broken-route failure; add a leaf the hub never names → orphan failure).

**Tech Stack:** Markdown reference files; Python validators (`check_router_reachability.py`, `check_routing_evals.py`); `validate-skill.sh`; `uvx skillsaw --strict`. No application code.

## Global Constraints

- **Depth-3 tree (CI-enforced).** Every reference is `references/<name>/index.md`. A hub `index.md` may name **only** leaves in its own directory, as the literal substring `references/<name>/<leaf>.md`. Leaves and index-only files are **sinks**: they may contain **no** `.md` link (existing or dead) and no cross-group `references/*/*.md` reference. No stray `references/*.md` flat files.
- **Reachability leaf rule.** A leaf is reachable iff the hub `index.md` contains `references/<group>/<leaf>.md` for it. A named path with no file = broken route; a leaf file the hub never names = orphan. Both fail `check_router_reachability.py`.
- **Routing cases stay single-hop.** Keep hub dispatch-table first cells as multi-word phrases (never a bare single token like `integrate`), so `_HUB_ROW_RE` in `check_routing_evals.py` does not match and existing single-hop cases (`expect_refs` = `<group>/index.md`) keep passing. This matches `feature-mfa`, `feature-organizations`, and `framework-node-auth0`.
- **Pointer block format** (§4 of spec), verbatim shape:
  ```
  > **Full reference:** <topic> — full options/symbols live in the installed
  > package's docs (its `README` / `EXAMPLES.md` / generated API docs). Source of
  > truth if not installed: github.com/auth0/<repo> (<path>).
  > Auth0 concepts: https://auth0.com/docs/<page>
  ```
- **Verified-as-of marker.** Any SDK-symbol content kept inline carries `verified against <package>@<version>`.
- **Extract-before-offload.** Never delete a table that carries an agent-only rule until that rule is copied into kept wiring (§3.3 of spec).
- **Load-bearing runtime fetches stay inline** (§3.4): swift migration's `raw.githubusercontent.com` source fetch; branding Capability 3's runtime auth0.com/docs text-elements fetch.
- **Gate (run from repo root, must all pass before commit):**
  ```bash
  bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
  python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
  python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
  uvx skillsaw --strict
  ```

---

### Task 1: Split `framework-swift` into the canonical framework template

**Files:**
- Modify → becomes hub: `plugins/auth0/skills/auth0/references/framework-swift/index.md` (currently 2568 lines)
- Create: `plugins/auth0/skills/auth0/references/framework-swift/setup.md`
- Create: `plugins/auth0/skills/auth0/references/framework-swift/patterns.md`
- Create: `plugins/auth0/skills/auth0/references/framework-swift/api-reference.md`
- Create: `plugins/auth0/skills/auth0/references/framework-swift/migration.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: the leaf layout `framework-swift/{index,setup,patterns,api-reference,migration}.md` and the hub dispatch-table shape that Task 3 documents as the canonical template.

**Carve map** (source line ranges in the current `index.md`; move content verbatim unless the step says trim):

| New file | Source lines (current index.md) | Action |
|---|---|---|
| `patterns.md` | 485–933 (sub-doc "Integration Patterns") | Move verbatim |
| `setup.md` | 934–1255 (sub-doc "Setup Guide") | Move verbatim |
| `migration.md` | 1256–2568 (sub-doc "v3 Migration") | Move verbatim; keep the `raw.githubusercontent.com` fetch |
| `api-reference.md` | 298–484 (sub-doc "API Reference & Testing") | Move, then trim (Step 4) |
| `index.md` (hub) | 2–297 (sub-doc "Integration"), trimmed | Keep + add dispatch table (Step 5) |

- [ ] **Step 1: Snapshot current gate is green**

Run: `python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0 && python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0`
Expected: PASS (baseline before edits).

- [ ] **Step 2: Create `patterns.md`, `setup.md`, `migration.md` by moving verbatim ranges**

Move lines 485–933 → `patterns.md`, 934–1255 → `setup.md`, 1256–2568 → `migration.md`, each as a standalone document (keep the leading `#` H1 of the moved sub-doc as the file's title). Delete those ranges from `index.md`.

Then make each leaf a **sink**: search each new leaf for `references/framework-swift/` and for any `.md` link, e.g.
Run: `grep -nE 'references/[a-z0-9-]+/[a-z0-9-]+\.md|\]\([^)]*\.md' plugins/auth0/skills/auth0/references/framework-swift/{setup,patterns,migration}.md`
For every hit (e.g. the "Detailed References" list at old lines 2533–2537 landing in `migration.md`), rewrite it as prose ("see the setup guide") — a leaf must contain no `.md` reference.

- [ ] **Step 3: Verify reachability FAILS with orphan leaves (red)**

Run: `python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0`
Expected: FAIL — reports `framework-swift/setup.md`, `framework-swift/patterns.md`, `framework-swift/migration.md` (and after Step 4, `api-reference.md`) as orphan/unreachable, because the hub does not yet name them. This confirms the checker is the red/green signal.

- [ ] **Step 4: Create `api-reference.md` (move 298–484) and trim REFERENCE tables to a pointer**

Move lines 298–484 → `api-reference.md`. Keep inline: `Auth0.plist Keys` (old 302–308), the most-used `WebAuth`/`CredentialsManager` builder options, and the core `Standard OIDC Claims` table. Replace the exhaustive option/claims tables and trim the `Security Considerations` prose (old 462–474) with this pointer block:

```
> **Full reference:** Auth0.swift configuration options, builder methods, and the
> complete claims set live in the installed package's docs (`README` / `EXAMPLES.md`
> / DocC). Source of truth if not installed: github.com/auth0/Auth0.swift
> (EXAMPLES.md, and the DocC site at auth0.github.io/Auth0.swift). Auth0 concepts:
> https://auth0.com/docs/libraries/auth0-swift
```

Add a `verified against Auth0.swift@<major.minor>` marker above the kept plist/option tables (use the version already cited in the file). Make `api-reference.md` a sink (same `.md`-link grep as Step 2).

- [ ] **Step 5: Rewrite `index.md` as the hub**

The hub keeps old lines 2–297 trimmed to: Critical rules, When NOT to Use, Prerequisites, Quick Start Workflow (Steps 1–5), Common Mistakes. Replace the old "Detailed Documentation" list (old 261–266) with this dispatch table (mirrors `framework-node-auth0/index.md:46-48`):

```markdown
## Which file to read

| Task | Read |
|---|---|
| Integrate Auth0 into a Swift app end to end | `Read: references/framework-swift/setup.md` then `Read: references/framework-swift/patterns.md` |
| Tenant and SDK setup detail (Auth0 CLI, Auth0.plist, SPM/CocoaPods/Carthage) | `Read: references/framework-swift/setup.md` |
| Integration patterns (login/logout, CredentialsManager, biometrics, error handling, organizations) | `Read: references/framework-swift/patterns.md` |
| SDK configuration, builder options, and claims reference | `Read: references/framework-swift/api-reference.md` |
| Upgrade Auth0.swift across a major version (v3 migration) | `Read: references/framework-swift/migration.md` |
```

Append the §4 pointer block (repo `auth0/Auth0.swift`) under a `## References` section, keeping the existing external links. Confirm the hub contains no `.md` link other than the five `references/framework-swift/*.md` dispatch targets.

- [ ] **Step 6: Verify the full gate PASSES (green)**

Run:
```bash
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
uvx skillsaw --strict
```
Expected: all PASS. Reachability now resolves all four leaves via the hub table; the existing `integrate-swift` routing case still expects only `framework-swift/index.md` (single-hop) and passes because the dispatch first cells are multi-word.

- [ ] **Step 7: Sanity-check no content was lost**

Run: `wc -l plugins/auth0/skills/auth0/references/framework-swift/*.md`
Expected: the five files sum to roughly the original 2568 minus the trimmed api-reference tables (~2400–2450); `index.md` is ~150–200 lines.

- [ ] **Step 8: Commit**

```bash
git add plugins/auth0/skills/auth0/references/framework-swift/
git commit -m "refactor(swift): split framework-swift into canonical template leaf group"
```

---

### Task 2: Offload `feature-branding` into a leaf group

**Files:**
- Modify → becomes hub: `plugins/auth0/skills/auth0/references/feature-branding/index.md` (currently 1714 lines)
- Create: `plugins/auth0/skills/auth0/references/feature-branding/api.md`
- Create: `plugins/auth0/skills/auth0/references/feature-branding/screens.md`

**Interfaces:**
- Consumes: the pointer-block format and sink rules established in Task 1.
- Produces: `feature-branding/{index,api,screens}.md`; the offload pattern Task 3 documents.

**Keep inline in the hub** (differentiated, per spec §8): all five Capability blocks (old 1073–1714), overview routing (`Capabilities` 6–21, `Prompt style` 22–39, `Plan mode` 40–66, `Verify in browser` 67–81), `Prerequisites` gates (94–120), `Common Mistakes` (151–162), `URL Validation` (401–424), `Extended gotchas` (425–439), deployment/tenant-copy scripts (948–1071).

- [ ] **Step 1: Snapshot current gate is green**

Run: `python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0`
Expected: PASS (baseline).

- [ ] **Step 2: Extract agent-only rules before moving/offloading tables**

These rules live inside offload-candidate tables and exist nowhere else — copy each into the capability wiring that uses it (search to confirm placement), then they are safe to move/trim:
- "MFA screens use the `description` key" (old ~709) → into `screens.md` MFA row note and Capability 3 rewrite wiring.
- "identifier-first = separate prompts, not screens" (old ~646, ~660) → into `screens.md` intro and Capability 3.
- "theme: all top-level sections required" (old ~211, ~432) → into Capability 1/2 apply wiring.

Run: `grep -n 'description\|identifier-first\|top-level sections' plugins/auth0/skills/auth0/references/feature-branding/index.md`
Expected: confirm each rule now also appears in a kept location before Step 3 deletes its origin table.

- [ ] **Step 3: Create `screens.md` by moving the Universal Login screen catalog**

Move old lines 630–780 ("Universal Login screens, by category") → `screens.md`. It gets its own leaf because the "Learn new screens" flow (old 1689–1714) appends to it at runtime. Make it a sink (no `.md` links).

- [ ] **Step 4: Create `api.md` — moved-then-trimmed reference**

Move old lines 186–439 (API Reference) + 441–628 (Page Templates & Text Customization) + 782–947 (cURL examples) → `api.md`. Then replace the schema tables with pointer blocks (extracted rules already relocated in Step 2):
- Endpoints/scope/settings/theme-property/error tables → pointer:
  ```
  > **Full reference:** Branding, theme, and template Management API schemas live at
  > https://auth0.com/docs/api/management/v2/branding and the theme/template pages
  > under https://auth0.com/docs/customize/login-pages/universal-login. Keep only the
  > endpoints the capabilities call inline.
  ```
- CLI catalog → pointer to `https://auth0.com/docs` CLI reference; keep only commands invoked by capabilities.
- Page Templates / Text Customization prose → pointer to the customize-templates / customize-text-elements pages (already linked at old 178–179).
Keep the cURL request bodies the deployment scripts reference; pointer-replace pure endpoint-echo examples. Make `api.md` a sink.

- [ ] **Step 5: Trim the hub and add the dispatch table**

In `index.md`: trim `Key Concepts` (old 82–93) to a one-line orientation + link to `https://auth0.com/docs/customize/login-pages/universal-login`. Delete the ranges moved in Steps 3–4. Add the dispatch table:

```markdown
## Which file to read

| Need | Read |
|---|---|
| Branding Management API, CLI, theme-property, or cURL reference | `Read: references/feature-branding/api.md` |
| The Universal Login screen and prompt catalog (and to append newly learned screens) | `Read: references/feature-branding/screens.md` |
```

Confirm the hub's `References` section keeps its external auth0.com/docs URLs and contains no `.md` link other than the two `references/feature-branding/*.md` dispatch targets.

- [ ] **Step 6: Verify the gate — reachability PASSES, both leaves resolved (green)**

Run:
```bash
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
uvx skillsaw --strict
```
Expected: all PASS. The `feature-branding` routing case stays single-hop (`expect_refs` includes `feature-branding/index.md`) and passes. If reachability reports an orphan, a leaf is not named in the hub table (fix Step 5); if a broken route, a named path has no file.

- [ ] **Step 7: Confirm offload volume**

Run: `wc -l plugins/auth0/skills/auth0/references/feature-branding/*.md`
Expected: `index.md` ~700–800, `api.md` ~200–300, `screens.md` ~150; total ~1050–1250 (down from 1714 — ~500–650 lines offloaded to pointers).

- [ ] **Step 8: Commit**

```bash
git add plugins/auth0/skills/auth0/references/feature-branding/
git commit -m "refactor(branding): offload reference/concept material and split into leaf group"
```

---

### Task 3: Codify the conventions as authoring rules

**Files:**
- Modify: `docs/architecture.md`
- Modify: `CONTRIBUTING.md` (the "Adding a reference" / "Adding a Capability" sections)
- Modify: `plugins/auth0/README.md` (note the new leaf layouts)
- Modify: `.claude/skills/author-auth0-skill/SKILL.md` (contributor workflow)

**Interfaces:**
- Consumes: the `framework-swift` and `feature-branding` leaf groups from Tasks 1–2 as the canonical worked examples the docs point to.
- Produces: no code; documentation the linter must still accept.

- [ ] **Step 1: Add the sourcing discipline + pointer convention to `docs/architecture.md`**

Add a section "Sourcing discipline" containing the differentiation test, the five-category rubric table, the one-sentence rule, and the §4 pointer-block format — copied from the spec (§3–§4). Cite `framework-swift` (splitting/template) and `feature-branding` (offload) as the reference implementations.

- [ ] **Step 2: Add the framework-reference template + splitting rules to `CONTRIBUTING.md`**

In "Adding a reference", document the canonical framework leaf skeleton (`index` hub / `setup` / `patterns` / `api-reference` / `migration` with fill-in slots), the "trim before split" rule, and the reachability leaf format `Read: references/<group>/<leaf>.md`. State that routing cases stay single-hop unless an intent maps 1:1 to a leaf. Link to the spec.

- [ ] **Step 3: Update `plugins/auth0/README.md` and the `author-auth0-skill` skill**

Note that `framework-swift` and `feature-branding` are leaf groups exemplifying the template and offload patterns. In `author-auth0-skill/SKILL.md`, add the sourcing-discipline decision to its classification steps (keep inline vs. offload).

- [ ] **Step 4: Verify the docs gate passes**

Run: `uvx skillsaw --strict && python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0`
Expected: PASS (docs edits must not break the skill; README coverage rule satisfied).

- [ ] **Step 5: Commit**

```bash
git add docs/architecture.md CONTRIBUTING.md plugins/auth0/README.md .claude/skills/author-auth0-skill/SKILL.md
git commit -m "docs: codify sourcing discipline and framework-reference template"
```

---

## Notes for the executor

- **Do not edit `SKILL.md` routing tables.** Migration/leaf reachability derives from the hub dispatch tables, exactly as `framework-node-auth0` works today; the reachability checker harvests framework slugs from `SKILL.md` tables that already list `swift` and `branding`.
- **Run the behavioral evals before merging** Tasks 1–2 (`evals/behavioral/`, via the `claude` CLI + execa harness) to confirm a live agent still integrates Swift and brands a tenant from the split references. These are heavy/dev-only and are not part of the per-task gate.
- **Order flexibility:** Tasks 1 and 2 are independent and can be done in either order or in parallel worktrees; Task 3 must come last (it points at both).

## Self-Review

- **Spec coverage:** §3 sourcing discipline → Task 3 Step 1 + applied in Tasks 1–2; §4 pointer convention → Global Constraints + Task 1 Step 4 / Task 2 Step 4; §5 framework template → Task 1 (built) + Task 3 Step 2 (documented); §6 splitting → Tasks 1–2 + Task 3 Step 2; §7 swift → Task 1; §8 branding → Task 2; §9 enabling track → out of scope for this repo (spec marks it parallel/non-blocking; noted, no task); §11 risks → mitigations baked into Global Constraints (verified-as-of, extract-before-offload, load-bearing fetches stay); §12 validation → the gate in Global Constraints + behavioral-eval note.
- **Placeholder scan:** authored artifacts (dispatch tables, pointer blocks) are written in full; moved content is specified by exact source line ranges + destination, not "TBD".
- **Type/name consistency:** leaf filenames are identical across the carve map, dispatch tables, gate greps, and commits (`setup.md`, `patterns.md`, `api-reference.md`, `migration.md`, `api.md`, `screens.md`).
