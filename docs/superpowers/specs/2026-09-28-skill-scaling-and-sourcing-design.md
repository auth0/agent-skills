# Design: scaling the `auth0` skill — a sourcing discipline + framework template

- **Date:** 2026-09-28
- **Status:** Proposed (design approved in chat; awaiting spec review)
- **Scope:** repo-wide guidance + two worked examples (`framework-swift`, `feature-branding`)

## 1. Problem

The unified `auth0` skill has two coupled scale problems, measured from the
current tree (73 reference directories, 92 files, ~52K lines):

1. **Oversized references load whole.** Six single `index.md` files exceed 1,700
   lines (swift 2,568; custom-domains 2,056; android 1,809; acul 1,786; branding
   1,714; nuxt 1,708), yet only **two** references (`feature-mfa`,
   `feature-organizations`) are split into leaf groups. Every other large file is
   loaded in full even when a task needs one slice.

2. **Duplication invites drift.** Some content restates auth0.com/docs and the
   Management API reference. When those drift, the skill silently goes stale. The
   duplication is *not* uniform, though — it concentrates in concept prose and
   schema tables and varies a lot by reference (branding ≈ 40% offloadable;
   custom-domains ≈ 18%).

There is also a **latent contradiction** with the "ship SDK `docs/` to package
managers, let agents read them" idea: the skill today deliberately bakes in
verified SDK symbols and repeatedly instructs the agent **NOT** to grep
`node_modules` / read `.d.ts` to re-verify. Any move toward external docs must
therefore be a *soft* dependency, never a hard `node_modules` path.

## 2. Goals / non-goals

**Goals**
- A repeatable rule for what content stays inline vs. delegates to docs.
- A resilient pointer convention (package root → GitHub → auth0.com/docs) with no
  hard `node_modules` dependency; the high-frequency path stays offline-capable.
- A canonical **framework-reference template** so ~53 framework files share one
  shape and adding a framework is "fill the template."
- A splitting strategy so large references load only the needed slice.
- Two worked examples proving both theses: swift (split + template), branding
  (offload).

**Non-goals**
- Rewriting the router pipeline in `SKILL.md` (Steps 1–4 stay; routing tables are
  untouched — the reachability checker derives slugs from them).
- Shipping the SDK `docs/` folders themselves (that is a parallel enabling track,
  §9, and the skill must not block on it).
- Touching the eval *harness*; we add cases, not machinery.

## 3. The sourcing discipline

### 3.1 Differentiation test (runs first)

Before categorizing any block, ask: **does auth0.com/docs or the Management API
reference already serve this well, and is it read-to-look-up material?** If yes,
it is an offload candidate. The skill keeps only *differentiated agent value*:
orchestration across tools, decision logic, and exact multi-step wiring no doc
page provides.

One-sentence rule: **inline what the agent must *execute or decide*; delegate
what it would only *read to understand or look up*.**

### 3.2 Five-category rubric

