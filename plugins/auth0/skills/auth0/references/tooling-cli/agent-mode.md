# Auth0 CLI — Agent Mode Deep Reference

Read this when you need to classify a failure precisely or understand exactly
what agent mode changes; for everyday use, the main CLI command reference is
enough.

---

## The JSON error envelope

Every failure in JSON/agent mode prints **one compact JSON line to stderr** and
exits non-zero. stdout is left clean for any partial result.

```json
{"error":{"code":"...","reason":"...","message":"...","status":404,"details":{...}}}
```

| Field | Always present | Meaning |
|-------|:---:|---------|
| `error.code` | ✅ | Coarse, **stable failure class** (table below) |
| `error.message` | ✅ | Single-line human-readable message |
| `error.reason` | — | Finer sub-classification; may grow over time |
| `error.status` | — | HTTP status, when the failure came from the Management API |
| `error.details` | — | Structured extras: field-level validation errors, or `{"suggestions":[...]}` for a mistyped command |

### Failure classes (`error.code`)

The complete set: `none`, `usage`, `auth`, `validation`, `not_found`,
`conflict`, `rate_limit`, `api`, `network`, `unknown`.

HTTP status → class mapping:

| HTTP | `code` |
|------|--------|
| 401, 403 | `auth` |
| 400, 410, 415, 422 | `validation` |
| 404 | `not_found` |
| 409 | `conflict` |
| 429 | `rate_limit` |
| ≥ 500 | `api` |
| (transport/DNS/TLS/timeout, no response) | `network` |
| anything else | `unknown` |

Local (pre-request) failures are also classified: a flag-parse or unknown-command
error is `usage`; a bad `--data` body is `validation`.

### `reason` values

`reason` is a finer, open-ended sub-classification — e.g. `flag_parse`,
`not_logged_in`, `missing_scopes`, `invalid_request`, `rate_limited`,
`unsupported_in_agent_mode`. The set grows over time, so **match on `code` for
stable logic and treat `reason` as a hint**, not a value to branch on.

### Detecting success vs failure

- **Exit code is the primary signal**, but it's collapsed: `0` = success,
  `130` = interrupted (Ctrl-C), `1` = **every** other failure. The class is *not*
  in the exit code — read `error.code`.
- On **success**, stderr is empty. On **failure**, stderr holds exactly one JSON
  line whose reserved `error` key discriminates it, so even a merged stream stays
  parseable — but prefer reading stdout and stderr separately.

### Examples

```json
{"error":{"code":"usage","reason":"flag_parse","message":"unknown flag: --foo"}}
{"error":{"code":"not_found","reason":"not_found","message":"API request failed: Not Found","status":404}}
{"error":{"code":"validation","reason":"invalid_request","message":"schema validation failed:\n1. ...","details":[{"field":"...","error":"..."}],"status":400}}
{"error":{"code":"usage","reason":"...","message":"unknown command \"lst\" for \"auth0 actions\"","details":{"suggestions":["list"]}}}
```

**Gotcha:** the destructive-command refusal is returned unwrapped, so it surfaces
as `{"error":{"code":"unknown","reason":"unclassified","message":"this is a destructive command; re-run with --force to proceed without a confirmation prompt"}}`.
Don't key off the class here — any `delete`/`revoke` needs `--force` in agent mode.

---

## What agent mode changes

The everyday CLI reference lists the observable effects. What that summary
doesn't spell out — the mechanics and edge cases:

- **Defaulted, not forced.** `--json` is defaulted true *unless* `--json`,
  `--json-compact`, or `--csv` was set explicitly; `--no-input` and `--no-color`
  are defaulted true the same way. An explicit flag always wins, so you can still
  ask for CSV or pretty JSON inside an agent session.
- **Stream shape.** JSON stdout gets a trailing newline; streaming commands (e.g.
  `auth0 logs tail`) emit **NDJSON** — one compact object per line, never an array.
- **JSON help.** `--help`, `help`, and a bare namespace render a machine-readable
  JSON help tree instead of prose.
- **Failures and interactive commands.** Failures print the JSON error envelope
  above to stderr; interactive/browser commands fail fast or emit a URL (below).

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
  sets the tenant as default.
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
output. (`auth0 api` has `--json`/`--json-compact` but no `--csv`.)

---

## Structured-input flags by resource

Three flags let an agent drive a resource with JSON instead of hand-building every
named flag — the reliable path when a body is large or nested. **They are defined
only on the top-level resource commands that manage a Management API object, not
on every command**, so check this table (or `<command> --help`) before assuming a
resource takes them:

- `--data` — the JSON body for `create` / `update`. Accepts inline JSON, `@file`,
  or stdin.
- `--schema` — prints the JSON schema for that command's body, so you can see the
  exact shape before writing `--data`.
- `--query` — a JSON **object** of query parameters for a `list` command.

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

Two `--query` flags share a name but differ: on a `list` command it's a JSON
object of query params, whereas on `auth0 api` `-q`/`--query` is a repeatable raw
`key=value` URL parameter (`-q from=20240101 -q to=20240131`). Don't pass a JSON
object to `auth0 api -q`.
