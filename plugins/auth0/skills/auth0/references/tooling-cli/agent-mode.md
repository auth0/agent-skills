# Auth0 CLI — Agent Mode Deep Reference

How agent mode works, and how to read the CLI's output and errors. This is the
single source for agent-mode behavior — the main command reference routes here
rather than repeating it, so read this before running commands in an agent
session.

---

## What agent mode is

The CLI has an agent mode that is **auto-enabled when it detects an AI agent is
running it**. When it is on, the CLI:

- prints **JSON** on stdout (adds a trailing newline; streams emit **NDJSON** —
  one compact object per line, never a JSON array),
- disables interactive prompts,
- disables colors,
- keeps **stderr clean** — human banners, section headers, and progress notices
  are suppressed, so on success stderr is empty,
- returns a **JSON error envelope** on stderr when a command fails (below),
- renders `--help` as a **JSON tree** instead of prose.

Force it on or off when auto-detection gets it wrong:

```bash
auth0 --agent-mode ...           # force it on
auth0 --agent-mode=false ...     # force it off for one command
AUTH0_AGENT_MODE=false auth0 ... # force it off via environment
```

Because agent mode is on by default in an agent session, the output is *already*
JSON — **do not reflexively append `--json` to every command.** It is redundant,
and on the action-style commands that don't define the flag it makes the command
fail outright.

**Defaulting is soft.** `--json` is defaulted true *unless* `--json`,
`--json-compact`, or `--csv` was set explicitly; `--no-input` and `--no-color`
default true the same way. An explicit flag always wins, so you can still ask for
CSV or pretty JSON inside an agent session. `--help`, `help`, and a bare namespace
render the JSON help tree.

---

## Authenticating without the keychain (agents, CI, sandboxes)

`auth0 login` persists credentials to the OS keychain and a config file. A
sandbox or CI box often has neither, so set **`AUTH0_CLI_AUTH_MODE=env`** to
authenticate purely from environment variables — nothing is written to disk or
the keychain, and the resolved token is held in memory for that one command:

- `AUTH0_DOMAIN` — the tenant domain (e.g. `tenant.us.auth0.com`), always required.
- `AUTH0_API_TOKEN` — a pre-minted Management API token, **or**
- `AUTH0_CLIENT_ID` + `AUTH0_CLIENT_SECRET` — client credentials the CLI exchanges
  for a token on *every* invocation. For repeated calls, mint one token yourself
  and pass `AUTH0_API_TOKEN` instead.

```bash
AUTH0_CLI_AUTH_MODE=env AUTH0_DOMAIN=tenant.us.auth0.com \
  AUTH0_API_TOKEN="$TOKEN" auth0 apps list
```

The mode is **opt-in on purpose** — the `AUTH0_*` vars are shared with the
Terraform provider and scaffolded sample apps, so their mere presence never
silently replaces a saved login or switches tenants. In this mode the tenant is
fixed by `AUTH0_DOMAIN`; a `--tenant` pointing elsewhere fails rather than
targeting the wrong tenant. An incomplete or malformed configuration fails with
an `auth` error and a `reason` such as `env_auth_incomplete`,
`env_auth_invalid_domain`, `env_auth_tenant_conflict`, or `env_auth_exchange_failed`
— it never falls back to a saved login.

When a normal `auth0 login` can't persist because the keychain is unreadable or
the config isn't writable (a read-only sandbox), the CLI fails with an `auth`
error (`reason: stored_token_unavailable` or `config_not_writable`) that points
you at this env mode.

---

## Destructive commands require `--force`

Agent mode disables prompts, so instead of silently deleting, destructive
commands **refuse to run** without `--force`:

```text
this is a destructive command; re-run with --force to proceed without a confirmation prompt
```

This applies to every `delete` and `revoke` across resources, and to
`auth0 api delete`. Treat the refusal as a confirmation checkpoint — confirm the
intent, then re-run with `--force`:

```bash
auth0 apps delete <client-id> --force
auth0 api delete "actions/actions/<action-id>" --force
```

The refusal is returned **unwrapped** — it surfaces as
`{"error":{"code":"unknown","reason":"unclassified","message":"this is a destructive command; ..."}}`,
so don't key off the class; any `delete` / `revoke` simply needs `--force`.

---

## The JSON error envelope

On **success** a command exits `0`, prints JSON on stdout, and leaves stderr
empty. On **failure** it prints **one compact JSON line to stderr** and exits
non-zero, leaving stdout clean for any partial result:

```json
{"error":{"code":"not_found","reason":"not_found","message":"API request failed: Not Found","status":404}}
```

| Field | Always present | Meaning |
|-------|:---:|---------|
| `error.code` | ✅ | Coarse, **stable failure class** — branch on this (table below) |
| `error.message` | ✅ | Single-line human-readable message |
| `error.reason` | — | Finer, open-ended sub-classification (`flag_parse`, `not_logged_in`, `missing_scopes`, `rate_limited`, `unsupported_in_agent_mode`, …); a hint, not a value to branch on |
| `error.status` | — | HTTP status, when the failure came from the Management API |
| `error.details` | — | Structured extras — a field-level validation array (`[{"field","error"}]`), or `{"suggestions":[...]}` for a mistyped command |

