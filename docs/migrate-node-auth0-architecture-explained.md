# migrate-node-auth0: The Architecture, Explained Simply

## The change in one sentence

The migration guidance previously lived in its own standalone folder (`feature-migrate-node-auth0/`) split across five files. It now lives in a single file (`migration.md`) inside the existing `framework-node-auth0/` folder.

## A plain analogy

Think of the migration guidance as a chapter in a repair manual for node-auth0.

- **Before:** the migration chapter had its own separate binder with five booklets (an overview plus four topic booklets). The signpost at the front desk pointed you to that binder.

- **Now:** those five booklets have been merged into one comprehensive chapter and filed inside the main node-auth0 manual, right alongside the Management API section. The signpost points to the same manual it already used for Management API work; you just turn to the migration chapter.

Same knowledge, fewer locations to maintain.

## How it's organized: three levels

### Level 1 — The signpost (`SKILL.md`)

The front door. Its only job is to notice "this is a node-auth0 migration" and point to one place. Before, it pointed to `feature-migrate-node-auth0/index.md`. Now it points to `framework-node-auth0/index.md`:

```
This is a node-auth0 migration -> open references/framework-node-auth0/index.md
```

It holds no migration details itself — no code, no version numbers, no steps.

### Level 2 — The hub (`framework-node-auth0/index.md`)

This hub already existed for Management API documentation. It now also contains a row in its dispatch table routing migration requests to `migration.md`. One hub, two jobs.

### Level 3 — The leaf (`migration.md`)

One comprehensive file (roughly 1,600 lines) covering everything a migration needs: target SDK selection, breaking changes, API method mapping, session migration, and the scan and verify commands. Nothing is split out. The file is a dead end — it does not link to any other document.

The scan and verify commands appear as code blocks directly inside `migration.md` (scan in Section 2, verify in Section 8). The underlying shell scripts (`scan-usage.sh`, `verify-migration.sh`) now live in the eval harness at `evals/behavioral/fixtures/node-auth0-migration/`, where they serve as oracle scripts for automated testing. They are no longer part of the shipped skill.

## The folder structure

```
references/framework-node-auth0/
  index.md       <- hub: Management API content + migration dispatch row
  migration.md   <- leaf: all migration content in one place (~1,600 lines)
```

The old `feature-migrate-node-auth0/` folder and its five files (`index.md`, `routing.md`, `breaking-changes.md`, `api-mapping.md`, `sessions.md`) are deleted.

## Why put migration inside the framework folder?

Two reasons.

**1. There's a house rule about how deep the links can go.** Navigation is three levels: the signpost points to a hub, and the hub points to a leaf. That's two hops total, which is fine.

The rule (enforced by an automated check, called the "one-hop rule") governs only what happens inside the reference layer, after you've reached a hub. There, exactly one further hop is allowed, and only a specific one: a hub may point to a leaf in its own folder. A leaf may point to nothing (dead end). Nothing may jump sideways to a different folder.

Having `feature-migrate-node-auth0/` as a separate top-level folder would mean the signpost points at two different node-auth0 locations. Moving `migration.md` inside `framework-node-auth0/` keeps it to one hub per topic area and satisfies the one-hop rule.

**2. node-auth0 knowledge belongs together.** The framework hub already covers constructor patterns and Management API usage. Migration builds on those same patterns. Keeping both under one folder avoids any cross-directory linking and makes the full node-auth0 picture easy to find in one place.

## The one rule to be careful about

`migration.md` is a dead end — it may not link to any other `.md` file, not even by mentioning a filename. The automated check will fail if it does. This is the one thing to verify when editing the file, because a stray literal path would trip the check. Everything else is straightforward.

## The before-and-after, side by side

**Before:** "This is a migration." → signpost points to `feature-migrate-node-auth0/` → loads hub overview + up to four topic files.

**After:** "This is a migration." → signpost points to `framework-node-auth0/` → hub dispatch table → loads `migration.md`.

## What stays exactly the same

- The actual migration instructions — they are all in `migration.md`, just consolidated into one file instead of five.
- The three-level navigation structure (signpost to hub to leaf).
- Two automated checks: one verifies the folder structure and links, the other verifies the signpost points where it should.