| Category | What it is | Disposition |
|---|---|---|
| **WIRING** | Exact CLI, SDK code, agent step-blocks, config keys | **Inline, always** (drift-safe: if the SDK changes it, the skill must too) |
| **DECISION** | Error-triage, capability tables, common-mistakes, diagnostic ladders | **Inline, always** (the skill's unique value; not in any doc) |
| **REFERENCE** | SDK-symbol tables, API object/body/config-key/scope tables | **Delegate**: keep the 3–8 symbols the common path needs; point to the rest |
| **CONCEPTUAL** | Overview, Key Concepts, Security narrative, "Advanced" prose | **Trim** to a 1–2 line orientation + canonical link |
| **LINKS** | Scattered "External Docs" lists | **Consolidate** into one pointer block |

REFERENCE is the primary offload target for framework files; CONCEPTUAL for
feature files. Offloading directly reclaims ~15–40% depending on the file; the
larger scale win comes from splitting (§6).

### 3.3 Preserve embedded agent-only rules

Offloadable tables sometimes carry rules that exist nowhere else (e.g. branding's
"MFA screens use the `description` key", "identifier-first = separate prompts not
screens", theme "all top-level sections required"). **Extract these into the
adjacent wiring before deleting the table.** A block is only offloadable once its
agent-only rules have a home in kept content.

### 3.4 Load-bearing runtime fetches stay

If the skill *fetches* a doc URL at runtime (e.g. branding Capability 3 reads
auth0.com/docs for default English copy; swift migration fetches SDK source from
`raw.githubusercontent.com`), that is WIRING, not a link — it stays inline.

## 4. Pointer convention

One standard block. Never a literal `node_modules` path; phrased so the agent
resolves it wherever the package lives, with GitHub as the durable fallback and
auth0.com/docs as the concept source:

```
> **Full reference:** <topic> — full options/symbols live in the installed
> package's docs (its `README` / `EXAMPLES.md` / generated API docs). Source of
> truth if not installed: github.com/auth0/<repo> (<path>).
> Auth0 concepts: https://auth0.com/docs/<page>
```

**Drift-bounding discipline on kept symbols:** any SDK-symbol content that stays
inline carries a `verified against <package>@<version>` marker so staleness is
visible rather than silent. This standardizes the ad-hoc verification notes the
skill already contains.

## 5. Framework-reference template (the convention)

Swift's five concatenated sub-docs are the latent convention; formalize them into
a fixed leaf skeleton with explicit **slots** every framework file fills.

| Leaf | Contents | Slots |
|---|---|---|
| `index.md` (hub) | Critical rules · When NOT to use · Prerequisites · Quick Start (install via *{pkg mgr}* + callback config + minimal login/logout) · Common Mistakes · **dispatch table** · pointer block | `{language}`, `{framework}`, `{pkg mgr}` |
| `setup.md` | Full tenant + SDK install/config (CLI automated + manual, all package managers) | `{pkg mgr}`, `{SDK pkg}` |
| `patterns.md` | Route protection, session, token handling, error handling, org login | `{SDK pkg}` |
| `api-reference.md` | The few must-know symbols inline; delegate the rest via the §4 pointer | `{SDK repo}` |
| `migration.md` | **Only if** a major-version migration exists | `{SDK repo}` |

The hub's dispatch table maps router intents to leaves, e.g. `integrate` →
index + setup + patterns; `upgrade-sdk` → migration; feature intents → patterns /
api-reference as needed. Feature references (branding, custom-domains) are
**capability-shaped**, not language-shaped, and do **not** use this skeleton —
they split by sub-topic instead.

**Fill-in contract for a new framework:** copy the skeleton, fill the slots,
populate WIRING/DECISION inline, point REFERENCE at the SDK repo, add the hub
dispatch table, add a routing-eval case, register the slug in
`validate-skill.sh`. No `SKILL.md` routing-table edit is required.

## 6. Splitting / scaling strategy

- **Trim before you split.** Apply §3 first (removes 15–40%), then carve what
  remains, so duplication is deleted, not relocated into leaves.
- **Threshold.** Split when `index.md` > ~1,000 lines *or* when a clean
  REFERENCE / migration block can be peeled off (a leaf that loads only for its
  intent, e.g. migration only for `upgrade-sdk`).
- **Leaf shape.** Framework files use the §5 document-section leaves. Feature
  files split by sub-topic (`api`, `screens`, `advanced`, `examples`, or
  operation-named leaves).
- **Depth-3 tree holds.** Hub `index.md` dispatches only to leaves in its own
  directory; leaves and index-only files link to no `.md` (they are sinks);
  cross-group links stay forbidden. Where two leaves need the same shared block
  (e.g. a DNS playbook used by both setup and manage), the hub names both leaves
  in its dispatch — no cross-leaf link.
- **Router / eval impact per split** (small, mechanical):
  - `SKILL.md` routing tables: **no change**.
  - Add the hub's intra-reference dispatch table inside `index.md`.
  - Add a case to `evals/routing-cases.json` with two-hop `expect_refs`.
  - Move the slug from the index-only presence check to the grouped loop in
    `plugins/auth0/skills/auth0/scripts/validate-skill.sh`.

## 7. Worked plan A — `framework-swift` (2,568 → hub ~180)

Splitting + template demo. Offload is small here (~8% REFERENCE); the win is
load-size and isolating the 1,312-line migration so only `upgrade-sdk` pays for
it. Carve of the five existing sub-docs onto the §5 template:

| New leaf | Source (lines) | Action |
|---|---|---|
| `index.md` (hub, ~180) | sub-doc 1 (2–297) | Trim to Critical rules / When NOT / Prerequisites / Quick Start Steps 1–5 / Common Mistakes; convert the "Detailed Documentation" list (261–266) into a real dispatch table + §4 pointer block |
| `patterns.md` | sub-doc 3 (485–933) | Move verbatim (pure WIRING) |
| `setup.md` | sub-doc 4 (934–1255) | Move verbatim (WIRING) |
| `api-reference.md` | sub-doc 2 (298–484) | Trim ~40%: keep Auth0.plist keys + the most-used WebAuth/CredentialsManager options + core claims; delegate exhaustive option/claims tables to the DocC (`auth0.github.io/Auth0.swift`) + `EXAMPLES.md` pointer; trim "Security Considerations" (462–474) to a link |
| `migration.md` | sub-doc 5 (1256–2568) | Move verbatim; the runtime `raw.githubusercontent.com` source-fetch (1403/1410) stays inline (WIRING) |

Dispatch table: `integrate` → index + setup + patterns; `upgrade-sdk` →
migration; `feature:mfa`/`feature:organizations` already have their own swift
leaves elsewhere.

## 8. Worked plan B — `feature-branding` (1,714 → ~1,000 across 3 leaves)

Offload demo. REFERENCE + CONCEPTUAL ≈ 40% (~715 lines) is offloadable; the file
already links every canonical target (176–182). Capability-shaped split.

**Keep inline (differentiated, ≈55%):** all five Capability blocks (1073–1714),
overview routing/interaction (`Capabilities` 6–21, `Prompt style` 22–39,
`Plan mode` 40–66, `Verify in browser` 67–81), `Prerequisites` gates (94–120),
`Common Mistakes` (151–162), `URL Validation` (401–424), `Extended gotchas`
(425–439), deployment/tenant-copy scripts (948–1071).

**Offload (~715 lines):**

| Section | Lines | Action |
|---|---|---|
| Key Concepts | 82–93 | Trim to orientation + link (Customize UL) |
| Management API Endpoints | 190–229 | Pointer → Branding API Reference; keep only endpoints the capabilities call |
| CLI Commands | 230–296 | Pointer → Auth0 CLI docs; keep the few commands used inline in capabilities |
| Branding Settings / Theme Config Properties | 297–389 | Pointer → Themes API; **extract** the "all top-level sections required" rule (211/432) into wiring first |
| Error Handling (generic HTTP table) | 390–400 | Pointer → Mgmt API error docs |
| Page Templates (variable tables + Liquid) | 445–587 | Pointer → Customize Page Templates; keep the Liquid usage note the capabilities need |
| Text Customization (behavior prose) | 588–628 | Pointer → Customize Text Elements |
| cURL examples | 791–947 | Pointer → Branding API Reference (boilerplate bodies) |

**Load-bearing, stays inline:** Capability 3's runtime fetch of
auth0.com/docs text-elements (1618/1662) is WIRING, not a link.

**Resulting layout:**
- `index.md` (~700–800) — overview + routing + all 5 capabilities + guardrails.
- `api.md` (~200–300) — trimmed/condensed endpoint/scope/theme/error/cURL,
  mostly §4 pointers plus the extracted agent-only rules.
- `screens.md` (~150) — the Universal Login screen catalog (630–780); it gets its
  own leaf because the "Learn new screens" flow (1689–1714) appends to it at
  runtime. **Extract** the embedded rules (MFA `description` key 709;
  identifier-first "separate prompts not screens" 646/660) before trimming.

## 9. Enabling track (parallel, non-blocking)

Define what a good SDK-repo `docs/` folder holds — the delegated REFERENCE
material (symbol tables, exhaustive options, edge cases) — and ship it to package
managers where supported (npm ships arbitrary files; agents commonly read
installed package docs). The skill's §4 pointers target it, but never *depend* on
it: GitHub (`github.com/auth0/<repo>`) and auth0.com/docs are the guaranteed
fallbacks. Tracked separately so the refactor is not blocked on ~9 SDK repos.

## 10. Rollout

1. Land §3–§6 as authoring rules (extend `CONTRIBUTING.md` /
   `docs/architecture.md` / the `author-auth0-skill` contributor skill).
2. Implement worked example A (swift) as the reference framework template.
3. Implement worked example B (branding) as the reference offload.
4. Roll the template across the remaining oversized framework files (android,
   nuxt, then any > ~1,000 lines) and the offload discipline across
   concept-heavy feature files, one PR per reference, each passing the gate.

## 11. Risks & tradeoffs

- **Offline completeness drops for edge cases.** Accepted: hybrid model — the
  high-frequency path stays inline; delegated edge cases degrade to GitHub /
  docs, never to a broken `node_modules` read.
- **Pointer targets must exist.** Mitigation: point at auth0.com/docs / the SDK
  repo (always present) as the guaranteed layer; the package `docs/` folder is an
  optimization, not a requirement.
- **Kept inline symbols can still drift.** Mitigation: the
  `verified against <pkg>@<version>` marker (§4) makes staleness visible.
- **Custom-domains is a weak offload target** (~80% orchestration) — hence
  branding was chosen for the offload example; custom-domains remains a good
  future *splitting* candidate.

## 12. Validation

Each reference PR must pass the existing gate:

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```

- **Reachability** confirms the depth-3 tree holds after each split.
- **Routing evals** confirm the two-hop `expect_refs` for each new leaf group.
- **Activation evals** (`evals/activation/`) are unaffected — no `description`
  changes are planned; run them only if a `description` is touched.
- **Behavioral evals** (`evals/behavioral/`) should be run before merging the
  swift/branding restructures to confirm a live agent still integrates correctly
  from the split references.
