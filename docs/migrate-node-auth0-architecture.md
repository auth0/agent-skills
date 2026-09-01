# migrate-node-auth0: Target Architecture

## The core idea: progressive disclosure

Today the migration skill loads everything at once. The moment an agent decides "this is a node-auth0 migration," it reads all five files — the hub plus four topic references, about 1,466 lines total — even when most of that content is irrelevant to the migration in front of it. A stateless backend that only does token grants still pays to load the entire sessions reference and the entire CIBA/backchannel mapping it will never touch.

The target architecture changes this from "load everything, then figure out what you need" to "load a lean map, then fetch each detailed section only when you actually reach it." That is the whole point, and it mirrors what the rest of the repo already does.

## Three layers, and what each one knows

### Layer 1 — the router (`SKILL.md`)

The router's only job is to recognize the intent and point at one file. It becomes leaner: today it names five files; after the change it names one.

```
### migrate-node-auth0
Read: references/feature-migrate-node-auth0/index.md
Follow the dispatch table in that hub — load each leaf at the step that needs it.
Do not load feature-migration/index.md.
```

The router never contained migration facts — no API names, no version numbers, no steps — and it still won't. It is a switchboard. Shrinking it also returns token headroom against the 4,300-token router budget that previously forced prose trimming.

### Layer 2 — the hub (`feature-migrate-node-auth0/index.md`)

The always-loaded map. It holds what every migration needs regardless of shape:

- Scope rules (rewrite the auth layer; leave `ManagementClient` alone).
- The target-SDK decision (`@auth0/auth0-auth-js` vs `@auth0/auth0-server-js`).
- The numbered 0–6 workflow spine.
- The script invocations (`scan-usage.sh`, `verify-migration.sh`).

Crucially it carries a **dispatch table** mapping each workflow step to the one leaf that step needs. The hub is small and cheap, and gives the agent a complete mental model of the job before any detail is pulled in.

### Layer 3 — the leaves (loaded on demand)

The four detailed references live inside the hub's own directory as leaves:

```
references/feature-migrate-node-auth0/
  index.md            ← hub (always loaded)
  routing.md          ← loaded at step 2 (target SDK + constructor)
  breaking-changes.md ← loaded at step 3 (structural changes, before method rewrite)
  api-mapping.md      ← loaded at step 3 (method rewrite, after breaking-changes)
  sessions.md         ← loaded at step 5 (session apps only)
```

Each leaf is a self-contained document section, read only when the workflow step that needs it arrives. A stateless migration never opens `sessions.md`. This is the leanness win: the common case loads noticeably less, and no case loads more than today.

## Dispatch table (lives in the hub)

| At workflow step | Load leaf |
|---|---|
| Step 2 — target SDK + constructor | `references/feature-migrate-node-auth0/routing.md` |
| Step 3 — structural changes (before method rewrite) | `references/feature-migrate-node-auth0/breaking-changes.md` |
| Step 3 — method rewrite (after breaking-changes) | `references/feature-migrate-node-auth0/api-mapping.md` |
| Step 5 — session apps only | `references/feature-migrate-node-auth0/sessions.md` |

## Why nested, not flat siblings

Two structural reasons.

**The one-hop rule.** The navigation tree is three levels deep (router → hub `index.md` → leaf), so following it from the top is two pointer-follows. The first — router → reference — is the base route and is not counted; routing is the router's entire job. The "one-hop rule" (enforced by `scripts/check_router_reachability.py`) constrains only the *reference layer*: from `check_router_reachability.py`'s own docstring, "the ONLY second hop allowed is a hub `index.md` dispatching to leaves in its OWN directory." So a hub gets exactly one downward hop, to a same-directory leaf; a leaf gets none (it's a sink). Keeping flat sibling directories but having the hub point at a *sibling* reference is a sideways cross-directory hop — not the one permitted same-directory hop — which the checker rejects. Nesting the detail files under the hub is the only shape that lets the hub dispatch to them legally.

**It is the repo's existing convention.** `docs/architecture.md` calls this a "leaf group." The `framework-hono` design doc is a worked example of the same structure, and PR #194 (`framework-node-auth0`, merged) is the single-file version of the same principle. This refactor brings one skill onto the convention everything else already follows; it introduces no new loader, manifest, or frontmatter mechanism.

## The one real constraint: leaves are sinks

A leaf file cannot reference any other `.md` file — no markdown links, no backticked filenames, no `Read:` verbs, no `references/...` paths, not even in prose. The reachability checker treats a leaf as a strict sink and fails on any intra-skill `.md` reference.

Today the api-mapping and breaking-changes references point at each other only by descriptive name ("the co-loaded breaking-changes reference"), never by an actual path, so they are already sink-clean. This is the one place to verify carefully after the move, because a stray literal path would fail CI. It is the sole asymmetric risk; everything else is mechanical.

## Before / after: what the agent experiences

**Before.** "This is a migration" → dumps ~1,466 lines into context → works through it.

**After.** "This is a migration" → loads the hub map (~185 lines) → sees the workflow and dispatch table → at each step pulls in exactly the one detailed section that step needs → skips entirely the sections that don't apply.

Same total knowledge available, delivered just-in-time instead of all-up-front, on the structure the repo already enforces everywhere else.

## Load-cost comparison

| Scenario | Before | After |
|---|---|---|
| Stateless auth-js migration (no sessions) | all 5 files (~1,466 L) | hub + routing + api-mapping + breaking-changes (~1,256 L); `sessions.md` skipped |
| Server-js session app | all 5 files (~1,466 L) | hub + all 4 leaves as steps reach them (~1,466 L), but staged not up-front |
| Router cost, every case | 5 `Read:` lines | 1 `Read:` line |

## Invariants preserved

- Router carries pure dispatch, zero migration specifics — unchanged, now leaner.
- Reference content (the migration substance) is unchanged; only relocated.
- History preserved via `git mv`.
- Enforced by `check_router_reachability.py` (structure) and `check_routing_evals.py` (routing table), both in CI.
