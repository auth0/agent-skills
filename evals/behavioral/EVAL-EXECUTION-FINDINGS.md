# Eval execution findings — node-auth0-migration behavioral suite

Date: 2026-08-24. Context: the `node-auth0-migration` behavioral eval scored 0/48
both with- and without-skill, delta +0. This documents why, and separates the
real bugs from the red herrings.

## TL;DR

The 0/48 is a **harness fault, not a skill fault, and not a missing API key**.
The local `evals/behavioral/` runner is a hand-rolled clone of the official
`auth0-evals` framework, and it drops the one contract that framework is built
on: the agent must edit a **scaffold file on disk**, and the graders read that
file. Our runner embeds the code inline in the prompt, ships no scaffold, and
never tells the agent to write a file. The agent answers in prose, writes zero
files, and every grader reads an empty workspace.

## What we run vs what the official framework does

The authoritative framework is `github.com/auth0/auth0-evals` (the `a0-eval`
CLI, a TypeScript monorepo). Its living design doc is "Auth0 Evals - How It
Works" (Confluence page 945949538). Our `evals/behavioral/run-evals.mjs` +
`graders.mjs` are an independent reimplementation. The divergences below are the
root cause.

### Bug 1 (fatal) — no scaffold, no write instruction

The official framework defines every eval as three parts: a `PROMPT.md` (task),
a `scaffold/` (starter code the agent edits — **required for agent mode**), and
`graders.ts` (checks that read the workspace). The agent's universal workflow is
read the scaffold, then `write_file` the complete edited contents.

Our runner instead:

- Embeds the "before" code inline inside the prompt string.
- Writes no scaffold file to the workspace.
- Never instructs the agent to write its answer to a file.

Result: the agent replies with migrated code in its stdout answer, which the
runner captures and discards. `readAllSources()` walks an empty workspace, so
every `contains` grader fails with "not found in any source file," and every
`not_contains` grader is then demoted to FAIL by the empty-workspace guard
("no positive graders passed"). Both symptoms match the transcript exactly.

### Bug 2 — the multi-eval case only ever runs its first scenario

`node-auth0-migration.json` holds 9 evals but a single flat array of 48 graders.
`runCase()` reads `caseObj.evals[0].prompt` (only the first scenario) and runs
all 48 graders against that one workspace. Eight of nine scenarios never
execute; their graders cannot pass by construction.

### Bug 3 — judge graders time out

`gradeJudge()` spawns a nested `claude -p` call with a 60s timeout. Cold judge
calls, run several in sequence, exceed it. The transcript shows repeated
"Command timed out after 60000 milliseconds." When a judge did answer, it saw an
empty file summary (a consequence of Bug 1) and honestly returned VERDICT: NO.

## Red herrings

### "I don't have an Anthropic API key"

Correct that the key is unset, but it is not the blocker, on either path:

- Official path: agents route through the internal proxy `llm.atko.ai` using
  `LLM_API_KEY` (a LiteLLM key minted via okta.okta.com). Direct calls to
  `api.anthropic.com` are never made; CI runners are IP-allowlisted to the proxy
  only. For Claude models the framework sets `ANTHROPIC_BASE_URL=llm.atko.ai/anthropic`
  and drives Claude Code — still no bare Anthropic key.
- Our local path: the `claude` CLI is authed via the logged-in subscription
  session. `claude -p 'say OK'` returns `OK`, exit 0. The runner's
  `claude --version` preflight passes and agent calls work.

Neither path needs `ANTHROPIC_API_KEY`. The Docker notes that inject
`-e ANTHROPIC_API_KEY` describe a third path that does not match how the
framework authenticates.

## Fix plan (Road A — repair the local harness)

Chosen over Road B (port to the official framework) to get fast signal on this
migration skill without external dependencies. Auth already works locally.

1. Move each eval's "before" code out of the prompt and into a per-eval
   `scaffold` map, e.g. `{ "src/refresh.ts": "<before code>" }`.
2. Rewrite each prompt to "Migrate the file `src/<name>.ts` in place."
3. Add a per-eval loop to `runCase()`: each eval gets its own workspace, its own
   scaffold, and its own graders. Keep a legacy fallback (case-level graders +
   `evals[0]`) so single-eval case files stay working.
4. Partition the 48 flat graders into their 9 owning evals (the grader
   descriptions are already prefixed with the scenario id, so this is
   mechanical).
5. Raise the judge timeout from 60s to 180s and allow pinning a fast judge model.

### Road B (deferred)

Port these 9 scenarios into the official `auth0/auth0-evals` layout
(`evals/<category>/<id>/{PROMPT.md,graders.ts,scaffold/}`), obtain an
`LLM_API_KEY`, and run via `a0-eval`. This is the path to L1–L5 grading,
8-dimension scoring, recommendations, and leaderboard parity. Recommended if
these evals are meant to feed the public Agent Experience flywheel.

## References

- Auth0 Evals - How It Works (living source of truth): Confluence 945949538
- Auth0 Evals V1 Engineering Deep Dive: Confluence 758546433
- Auth0 Evals with Hosted MCP (QA scope, env vars): Confluence 898302207
- Evals V1.1 Flywheel Improvements: Confluence 927040690
- Framework repo: github.com/auth0/auth0-evals
