# migrate-node-auth0: The New Architecture, Explained Simply

## The problem in one sentence

Right now, whenever the assistant starts a node-auth0 migration, it reads the entire manual up front — even the chapters that don't apply to the app it's working on.

## A plain analogy

Think of the migration skill as a repair manual.

- **Today:** the assistant grabs the whole manual — all five booklets, roughly 1,466 lines — and reads it cover to cover before touching a thing. If the app is a simple backend that never deals with login sessions, it still reads the entire "sessions" booklet it will never use. Wasteful.

- **The new way:** the assistant first reads only a short **table of contents with a map of the job**. Then, as it works step by step, it flips open just the one chapter each step needs. The "sessions" chapter stays closed unless the app actually has sessions.

Same knowledge, but fetched only when it's actually needed.

## How it's organized: three levels

### Level 1 — The signpost (`SKILL.md`)

This is the front door. Its only job is to notice "ah, this is a node-auth0 migration" and point to one place. It holds no migration details itself — no code, no version numbers, no steps. Just a signpost.

Before, it listed five files to open. Now it lists one:

```
This is a node-auth0 migration → open references/feature-migrate-node-auth0/index.md
```

### Level 2 — The map (`index.md`, the "hub")

This is the short overview that's always read first. It contains the things every migration needs no matter what:

- The ground rules (which code to change, which to leave alone).
- Which replacement SDK to pick.
- The step-by-step plan (steps 0 through 6).
- A small **lookup table** that says "at step 3, open breaking-changes first then api-mapping; at step 5, open the sessions chapter — but only if this app has sessions."

It's short and cheap to read, and it gives the assistant the full picture of the job before diving into any detail.

### Level 3 — The chapters (opened only when needed)

The four detailed documents now sit together, inside the hub's own folder, as chapters of it:

```
feature-migrate-node-auth0/
  index.md            ← the map (always read)
  routing.md          ← opened at step 2: which SDK + how to set it up
  breaking-changes.md ← opened at step 3 (first): the tricky behavior differences
  api-mapping.md      ← opened at step 3 (second): how each old method becomes a new one
  sessions.md         ← opened at step 5: only if the app has login sessions
```

Each chapter is opened only when its step comes up. A simple app skips the sessions chapter entirely. That's the saving.

## Why put the chapters inside one folder?

Two reasons.

**1. There's a house rule about how deep the links can go.** The navigation is three levels: the signpost points to a map, and the map points to a chapter. That's two pointer-follows in total, and that's fine — the signpost's whole job is to route you to the right map, so that first step is the base route and doesn't count against the limit.

The rule (enforced by an automated check, and called the "one-hop rule") governs only what happens *inside the reference layer*, after you've reached a map. There, exactly **one** further hop is allowed, and only a specific one: a map may point to a chapter **in its own folder**. That's it. A chapter may point to nothing (dead end), and nothing may jump sideways to a *different* folder's documents.

If we left the four chapters scattered as separate top-level folders, the map pointing to them would be a sideways jump into other folders — not the one allowed same-folder hop — and the check would fail. Tucking the chapters inside the hub's own folder is what makes that single hop legal.

**2. This is already how everything else in the repo works.** Other skills are built exactly this way — a map plus its chapters in one folder. A recently merged change (the `framework-node-auth0` reference) is the simplest version of the same idea. So this isn't a new invention; it's bringing the migration skill in line with the pattern already used everywhere else.

## The one rule to be careful about

Chapters are **dead ends** — a chapter is not allowed to point to any other document, not even by mentioning its filename. The automated check will fail if a chapter links to another `.md` file.

Good news: today the chapters only refer to each other by description ("see the breaking-changes reference"), never by an actual filename or link. So they're already clean. This is just the one thing to double-check after moving the files, because a stray filename would trip the check. Everything else in the move is routine.

## The before-and-after, side by side

**Before:** "This is a migration." → reads all ~1,466 lines at once → starts working.

**After:** "This is a migration." → reads the short map (~185 lines) → sees the plan and the lookup table → at each step, opens the one chapter that step needs → never opens chapters that don't apply.

The assistant ends up with the same knowledge available to it — it just picks it up right when it's needed instead of hauling all of it around from the start.

## What this saves

| Situation | Before | After |
|---|---|---|
| Simple backend, no login sessions | reads all 5 documents | reads the map + 3 chapters; skips the sessions chapter |
| Full web app with sessions | reads all 5 documents | reads the same content, but one chapter at a time as it goes, not all at once |
| The signpost, every single time | lists 5 files to open | lists 1 file to open |

## What stays exactly the same

- The actual migration instructions don't change — they just move into one folder.
- File history is preserved (the files are moved, not recreated).
- Two automated checks keep it honest: one verifies the folder structure and links, the other verifies the signpost points where it should.
