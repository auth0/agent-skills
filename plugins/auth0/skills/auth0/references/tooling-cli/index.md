# Auth0 CLI — Tenant Configuration and Command Reference

Use the Auth0 CLI when the project has no Terraform infrastructure and no active
MCP session. This is the default tooling.

Install with: `brew install auth0`

---

## Before You Start: Authenticate

```bash
auth0 login                          # interactive device-code login
auth0 login --no-input               # headless: prints the URL and code, no browser
auth0 login --scopes "read:stats"  # request extra scopes if 403
auth0 login --domain <tenant>.auth0.com --client-id <id> --client-secret "$AUTH0_CLIENT_SECRET"  # CI/CD
```

Machine login (client credentials) is the recommended method for non-interactive
environments and for Private Cloud tenants. `auth0 login` and `auth0 logout` do
not accept output flags. Switch tenants with `auth0 tenants use <domain>`, or
target one command at a time with the global `--tenant` flag.

---

## Agent Mode — Read This Before Adding Output Flags

The CLI has an agent mode that is **auto-enabled when it detects it is being run
by an AI agent**. When it is on, the CLI already:

- prints **JSON** on stdout,
- disables interactive prompts,
- disables colors.

```bash
auth0 --agent-mode ...           # force it on
auth0 --agent-mode=false ...     # force it off for one command
AUTH0_AGENT_MODE=false auth0 ... # force it off via environment
```

Resolution order: an explicit `--agent-mode` flag wins, then the
`AUTH0_AGENT_MODE` environment variable (any Go-parseable bool — `1`, `true`,
`false`), then auto-detection. Detection identifies Claude Code, Cursor, Codex,
Gemini CLI, Antigravity, GitHub Copilot, and the Auth0 MCP server, via an
`AUTH0_CLI_CLIENT` handshake, then a known-env-var allow-list, then a
parent-process walk.

Because agent mode is on by default in an agent session, **do not reflexively
append `--json` to every command.** The output is already JSON, and on the
commands that don't define the flag the extra `--json` makes the command fail
outright.

Agent mode writes its notice banner and section headers to **stderr**, so stdout
stays clean and pipes straight into `jq` — no redirect needed, since stderr
never enters a pipe:

```bash
auth0 apps list | jq -r '.[0].client_id'
```

Pipe stdout as it is. A failing command explains itself on stderr, so `2>&1`
feeds that explanation to `jq` and you get `parse error: Invalid numeric
literal` in place of the reason the command failed.

Don't reflexively add `2>/dev/null`. It buys nothing here and throws away the
error message when a command fails, leaving you with empty output and no reason
why. Add it only to silence an error you actively expect, such as probing an
optional resource that may not exist.

### Destructive commands require `--force` in agent mode

Agent mode disables prompts, so instead of silently deleting, destructive
commands **refuse to run** without `--force`:

```text
This is a destructive command; re-run with --force to proceed without a confirmation prompt.
```

This applies to `delete` and `revoke` across every resource, and to
`auth0 api delete`. Treat the error as a confirmation checkpoint — confirm the
intent, then re-run with `--force`:

```bash
auth0 apps delete <client-id> --force
auth0 api delete "actions/actions/<action-id>" --force
```

### When you still need `--json` explicitly

Add it only when the command runs **outside** an agent session and you need
machine-readable output anyway — a shell script, a CI job, a Makefile. In that
case check the flag exists first (see the next section).

---

## Output Flag Rules

| Situation | What to do |
|-----------|-----------|
| Running as an agent | Nothing. Agent mode already emits JSON. |
| `auth0 api ...` | Never pass `--json`. It returns JSON only and **rejects the flag** with `Unknown flag: --json`. |
| Scripting outside an agent session | Add `--json`, but confirm the command defines it. |
| Piping large output to `jq` | `--json-compact` (defined on most `list`/`show` commands). |
| Spreadsheet / tabular export | `--csv` (defined on many `list`/`search` commands). |
| Any non-interactive run | `--no-input` so the CLI errors instead of prompting. |

