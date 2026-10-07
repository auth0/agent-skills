# Auth0 CLI — Tenant Configuration and Command Reference

Use the Auth0 CLI when the project has no Terraform infrastructure and no active
MCP session. This is the default tooling.

Install with: `brew install auth0`. This reference assumes a recent release
(**v1.37.0 or newer**) with agent mode, the JSON error envelope, native resource
commands, and the `--schema`/`--data`/`--query` structured-input flags; run
`auth0 --version` to check, and prefer `auth0 commands` / `--help` (both
machine-readable in agent mode) over this page for the exact current flags.

## Contents

- [Before You Start: Authenticate](#before-you-start-authenticate)
- [Structured Input and Output: `--schema` / `--data` / `--query`](#structured-input-and-output---schema----data----query)
- [Output Flag Rules](#output-flag-rules)
- [Value Syntax Rules](#value-syntax-rules)
- [Command Discovery — `auth0 commands`](#command-discovery--auth0-commands)
- [Quick Decision Guide](#quick-decision-guide)
- [Command Overview](#command-overview)
- [Piping to `jq`](#piping-to-jq)

**Agent mode, output, and error handling live in one place.** How agent mode is
enabled and forced and everything it changes, keychain-less env authentication
for sandboxes and CI, the JSON error envelope and failure-class reference,
destructive-command `--force` handling, interactive and browser-command behavior,
and the rules for reading stdout vs stderr are all in
`references/tooling-cli/agent-mode.md` — read it before running commands in an
agent session.

---

## Before You Start: Authenticate

```bash
auth0 login                          # interactive device-code login
auth0 login --no-input               # headless: prints the URL and code, no browser
auth0 login --scopes "read:stats"  # request extra scopes if 403
auth0 login --domain <tenant>.auth0.com --client-id <id> --client-secret "$AUTH0_CLIENT_SECRET"  # CI/CD
```

Machine login (client credentials) is the recommended method for non-interactive
environments and for Private Cloud tenants — it needs no browser and, unlike the
device flow, doesn't block on a human. Switch tenants with
`auth0 tenants use <domain>`, or target one command at a time with the global
`--tenant` flag. `auth0 login` and `auth0 logout` take no output flags.

In a sandbox or CI box with no OS keychain and no writable config, don't use
`auth0 login` at all — authenticate from environment variables by setting
`AUTH0_CLI_AUTH_MODE=env`, which persists nothing to disk. See the env-auth
section of
[`agent-mode.md`](agent-mode.md#authenticating-without-the-keychain-agents-ci-sandboxes).

---

## Structured Input and Output: `--schema` / `--data` / `--query`

A machine-first way to drive the native resource commands, so you rarely have to
drop to raw `auth0 api` or hand-build long flag lists. `--data` and `--schema`
drive `create` / `update`; `--query` and `--schema` drive `list`.

**Not every command defines these** — coverage is per-command. For the exact
resource-by-resource matrix, see
[`agent-mode.md`](agent-mode.md#structured-input-flags-by-resource); when unsure,
check `<command> --help`.

**`--schema`** prints the request payload schema for a command and exits. Use it
to construct a valid body without guessing field names:

```bash
auth0 apps create --schema          # the request schema (JSON in agent mode)
```

**`--data`** submits a full JSON body — inline, from `@file`, from `@-`/stdin, or
piped. It is validated **locally** against the embedded OpenAPI schema *before*
the API call, and field-level errors come back in the envelope's `details`. It
bypasses the command's required-flag checks, so you don't also need `--name`:

```bash
auth0 apps create --data '{"name":"My SPA","app_type":"spa"}'
auth0 apps update <client-id> --data @patch.json
cat body.json | auth0 apis create --data @-
```

If a command has no local schema, the body is sent unvalidated (a warning is
emitted, but it's suppressed in agent mode); malformed JSON is still rejected
locally.

**`--query`** filters `list` output. It takes a **JSON object of Management API
query parameters** (not a raw Lucene string on the flag — though you can pass
`{"q":"...","search_engine":"v3"}` inside it). Arrays become repeated params;
numbers keep their literal form:

```bash
auth0 apis list --query '{"identifiers":["https://my-api"]}'
auth0 apps list --query '{"app_type":["spa","native"],"include_totals":true}' --json-compact
```

A single `--query` fetches one page; add `"include_totals":true` to learn the
total count. (`--csv` is rejected with `--query` — the response has no fixed
columns; use `--json` or `--json-compact`.)

`auth0 actions diff` additionally takes `--version1` / `--version2` to compare two
deployed versions by number:

```bash
auth0 actions diff <action-id> --version1 2 --version2 3
```

---

## Output Flag Rules

| Situation | What to do |
|-----------|-----------|
| Running as an agent | Nothing. Agent mode already emits JSON. |
| `auth0 api ...` | Output is already JSON; `--json`/`--json-compact` are accepted (no `--csv`) but redundant in agent mode. |
| Scripting outside an agent session | Add `--json`, but confirm the command defines it. |
| Piping large output to `jq` | `--json-compact` (defined on most `list`/`show` commands). |
| Spreadsheet / tabular export | `--csv` (defined on many `list`/`search` commands; not on `auth0 api`). |
| Any non-interactive run | `--no-input` so the CLI errors instead of prompting. |

Some runnable commands define **no** JSON flag at all — the action-style and
interactive ones: `delete`, `open`, `revoke`, `unblock`, `login`, `logout`, plus:

- `auth0 logs tail` — only takes `--filter` and `--number` (streams NDJSON in agent mode)
- `auth0 users import` — only `--connection-name`, `--users`, `--upsert`, `--template`, `--email-results`
- `auth0 roles permissions add` / `remove`
- `auth0 terraform generate` — prints a JSON result in agent mode
- `auth0 universal-login customize` / `templates update` — interactive editors
- `auth0 acul init` / `acul dev`

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

In agent mode, `--help` returns a JSON object per command rather than prose —
its usage and examples, whether it's runnable and needs auth, and a `flags` array
(each flag's name, type, and default). Outside agent mode, combine `--help --json`
for the same output.

```bash
auth0 apps update --help | jq -r '.[0].flags[].name'
```

---

## Quick Decision Guide

| What you're doing | Command to use |
|-------------------|---------------|
| Discovering which command to run | `auth0 commands --flat` |
| Checking a command's flags | `auth0 <command> --help` |
| Looking up Auth0 documentation | `auth0 docs search "<term>"` |
| Building a request body without guessing fields | `auth0 apps create --schema` (only on resources that support it — see Structured Input) |
| **Integrating an app with Auth0 (add login/API)** | **`auth0 qs setup`** — auto-detects the framework, creates the app/API, writes config |
| Setting up a new project | `auth0 apps create --type spa` (see App types below) |
| Scaffolding an app + API for a framework | `auth0 quickstarts setup --app --framework <fw>` |
| Need a client ID or secret | `auth0 apps show <id> -r` |
| Registering a backend API | `auth0 apis create --identifier "https://..."` |
| Authorizing an M2M app for an API | `auth0 client-grants create` |
| Managing a DB / social / enterprise connection | `auth0 connections create` / `list` / `enabled-clients update` |
| Configuring MFA factors or the MFA policy | `auth0 guardian factors ...` / `guardian policies set` |
| Finding a user's ID | `auth0 users search --query "email:..."` |
| Counting or paging all users | `auth0 api get "users?include_totals=true"` |
| Creating/managing roles (RBAC) | `auth0 roles create` / `auth0 users roles assign` |
| Revoking a user's access right now | `auth0 users sessions delete` / `auth0 users refresh-tokens delete` |
| B2B multi-tenancy | `auth0 orgs create` |
| Custom login logic | `auth0 actions create --trigger post-login` |
| Reusable code shared across actions | `auth0 actions modules create` + `--module` |
| Multi-step self-service journeys | `auth0 forms` / `auth0 flows` |
| Branding the login page | `auth0 ul update --logo ... --accent ...` |
| Custom domain for login | `auth0 domains create --domain "auth.myapp.com"` |
| Debugging a failed login | `auth0 logs tail --filter "type:f"` |
| Testing a login flow | `auth0 test login <client-id>` |
| Getting an access token to test an API | `auth0 test token --audience "https://..."` |
| Exporting config as Terraform | `auth0 terraform generate --output-dir ./terraform` |
| Restricting tenant traffic by IP | `auth0 network-acl create --rule '{...}'` |
| Streaming tenant events to your system | `auth0 event-streams create` |
| Reading or changing tenant-wide settings | `auth0 tenant-settings show` / `update set` |
| Token exchange / custom auth profiles | `auth0 token-exchange create` |
| Anything with no dedicated command | `auth0 api get <path>` |
| Security hardening | `auth0 protection brute-force-protection update --enabled true` |
| Routing logs externally | `auth0 logs streams create datadog` (one subcommand per provider) |
| Bulk importing users | `auth0 users import --connection-name ...` |
| Installing this Auth0 skill into a coding assistant | `auth0 agent skills install` |

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
  --origins "http://localhost:3000" \
  --web-origins "http://localhost:3000"

auth0 apps show <client-id> -r          # -r reveals the client secret
```

`--origins` sets `allowed_origins` (CORS) and `--web-origins` sets `web_origins`
(silent authentication and cross-origin auth). They are separate fields, and a
SPA needs `--web-origins` for `getTokenSilently()` to work. Passing only
`--origins` succeeds without error but leaves `web_origins` empty.

App types: `spa`, `regular`, `m2m`, `native`, `resource_server`.

**Session transfer** (native-to-web SSO) lives under `apps session-transfer`
(`show` / `update`); run `auth0 apps session-transfer update --help` for its flags.

**Organization behavior** for a B2B app is set on `create` / `update` with
`--organization-usage`, `--organization-require-behavior`, and
`--organization-discovery-methods`.

### APIs — Manage API Resources

Register backend APIs (Resource Servers) to protect with Auth0 tokens. Alias:
`auth0 resource-servers`.

```bash
auth0 apis create --name "My API" --identifier "https://api.myapp.com" \
  --scopes "read:data,write:data" --token-lifetime 3600 \
  --enforce-policies --token-dialect access_token_authz

auth0 apis list --query '{"identifiers":["https://api.myapp.com"]}'
```

`--token-dialect` is one of `access_token`, `access_token_authz`,
`rfc9068_profile`, `rfc9068_profile_authz`.

**Key distinction:** `apps` = the client requesting tokens. `apis` = the
resource accepting tokens.

### Client Grants — Authorize M2M Access

Grant an application permission to call an API with specific scopes. This is the
step that makes a `client_credentials` flow work.

```bash
auth0 client-grants create --client-id <client-id> --audience <api-identifier> \
  --scopes "read:data,write:data"
```

### Connections — Identity Sources

Manage connections (database, social, enterprise) natively, without `auth0 api`.
A connection is *which* login methods a tenant offers; `enabled-clients` controls
which applications may use each connection.

```bash
auth0 connections create --data '{"name":"my-db","strategy":"auth0"}'
auth0 connections update <connection-id> --data @patch.json
auth0 connections enabled-clients update <connection-id> \
  --data '[{"client_id":"<id>","status":true}]'
```

Strategies include `auth0` (database), `google-oauth2`, `samlp`, `oidc`, `waad`,
`ad`, `oauth2`, and more.

#### Enabling passkeys on a database connection

Passkeys are a **connection authentication method**, configured under the
connection's `options` — enable the method, then tune `passkey_options`. (This
is distinct from Guardian WebAuthn, which is an MFA factor, not a connection
method.) `--data` on `connections update` replaces `options` **wholesale**, so
read the connection first (`auth0 api get connections/<id>`) and merge your
changes into its existing `options` rather than sending a bare object.

| `options.*` field | Type | Values | Default | Set it when |
|---|---|---|---|---|
| `authentication_methods.passkey.enabled` | boolean | `true` / `false` | — | always — this is what turns passkeys on for the connection |
| `passkey_options.progressive_enrollment_enabled` | boolean | `true` / `false` | `true` | task explicitly asks for or against enrollment nudging — default is `true` (nudge is on); omit when the task is silent about it |
| `passkey_options.local_enrollment_enabled` | boolean | `true` / `false` | `true` | **only when explicitly asked** — default is `true`; omit unless the task explicitly asks to control local/cross-device enrollment |
| `passkey_options.challenge_ui` | string | `both` / `autofill` / `button` | — | choosing how the passkey prompt is surfaced at login |

**Set only the fields the task calls for.** `progressive_enrollment_enabled`
and `local_enrollment_enabled` both already default to `true`, so setting either
of them to `true` unprompted is redundant config churn — omit both unless the
task explicitly asks to change enrollment behavior.

```bash
# Read the connection first, then merge only the passkey fields the task requires.
# auth0 api get connections/<id>
auth0 connections update <connection-id> \
  --data '{"options":{"authentication_methods":{"passkey":{"enabled":true}}}}'
```

### Users — Manage Users

Create, search, inspect, import, and manage users in your tenant.

```bash
auth0 users search --query "email:user@example.com"
auth0 users search-by-email user@example.com
auth0 users create --connection-name "Username-Password-Authentication" \
  --email "test@example.com" --password "$USER_PASSWORD"
auth0 users create --data '{"connection":"Username-Password-Authentication","email":"test@example.com"}'
auth0 users blocks unblock <email>
auth0 users import --connection-name "Username-Password-Authentication" \
  --users '[...]' --upsert
```

**There is no `auth0 users list`.** `auth0 users search` is the listing command;
its `--query` is a Lucene query **string** (e.g. `email:user@example.com`), not
the JSON-object `--query` that structured `list` commands take, and it's optional
— omit it for the first page. `search` returns a bare array with no total count,
so for a count or for paging use the raw API:

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
auth0 users sessions delete <user-id>          # deletes ALL of the user's sessions
auth0 users refresh-tokens delete <user-id>    # deletes ALL of the user's refresh tokens
auth0 sessions revoke <session-id>             # revoke one; refresh-tokens revoke <token-id> likewise
```

### Roles — Manage RBAC Roles

Create roles, assign permissions, and assign roles to users.

```bash
auth0 roles create --name "editor" --description "Can edit content"
auth0 roles permissions add <role-id> --api-id <api-id> --permissions "read:data,write:data"
auth0 users roles assign <user-id> --roles <role-id>
```

### Guardian — Multi-Factor Authentication

Manage the tenant MFA policy, enrollment tickets, and factor providers natively.
Alias: `auth0 mfa`.

```bash
auth0 guardian policies set --policy all-applications     # or: confidence-score, or --none
auth0 guardian factors list
auth0 guardian factors set                                # enable/disable a factor
auth0 guardian enrollments create-ticket --user-id "auth0|123" \
  --factor push-notification --send-email
```

Factor provider trees exist under `factors phone`, `factors sms` (legacy),
`factors push`, and `factors duo`.

### Organizations — B2B Multi-Tenancy

Manage organizations for B2B SaaS scenarios. Alias: `auth0 orgs`.

```bash
auth0 orgs create --name "acme-corp" --display "Acme Corporation" \
  --logo "https://acme.com/logo.png" --accent "#FF6600"
auth0 orgs invitations create --org-id <org-id> --invitee-email "new@acme.com" \
  --inviter-name "Admin" --client-id <id> --roles <role-id> --send-email=false
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
for `auth0 api`, in case a dedicated subcommand exists. Note that `--help` on an
unrecognized subcommand falls back to the parent command's help rather than
erroring, so `auth0 commands` is the more reliable probe. (`orgs` defines no
`--data` / `--schema` / `--query` — use its named flags or `auth0 api`.)

Invitations need two prerequisites that each 400; see the organizations feature
reference.

### Actions — Serverless Auth Pipeline

Create and deploy serverless functions at auth pipeline trigger points.

```bash
auth0 actions create --name "Add Claims" --trigger "post-login" \
  --code 'exports.onExecutePostLogin = async (event, api) => { ... }'
auth0 actions create --data '{"name":"Add Claims","supported_triggers":[{"id":"post-login","version":"v3"}]}'
auth0 actions deploy <action-id>
auth0 actions diff <action-id> --version1 2 --version2 3
auth0 actions list --query '{"triggerId":"post-login"}'
```

Triggers: `post-login`, `credentials-exchange`, `pre-user-registration`,
`post-user-registration`, `post-change-password`, `send-phone-message`,
`custom-token-exchange`.

**Important:** You must `deploy` after creating or updating for changes to take
effect.

**Action modules** are reusable code libraries actions can import:

```bash
auth0 actions modules create
auth0 actions modules versions publish <module-id>       # then rollback <module-id> to revert
# attach a module to an action (both UUIDs required, flag repeatable):
auth0 actions create --name a --trigger post-login \
  --module "module_id=<uuid>,module_version_id=<uuid>"
```

### Forms and Flows — Self-Service Journeys

`auth0 forms` manages hosted forms (e.g. signup surveys, profile completion);
`auth0 flows` orchestrates multi-step journeys, with executions and a credential
vault.

```bash
auth0 forms create --name "Signup Survey"
auth0 forms create --data @form.json
auth0 forms import --data @form.json

auth0 flows create --name "My Flow" --actions-file ./flow.json
auth0 flows executions list <flow-id>
auth0 flows vault connections create
```

### Logs — Debugging & Monitoring

```bash
auth0 logs tail --filter "type:f"                 # real-time failed logins (NDJSON in agent mode)
auth0 logs list --filter "type:f" --number 20     # historical
```

Common codes: `s` (success), `f` (failed login), `slo` (logout), `fs` (silent
auth failure).

**Note:** `auth0 logs tail` streams and takes only `--filter` and `--number` —
it has no output flags. Use `auth0 logs list` when you need paged, structured
output.

### Event Streams — Push Tenant Events Out

Subscribe an external system to tenant events, then inspect and replay
deliveries.

```bash
auth0 event-streams create
auth0 event-streams deliveries list <stream-id>
auth0 event-streams redeliver <stream-id>
```

### Network ACLs — Restrict Tenant Traffic

A rule is supplied as a single `--rule` JSON object combining an `action`, a
`scope`, and a match construct.

```bash
auth0 network-acl create -d "Deny all" -p 7 --active true \
  --rule '{"action":{"block":true},"scope":"tenant","match_all":true}'
auth0 network-acl update <acl-id> --rule '{...}'
```

`match_all` blocks/redirects all traffic in scope. (The `http_message_signature`
signal and `auth0_managed` curated blocklists inside a rule are Early Access.)

### Tenant Settings

```bash
auth0 tenant-settings show
auth0 tenant-settings update set <flag>       # e.g. client_id_metadata_document_supported
auth0 tenant-settings update unset <flag>
```

### Token Exchange — Custom Auth Profiles

Configure token exchange profiles for custom authentication and on-behalf-of
flows. Alias: `auth0 te`.

```bash
auth0 token-exchange create
```

The matching app-side flag enables the profile types on an app:

```bash
auth0 apps create --allow-any-profile-of-type custom_authentication,on_behalf_of_token_exchange
```

### Email and Phone Providers

```bash
auth0 email provider create                 # show / update likewise
auth0 email templates update <template>
auth0 phone provider create
```

### Domains — Custom Domains

```bash
auth0 domains create --domain "auth.myapp.com" --type "auth0_managed_certs"
auth0 domains verify <domain-id>
auth0 domains default set <domain-id>       # pick the tenant's default custom domain
```

### Universal Login — Branding

```bash
auth0 ul update --accent "#FF6600" --background "#FFFFFF" \
  --logo "https://myapp.com/logo.png"
auth0 ul update --data @branding.json           # or drive it with a JSON body
```

`auth0 ul update` and `auth0 ul prompts update` are non-interactive and take
`--data` / `--schema`. `auth0 ul customize` and `templates update` are
interactive editors that fail fast in agent mode (see agent-mode.md); for
non-interactive advanced rendering (ACUL), use `auth0 acul config ...`.

### Test — Verify Login Flows and Tokens

```bash
auth0 test login <client-id> --audience "https://api.myapp.com" --scopes "openid profile email"
auth0 test token --audience "https://api.myapp.com" --scopes "read:data"
auth0 test token <client-id> --audience "https://api.myapp.com" --organization <org-id>   # M2M for an org
```

In agent mode `test login` prints `{"login_url":"..."}` and waits for the browser
callback rather than opening a browser.

### Quickstarts — Integrate an App with Auth0

**`auth0 qs setup` (alias for `auth0 quickstarts setup`) is the fastest way to
wire a project up to Auth0** — reach for it whenever someone wants to "add Auth0"
or "add login" to an app rather than hand-creating a client and copying values.
It auto-detects the project's framework, creates the matching Auth0 application
and/or API, and writes the config file the SDK reads (`.env` and framework
equivalents) with the tenant domain, client ID, and — when an API is created —
its audience already filled in.

Three workflows:

```bash
# App only — auto-detects the framework in the current directory:
auth0 qs setup --app --type spa --framework react --build-tool vite --port 5173

# API + a new app to call it:
auth0 qs setup --api --app --type regular --framework express --identifier "https://my-api"

# API linked to an existing app (skips app creation):
auth0 qs setup --api --linked-app-id <client-id> \
  --identifier "https://my-api" --scopes "read:data,write:data"
```

Run it with no flags for a guided setup; `--app` / `--api` choose what to create,
and at least one is required in `--no-input`/agent mode. `--type` is `spa`,
`regular`, `native`, or `m2m`; other useful flags are `--name`, `--port`, and
`--callback-url` / `--logout-url` / `--web-origin-url` (app), plus `--identifier`,
`--scopes`, `--signing-alg`, `--token-lifetime`, and `--offline-access` (API).
Framework/build-tool coverage includes React, Vue, Next.js, Express, Fastify,
JHipster, and Vite/Webpack/CRA. `auth0 qs download` and `auth0 qs list` remain for
fetching sample apps.

### Attack Protection — Security Hardening

```bash
auth0 protection brute-force-protection update --enabled true
auth0 protection breached-password-detection update --enabled true
auth0 protection bot-detection update --bot-detection-level medium
auth0 protection suspicious-ip-throttling ips unblock <ip>
```

### Log Streams — External Routing

```bash
auth0 logs streams create datadog     # subcommand per provider
auth0 logs streams create http        # custom webhook
```

Supported: `eventbridge`, `eventgrid`, `http`, `datadog`, `splunk`, `sumo`.

### Terraform — Export as IaC

```bash
auth0 terraform generate --output-dir ./terraform \
  --resources "auth0_client,auth0_connection"
```

Alias: `auth0 tf generate`. With no `--resources`, it exports **many resource
types**, not just clients and connections — applications, connections, actions,
flows, forms, Guardian, network ACLs, branding, phone/email templates,
token-exchange profiles, prompt screens, and more (e.g. `auth0_flow`, `auth0_form`,
`auth0_guardian`, `auth0_network_acl`, `auth0_branding_theme`,
`auth0_token_exchange_profile`, `auth0_prompt_screen_partial`). Run
`auth0 terraform generate --help` for the complete list. CIMD clients are emitted
automatically as `auth0_client_cimd` when generating `auth0_client`; you don't
pass that name to `--resources`. In agent mode this command prints a JSON result
instead of progress text — see
[`agent-mode.md`](agent-mode.md#interactive-and-browser-commands-in-agent-mode).

### Agent Skills — Install This Skill Elsewhere

```bash
auth0 agent skills install                          # prompts; or --agent claude-code,cursor / --agent all --force
```

Installs the Auth0 skill into AI coding assistants (via `npx skills@...`; needs
Node.js).

### Docs — Search Auth0 Documentation

Look up official Auth0 documentation from the terminal without leaving the
session. Alias: `auth0 docs find`.

```bash
auth0 docs search "custom domains"
auth0 docs search "refresh token" --json
auth0 docs search rules --json-compact | jq '.[] | {title, url}'
```

Each result carries a `title`, `type`, `url`, `snippet`, and `score`. In agent
mode the `url` is the page's raw-markdown source, so you can fetch it directly;
`--open` (open a result in a browser) is rejected in agent mode — search without
it and read a result's `url`.

### Raw API Mode — Direct Management API Access

When a dedicated command doesn't exist, `auth0 api` calls Management API v2
endpoints directly. The response body is **always JSON**; the flag list
includes `--json` (pretty) and `--json-compact`, though in agent mode the output
is already JSON so you rarely need them. There is **no `--csv`**.

```bash
auth0 api get connections
auth0 api post client-grants --data '{"client_id":"...","audience":"...","scope":["read:data"]}'
auth0 api get stats/daily -q "from=20240101" -q "to=20240131"
auth0 api delete "actions/actions/<action-id>" --force
auth0 api post clients --data @client.json      # @file
cat data.json | auth0 api post clients          # or pipe the body via stdin
```

`--data` accepts inline JSON, `@file`, or `@-`/stdin (or a plain pipe). Method
defaults to `GET` without data and `POST` with data. If a call returns 403,
re-run `auth0 login --scopes "<needed:scope>"`.

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

Agent mode emits JSON on stdout, so pipe it straight into `jq`:

```bash
auth0 apps list | jq '.[] | {client_id, name}'
auth0 users show <user-id> | jq '{id: .user_id, email: .email}'
auth0 roles list | jq '.[].name'
```

If `jq` reports `parse error: Invalid numeric literal`, you're most likely feeding
it human output because agent mode wasn't detected — force `--agent-mode`. Read
data from stdout only; don't `2>&1` the error envelope into your data stream.

Outside an agent session, add the flag explicitly on commands that define it:

```bash
auth0 apps list --json-compact | jq '.[] | {client_id, name}'
```

---

## References

Run `auth0 docs search "auth0 cli"` for the latest Auth0 docs on this topic.

- [Auth0 CLI Documentation](https://auth0.github.io/auth0-cli/)
- [`agent-mode.md`](agent-mode.md) — full failure-class list, the structured-input matrix by resource, per-command interactive behavior
- [Auth0 Management API v2](https://auth0.com/docs/api/management/v2)
- [Management API OpenAPI spec](https://auth0.com/docs/oas/management/v2/management-api-oas.json) —
  machine-readable source of truth for `auth0 api` paths, accepted methods, and
  request/response shapes. Use it to confirm a verb or payload instead of
  inferring one from a 404.
- [Auth0 Documentation](https://auth0.com/docs)
