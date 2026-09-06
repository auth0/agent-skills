# migrate-node-auth0: Architecture

## The core idea: consolidation under the framework hub

Previously the migration guidance lived in a standalone `feature-migrate-node-auth0/` directory: five files totaling roughly 1,466 lines (a hub plus four topic leaves). That directory is deleted. All migration content now lives in a single file, `references/framework-node-auth0/migration.md`, dispatched from the existing `framework-node-auth0` hub.

The `framework-node-auth0` hub now serves two roles: the Management API reference it always handled, plus a dispatch-table row routing the `migrate-node-auth0` intent to `migration.md`. The router points at one fewer top-level directory, and the three-hop navigation tree is preserved.

## Three layers, and what each one knows

### Layer 1 — the router (`SKILL.md`)

The router's only job is to recognize the intent and point at one file. For the migration intent:

```
### migrate-node-auth0
Read: references/framework-node-auth0/index.md
Follow the dispatch table in that hub — load migration.md for the full migration reference.
```

The router holds no migration facts — no API names, no version numbers, no steps. It is a switchboard. Pointing at the existing `framework-node-auth0` hub instead of a dedicated feature directory also returns token headroom in the router, since the `migrate-node-auth0` entry now shares the hub with Management API routing.

### Layer 2 — the hub (`framework-node-auth0/index.md`)

The hub contains the Management API reference (unchanged) and a dispatch table entry for the migration intent. It routes `migrate-node-auth0` requests to `migration.md`. It is always loaded when the migration intent fires.

### Layer 3 — the leaf (`migration.md`)

The single comprehensive migration reference. All migration content — target SDK routing logic, breaking changes, API method mapping, session migration, scan commands, and verify commands — lives here as one roughly 1,600-line document.

`migration.md` is a sink: no outbound links to any other `.md` file.

The scan and verify commands appear as visible code blocks directly in `migration.md` (Section 2 for scan, Section 8 for verify). The corresponding shell scripts (`scan-usage.sh`, `verify-migration.sh`) were moved out of the skill into `evals/behavioral/fixtures/node-auth0-migration/`, where they serve as deterministic eval oracle scripts. The shipped skill no longer includes those scripts.

## Directory structure

```
references/framework-node-auth0/
  index.md       <- hub: Management API content + migrate-node-auth0 dispatch row
  migration.md   <- leaf: comprehensive migration reference (~1,600 lines)
```

The old `feature-migrate-node-auth0/` directory and its five files (`index.md`, `routing.md`, `breaking-changes.md`, `api-mapping.md`, `sessions.md`) are deleted.

## Why nested under the framework hub, not a separate directory

**The one-hop rule.** Navigation is three levels deep: router to hub `index.md` to leaf. The "one-hop rule" (enforced by `scripts/check_router_reachability.py`) constrains only the reference layer: from the reachability checker's own docstring, "the ONLY second hop allowed is a hub `index.md` dispatching to leaves in its OWN directory." A hub gets exactly one downward hop, to a same-directory leaf; a leaf gets none (it is a sink).

Keeping a separate `feature-migrate-node-auth0/` directory alongside `framework-node-auth0/` would have the router point at two separate node-auth0 top-level directories. Merging migration into the existing `framework-node-auth0` hub is the correct shape: one hub per topic area, leaves in its own directory.

**Consolidation over duplication.** `framework-node-auth0` already covers Management API usage and constructor patterns. Migration builds on those same patterns. Merging migration under the same hub avoids cross-directory links and keeps all node-auth0 knowledge in one place.

**It follows the repo convention.** `docs/architecture.md` describes this as a "leaf group." The existing `framework-node-auth0` reference is the pattern this change extends. No new loader, manifest, or frontmatter mechanism is introduced.

## The one real constraint: leaves are sinks

`migration.md` cannot reference any other `.md` file — no markdown links, no backticked filenames, no `Read:` verbs, no `references/...` paths, not even in prose. The reachability checker treats a leaf as a strict sink and fails on any intra-skill `.md` reference. This is the one asymmetric risk: a stray literal path fails CI. Everything else is mechanical.

## Before / after: what the agent experiences

**Before.** "This is a migration" → router points to `feature-migrate-node-auth0/index.md` → loads hub + up to four topic leaves (~1,466 lines across five files).

**After.** "This is a migration" → router points to `framework-node-auth0/index.md` → hub dispatch table row → loads `migration.md` (~1,600 lines in one file).

## Load-cost comparison

| Scenario | Before | After |
|---|---|---|
| Any node-auth0 migration | hub + up to 4 topic leaves (~1,466 L) across `feature-migrate-node-auth0/` | hub index + `migration.md` (~1,600 L) under `framework-node-auth0/` |
| Router cost, every case | dedicated `Read:` line pointing to `feature-migrate-node-auth0/` | `Read:` line pointing to `framework-node-auth0/` (shared with Management API routing) |
| Skill-shipped scripts | `scan-usage.sh`, `verify-migration.sh` in `plugins/auth0/skills/auth0/scripts/` | none — commands inlined in `migration.md`; scripts live in `evals/behavioral/fixtures/node-auth0-migration/` |

## Invariants preserved

- Router carries pure dispatch, zero migration specifics — unchanged.
- Reference content (migration substance) is equivalent; only structure changed.
- Navigation depth is three hops: router to hub to leaf.
- Enforced by `check_router_reachability.py` (structure) and `check_routing_evals.py` (routing table), both in CI.
