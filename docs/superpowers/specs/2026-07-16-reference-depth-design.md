# Reference depth: hub + leaves for large reference files

**Date:** 2026-07-16
**Status:** Approved design, pre-implementation
**Skill:** `plugins/auth0/skills/auth0/`

## Problem

The consolidated `auth0` skill (v2.0) ships one router `SKILL.md` over a **flat**
pool of ~50 reference files. Several are very large, so an agent loading a
reference pays for the whole file even when it needs only one intent's worth of
it. Current sizes over 40K:

| File | Size |
|---|---|
| `framework-swift.md` | 104K |
| `feature-custom-domains.md` | 104K |
| `feature-branding.md` | 92K |
| `framework-android.md` | 77K |
| `feature-acul.md` | 68K |
| `framework-go.md` | 56K |
| `framework-php-api.md` | 49K |
| `framework-react.md` | 45K |
| `framework-java-mvc.md` | 44K |
| `framework-ionic-angular.md` | 44K |
| `framework-php.md` | 42K |
| `framework-ionic-vue.md` | 42K |
| `framework-aspnetcore-auth.md` | 41K |
| `framework-expo.md` | 41K |
| `framework-nuxt.md` | 39K (near threshold) |

An agent asked to "add MFA to my Swift app" should not have to load the Swift
integration guide, the migration guide, and everything else to get the MFA
slice.

## Goal

Introduce **one level of depth** so the router can pull only the slice an agent
needs, reducing tokens loaded for large references, without regressing routing
reliability.

## Design

### Structure & naming

A "group" is a directory that replaces the old single file, keeping the existing
kebab prefix. Files at or below the split threshold stay flat. The pool is
**mixed** — some groups, some flat files.

```
references/
  framework-swift/          # was framework-swift.md (104K)
    index.md                # hub: intent -> leaf lookup + shared prerequisites (~1-2K)
    integrate.md            # intent: integrate
    mfa.md                  # intent: feature:mfa (SDK-side step-up)
    migration.md            # intent: upgrade-sdk (v2->v3 etc.)
    ...
  framework-fastify.md      # 4.8K, stays flat
  feature-branding/         # was feature-branding.md (92K)
    index.md
    ...
  pattern-security.md       # 2.4K, stays flat
```

- **Split threshold:** only files above ~40K get grouped. Exact list confirmed
  against the threshold during implementation (15 files currently qualify;
  `framework-nuxt` at 39K is borderline and decided per-file).
- **Leaf axis:** leaves are **intent-scoped**, mapping to Step 1 intents
  (`integrate`, `feature:mfa`, `upgrade-sdk`/`migration`, API protection, etc.).
  The precise leaf set is decided per-group from its content.

### Two-hop load path

The old one-hop rule (a reference file links to nothing; only `SKILL.md` routes)
is **relaxed to exactly two hops, and only through a group's `index.md`.**

**Hop 1 — SKILL.md -> group.** Step 4 routing reads the group hub instead of a
file. Because the router can't know per-slug whether a target is grouped or
flat, the instruction is uniform and filesystem-deterministic:

> If `references/framework-{framework}/` is a directory, read its `index.md`;
> otherwise read `references/framework-{framework}.md`.

**Hop 2 — index.md -> leaf, as an imperative Read.** The hub does **not** rely on
passive markdown links (the original one-hop rule existed because the agent
follows only one hop reliably). Instead the hub carries an explicit dispatch
table with an imperative `Read:` instruction the agent executes:

```markdown
# Swift — reference hub

You arrived here for a specific intent. Read ONLY the leaf for your intent:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-swift/integrate.md` |
| feature:mfa | `Read: references/framework-swift/mfa.md` |
| upgrade-sdk | `Read: references/framework-swift/migration.md` |

Do not read the other leaves.
```

Path: `SKILL.md` (loaded) -> `index.md` (~1-2K) -> one leaf. Two hops, both
imperative `Read:` verbs, never a bare link.

**Shared content** every leaf needs (install snippet, base config) lives in the
hub `index.md` itself, so the agent gets it on hop 1 without a third hop. Leaves
are self-contained for their intent and never link to each other or back to the
hub.

### Invariant: tree of depth 2

- A **group `index.md`** MAY use `Read: references/<group>/<leaf>.md` dispatch —
  but only to leaves **in its own group**. Cross-group links stay forbidden.
- A **leaf** links to nothing (no sideways, no back-link to index, no
  cross-group). Leaves are sinks.
- **Flat files** keep the strict old one-hop rule unchanged.

## Checker & test changes

### `check_router_reachability.py`

1. **No orphans (two-level).** Glob becomes recursive. Router must route to
   `<group>/index.md`; every leaf must be reachable from that `index.md` via an
   imperative `Read:` dispatch. A leaf no hub points at is an orphan.
2. **Broken routes (extended).** Also covers hub->leaf: a hub naming
   `framework-swift/mfa.md` that doesn't exist fails.
3. **One-hop -> two-hop.** The `SIDEWAYS_RES`/`LINK_RES` ban is relaxed narrowly:
   a hub `index.md` may dispatch to its own leaves; leaves and flat files stay
   sinks. Cross-group links forbidden everywhere.

New unit-test cases in `test_check_router_reachability.py`: valid hub dispatch;
hub linking cross-group (fail); leaf linking to index (fail); orphan leaf
(fail); hub entry with no matching leaf (fail).

### `check_routing_evals.py` + `routing-cases.json`

For a grouped slug, `expect_refs` becomes the two-hop path the router produces —
the hub plus the intent leaf:

```json
{ "id": "swift-mfa", "intent": "feature:mfa", "framework": "swift",
  "expect_refs": ["framework-swift/index.md", "framework-swift/mfa.md", "tooling-cli.md"] }
```

`compute_route` gains a resolution step: when `framework-{framework}` is a
directory, expand to `<group>/index.md` + `<group>/<intent-leaf>.md`; else the
flat `.md` as today. Flat-file cases unchanged. `present` globs recursively.

### `validate-skill.sh`

Grouped slugs checked as directories containing an `index.md`; presence lists
(`EXPECTED_FRAMEWORKS`/`EXPECTED_FEATURES`, "old files must be gone" globs)
updated for the tree.

### Behavioral evals (empirical reliability check)

The per-framework case files that cover the split files —
`swift.json`, `swift-migration.json`, `branding.json`, `android.json`,
`acul.json`, `custom-domains.json` — are the empirical check on the two-hop
reliability concern. After a split, run them to confirm the agent completes both
hops and lands on the right leaf. If any regress, the fix is in the hub prose
(make dispatch more imperative), not the leaf.

### Docs

`AGENTS.md`, `CONTRIBUTING.md`, `docs/architecture.md`, and the architecture
memory all state the one-hop rule and each is updated to the
two-hop-through-hub contract.

## Rollout

1. Split `framework-swift` first — it has two behavioral case files
   (`swift.json`, `swift-migration.json`), making it the strongest proof case.
2. Update the two checkers + their unit tests + `validate-skill.sh` so Swift
   passes as a group and all flat files still pass.
3. Run Swift's behavioral evals. Gate: they must stay green (agent completes
   both hops to the right leaf) before rolling out.
4. Apply the pattern to the remaining >40K files.
5. Update docs and the architecture memory.

## Non-goals

- Splitting files below the threshold.
- Changing the router's Step 1-3 detection logic (intent/framework/tooling
  detection is unchanged; only Step 4 load instructions gain the group branch).
- More than two hops. The graph is a depth-2 tree; hubs fan out only within
  their own directory.
