# Activation evals — the `auth0` skill `description`

Three layers of eval guard this skill. This directory is the **activation**
layer — it tests the one thing the other two can't see.

| Layer | Question | Runs in CI? | Needs a live model? |
|---|---|---|---|
| Routing (`../routing-cases.json`) | Does each intent/framework map to reference files that exist? | ✅ yes | no — deterministic |
| **Activation (here)** | **Does the `description` make the agent load the skill on the right prompts — and leave it alone on the wrong ones?** | ❌ manual | yes — `claude` CLI |
| Behavioral (`../behavioral/`) | Does the loaded skill make the agent generate **correct SDK code**? | ❌ manual | yes — `claude` CLI |

## Why this layer exists

The `description` in `SKILL.md` frontmatter is the **only** signal an agent uses
to decide whether to load this skill. If it's wrong, nothing else matters — the
best router in the world never runs.

Neither other layer touches it:

- `scripts/check_routing_evals.py` parses the SKILL.md **body** (the Step 4
  table). It never reads frontmatter.
- `../behavioral/` loads the plugin explicitly via `--plugin-dir` and grades the
  code produced **after** the skill is already in play.

So a description edit could destroy discoverability with every other check
green. That was the gap; this closes it.

## What it measures

For each case in `cases.json`, both description variants are scored on the same
prompt, and the run reports **recall** on positives, **false positives** on
negatives, and explicit `REGRESSED` / `IMPROVED` lists.

Two stages:

**Stage A — classifier (default).** Renders a realistic skill menu (`auth0` plus
seven distractor skills, name + description only, exactly as skills appear in a
system prompt), then the user's request, and asks which skills it would invoke.
Cheap, and the description is the only variable that changes between the two
runs.

> The distractor menu is not decoration. Asking "would you invoke `auth0`?" in
> isolation primes YES and makes every negative case meaningless. Several
> distractors are auth-*adjacent* on purpose (`kubernetes-ops`,
> `api-hardening`, `aws-infra`) so the near-miss negatives have a correct home
> to go to.

**Stage B — real activation (`--real`).** Ground truth. Builds two temp copies of
`plugins/auth0` differing **only** in the description line, runs the prompt with
`--plugin-dir` and `--output-format stream-json`, and detects an actual
`Skill(auth0)` **tool call** in the event stream (not prose about using it). A
full agent run per case per variant, so it's reserved for the cases tagged
`spot_check` plus anything Stage A flags.

Activation is non-deterministic, so each case runs `--trials` times (default 3)
per variant and the majority wins. Cases whose trials disagree are reported
`UNSTABLE` rather than silently rounded — that's the difference between a real
regression and a flipped coin.

## Running

```bash
cd evals/activation
npm install                              # once, for execa

node run-activation-evals.mjs --dry-run  # validate cases + resolve variants, no model calls
node run-activation-evals.mjs            # full matrix: git:HEAD vs working tree
node run-activation-evals.mjs --real     # stage B on the spot_check cases
```

Useful flags:

```bash
--baseline git:main        # any git ref, or a path to a SKILL.md
--candidate path/to/SKILL.md
--only id1,id2             # run specific case ids
--trials 5                 # more trials if too many cases come back UNSTABLE
--model <id>               # pin the model
--real --only <ids>        # confirm flagged cases on the real activation path
```

Variants resolve as `git:<ref>` or a filesystem path, so **any** future
description edit is testable against this same matrix with no new fixtures:

```bash
# after editing the description, compare against what's committed
node run-activation-evals.mjs --baseline git:HEAD
```

Exit code is non-zero only when a case **regressed**, so this can gate a
description change.

## The case matrix

`cases.json` is the part that determines whether a passing run means anything.
`should_activate` is ground truth — the right answer for that prompt — not a
prediction about either variant. Four groups:

- **`keyword-loss`** — prompts that the old description matched only via literal
  words (`redirect loop`, `callback URL mismatch`, `429`, `passkeys`, `ACUL`,
  `Clerk`, `NextAuth.js`, …). These attack generalized phrasing directly.
- **`framework-loss`** — the old description's explicit framework list (Flutter,
  FastAPI, Spring Boot, Laravel, ASP.NET Core, Expo, Swift).
