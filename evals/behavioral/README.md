# Behavioral evals — unified `auth0` skill

Two layers of eval guard this skill. This directory is the **behavioral** layer;
the **routing** layer lives in `../routing-cases.json` + `scripts/check_routing_evals.py`.

| Layer | Question | Runs in CI? | Needs a live model? |
|---|---|---|---|
| Routing (`../routing-cases.json`) | Does each intent/framework map to reference files that exist? | ✅ yes | no — deterministic |
| Behavioral (here) | Does the skill make the agent generate **correct SDK code**? | ❌ manual | yes — `claude` CLI |

Behavioral evals drive a real agent and grade the code it writes, so they need
the `claude` CLI and (for cases that configure a tenant) real Auth0 credentials
in the prompt. That's why they're a manually-run suite, not CI.

## History

These consolidate the per-skill `tests/` harnesses that shipped with the ~44
individual skills before the single-skill migration. Each skill carried its own
near-identical ~1,200-line `run-evals.mjs`; that logic now lives once in
`graders.mjs` + `run-evals.mjs`, with one case file per framework/feature under
`cases/`. Each ported case records the `origin_skill` it came from; a case
authored against a reference that never existed as a standalone skill (such as
`my-organization`) sets `origin_skill` to `null`.

## Layout

```
behavioral/
├── run-evals.mjs     # the single runner (drives the agent, reports deltas)
├── graders.mjs       # shared grader engine (contains/matches/judge/...)
├── package.json      # execa dependency
└── cases/
    ├── flask.json        # { slug, origin_skill, evals[], graders[] }
    ├── express-jwt.json
    └── ...               # 20 cases; 14 have machine graders, 6 (branding,
                          # custom-domains, cli, acul, audit, healthcheck) are
                          # expectations-only → manual transcript review
```

## Running

```bash
cd evals/behavioral
npm install            # once, for execa

node run-evals.mjs --list          # show cases
node run-evals.mjs --dry-run       # validate case files + grader regexes (no agent)
node run-evals.mjs                 # run every case
node run-evals.mjs flask express-jwt   # run only named slugs
node run-evals.mjs --model <id>    # pin a model for the agent AND judge graders
node run-evals.mjs --skill-only    # skip the without-skill comparison
```

For each graded case the runner runs the prompt **with the skill** (loads the
`auth0` plugin via `--plugin-dir`, so the router activates and detects the
framework) and **without it**, grades both workspaces, and prints the delta — a
useful skill should score materially higher with the router loaded.

## Adding / updating a case

Edit the JSON under `cases/`. Shape:

```jsonc
{
  "slug": "flask",              // matches the router's framework/feature slug
  "origin_skill": "auth0-flask",
  "evals": [{ "prompt": "...", "expectations": ["..."] }],
  "graders": [                  // omit (or null) for a manual-review case
    { "type": "matches", "pattern": "ServerClient", "description": "SDK initialized" },
    { "type": "not_contains_any", "values": ["Authlib", "python-jose"], "description": "no wrong lib" },
    { "type": "judge", "question": "Does the code ...?", "examples": "PASS: ...\nFAIL: ..." }
  ],
  "scaffold": {                 // optional — seed files so Tier 1/2 detection fires
    "package.json": "{ \"dependencies\": { \"@auth0/nextjs-auth0\": \"^4.0.0\" } }"
  }
}
```

Grader types: `contains`, `contains_any`, `not_contains`, `not_contains_any`,
`matches` (regex), `not_matches` (regex must be absent), `file_contains`
(`file_pattern` glob + `value`), `all` (composite), `judge` (LLM YES/NO).

Notes on the negative graders:

- Prefer **`not_matches`** over `not_contains` when a bare substring would
  false-positive. E.g. asserting the deprecated `express-jwt` package is absent:
  a plain `not_contains` for `"express-jwt"` also fires on the *correct* package
  `express-oauth2-jwt-bearer` (via its dep graph) and on natural project names
  like `express-jwt-api`. A regex like `["']express-jwt["']` (dep key / import
  target only) avoids that.
- **Generated lockfiles** (`package-lock.json`, `Podfile.lock`, `*.lock`, …) are
  excluded from the source scan entirely — they pin the full transitive graph,
  so substrings there don't reflect the authored code.
- `not_contains*` / `not_matches` graders are auto-invalidated if no positive
  grader passed, so an empty workspace can't score by writing nothing.

The `judge` grader asks a live model for a `VERDICT: YES/NO` (parsed from the
end of the reply, so a judge that reasons before concluding is read correctly).

Don't hardcode a specific SDK version in a grader — the references deliberately
teach "use the current version," so a `"^1.7.4"`-style pin tests removed advice
and rots on every release. Match "a version is present" only if you must.

### Why the tenant-workflow cases have no machine graders

`audit` and `healthcheck` are expectations-only because they **can't run
unattended**: both need `auth0 login` against a real tenant plus a live CheckMate
scan, so they mutate real infrastructure and consume Management API rate limit
rather than working in a temp dir. Grade them by reading the transcript against the
`assertions` list.

The pre-migration `auth0-checkmate` and `auth0-healthcheck-all-plans` skills each
carried a `tests/graders.json`, but neither was ever executable: those skills
shipped no `run-evals.mjs` (only 5 of the ~44 skills did), and no `prompt.md` /
`benchmark-config.json`, which the old runner required. Their grader sets also
failed that runner's own validation gate, which demanded `contains`,
`not_contains` and `judge` graders — checkmate had no `judge`, and every one of
healthcheck's eight was a bare `matches`. So nothing was regressed by not porting
them; there was no passing baseline to preserve.

Two things to fix first if you do port them:

- The workspace scan won't see the deliverable by default. Reports land in
  `$HOME/Documents/auth0_checkmate_reports` and state in `~/.auth0-checkmate/state/`,
  both outside `workspaceDir`, and `.md` is not in `SOURCE_EXTENSIONS` — so the
  markdown brief is invisible even when the path lines up. With no positive grader
  passing, the empty-workspace guard then demotes every `not_contains` to FAIL.
  Either have the eval prompt write the report into the cwd (grading the `.html`
  copy works today) or teach the engine about the artifact directory and `.md`.
- Two of the original audit graders fail a *spec-correct* run. `not_contains:
  "fit score"` false-positives on the legitimate `a4aa_fit_score` and "Capability
  Fit Score" the report is supposed to contain — use `not_matches` on
  `sales fit score|firmographic` instead. And `matches: "<tenant_domain>|..."` is
  backwards: it asserts placeholder tokens are still present, while the audit
  reference's own final lint requires zero placeholders remain, so it only passes
  when the skill misbehaves. Drop it.
