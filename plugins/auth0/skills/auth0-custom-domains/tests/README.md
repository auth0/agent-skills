# auth0-custom-domains tests

Two artifacts:

- **`evals.json`** — canonical eval spec in the repo-wide format: prompts, expected behavior, and per-eval assertions. This is the source of truth; use it when wiring the skill into a shared evals runner, or when reviewing what the skill is expected to do.
- **`run-regression.sh`** — lightweight bash harness for a quick routing sanity check after edits. Runs each prompt through `claude -p` in a fresh session and greps for a capability-name marker in the response. Not a full correctness check — it verifies that Claude loads the right capability, not that every assertion in `evals.json` holds.

## When to run each

- After editing `SKILL.md` (especially the capability list, description, or interaction style) — run `run-regression.sh` to confirm routing still works across the seven canonical intents.
- Before releasing a meaningful change to the skill — walk `evals.json` manually or via the shared runner to check behavioral assertions, not just routing.

## Running the bash harness

```bash
./run-regression.sh
```

Writes per-prompt logs to `tests/logs/`. A `REVIEW` result means the expected marker string didn't appear in the response — open the log to decide whether the skill misrouted or Claude just used different phrasing.

The harness invokes `claude -p --plugin-dir ../../..` (the auth0 plugin root). The `--plugin-dir` flag is **required**: without it, `claude -p` sub-sessions do not load plugin skills unless the plugin is installed from a marketplace, and the harness would appear to pass against Claude's general Auth0 knowledge while the skill itself is not in scope. Auto-discovery from the plugin directory surfaces every skill in `plugins/auth0/skills/`, including siblings (`auth0-branding`, `auth0-cli`, etc.) — useful when `auth0-custom-domains` work overlaps with those.

Permission prompts often cut runs short at the skill-prescribed pre-flight tenant confirmation step. That's normal and is itself a valid routing signal — markers include pre-flight phrasing so most of these cases still pass.

Occasionally a run cuts so short that Claude emits only "can you approve `auth0 tenants list`?" with no elaboration — not enough content for any capability-discriminating marker to match, even broad ones. Accept the REVIEW, read the log, and if the skill's `available-skills` list is visible in-session (`auth0:auth0-custom-domains` in the system reminder) the skill was loaded. The cutoff is a non-interactive-session artifact, not a routing failure.

## Coverage

`evals.json` covers:

| ID | Intent | Capability |
|---|---|---|
| 1 | Explicit health check | 5 |
| 2 | New setup on Cloudflare | 1 |
| 3 | Stuck in pending_verification | 2 |
| 4 | Set default + change RPID | 3 |
| 5 | Add metadata | 3 |
| 6 | Remove on Route 53 | 4 |
| 7 | Ambiguous "something's wrong" | 5 (default-route) |
| 8 | Self-managed on Free tier (two blockers) | 1 |
| 9 | Switch cert type (not PATCHable) | 3 → 4 + 1 |

Assertions per eval cover both routing and behavioral guardrails from `SKILL.md` (correct `type` value, GET-merge-PATCH for metadata, no speculative credit-card probe, exact-match Route 53 DELETE, etc.). Update `evals.json` when you change a guardrail.