- **`indirect`** — no Auth0, no framework, no feature name: *"add auth to my Node
  API"*, *"only logged-in users should reach /dashboard"*.
- **`negative`** — including **`near-miss`** cases that deliberately reuse the
  old description's own vocabulary: Kubernetes `RBAC`, application `429` rate
  limiting, `CORS` headers on an `Express` app, `rotate` AWS IAM keys,
  `express-session` → Redis.

The near-misses are what make this a fair test rather than a rigged one. Without
negatives, a description reading "use this always" scores 100% recall and the
suite proves nothing.

## Calibration — what this suite can and can't detect

Run on 2026-07-30 comparing the 754-char description (`git:HEAD`) against the
503-char rewrite. **Read this before trusting a green run.**

### Stage A is saturated

Both variants scored 26/26 recall and 0/9 false positives — a perfect tie. A tie
at 100% carries no information, so the suite was calibrated with two deliberately
broken control descriptions:

| Control description | recall | false positives | verdict |
|---|---|---|---|
| Narrow: *"Use when the user explicitly asks for the Auth0 skill by name."* | **0/26** | 0/9 | ✅ detected |
| Broad: *"Use for any software development task involving a web, mobile, or backend application…"* | — | **0/9** | ❌ **not** detected |

So Stage A's **recall axis works** (it catches an under-triggering description
outright) but its **precision axis is insensitive** — a description broad enough
to claim nearly all software work still produced zero false positives, because
the distractor skills are individually a better match for each negative prompt
and the classifier picks the best fit rather than everything plausible.

**Consequence: a green Stage A run is evidence against under-triggering only. It
is NOT evidence against over-triggering.** Judge over-triggering with Stage B, or
by adding negatives whose correct home is *no skill at all*.

### Stage B discriminates, but has high variance

3 real-activation trials per case (the runner's `detectSkillUse` is unit-tested
against synthetic event streams for the 5 discriminations that matter, including
not counting prose or a `Read` of an auth0 path):

| Case | ground truth | old (754ch) | new (503ch) |
|---|---|---|---|
| `kw-passkeys` | activate | 0/3 | 1/3 |
| `indirect-node-api` | activate | 0/3 | 2/3 |
| `neg-cors-headers` | **don't** | 2/3 fired ❌ | 0/3 ✅ |

The new description was never worse on any trial, and fixed a real
over-trigger: the old wording fired on a plain CORS-headers request 2 of 3 times,
because it listed `CORS error` and `Express` as literal triggers.

But note the absolute numbers: **real-path recall is low for _both_
descriptions** (0–2 of 3). In a live run the agent frequently answers an auth
question without invoking the skill at all. That is a finding about the
skill's discoverability in general, not about this edit — and it's the most
useful thing this harness surfaced. Worth investigating separately.

### Practical guidance

- Never read a Stage A tie as "the change is safe" — it mostly means both
  descriptions clear a low bar. Look at Stage B and the control table.
- Use `--trials 5+` on Stage B before believing any single-case difference.
- If you add over-triggering negatives, verify the suite can actually fail by
  re-running the broad control:
  `node run-activation-evals.mjs --baseline /tmp/SKILL-broad.md --trials 1`

## Adding a case

```jsonc
{
  "id": "kw-something",
  "prompt": "What the developer actually types.",
  "should_activate": true,
  "why": "Why this is the ground truth — required, it's what makes the case reviewable.",
  "tags": ["keyword-loss", "debug"],
  "spot_check": true          // optional: include in the --real stage
}
```

Guidance:

- **Write the prompt as a developer would type it**, not as a description-shaped
  sentence. Echoing the description's vocabulary tests string matching, not
  intent recognition.
- **Every positive needs a plausible negative twin** using the same vocabulary.
  A description can only be shown to discriminate if something nearby doesn't
  match.
- **Skip prompts with no defensible ground truth.** `cases.json` documents the
  ones excluded on purpose (e.g. *"hash passwords with bcrypt in my hand-rolled
  auth"* — both activating and respecting the user's stated choice are
  defensible). Scoring those measures taste, not activation.
- **Don't tune the description until the suite is green.** Fitting the wording to
  35 known prompts is overfitting; the goal is a description that generalizes to
  the prompts nobody wrote down.
