# Architecture: the unified `auth0` skill

## Why one skill
- A skill's `description` is always in the agent's context. ~45 skills meant ~45
  competing descriptions and ambiguous activation. One skill = one description.
- Routing is **file-based and deterministic**: the router reads `package.json`,
  `composer.json`, `go.mod`, `*.csproj`, `pubspec.yaml`, etc. — code-driven, not
  a model guess.
- **No reference file links to any `.md` file.** Claude Code loads the router,
  then the files it names — one hop. Links between references (or to now-deleted
  sub-files) are not guaranteed to be followed, so all detection and navigation
  logic lives in `SKILL.md`, and reference files are self-contained.

## Structure
`plugins/auth0/skills/auth0/`
- `SKILL.md` — the router (intent → framework → tooling → load).
- `references/feature-*.md` — a capability spanning frameworks (mfa,
  organizations, custom-domains, acul, branding, migration, dpop).
- `references/framework-*.md` — one SDK/framework integration.
- `references/tooling-*.md` — cli / mcp / terraform.
- `references/pattern-*.md` — cross-cutting guidance (security, token-handling,
  multi-tenant, rate-limiting, common-errors).
- `assets/` — templates (e.g. ACUL screen templates).
- `scripts/validate-skill.sh` — local structure + routing gate.

## Routing flow
1. **Intent** — what the developer wants (integrate, feature:*, guidance, debug,
   migrate).
2. **Framework — three-tier cascade** (first tier that yields a framework wins):
   Tier 1 installed Auth0 SDK → Tier 2 non-Auth0 workspace deps → Tier 3 prompt
   keywords. Web-vs-API variants resolve intent-first, then ask.
3. **Tooling** — terraform / mcp / cli (project context).
4. **Load** 2–3 reference files and follow them.

## Reachability invariant (CI-enforced)
`scripts/check_router_reachability.py` asserts every `references/*.md` is
routable from `SKILL.md` (via template expansion over the known framework and
tooling value sets) and that no reference file contains an intra-references
`.md` link (existing target or dead). This runs in the `skillsaw` GitHub Actions
workflow and inside `validate-skill.sh`.

To add or extend a capability, see
[CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-capability-to-the-unified-skill).
