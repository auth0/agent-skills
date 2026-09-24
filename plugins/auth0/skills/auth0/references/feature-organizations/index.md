# Auth0 Organizations

Multi-tenant B2B authentication. Organizations let each of your customers have their own isolated user pool, roles, and connections - all within one Auth0 tenant.

---

## When to use Organizations

Use Organizations when you need:
- Multiple business customers (tenants), each with their own users and SSO
- Per-org user roles and permissions
- Different login connections per customer (e.g., Okta SSO for CustomerA, Google Workspace for CustomerB)
- Organization-scoped invitations and member management

Do NOT use Organizations for consumer apps (B2C). Organizations is a B2B construct - instead, use plain Auth0 connections within a single tenant for B2C, and reserve Organizations for B2B multi-tenant scenarios.

---

## Concepts

| Concept | Description |
|---|---|
| **Organization** | An isolated tenant within your Auth0 tenant. Has an `id` (org_xxx) and `name` (slug). |
| **Member** | A user belonging to an organization. A user can belong to multiple orgs. |
| **Org-level role** | A role granted to a user within a specific org (not globally). |
| **Connection** | A login method enabled for an org (database, enterprise SSO, social). |
| **Invitation** | A time-limited invite to join an org, sent by email. |

---

## SDK Integration

### Pass organization at login

The org-login shape is protocol-level: send the organization identifier on the `/authorize`
request, then read `org_id` back off the returned token. Only how the SDK takes it differs - get
the exact call from the **loaded `framework-{framework}/index.md` reference**, not from memory,
preferring the most specific form:

- **A dedicated `organization` option** (e.g. `startInteractiveLogin({ organization: 'org_xxx' })`,
  `.organization("org_xxx")`, a client-level default). **Prefer this whenever the SDK has one** -
  it is the canonical form; the authorization-params bag below is a backwards-compatible fallback.
- **Inside the authorization parameters** (e.g. `loginWithRedirect({ authorizationParams: { organization: 'org_xxx' } })`).
  For SDKs with no dedicated option (common for SPA/mobile) this is itself canonical.
- **As a URL/query param the handler forwards** (e.g. `/login?organization=org_xxx`).

Match the detected SDK to the form its own reference documents; do not infer it from the platform.

Get the exact call from the per-SDK reference below — **`Read:` the file for the detected SDK**.
Each carries that SDK's exact org-login option, invitation forwarding, and `org_id` accessor,
verified against the installed SDK. Implement directly from it: do NOT fetch from GitHub, grep
`node_modules`/`.d.ts`/site-packages, or web-search to re-verify a signature. (Exception: if
the per-SDK file tells you to read a bundled `SKILL.md` under `node_modules/…/skills/`, do —
that is a curated guide the package ships, not signature-probing.) Min version is the
release the feature landed in — **check the installed version (`package.json`/lockfile,
`Package.swift`, Gradle, `pyproject.toml`) meets it before implementing**, and upgrade if it
falls short. It matters most for the newer server SDKs (`auth0-server-js`, `auth0-auth-js`,
`auth0-api-js`, `auth0-server-python`), where organizations lands mid-`1.x`, so an older install
won't have it. No matching row? Fall back to the protocol shape above plus the loaded
`framework-{framework}/index.md`. Never hand-roll the authorize URL or decode the token by hand.

**Wire the change into the project's existing files.** Edit the app's real login/callback/route
and config files in place; do not scaffold extra `README`, `SETUP`, `NOTES`, `CHECKLIST`, or
`*-summary` documents to "explain" the integration - they are not part of the task and dilute the
diff. Keep the change minimal and focused on what makes org login, invitation acceptance, and
`org_id` enforcement work.