Roughly a third of runnable commands define **no** JSON flag at all. These are
the action-style and interactive commands — `delete`, `open`, `revoke`,
`unblock`, `login`, `logout`, plus notable ones agents reach for often:

- `auth0 api` — JSON-only by design
- `auth0 logs tail` — only takes `--filter` and `--number`
- `auth0 users import` — only takes `--connection-name`, `--users`, `--upsert`, `--template`, `--email-results`
- `auth0 roles permissions add` / `remove`
- `auth0 terraform generate`
- `auth0 universal-login customize` / `templates update` / `prompts update`
- `auth0 acul init` / `acul dev` / `acul config set`

When unsure, don't guess — ask the CLI:

```bash
auth0 apps create --help                  # JSON in agent mode: flags, types, defaults, examples
auth0 apps create --help --json           # same JSON when agent mode is off
```

---

## Value Syntax Rules

**List values are comma-joined in one argument.** Space-separating them makes the
extras look like positional args (`Accepts at most 1 arg(s), received 3`):

```bash
auth0 roles permissions add <role-id> --api-id <api-id> --permissions "read:data,write:data"
auth0 apis create --name "My API" --identifier "https://api.example.com" --scopes "read:data,write:data"
```

**Boolean flags need the `=` form.** `--send-email false` reads `false` as a
positional arg, so a default-`true` flag silently stays on. Use `--send-email=false`.

**Don't guess flag names.** `auth0 orgs create` takes `--display`, not
`--display-name`. On `Unknown flag:`, read the real name off `--help`.

---

## Command Discovery — `auth0 commands`

`auth0 commands` prints the entire CLI surface in one place, so the right
command can be found without opening `--help` page by page. Prefer this over
guessing a command name.

```bash
auth0 commands                          # full tree
auth0 commands --flat                   # one runnable command per line — best for intent matching
auth0 commands apps                     # expand only the apps branch
auth0 commands apps create --detailed   # usage, flags, arguments, auth requirement
auth0 commands --depth 1                # top-level resources only
auth0 commands apps --json --detailed   # machine-readable
```

`--detailed` is what lets you construct a valid invocation in one shot: it
includes each command's flags, arguments, and whether it requires
authentication.

```bash
# find every command that mentions organizations
auth0 commands --flat | grep -i organization
```

### Structured `--help`

In agent mode, `--help` returns a JSON object per command rather than prose:
`path`, `name`, `short`, `description`, `usage`, `example`, `runnable`,
`requiresAuth`, and a `flags` array carrying each flag's `name`, `shorthand`,
`usage`, `type`, and `default`. Outside agent mode, combine `--help --json` for
the same output.

Use it to verify a flag before running a command that changes tenant state:

```bash
auth0 apps update --help | jq -r '.[0].flags[].name'
```

---

## Quick Decision Guide

| What you're doing | Command to use |
|-------------------|---------------|
| Discovering which command to run | `auth0 commands --flat` |
| Checking a command's flags | `auth0 <command> --help` |
| Setting up a new project | `auth0 apps create --type spa` (see App types below) |
| Need a client ID or secret | `auth0 apps show <id> -r` |
| Registering a backend API | `auth0 apis create --identifier "https://..."` |
| Authorizing an M2M app for an API | `auth0 client-grants create` |
| Finding a user's ID | `auth0 users search --query "email:..."` |
| Counting or paging all users | `auth0 api get "users?include_totals=true"` |
| Creating/managing roles (RBAC) | `auth0 roles create` / `auth0 users roles assign` |
| Revoking a user's access right now | `auth0 users sessions delete` / `auth0 users refresh-tokens delete` |
| B2B multi-tenancy | `auth0 orgs create` |
| Custom login logic | `auth0 actions create --trigger post-login` |
| Branding the login page | `auth0 ul update --logo ... --accent ...` |
| Custom domain for login | `auth0 domains create --domain "auth.myapp.com"` |
| Debugging a failed login | `auth0 logs tail --filter "type:f"` |
| Testing a login flow | `auth0 test login <client-id>` |
| Getting an access token to test an API | `auth0 test token --audience "https://..."` |
| Exporting config as Terraform | `auth0 terraform generate --output-dir ./terraform` |
| Restricting tenant traffic by IP | `auth0 network-acl create` |
| Streaming tenant events to your system | `auth0 event-streams create` |
| Reading or changing tenant-wide settings | `auth0 tenant-settings show` / `update set` |
| Token exchange / custom auth profiles | `auth0 token-exchange create` |
| Anything with no dedicated command | `auth0 api get <path>` |
| Security hardening | `auth0 protection brute-force-protection update --enabled true` |
| Routing logs externally | `auth0 logs streams create datadog` (one subcommand per provider) |
| Bulk importing users | `auth0 users import --connection-name ...` |

