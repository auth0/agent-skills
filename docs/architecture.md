# Architecture: the unified `auth0` skill

## Why one skill
- A skill's `description` is always in the agent's context. ~45 skills meant ~45
  competing descriptions and ambiguous activation. One skill = one description.
- Routing is **file-based and deterministic**: the router reads `package.json`,
  `composer.json`, `go.mod`, `*.csproj`, `pubspec.yaml`, etc. — code-driven, not
  a model guess.
- **Navigation is a depth-2 tree.** Claude Code loads the router, then the files
  it names. A reference is either a flat self-contained `*.md` file (one hop from
  the router) or a **group**: a directory `<stem>/` with a hub `index.md` (shared
  prerequisites + an intent→leaf dispatch table) and document-section leaves. For
  a group the router reads `index.md`, whose imperative `Read:` dispatch sends the
  agent to exactly one leaf — two hops. A hub may dispatch **only** to leaves in
  its own directory; leaves and flat files link to nothing (they are sinks);
  cross-group links are forbidden. All framework/tooling detection still lives in
  `SKILL.md`. Groups exist so a large reference doesn't force the agent to load
  the whole file when it needs one section's worth.

## Structure
`plugins/auth0/skills/auth0/`
- `SKILL.md` — the router (intent → framework → tooling → load).
- `references/feature-*` — a capability spanning frameworks (mfa,
  organizations, custom-domains, acul, branding, migration, dpop).
- `references/framework-*` — one SDK/framework integration.
- `references/tooling-*.md` — cli / mcp / terraform.
- `references/pattern-*.md` — cross-cutting guidance (security, token-handling,
  multi-tenant, rate-limiting, common-errors).
- `assets/` — templates (e.g. ACUL screen templates).
- `scripts/validate-skill.sh` — local structure + routing gate.

A `framework-*` or `feature-*` reference is either a single `.md` file or a
**group directory** of the same stem (`framework-swift/`, `feature-branding/`)
when the content is large enough to split. A group contains `index.md` (the hub)
plus document-section leaves (`integrate.md`, `api-reference.md`, `patterns.md`,
`setup.md`, `migration.md`, …). The router routes to the stem either way; for a
group it lands on `index.md`, which dispatches to the leaf the task needs.

## Routing flow
1. **Intent** — what the developer wants (integrate, feature:*, guidance, debug,
   migrate).
2. **Framework — three-tier cascade** (first tier that yields a framework wins):
   Tier 1 installed Auth0 SDK → Tier 2 non-Auth0 workspace deps → Tier 3 prompt
   keywords. Web-vs-API variants resolve intent-first, then ask.
3. **Tooling** — terraform / mcp / cli (project context).
4. **Load** 2–3 reference files and follow them.

## Reachability invariant (CI-enforced)
`scripts/check_router_reachability.py` asserts the depth-2 tree holds: every flat
`references/*.md` and every group is routable from `SKILL.md` (via template
expansion over the known framework and tooling value sets); every group has an
`index.md` and every leaf is reachable from that hub's dispatch; no route points
at a missing file; and the only second-hop links allowed are a hub `index.md`
dispatching to leaves **in its own group** — flat files and leaves may contain no
intra-references `.md` link (existing target or dead), and cross-group links are
forbidden. This runs in the `skillsaw` GitHub Actions workflow and inside
`validate-skill.sh`.

To add or extend a capability, see
[CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-capability-to-the-unified-skill).