| SDK | Min version | Read this file |
|---|---|---|
| `@auth0/auth0-react` | 2.x | `Read: references/feature-organizations/auth0-react.md` |
| `@auth0/auth0-spa-js` | 2.x | `Read: references/feature-organizations/auth0-spa-js.md` |
| `@auth0/auth0-vue` | 2.x | `Read: references/feature-organizations/auth0-vue.md` |
| `@auth0/auth0-angular` | 2.x | `Read: references/feature-organizations/auth0-angular.md` |
| `@auth0/nextjs-auth0` | 4.x | `Read: references/feature-organizations/nextjs-auth0.md` |
| `express-openid-connect` | 2.x/3.x | `Read: references/feature-organizations/express-oidc.md` |
| `react-native-auth0` | 5.x | `Read: references/feature-organizations/react-native-auth0.md` |
| `Auth0.swift` | 2.x/3.x | `Read: references/feature-organizations/auth0-swift.md` |
| `Auth0.Android` | 2.x–4.x | `Read: references/feature-organizations/auth0-android.md` |
| `@auth0/auth0-server-js` | 1.9.0 | `Read: references/feature-organizations/auth0-server-js.md` |
| `@auth0/auth0-auth-js` | 1.10.0 | `Read: references/feature-organizations/auth0-auth-js.md` |
| `auth0-server-python` | 1.0.0b11 | `Read: references/feature-organizations/auth0-server-python.md` |
| `@auth0/auth0-api-js` (API) | 1.3.0 | `Read: references/feature-organizations/auth0-api-js.md` |
| `express-oauth2-jwt-bearer` (API) | 1.0.0 | `Read: references/feature-organizations/express-oauth2-jwt-bearer.md` |

### Reading the organization back

`org_id` (and `org_name`, when your tenant uses organization names) is present in
**both** the ID token and the access token after an organization login. Which one
you read depends on *why* you need it:

- **To display which org the user is in (client / web app):** read `org_id` /
  `org_name` from the **ID token**. Auth0's guidance is that web applications
  validate `org_id` from the ID token. Use the SDK's own claim accessor rather
  than hand-decoding a token.
- **To authorize an API request (server side):** validate `org_id` from the
  **access token** the API receives (see below).

### Validate org on the backend

What you do here depends on the app type - applying the wrong one is a real defect:

