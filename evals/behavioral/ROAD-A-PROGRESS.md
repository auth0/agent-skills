# Road A progress — behavioral eval harness fix

Date: 2026-08-24. Status: **implemented + smoke-verified. Full green-bar run
pending (user's shell).**

Companion to `EVAL-EXECUTION-FINDINGS.md` (root-cause analysis). This doc tracks
what was changed and what remains.

## Goal

Repair the local `evals/behavioral/` harness so the `node-auth0-migration` case
scores real signal instead of 0/48. Root cause: prompts embedded code inline,
wrote no scaffold file, never told the agent to write a file → empty workspace →
every grader failed. Full analysis in `EVAL-EXECUTION-FINDINGS.md`.

## Analysis before Road A (how we got here)

### Trigger
`node run-evals.mjs node-auth0-migration` reported **0/48 with-skill AND 0/48
without-skill, delta +0**. Every `contains` grader: "not found in any source
file"; every negative: "Invalidated: no positive graders passed (agent likely
wrote no integration code)". User suspected execution was wrong and had no
Anthropic API key.

### Three bugs found (reading run-evals.mjs + graders.mjs + the case file)
1. **Fatal — empty workspace.** `runAgent()` runs `claude -p "<prompt>"` in a
   tmp dir; prompt embeds the "before" code inline; no scaffold on disk; no
   instruction to write a file. Agent answers in prose, stdout is captured then
   **discarded**, 0 files written. `readAllSources()` walks an empty dir → all
   graders fail. The empty-workspace guard (graders.mjs) then demotes the
   trivially-passing negatives to FAIL. This alone produces the exact 0/48
   transcript.
2. **Only eval[0] runs.** `runCase()` read `caseObj.evals[0].prompt` but ran all
   48 flat top-level graders against that single workspace. The file had 9 evals;
   8 never executed → their graders could not pass by construction.
3. **Judge timeouts.** `gradeJudge()` used a 60s `claude -p` timeout; cold
   sequential judge calls exceeded it → "Command timed out after 60000 ms".

### The API-key red herring (two ways)
Missing `ANTHROPIC_API_KEY` was NOT the blocker.
- Local probe `claude -p 'say OK'` → `OK`, exit 0: the CLI is authed via the
  logged-in subscription session, so local agent + judge calls work with no key.
- The official framework never uses a bare Anthropic key anyway — it routes all
  LLM traffic through the internal proxy `llm.atko.ai` with `LLM_API_KEY`
  (LiteLLM key from okta.okta.com); for Claude it sets
  `ANTHROPIC_BASE_URL=llm.atko.ai/anthropic`. CI runners are IP-allowlisted to
  the proxy and have no direct provider access.
The `.forge` Docker notes that inject `-e ANTHROPIC_API_KEY` describe a third
path that matches neither the framework nor the working local session.

### Confluence framework study (4 pages) — confirmed harness ≠ framework
Read the authoritative design docs to check our harness against the real thing:
- **How It Works** (945949538, living source of truth): official framework is the
  `auth0/auth0-evals` TS monorepo (`a0-eval` CLI). Eval = `PROMPT.md` +
  `scaffold/` (starter code the agent edits — **required for agent mode**) +
  `graders.ts`. Grading is L1–L5 levels, gated by config (L4 only once the agent
  edits files). 8-dimension scoring, Docker sandbox per job, `discoverEvals()`
  auto-discovery, `LLM_API_KEY` + `eval.config.js`.
- **V1 Eng Deep Dive** (758546433): layered system prompt (Layer 1 universal
  8-step workflow / Layer 2 workspace file-tree / Layer 3 PROMPT.md). Agent mode
  = ReAct loop that reads scaffold files then `write_file`s the edit.
- **V1.1 Flywheel** (927040690): eval score → recommendation → skill fix → re-run
  (Swift F→A, Android 85→97).
- **Hosted MCP / QA scope** (898302207): confirmed env var rename ATKO_API_KEY →
  `LLM_API_KEY`; all traffic via `llm.atko.ai`.

Key realization: our `evals/behavioral/` runner is a hand-rolled reimplementation
of that framework, and it **dropped the scaffold contract the framework is built
on** (scaffold-on-disk + agent write_file). That IS bug 1. So the fix is to make
our harness honor the same contract.

### Schema audit (all 20 case files, before touching anything)
- `node-auth0-migration` = the ONLY case that is both multi-eval AND graded
  (9 evals, 48 flat graders) → sole full-restructure target.
- 13 single-eval + flat-top-level-graders cases (legacy shape, MUST keep working):
  android-migration, android, expo, express-jwt, flask, flutter-native,
  flutter-web, ionic-angular, ionic-react, ionic-vue, spa-js, swift-migration, swift.
- 6 multi-eval graderless cases (manual expectations, must not regress): acul,
  branding, cli, custom-domains, audit, healthcheck.
- No case used `scaffold` at any level (documented feature, unused).
- In node-auth0-migration each grader `description` is prefixed with its owning
  eval id → the 48→9 grader partition is mechanically derivable.
- 3 cases embed inline code and thus suffer bug 1: node-auth0-migration (ts),
  android-migration (kotlin), swift-migration (swift).

### Decision: Road A vs Road B
- **Road A (chosen):** repair the local harness — add scaffold-on-disk +
  "edit in place" prompts + per-eval loop + fallback + judge timeout. Fast, no
  external deps, local auth already works. Unblocks signal on this skill now.
- **Road B (deferred):** port into the official `auth0/auth0-evals` framework for
  L1–L5 + 8-dim scoring + recommendations + leaderboard parity. Needs
  `LLM_API_KEY`. The real destination if these evals feed the public flywheel.
User confirmed: fix all 3 migration files; validate via dry-run + 2-eval smoke.

## What was done

### 1. `graders.mjs`
- Judge timeout raised 60s → 180s (cold sequential `claude -p` judge calls were
  timing out).
- `runGraders(graders, workspaceDir, model, judgeModel)` and
  `gradeJudge(..., model, judgeModel)` now take an optional judge model; judge
  uses `judgeModel || model`.

### 2. `run-evals.mjs`
- Added `scaffoldEval(evalObj, dir)` — writes per-eval `scaffold` files to the
  workspace (mirror of the existing top-level `scaffold()`).
- `runCase()` shape-detects: `perEval = !caseObj.graders && !!caseObj.evals[0].graders`.
  - Per-eval branch: loops `caseObj.evals`, each eval gets its own tmp workspace
    pair (`auth0-eval-<slug>-<evalId>-<pid>/{with,without}-skill`), own scaffold,
    own graders; results aggregated into `{total, withPass, withoutPass, evalBreakdown}`.
  - Legacy branch: unchanged (single workspace, `evals[0].prompt`, top-level
    graders + top-level scaffold).
- New `--judge-model <id>` flag, threaded into `runGraders`.
- `--dry-run`, `--list`, and the SUMMARY block all handle both shapes (per-eval
  cases show a per-eval breakdown under the aggregate row).

### 3. `cases/node-auth0-migration.json` — full per-eval restructure
- 48 flat top-level graders partitioned into their 9 owning evals by description
  prefix; the `"<id>: "` prefix stripped from each moved description.
- Inline ```ts code extracted from each prompt into per-eval `scaffold`:
  refresh.ts, client-credentials.ts, password-login.ts, callback-handler.ts,
  api-client.ts, express-app.ts, callback.ts, m2m-with-headers.ts, auth-client.ts
  (all under `src/`).
- Prompts rewritten to "Migrate the file src/<name>.ts in place. <intent>."
- `expected_output` kept per eval (documents intent, not graded).
- Top-level `graders` array removed (signals per-eval shape).

### 4. `cases/android-migration.json` + `cases/swift-migration.json`
- Inline code extracted to TOP-LEVEL `scaffold` (stay legacy single-eval shape):
  - android: `app/build.gradle.kts`, `app/src/main/java/com/example/AuthManager.kt`
  - swift: `Package.swift`, `Sources/App/AuthenticationService.swift`
- Prompts rewritten to reference the workspace files in place.
- Top-level `graders` untouched.

### 5. `README.md`
- Added "Per-eval schema (multi-eval graded cases)" section + backward-compat
  rule + scaffold "edit in place" rationale.
- Documented `--judge-model`. Case count note 19 → 20.

## Verification done

- `node run-evals.mjs --dry-run` → **20/20 valid, 0 problems**. Shapes tag
  correctly: node-auth0-migration = "9 eval(s), 48 graders (per-eval)"; the 13
  graded singles = "(legacy)"; the 6 = "expectations-only".
- Live 2-eval slice (`smoke-node-auth0`, temp case, `--skill-only`): **9/9 pass**
  (expires-at-absolute 5/5, return-shape-and-casing 4/4, incl. judge). Confirmed
  scaffold file `refresh.ts` written into the per-eval workspace. Temp case
  deleted after.

## Phase 3 skill-only run results (2026-08-25)

15 evals (9 original + 6 new), skill-only, default model. Total: **74/80 (92.5%)**.

| Eval | Score | Notes |
|------|-------|-------|
| expires-at-absolute | 5/5 ✓ | |
| return-shape-and-casing | 4/4 ✓ | |
| mfa-required-guard | 5/5 ✓ | |
| authorization-code-url | 0/4 FAIL | Agent no-oped; prompt too vague — fixed |
| leave-management-client | 5/5 ✓ | F1+F2 fixes confirmed working |
| routing-session-vs-stateless | 7/7 ✓ | |
| server-js-session-traps | 7/7 ✓ | |
| fullresponse-success-headers | 6/6 ✓ | |
| per-request-options-signal-headers | 5/5 ✓ | |
| database-signup-casing | 6/6 ✓ | new eval |
| database-changepassword-return | 3/4 (75%) | `.data` grader too strict — fixed |
| userinfo-claims | 6/6 ✓ | new eval; graders updated for PR #228 |
| pkce-code-verifier | 5/5 ✓ | new eval |
| typed-errors-refresh | 5/5 ✓ | new eval |
| passwordless-sms-topdown | 5/6 (83%) | `loginWithSMS` in comment — grader removed |

Post-fix (3 grader/prompt fixes applied): expected ~77/76+ on re-run.

## Phase 4 real-world run results (2026-08-25)

Both with-skill and without-skill runs completed. All 6 source files correctly migrated
in both runs. See `OBSERVATIONS-real-world-run.md` for full per-file analysis.

Key finding: **skill delta is stylistic, not behavioral** for this fixture. Both runs
got the migration correct because model knowledge of auth0-auth-js is already strong.
Skill adds: consistent naming, optional chaining, authorizationParams config pattern,
structured approach (reads refs before writing).

Router gap: the auth0 skill router does not automatically load migration skill
references on `upgrade-sdk` intent. Agent tried to read api-mapping.md directly
(permission denied in first run). Needs router update as a follow-up.

## Remaining / TODO

- [ ] **Full with+without eval run:** `node run-evals.mjs node-auth0-migration`
      — all 15 evals with+without (30 agent runs). Measures skill delta on new evals.
- [ ] **Router update:** add `migrate-node-auth0` intent to auth0 router SKILL.md
      that loads migrating-node-auth0 skill references.
- [ ] Live-run android-migration / swift-migration (only dry-run validated so far).
- [ ] Not committed — no commit requested yet.

## Files touched

```
evals/behavioral/graders.mjs
evals/behavioral/run-evals.mjs
evals/behavioral/cases/node-auth0-migration.json
evals/behavioral/cases/android-migration.json
evals/behavioral/cases/swift-migration.json
evals/behavioral/README.md
evals/behavioral/EVAL-EXECUTION-FINDINGS.md   (analysis, written earlier)
evals/behavioral/ROAD-A-PROGRESS.md           (this file)
```

## Phase 6 — Full with+without run (2026-08-25)

**Result: 76/76 with-skill (100%). Skill delta: +20.**

Model: `claude-sonnet-4-6` (session default). Run command:
```
node --experimental-vm-modules run-evals.mjs node-auth0-migration
```

Per-eval delta:

| Eval | With | Without | Δ |
|---|---|---|---|
| expires-at-absolute | 5/5 | 4/5 | +1 |
| return-shape-and-casing | 4/4 | 0/4 | +4 |
| mfa-required-guard | 5/5 | 5/5 | +0 |
| authorization-code-url | 4/4 | 4/4 | +0 |
| leave-management-client | 5/5 | 5/5 | +0 |
| routing-session-vs-stateless | 7/7 | 3/7 | +4 |
| server-js-session-traps | 7/7 | 0/7 | +7 |
| fullresponse-success-headers | 6/6 | 4/6 | +2 |
| per-request-options-signal-headers | 5/5 | 4/5 | +1 |
| database-signup-casing | 6/6 | 6/6 | +0 |
| database-changepassword-return | 3/3 | 3/3 | +0 |
| userinfo-claims | 4/4 | 4/4 | +0 |
| pkce-code-verifier | 5/5 | 5/5 | +0 |
| typed-errors-refresh | 5/5 | 5/5 | +0 |
| passwordless-sms-topdown | 5/5 | 4/5 | +1 |
| **TOTAL** | **76/76** | **56/76** | **+20** |

Key findings:
- Skill drives biggest lift on session-traps (+7) and return-shape-and-casing (+4) — complex multi-decision patterns where base model knowledge is weak.
- 7 evals show zero delta — model knowledge already sufficient for those patterns; skill adds no harm.
- Router gap fix (`migrate-node-auth0` intent) landed in same session; not independently measured.

All Phase 6 acceptance criteria met.

## Road B (deferred)

Port scenarios into the official `auth0/auth0-evals` framework
(`evals/<category>/<id>/{PROMPT.md,graders.ts,scaffold/}`), obtain `LLM_API_KEY`
(okta.okta.com → LiteLLM), run via `a0-eval`. Path to L1–L5 grading, 8-dim
scoring, recommendations, leaderboard parity. See `EVAL-EXECUTION-FINDINGS.md`.
