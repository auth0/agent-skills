# Architecture: the unified `auth0` skill

## Why one skill
- A skill's `description` is always in the agent's context. ~45 skills meant ~45
  competing descriptions and ambiguous activation. One skill = one description.
- Routing is **file-based and deterministic**: the router reads `package.json`,
  `composer.json`, `go.mod`, `*.csproj`, `pubspec.yaml`, etc. — code-driven, not
  a model guess.
- **Navigation is a depth-3 tree.** Claude Code loads the router, then the files
  it names. Every reference is a directory `<stem>/` with an `index.md`. An
  **index-only** reference puts its whole content in `index.md` (one hop from the
  router, no leaves). A large reference is a **leaf group**: `index.md` is a hub
  (shared prerequisites + an intent→leaf dispatch table) over document-section
  leaves. For a leaf group the router reads `index.md`, whose imperative `Read:`
  dispatch sends the agent to exactly one leaf — two hops. A hub may dispatch
  **only** to leaves in its own directory; leaves and index-only `index.md` files
  link to nothing (they are sinks); cross-group links are forbidden. All
  framework/tooling detection still lives in `SKILL.md`. Leaf groups exist so a
  large reference doesn't force the agent to load the whole file when it needs
  one section's worth. Split references into leaf groups when `index.md` exceeds
  ~1000 lines.

## Structure
`plugins/auth0/skills/auth0/`
- `SKILL.md` — the router (intent → framework → tooling → load).
- `references/feature-*/` — a capability spanning frameworks (mfa,
  organizations, custom-domains, acul, branding, migration, dpop).
- `references/framework-*/` — one SDK/framework integration.
- `references/tooling-*/` — cli / mcp / terraform.
- `references/pattern-*/` — cross-cutting guidance (security, token-handling,
  multi-tenant, rate-limiting, common-errors).
- `assets/` — templates (e.g. ACUL screen templates).
- `scripts/validate-skill.sh` — local structure + routing gate.

Every `framework-*`, `feature-*`, `tooling-*`, and `pattern-*` reference is a
directory of the same stem (e.g. `framework-swift/`, `feature-branding/`)
containing an `index.md`. An **index-only** reference has just `index.md`; a
**leaf group** — when the content is large enough to split — adds document-
section leaves (`integrate.md`, `api-reference.md`, `patterns.md`, `setup.md`,
`migration.md`, …) alongside a hub `index.md`. The router routes to the stem
either way; it always lands on `index.md`, which either *is* the content or
dispatches to the leaf the task needs.

## Routing flow
1. **Intent** — what the developer wants (integrate, feature:*, guidance, debug,
   migrate).
2. **Framework — three-tier cascade** (first tier that yields a framework wins):
   Tier 1 installed Auth0 SDK → Tier 2 non-Auth0 workspace deps → Tier 3 prompt
   keywords. Web-vs-API variants resolve intent-first, then ask.
3. **Tooling** — terraform / mcp / cli (project context).
4. **Load** 2–3 reference files and follow them.

## Reachability invariant (CI-enforced)
`scripts/check_router_reachability.py` asserts the depth-3 tree holds: every
reference directory is routable from `SKILL.md` (via template expansion over the
known framework and tooling value sets) and has an `index.md`; every leaf-group
leaf is reachable from that hub's dispatch; no route points at a missing file;
and the only second-hop links allowed are a hub `index.md` dispatching to leaves
**in its own group** — index-only `index.md` files and leaves may contain no
intra-references `.md` link (existing target or dead), and cross-group links are
forbidden. This runs in the `skillsaw` GitHub Actions workflow and inside
`validate-skill.sh`.

## Sourcing discipline (what stays inline vs. delegates)

A reference earns its length by holding what the agent can't get elsewhere.
Before writing (or keeping) any block, run the **differentiation test**: does
auth0.com/docs or the Management API reference already serve this well, and is it
read-to-look-up material? If yes, it's an offload candidate. One-sentence rule:
**inline what the agent must *execute or decide*; delegate what it would only
*read to understand or look up*.**

Five categories, each with a fixed disposition:

| Category | What it is | Disposition |
|---|---|---|
| **WIRING** | Exact CLI, SDK code, agent step-blocks, config keys, request bodies the agent sends | **Inline, always** |
| **DECISION** | Error-triage, capability tables, common-mistakes, diagnostic ladders | **Inline, always** (the skill's unique value) |
| **REFERENCE** | SDK-symbol tables, API object/body/config-key/scope tables | **Delegate**: keep the 3–8 symbols the common path needs; point to the rest |
| **CONCEPTUAL** | Overview, Key Concepts, security narrative, "advanced" prose | **Trim** to a 1–2 line orientation + canonical link |
| **LINKS** | Scattered "External Docs" lists | **Consolidate** into one pointer block |

Two rules protect correctness while offloading:
- **Extract before offload.** Offloadable tables sometimes carry agent-only rules
  that exist nowhere else (e.g. branding's "`mfa-begin-enroll-options` only accepts
  `title`"). Copy the rule into the kept wiring *before* deleting its table.
- **Load-bearing runtime fetches stay inline.** If the skill *fetches* a doc URL
  at runtime (branding Capability 3 reads auth0.com/docs for default copy; swift
  migration fetches SDK source from `raw.githubusercontent.com`), that is WIRING,
  not a link — keep it.

**Pointer convention.** Delegated material uses one standard block — never a
literal `node_modules` path, phrased so the agent resolves it wherever the
package lives, with GitHub as the durable fallback and auth0.com/docs as the
concept source:

```
> **Full reference:** <topic> — full options/symbols live in the installed
> package's docs (its `README` / `EXAMPLES.md` / generated API docs). Source of
> truth if not installed: github.com/auth0/<repo> (<path>).
> Auth0 concepts: https://auth0.com/docs/<page>
```

Any SDK-symbol content that stays inline carries a `verified against
<package>@<version>` marker so staleness is visible rather than silent.

`framework-swift/` (splitting + the framework template) and `feature-branding/`
(offload) are the reference implementations of this discipline.

To add or extend a capability, see
[CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-capability-to-the-unified-skill).