---

## Command Overview

### Apps — Manage Applications

Create or inspect Auth0 applications (client ID, secret, callback URLs, app
type). Alias: `auth0 clients`.

```bash
auth0 apps create --name "My SPA" --type spa \
  --auth-method None \
  --callbacks "http://localhost:3000" \
  --logout-urls "http://localhost:3000" \
  --origins "http://localhost:3000"

auth0 apps list
auth0 apps show <client-id> -r          # -r reveals the client secret
auth0 apps update <client-id> --callbacks "http://localhost:3000,https://myapp.com"
auth0 apps delete <client-id> --force
auth0 apps session-transfer show <client-id>
```

App types: `spa`, `regular`, `m2m`, `native`, `resource_server`

### APIs — Manage API Resources

Register backend APIs (Resource Servers) to protect with Auth0 tokens. Alias:
`auth0 resource-servers`.

```bash
auth0 apis create --name "My API" --identifier "https://api.myapp.com" \
  --scopes "read:data,write:data" --token-lifetime 3600

auth0 apis list
auth0 apis scopes list <api-id>
```

**Key distinction:** `apps` = the client requesting tokens. `apis` = the
resource accepting tokens.

### Client Grants — Authorize M2M Access

Grant an application permission to call an API with specific scopes. This is the
step that makes a `client_credentials` flow work.

```bash
auth0 client-grants create
auth0 client-grants list
auth0 client-grants show <grant-id>
auth0 client-grants update <grant-id>
auth0 client-grants organizations list <grant-id>
```

### Users — Manage Users

Create, search, inspect, import, and manage users in your tenant.

```bash
auth0 users search --query "email:user@example.com"
auth0 users search-by-email user@example.com
auth0 users create --connection-name "Username-Password-Authentication" \
  --email "test@example.com" --password "$USER_PASSWORD"
auth0 users show <user-id>
auth0 users blocks list <email>
auth0 users blocks unblock <email>
auth0 users import --connection-name "Username-Password-Authentication" \
  --users '[...]' --upsert
```

**There is no `auth0 users list`.** `auth0 users search` is the listing command,
and it also accepts no `--query` at all if you just want the first page. It
returns a bare array with no total count, so for a count or for paging use the
raw API:

```bash
auth0 api get "users?per_page=1&include_totals=true" | jq '.total'
auth0 api get "users?per_page=100&page=0&include_totals=true"
```

**Note:** user output carries full profiles (email, metadata) and import
payloads carry password hashes — avoid piping to shared logs/CI output.

### Sessions and Refresh Tokens — Revoke Access

Inspect and revoke a user's live sessions and refresh tokens. Use these when a
user must lose access immediately rather than at token expiry.

```bash
auth0 users sessions list <user-id>
auth0 users sessions delete <user-id>
auth0 users refresh-tokens list <user-id>
auth0 users refresh-tokens delete <user-id>

auth0 sessions show <session-id>
auth0 sessions revoke <session-id>
auth0 refresh-tokens show <token-id>
auth0 refresh-tokens revoke <token-id>
```

### Roles — Manage RBAC Roles

Create roles, assign permissions, and assign roles to users.

```bash
auth0 roles create --name "editor" --description "Can edit content"
auth0 roles permissions add <role-id> --api-id <api-id> --permissions "read:data,write:data"
auth0 users roles assign <user-id> --roles <role-id>
auth0 users roles show <user-id>
```

