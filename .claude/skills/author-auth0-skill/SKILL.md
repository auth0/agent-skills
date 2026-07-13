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

- **One-hop rule + reachability:** every `references/` file MUST be named in a
  `SKILL.md` router table, and MUST NOT link to any other `.md` file. Both are
  stated in full under
  [`CONTRIBUTING.md` → "Make it routable"](../../../CONTRIBUTING.md#make-it-routable-required--ci-enforces-this);
  the paths below tell you which table to edit.
- **Strict mode:** avoid vague quality adverbs that assert an outcome without
  showing it — state the concrete behavior instead (what happens, to what,
  when); give a positive alternative for every prohibition; hoist MUST/NEVER
  directives near the top of the file.

## Step 0 — Classify the contribution

| What you're adding | Prefix | Router edits |
|---|---|---|
| A single SDK/framework integration | `framework-<name>.md` | Step 2 all 3 tiers (+ variant row if web/API split) |
| A capability spanning frameworks | `feature-<name>.md` | Step 1 intent row + Step 4 load block |
| A provisioning tool | `tooling-<name>.md` | Step 3 tooling table |
| Cross-cutting guidance | `pattern-<name>.md` | Step 4 load block(s) referencing it |
| Editing an existing reference | (n/a) | Usually none — re-check the one-hop rule |

Then follow the matching path below.

## Path A — New framework reference

1. Create `plugins/auth0/skills/auth0/references/framework-<slug>.md`
   (kebab-case). Follow the split used by peers: `## Setup`, `## Integration`,
   `## API` sections; self-contained (no `.md` links).
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
   table makes `framework-<slug>.md` reachable.
5. The `integrate` load block in Step 4 already reads
   `references/framework-{framework}.md` — no Step 4 edit needed.

## Path B — New feature reference

1. Create `plugins/auth0/skills/auth0/references/feature-<slug>.md`
   (self-contained).
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
   Read: references/feature-passwordless.md
   Read: references/tooling-{tooling}.md
   If framework detected: Read references/framework-{framework}.md
   ```
   ~~~

## Path C — New tooling or pattern reference

- **Tooling:** create
  `plugins/auth0/skills/auth0/references/tooling-<slug>.md`, then add a row to
  the Step 3 table. Backtick the value exactly as the existing rows do
  (`` | <project signal> | `tooling-<slug>.md` | ``) — reachability picks up
  tooling files only via their backticked bare filename, so an unbackticked
  value leaves the file unreachable. Note `validate-skill.sh` hardcodes
  `cli mcp terraform` — a genuinely new tooling file also needs that list
  extended.
- **Pattern:** create
  `plugins/auth0/skills/auth0/references/pattern-<slug>.md`, then reference it
  from the relevant Step 4 load block(s) (patterns are pulled in conditionally,
  e.g. `pattern-multi-tenant.md` under `guidance`). `validate-skill.sh`
  hardcodes `security token-handling multi-tenant rate-limiting common-errors` —
  extend that list for a new pattern file.

## Path D — Editing an existing reference

Usually no router edit. Before finishing: confirm you introduced no link to
another `.md` file (one-hop rule), and that any new prohibition has a positive
alternative and any weak language is reworded.

## Step 5 — Add a routing eval

Add a case to `plugins/auth0/skills/auth0/tests/routing-cases.json` so the new
intent/framework is asserted. Replace the `remix` placeholder below with your
own slug — `expect_refs` must name files that already exist under
`references/`, or `check_routing_evals.py` rejects the case:

```json
{
  "id": "integrate-remix",
  "intent": "integrate",
  "framework": "remix",
  "tooling": "cli",
  "expect_refs": ["framework-remix.md", "tooling-cli.md"]
}
```

## Step 6 — Validate (the gate)

Run all three, in order. The change is not done until every one passes:

```bash
bash plugins/auth0/skills/auth0/scripts/validate-skill.sh
python3 scripts/check_router_reachability.py plugins/auth0/skills/auth0
uvx skillsaw --strict
```

What each catches:
- unreachable file or a second-hop `.md` link → `check_router_reachability.py`
- weak language or missing frontmatter fields (license, author, openclaw) → `skillsaw --strict`
- description length, required sections, expected file presence → `validate-skill.sh`

Also update `plugins/auth0/README.md` when the change adds visible coverage —
the linter enforces README documentation.
