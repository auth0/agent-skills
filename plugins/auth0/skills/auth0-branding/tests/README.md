# auth0-branding tests

Two artifacts:

- **`evals.json`** — canonical eval spec in the repo-wide format: prompts, expected behavior, and per-eval assertions. This is the source of truth; use it when wiring the skill into a shared evals runner, or when reviewing what the skill is expected to do.
- **`run-regression.sh`** — lightweight bash harness for a quick routing sanity check after edits. Runs each prompt through `claude -p` in a fresh session and greps for a capability-name marker in the response. Not a full correctness check — it verifies that Claude loads the right capability, not that every assertion in `evals.json` holds.

## When to run each

- After editing `SKILL.md` (especially the capability list, description, interaction style, or the Plan mode / Verify in browser sections) — run `run-regression.sh` to confirm routing still works across the canonical intents.
- Before releasing a meaningful change to the skill — walk `evals.json` manually or via the shared runner to check behavioral assertions, not just routing.

## Running the bash harness

```bash
./run-regression.sh
```

Writes per-prompt logs to `tests/logs/`. A `REVIEW` result means the expected marker string didn't appear in the response — open the log to decide whether the skill misrouted or Claude just used different phrasing.

**Expect some run-to-run variance.** Claude's responses aren't deterministic, so the same prompt can phrase things slightly differently on each run. The markers are intentionally generous, but occasional `REVIEW` results are normal and don't automatically indicate a routing regression — always read the log before concluding there's a problem. Treat a drop from 8/8 to 6/8 as a noise range; treat ≤4/8 as a real signal worth investigating.

The harness passes `--plugin-dir` (parent `auth0` plugin) and `--add-dir` (skill root for reference file reads). These together ensure the skill auto-loads and can read its own `references/*.md` files from the non-interactive session. Most capabilities stop on the tenant-context prerequisite gate (`auth0 tenants list` needs permission) — that's expected in `claude -p` and is itself a routing signal the markers accept.

## Coverage

`evals.json` covers:

| ID | Intent | Capability |
|---|---|---|
| 1 | Brand from URL (Brandfetch path) | 1 |
| 2 | Brand from inline values (no extraction) | 1 |
| 3 | Change a single setting (primary button color) | 2 |
| 4 | Ambiguous "button color" disambiguation | 2 |
| 5 | Voice rewrite from URL + descriptor | 3 |
| 6 | Rollback with scope pre-check | 4 |
| 7 | Ambiguous "theme not showing" → diagnosis | 5 (default-route) |
| 8 | Page template upload (auth0:head/widget validation) | 2 |
| 9 | Bare `/auth0-branding` (no intent) | routing table |
| 10 | Plan mode (defer writes) | 1 + ExitPlanMode |

Assertions per eval cover both routing and behavioral guardrails from `SKILL.md` and the capability references — full theme PATCH (not partial), GET-merge-PUT for custom text, no-op-default stripping in voice rewrites, scope pre-check order in rollback, Classic-toggle diagnosis in check, Plan mode write deferral, and more. Update `evals.json` when you change a guardrail.

The bash harness (`run-regression.sh`) covers 8 of the 10 evals; the bare-invocation case (`/auth0-branding`) and plan-mode case don't run cleanly in `claude -p` and should be verified manually.