### Organizations — B2B Multi-Tenancy

Manage organizations for B2B SaaS scenarios. Alias: `auth0 orgs`.

```bash
auth0 orgs create --name "acme-corp" --display "Acme Corporation" \
  --logo "https://acme.com/logo.png" --accent "#FF6600"
auth0 orgs list
auth0 orgs members list <org-id>
auth0 orgs roles list <org-id>
auth0 orgs invitations create --org-id <org-id> --invitee-email "new@acme.com" \
  --inviter-name "Admin" --client-id <id> --roles <role-id> --send-email=false
auth0 orgs invitations list --org-id <org-id>
```

Adding members, assigning org-scoped roles, and enabling a connection on an org
go through `auth0 api`:

```bash
auth0 api post "organizations/<org-id>/members" --data '{"members":["<user-id>"]}'
auth0 api post "organizations/<org-id>/members/<user-id>/roles" --data '{"roles":["<role-id>"]}'
auth0 api post "organizations/<org-id>/enabled_connections" \
  --data '{"connection_id":"<con-id>","assign_membership_on_login":true}'
```

Confirm the current surface with `auth0 commands orgs --detailed` before reaching
for `auth0 api`, since a dedicated subcommand may exist by now. Note that
`--help` on an unrecognized subcommand falls back to the parent command's help
rather than erroring, so `auth0 commands` is the more reliable probe.

Invitations need two prerequisites that each 400; see the organizations feature
reference.

### Actions — Serverless Auth Pipeline

Create and deploy serverless functions at auth pipeline trigger points.

```bash
auth0 actions create --name "Add Claims" --trigger "post-login" \
  --code 'exports.onExecutePostLogin = async (event, api) => { ... }'
auth0 actions deploy <action-id>
auth0 actions diff <action-id>
auth0 actions modules list          # shared code modules reusable across actions
```

Triggers: `post-login`, `credentials-exchange`, `pre-user-registration`,
`post-user-registration`, `post-change-password`, `send-phone-message`

**Important:** You must `deploy` after creating or updating for changes to take
effect.

### Logs — Debugging & Monitoring

```bash
auth0 logs tail --filter "type:f"                 # real-time failed logins
auth0 logs list --filter "type:f" --number 20     # historical
```

Common codes: `s` (success), `f` (failed login), `slo` (logout), `fs` (silent
auth failure)

**Note:** `auth0 logs tail` streams and takes only `--filter` and `--number` —
it has no output flags. Use `auth0 logs list` when you need structured output.

### Event Streams — Push Tenant Events Out

Subscribe an external system to tenant events, then inspect and replay
deliveries.

```bash
auth0 event-streams create
auth0 event-streams list
auth0 event-streams deliveries list <stream-id>
auth0 event-streams stats <stream-id>
auth0 event-streams redeliver <stream-id>
auth0 event-streams subscribe <stream-id>
```

### Network ACLs — Restrict Tenant Traffic

```bash
auth0 network-acl create
auth0 network-acl list
auth0 network-acl show <acl-id>
auth0 network-acl update <acl-id>
```

### Tenant Settings

```bash
auth0 tenant-settings show
auth0 tenant-settings update set <flag>
auth0 tenant-settings update unset <flag>
```

### Token Exchange — Custom Auth Profiles

Configure token exchange profiles for custom authentication and on-behalf-of
flows. Alias: `auth0 te`.

```bash
auth0 token-exchange create
auth0 token-exchange list
auth0 token-exchange show <profile-id>
```

The matching app-side flag is
`auth0 apps create --allow-any-profile-of-type custom_authentication,on_behalf_of_token_exchange`.

### Email and Phone Providers

```bash
auth0 email provider create
auth0 email provider show
auth0 email templates update <template>
auth0 phone provider create
auth0 phone provider list
```

### Domains — Custom Domains

```bash
auth0 domains create --domain "auth.myapp.com" --type "auth0_managed_certs"
auth0 domains verify <domain-id>
```

### Universal Login — Branding

```bash
auth0 ul update --accent "#FF6600" --background "#FFFFFF" \
  --logo "https://myapp.com/logo.png"
```