- **A resource API validating access tokens:** enforce `org_id` on the *verified access token*. Per
  [Auth0's guidance](https://auth0.com/docs/manage-users/organizations/using-tokens#validate-tokens),
  check it against a **known list of the org IDs the API serves** (or the org implied by request
  context) *and* segment data by `org_id`. A valid token proves membership in *some* org, not that
  it is one your API serves. Read the detected SDK's file from the per-SDK table above for the exact
  enforcement call.
- **A login / session app:** read `org_id` from the session / ID token to display the org and to
  **segment data** by it. Do **not** add a post-login allow-list that rejects a signed-in user whose
  `org_id` is not the default - the user already authenticated into that org, so gating the session
  or its routes 403s anyone who accepted an invitation to another org.

Wherever a known list is used, source it from your org records and keep it in sync with every org
served - a list seeded with only the default org 403s the first invited member.

---

## Tenant Configuration (via chosen tooling)

The Auth0 MCP server exposes **no** organizations tool, so use the CLI or Terraform (full
command syntax lives in your tooling reference).

| Operation | CLI | Terraform |
|---|---|---|
| Create an organization | `auth0 orgs create --name <slug> --display "<Name>"` | `auth0_organization` |
| List / show / update / delete | `auth0 orgs list` / `show` / `update` / `delete` | `auth0_organization` |
| Add a member | `auth0 api post "organizations/<org-id>/members" --data '{"members":["<user-id>"]}'` | `auth0_organization_member` |
| Enable a connection | `auth0 api post "organizations/<org-id>/enabled_connections" --data '{"connection_id":"<con-id>","assign_membership_on_login":true}'` | `auth0_organization_connections` |
| Assign an org-scoped role | `auth0 api post "organizations/<org-id>/members/<user-id>/roles" --data '{"roles":["<role-id>"]}'` | `auth0_organization_member_roles` |
| Create an invitation | `auth0 orgs invitations create` (see below) | not covered |

Verify subcommands with `auth0 commands orgs --detailed` and read flag names off `--help`
rather than inferring them; use `auth0 api` for anything without a dedicated subcommand.
Reading connections back returns a **bare array**, so use `jq '.[]'`, not
`jq '.enabled_connections[]'`.

### Finding or creating a login connection

Reuse an existing database connection when the tenant has one; create one only if it does not:

```bash
# List database connections in the tenant and pick one explicitly by name -
# the API defines no ordering, so `.[0]` silently grabs an arbitrary connection.
auth0 api get "connections?strategy=auth0" | jq -r '.[] | select(.name=="<connection-name>") | .id'

# Create one only if there is none matching. `name` must match
# ^[a-zA-Z0-9](-[a-zA-Z0-9]|[a-zA-Z0-9])*$, max 128 chars.
auth0 api post connections --data '{"name":"<connection-name>","strategy":"auth0"}'

# Enable it for the organization - without this, org members have no way to log in.
auth0 api post "organizations/<org-id>/enabled_connections" \
  --data '{"connection_id":"<con-id>","assign_membership_on_login":true}'

# Enable it for each app that will use it - status false disables. Max 50 per call.
auth0 api patch "connections/<con-id>/clients" \
  --data '[{"client_id":"<client-id>","status":true}]'

# Read back which apps are enabled.
auth0 api get "connections/<con-id>/clients" | jq -r '.clients[].client_id'
```

Both connection reads are checkpoint-paginated (`take` defaults to 50): omit `from` on the
first call, then while the response carries a `next` value pass it as `from` until it is
absent. The lookup above only inspects the first page, so page through all results before
concluding a connection is absent, and fail unless exactly one matches rather than guessing.

A connection added to the organization's `enabled_connections` is what appears at that org's
login prompt and lets members authenticate. Enabling the connection for a client
(`connections/<con-id>/clients`) is a separate setting - it governs the connection's
availability to the app outside the organization context - and is not what enables organization
login.

---

## Invitation flow

An invitation lets you add a user who has no Auth0 account yet. The invitee gets
a link, authenticates, and becomes a member.

**Two prerequisites, each a hard 400.** Do both before the first
`invitations create` call:

```bash
# 1. Without this: "The specified client_id (...) does not allow organizations."
auth0 api patch "clients/<client-id>" \
  --data '{"organization_usage":"allow","organization_require_behavior":"no_prompt"}'

# 2. Without this: "A default login route is required to generate the invitation url."
#    Read the current value FIRST - the setting is tenant-wide, and you may need
#    to restore it. An empty response means it's currently unset.
auth0 api get "tenants/settings" | jq -r '.default_redirection_uri // ""'

auth0 api patch "tenants/settings" \
  --data '{"default_redirection_uri":"https://app.example.com/callback"}'
```

The tenant setting is `default_redirection_uri`, validated as
`absolute-https-uri-or-empty`: it must be https, and `localhost` is rejected on
either scheme, so a local-dev URL will not satisfy it.

`default_redirection_uri` is **tenant-wide**, not per app or per organization, so
setting it changes login behaviour for everything in the tenant. Put the
captured value back afterwards if the invitation was the only reason you set
it - restore it to an empty string (`{"default_redirection_uri":""}`), not the
literal text `"unset"`, if it was empty before.

If you keep the new value, say so in your summary. Silently repointing a shared
tenant setting is the kind of change someone else has to debug.

```bash
auth0 orgs invitations create --org-id "<org-id>" \
  --invitee-email "user@company.com" --inviter-name "Admin" \
  --client-id "<client-id>" --roles "<role-id>" --send-email=false
```

`--send-email` **defaults to `true`**, and it needs the `=` form, since
`--send-email false` reads `false` as a positional argument. Verify with
`auth0 orgs invitations list --org-id <org-id>`.

### Accepting an invitation (app side)

The invite link lands on your app carrying **both** an `invitation` and an `organization` parameter:

```
https://your-app.com/login?invitation={ticket_id}&organization={org_id}
```

Your app must read **both** params from the URL and forward **both** to the `/authorize` request (the SDK's login call). This is protocol-level behavior - it holds for SPA, mobile, and Regular Web App SDKs alike; only *where* you wire it differs:

- **SPA / mobile** (public client): read from the browser URL, pass in `authorizationParams` on the login call.
- **Regular Web App** (confidential client): read from the server request, pass through the OIDC middleware / challenge params.

**Forward the invitation's own `organization` - do not substitute your app's configured default org.** The invite is scoped to the org it was issued for, which may differ from your default.

- Read `invitation` + `organization` off the login request and forward both; only fall back to the default org when no `organization` is present.
- If you accept cross-org invitations, pass `organization` **per login call** - a client-wide default org is validated against the returned `org_id` at login completion and rejects invites to other orgs.

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Not passing `organization` at login | Pass the org identifier via the SDK's dedicated `organization` option when it has one (preferred); only fall back to the authorization-parameters bag for SDKs that expose no dedicated option |
| Not forwarding the `invitation` param when accepting an invite | Read `invitation` + `organization` from the callback URL and forward both to `/authorize` |
| Using your default org for an invitation link | Forward the invite's own `organization` param - it may differ from your configured default |
| Login route overwriting an incoming `organization` with the default | Forward an `organization` present on the request; only fall back to the default when none is supplied |
| Pinning a client-wide default org while accepting cross-org invitations | A client-level `organization` is validated against the returned `org_id` at login completion, rejecting invites to other orgs. Pass `organization` per login call instead |
| Reading `org_id` from the wrong token | Web/client apps read it from the ID token (display); APIs validate it from the access token (authorization) |
| Validating `org_id` against a single hardcoded org on the backend | Validate against the set of orgs the request may serve - a known list, or the org derived from request context. A fixed `!== defaultOrg` check rejects valid members of other orgs |
| Gating a login/session app on an org allow-list | The allow-list is an access-token check for APIs, not a session gate. A signed-in user already authenticated into their org; rejecting a non-default `org_id` blocks invited members. Read `org_id` from the session and segment data by it |
| On an API, an allow-list seeded with only the default org | Keep the served-org list sourced from your org records and in sync with every org served; a list holding just the default 403s the first invited member |
| Comparing `org_id` against an env var that can be `undefined` | Guarantee the required org id: give it a literal fallback (`process.env.ACME_ORG_ID ?? 'org_xxx'`) or validate env vars at startup. An unset var makes the check compare against `undefined` and silently breaks enforcement |
| Scaffolding extra README/SETUP/summary files for the integration | Wire the change into the project's existing login/callback/route/config files; keep the diff minimal |
| Hand-decoding a token to read `org_id` | Use the SDK's claim accessor (`getUser()` / `getIdTokenClaims()` / session user) - the claim is already exposed |
| Mixing up org `id` (org_xxx) and `name` (slug) | `id` for API calls, `name` for display |
| Granting global roles instead of org-level roles | Use the org member roles endpoint, not the user roles endpoint |
| Not enabling a connection for the org | `auth0 api post "organizations/<org-id>/enabled_connections"`, or Dashboard → Organization → Connections |
| A space or underscore in a new connection's `name` | Alphanumerics and hyphens only, starting and ending alphanumeric. Anything else is a 400 |
| Creating a connection and enabling it for no app | Nothing can use it. `auth0 api patch "connections/<con-id>/clients" --data '[{"client_id":"<client-id>","status":true}]'` |
| Reading or writing `enabled_clients` on the connection object | "NOT RECOMMENDED" on write, deprecated on read. Use `GET`/`PATCH connections/<con-id>/clients` |
| Overwriting `default_redirection_uri` without reading it first | It is tenant-wide. Capture the old value, and restore or disclose it |
| Guessing a `auth0 orgs` subcommand for membership, roles, or connections | Verify with `auth0 commands orgs --detailed`, and use `auth0 api post organizations/...` for whatever has no dedicated subcommand |
| Prefixing `auth0 api` paths with `/api/v2/` | Paths are relative to the API root. `/api/v2/organizations/...` returns 404 |
| Inviting before setting `organization_usage` on the app and `default_redirection_uri` on the tenant | Both are hard 400s. Configure them first (see Invitation flow) |
| Letting `auth0 orgs invitations create` send a live email | `--send-email` defaults to `true`. Pass `--send-email=false` |

---

## Multi-tenant architecture

For broader B2B SaaS architecture guidance (tenant isolation models, when to use one Auth0 organization per customer vs. shared connections), the router loads the multi-tenant pattern guidance alongside this file for architecture questions.