**Classify failures by `error.code`, not the exit code** — exit codes are
collapsed (`0` = success, `130` = interrupted, `1` = *every* other failure), so
the status tells you *that* it failed and the envelope tells you *why*:

| `code` | HTTP / local trigger | What it means → typical fix |
|--------|----------------------|------------------------------|
| `auth` | 401, 403 | not logged in / missing scopes → `auth0 login --scopes "<scope>"` |
| `validation` | 400, 410, 415, 422; bad `--data` body (local) | fix the payload; `--schema` shows the shape |
| `not_found` | 404 | wrong path, id, or **HTTP verb** → check the resource/verb |
| `conflict` | 409 | already exists / state clash → reconcile, then retry |
| `rate_limit` | 429 | back off and retry |
| `api` | ≥ 500 | server error → retry; likely transient |
| `network` | transport/DNS/TLS/timeout, no response | check connectivity, retry |
| `usage` | flag-parse / unknown command (local) | read `--help` |
| `unknown` | anything else | inspect `message` |
| `none` | success | — |

Read data from stdout and the envelope from stderr — **don't merge them.**
`2>&1 | jq` folds the envelope into your data stream on failure; `2>/dev/null`
throws it away and leaves you with empty output and no reason why. Silence stderr
only when probing an optional resource whose absence you expect.

---

## Interactive and browser commands in agent mode

Two behaviors:

**Fail fast** — return a `usage` error with `reason: unsupported_in_agent_mode`
(exit 1). These can't run headlessly:

- `auth0 universal-login customize` — points you to `auth0 acul config` for
  non-interactive advanced rendering.
- `auth0 universal-login templates update`
- `auth0 acul dev` — runs a local dev server + browser preview.

**Emit a URL/result and continue** (do *not* fail):

- Browser-URL openers emit a single-key JSON object: `{"login_url":...}`,
  `{"manage_url":...}`, `{"builder_url":...}`, `{"docs_url":...}`.
- `auth0 login` (device flow) emits `{"verification_uri","user_code","expires_in","interval"}`,
  polls to completion, then `{"logged_in":true,"tenant":...,"domain":...}`, and
  sets the tenant as default. Because it blocks on a human, prefer
  client-credentials login in automation.
- `auth0 test login` emits `{"login_url":...}` and waits for the browser callback
  (bounded by a timeout, so it aborts cleanly instead of hanging).
- `auth0 terraform generate` emits `{"output_dir","status",...}` (with an optional
  `message`) where `status` is one of `generated`, `plan_failed`,
  `terraform_install_failed`, `credentials_missing`.

A token missing required scopes fails fast with a `missing_scopes` auth error
and an `auth0 login --scopes ...` hint rather than dropping into a blocking
device-code flow.

---

## Flag scope

**Global (inherited)** — set once, apply everywhere:
`--tenant`, `--debug`, `--no-input`, `--no-color`, `--agent-mode`.

**Per-command (local)** — only where the command defines them:
`--json`, `--json-compact`, `--csv`, `--force`, `--data`, `--query`, `--schema`,
`--reveal-secrets`. Not every command exposes JSON/CSV — only those that produce
output.

---

## Structured-input flags by resource

`--data` / `--schema` drive `create` / `update`; `--query` / `--schema` drive
`list`. **They are defined only on the commands that manage a Management API
object, not on every command** — this table (or `<command> --help`) says which:

| Resource | `--data` / `--schema` (create/update) | `--query` / `--schema` (list) |
|----------|:---:|:---:|
| `apps`, `apis`, `roles`, `actions`, `connections` | ✅ | ✅ |
| `users` | ✅ | — (its lister is `search`, a Lucene `--query` **string**) |
| `forms` | ✅ (also `import`) | — |
| `orgs`, `client-grants` | — | — |

`connections enabled-clients update` also takes `--data` / `--schema`. A resource
outside the ✅ rows (e.g. `orgs`, `client-grants`) has no structured input — use
its named flags, or fall back to `auth0 api` with `--data @file` as the JSON-body
escape hatch.

Several **configuration commands** accept structured input beyond the classic
resources — custom domains, email templates, universal-login (including prompts),
ACUL config, and log listing among them. Coverage per command varies (an `update`
may take only `--data` / `--schema`, a `list` only `--query` / `--schema`), so
confirm with `<command> --help` rather than assuming.

Two `--query` flags share a name but differ: on a `list` command it's a JSON
object of query params, whereas on `auth0 api` `-q` / `--query` is a repeatable
raw `key=value` URL parameter. Each `-q` value is one parameter and a
comma-separated value stays intact (`-q "fields=a,b,c"` → `fields=a,b,c`);
repeat the flag to send a parameter more than once (`-q from=20240101 -q
to=20240131`). Don't pass a JSON object to `auth0 api -q`.