`auth0 ul customize`, `templates update`, and `prompts update` are interactive
editors and define no output flags.

### Terraform — Export as IaC

```bash
auth0 terraform generate --output-dir ./terraform --resources "auth0_client,auth0_connection"
```

### Test — Verify Login Flows and Tokens

```bash
auth0 test login <client-id>
auth0 test login <client-id> --audience "https://api.myapp.com" --scopes "openid profile email"
auth0 test token --audience "https://api.myapp.com" --scopes "read:data"
```

### Attack Protection — Security Hardening

```bash
auth0 protection brute-force-protection update --enabled true
auth0 protection breached-password-detection update --enabled true
auth0 protection bot-detection update --bot-detection-level medium
auth0 protection suspicious-ip-throttling ips check <ip>
auth0 protection suspicious-ip-throttling ips unblock <ip>
```

### Log Streams — External Routing

```bash
auth0 logs streams create datadog     # subcommand per provider
auth0 logs streams create http        # custom webhook
auth0 logs streams list
```

Supported: `eventbridge`, `eventgrid`, `http`, `datadog`, `splunk`, `sumo`

### Raw API Mode — Direct Management API Access

When a dedicated command doesn't exist, `auth0 api` calls Management API v2
endpoints directly. It **returns JSON already** and accepts **no** output flags
— passing `--json` fails with `Unknown flag: --json`.

```bash
auth0 api get connections
auth0 api post client-grants --data '{"client_id":"...","audience":"...","scope":["read:data"]}'
auth0 api get stats/daily -q "from=20240101" -q "to=20240131"
auth0 api delete "actions/actions/<action-id>" --force
cat data.json | auth0 api post clients      # data can be piped instead of using --data
```

Method defaults to `GET` without data and `POST` with data. If a call returns
403, re-run `auth0 login --scopes "<needed:scope>"`.

**Paths are relative to the API root.** Write `connections`, not
`/api/v2/connections`. The prefixed form returns a flat `404: Not Found` that
reads like a missing resource.

**A 404 on a path you believe exists usually means the wrong verb.** Verbs are
forwarded unvalidated, so an endpoint that doesn't accept the one you sent answers
404 rather than 405. Check the verb and whether the resource is addressable
individually or only as a collection, before assuming a permissions problem. The
[Management API OpenAPI spec](https://auth0.com/docs/oas/management/v2/management-api-oas.json)
is the authoritative answer for which methods a path accepts and what body it
expects.

**Response shapes vary.** Some endpoints return a bare array where the docs show
a wrapper, such as `organizations/<id>/enabled_connections`. On
`jq: Cannot index array with string`, print the raw body before editing the filter.

---

## Piping to `jq`

Agent mode already emits JSON on stdout and keeps its banners on stderr, so
leave stderr alone and pipe stdout:

```bash
auth0 apps list | jq '.[] | {client_id, name}'
auth0 users show <user-id> | jq '{id: .user_id, email: .email}'
auth0 roles list | jq '.[].name'
```

**Never `2>&1` into `jq`.** It folds the agent-mode notice and the
`=== <tenant> applications (3)` header into the JSON stream, and every filter
dies with `parse error: Invalid numeric literal at line 1, column 5`. The error
is about the banner, not the data, so rewriting the filter won't fix it. If a
whole verification block starts returning parse errors, look for `2>&1` first.

Outside an agent session, add the flag explicitly on commands that define it:

```bash
auth0 apps list --json-compact | jq '.[] | {client_id, name}'
```

---

## References

- [Auth0 CLI Documentation](https://auth0.github.io/auth0-cli/)
- [Auth0 Management API v2](https://auth0.com/docs/api/management/v2)
- [Management API OpenAPI spec](https://auth0.com/docs/oas/management/v2/management-api-oas.json) —
  machine-readable source of truth for `auth0 api` paths, accepted methods, and
  request/response shapes. Use it to confirm a verb or payload instead of
  inferring one from a 404.
- [Auth0 Documentation](https://auth0.com/docs)
