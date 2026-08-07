---
name: author-auth0-skill
description: >
  Use when adding or editing Auth0 guidance in this repo's single auth0 skill —
  a new framework, feature, tooling, or pattern reference — to get the file
  structure, router wiring, and validation right the first time. Use even if the
  request just says "add a reference" or "document X in the skill" without naming
  the router.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
---

# Authoring an Auth0 skill reference

Add or edit guidance in the single `auth0` skill
(`plugins/auth0/skills/auth0/`). This walks you through structure + router
wiring so the change passes CI on the first try.

Source of truth (read, don't duplicate): [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)
and [`docs/architecture.md`](../../../docs/architecture.md).

## Critical rules (get these wrong and CI fails)

- **Depth-3 tree + reachability:** every reference is a directory `<name>/`
  containing an `index.md`, and that directory name MUST be named in a
  `SKILL.md` router table. Start **index-only** (the whole reference lives in
  `index.md`, no leaves — one hop from the router). `index.md` MUST NOT exceed
  1000 lines — once it passes ~500 lines, consider splitting it into a **leaf
  group** (`index.md` becomes a hub — shared prerequisites + an intent→leaf
  dispatch table — over document-section leaves), but only if the content
  actually separates into distinct sections; don't split a reference that's
  long but cohesive. An index-only `index.md`, and any leaf inside a leaf
  group, MUST NOT link to any other `.md` file — they are sinks. The only
  second hop allowed is a leaf-group hub dispatching to leaves in its **own**
  directory; cross-group links are forbidden. Both are stated in full under
  [`CONTRIBUTING.md` → "Make it routable"](../../../CONTRIBUTING.md#make-it-routable-required--ci-enforces-this)
  and [`CONTRIBUTING.md` → "Adding a reference"](../../../CONTRIBUTING.md#adding-a-reference);
  the paths below tell you which table to edit.
- **Strict mode:** avoid vague quality adverbs that assert an outcome without
  showing it — state the concrete behavior instead (what happens, to what,
  when); give a positive alternative for every prohibition; hoist MUST/NEVER
  directives near the top of the file.

## Step 0 — Classify the contribution

| What you're adding | Prefix | Router edits |
|---|---|---|
| A single SDK/framework integration | `framework-<name>/` | Step 2 all 3 tiers (+ variant row if web/API split) |
| A capability spanning frameworks | `feature-<name>/` | Step 1 intent row + Step 4 load block |
| A provisioning tool | `tooling-<name>/` | Step 3 tooling table |
| Cross-cutting guidance | `pattern-<name>/` | Step 4 load block(s) referencing it |
| Editing an existing reference | (n/a) | Usually none — re-check the depth-3 tree rules |

Then follow the matching path below.

## Path A — New framework reference

1. Create `plugins/auth0/skills/auth0/references/framework-<slug>/index.md`
   (kebab-case directory). Start **index-only**: the whole reference lives in
   `index.md`, following the split used by peers (`## Setup`, `## Integration`,
   `## API` sections); self-contained (no `.md` links). Only split into a
   **leaf group** once it's large — see "Splitting into a leaf group" below.
2. Wire detection into **all three tiers** of Step 2 in
   `plugins/auth0/skills/auth0/SKILL.md`:
   - Tier 1 — the Auth0 SDK package row (e.g. `@auth0/auth0-remix` → `remix`).
     Put it above less-specific rows.
   - Tier 2 — the non-Auth0 workspace dependency row (e.g. `@remix-run/react`
     in `package.json` → `remix`).
   - Tier 3 — the prompt-keyword row (e.g. "Remix" → `remix`).
3. If the framework has a web-app vs API split, add a row to
   **Variant disambiguation**.
4. No separate list to update: the reachability checker derives routable slugs
   from the backticked value column of these tables, so naming `<slug>` in a
   table makes `framework-<slug>/index.md` reachable.
5. The `integrate` load block in Step 4 already reads
   `references/framework-{framework}/index.md` — no Step 4 edit needed.

## Path B — New feature reference

1. Create `plugins/auth0/skills/auth0/references/feature-<slug>/index.md`
   (index-only, self-contained — see "Splitting into a leaf group" below for
   when to add leaves).
2. Add an **intent row** to the Step 1 table. The `Intent` value is a lookup
   key reused verbatim as a Step 4 heading. Describe the goal in plain language,
   not just the Auth0 term. Example row:
   `| Let users sign in without a password ... *Auth0: passwordless.* | **feature:passwordless** |`
3. Add a matching **load block** in Step 4 whose heading is that intent. The
   heading is Markdown (`### feature:passwordless`); the `Read:` lines sit inside
   a fenced block beneath it, matching the existing Step 4 blocks:

   ~~~
   ### feature:passwordless
   ```
   Read: references/feature-passwordless/index.md
   Read: references/tooling-{tooling}/index.md
   If framework detected: Read references/framework-{framework}/index.md
   ```
   ~~~

## Path C — New tooling or pattern reference

- **Tooling:** create
  `plugins/auth0/skills/auth0/references/tooling-<slug>/index.md`, then add a
  row to the Step 3 table. Backtick the value exactly as the existing rows do
  (`` | <project signal> | `tooling-<slug>/index.md` | ``) — reachability picks
  up tooling references only via their backticked group name, so an
  unbackticked value leaves the reference unreachable. Note
  `validate-skill.sh` hardcodes `cli mcp terraform` — a genuinely new tooling
  reference also needs that list extended.
- **Pattern:** create
  `plugins/auth0/skills/auth0/references/pattern-<slug>/index.md`, then
  reference it from the relevant Step 4 load block(s) (patterns are pulled in
  conditionally, e.g. `pattern-multi-tenant/index.md` under `guidance`).
  `validate-skill.sh` hardcodes
  `security token-handling multi-tenant rate-limiting common-errors` — extend
  that list for a new pattern reference.

## Path D — Editing an existing reference

Usually no router edit. Before finishing: confirm you introduced no link to
another `.md` file from an index-only `index.md` or a leaf, and that any new
prohibition has a positive alternative and any weak language is reworded. If
you're editing a leaf group's hub, confirm any new `Read:` dispatch still
points only at a leaf in its own directory.

## Step 5 — Splitting into a leaf group (only for large references)

Skip this step for an index-only reference. Past ~500 lines (the 1000-line
cap is in "Critical rules" above), consider splitting into a leaf group so the
router pulls just the slice a task needs — but only if the content actually
separates into distinct sections; a long but cohesive reference stays
index-only:

```
references/framework-<slug>/
├── index.md          # hub: shared prerequisites + intent→leaf dispatch table
├── integrate.md      # document-section leaves (one per section, not per intent)
├── api-reference.md
├── patterns.md
├── setup.md
└── migration.md      # only if the SDK has a major-version migration
```

- **Leaves are document sections**, not intents (`integrate`, `api-reference`,
  `patterns`, `setup`, `migration`, …).
- **`index.md` becomes a lean hub:** shared setup every leaf needs, then a
  dispatch table with one row per router intent, each an imperative
  `` `Read: references/<slug>/<leaf>.md` `` pointing at that intent's primary
  leaf. Intent strings must match Step 1 **exactly** (`feature:mfa`, not
  `mfa`). A "Then, if the task requires it" list of `Read:` bullets makes
  secondary leaves reachable. Every leaf must appear in at least one `Read:`
  line or it's an orphan.
- **Lossless + self-contained:** every line of the original `index.md` lands
  in exactly one destination; leaves repeat shared context inline rather than
  linking to the hub or each other. If two sections cross-reference too
  heavily to separate, merge them into one leaf instead of adding a link.
- You don't edit `SKILL.md`'s routing tables — the router always emits
  `Read: references/{framework}/index.md` regardless of whether the target is
  index-only or a leaf group; a global Step 4 note tells the agent to follow
  the hub's dispatch table to a leaf if it has one.

## Step 6 — Add a routing eval

Add a case to `evals/routing-cases.json` (repo root, not inside the skill) so
the new intent/framework is asserted. Replace the `remix` placeholder below
with your own slug — `expect_refs` must name references that already exist
under `references/` (as `<name>/index.md`, or `<name>/<leaf>.md` for a leaf
group), or `check_routing_evals.py` rejects the case:

```json
{
  "id": "integrate-remix",
  "intent": "integrate",
  "framework": "remix",
  "tooling": "cli",
  "expect_refs": ["framework-remix/index.md", "tooling-cli/index.md"]
}
```

## Step 7 — Validate (the gate)

Run all four, in order. The change is not done until every one passes:

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
python3 scripts/check_routing_evals.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```

What each catches:
- unreachable reference, orphaned leaf, or a link that breaks the depth-3 tree
  (sideways/cross-group/second-hop-from-a-sink) → `check_router_reachability.py`
- a routing decision that doesn't match `evals/routing-cases.json` →
  `check_routing_evals.py`
- weak language or missing frontmatter fields (license, author, openclaw) → `skillsaw --strict`
- description length, required sections, expected file presence → `validate-skill.sh`

Also update `plugins/auth0/README.md` when the change adds visible coverage —
the linter enforces README documentation.
