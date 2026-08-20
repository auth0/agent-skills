# Auth0 Organizations

Multi-tenant B2B authentication. Organizations let each of your customers have their own isolated user pool, roles, and connections — all within one Auth0 tenant.

---

## When to use Organizations

Use Organizations when you need:
- Multiple business customers (tenants), each with their own users and SSO
- Per-org user roles and permissions
- Different login connections per customer (e.g., Okta SSO for CustomerA, Google Workspace for CustomerB)
- Organization-scoped invitations and member management

Do NOT use Organizations for consumer apps (B2C). Organizations is a B2B construct — instead, use plain Auth0 connections within a single tenant for B2C, and reserve Organizations for B2B multi-tenant scenarios.

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

All Auth0 SDKs support passing `organization` in `authorizationParams` (or equivalent):

**React:**
```javascript
loginWithRedirect({
  authorizationParams: { organization: 'org_xxxxx' }
});
```

**Next.js (nextjs-auth0 v4):**
```javascript
// Pass org via URL param: /auth/login?organization=org_xxx
// The nextjs-auth0 handler forwards it automatically
```

**Vue:**
```javascript
loginWithRedirect({
  authorizationParams: { organization: 'org_xxxxx' }
});
```

**Express:**
```javascript
app.get('/login/:orgId', (req, res) => {
  res.oidc.login({ authorizationParams: { organization: req.params.orgId } });
});
```

### Read org from access token

After login, the access token includes `org_id` and `org_name` claims:

```javascript
const { org_id, org_name } = tokenPayload;
```

### Validate org on the backend

Validate `org_id` on your API to prevent cross-tenant access:

```javascript
// Express example
app.get('/api/data', checkJwt, (req, res) => {
  const orgId = req.auth.payload.org_id;
  if (orgId !== expectedOrgId) {
    return res.status(403).json({ error: 'Wrong organization' });
  }
});
```

---

## Tenant Configuration (via chosen tooling)

See your tooling reference file for the full command syntax. The Auth0 MCP server
exposes **no** organizations tool, so for an MCP-only session fall back to the CLI
or Terraform.

| Operation | CLI | Terraform |
|---|---|---|
| Create an organization | `auth0 orgs create --name <slug> --display "<Name>"` | `auth0_organization` |
| List / show / update / delete | `auth0 orgs list` / `show` / `update` / `delete` | `auth0_organization` |
| Add a member | `auth0 api post "organizations/<org-id>/members" --data '{"members":["<user-id>"]}'` | `auth0_organization_member` |
| Enable a connection | `auth0 api post "organizations/<org-id>/enabled_connections" --data '{"connection_id":"<con-id>","assign_membership_on_login":true}'` | `auth0_organization_connections` |
| Assign an org-scoped role | `auth0 api post "organizations/<org-id>/members/<user-id>/roles" --data '{"roles":["<role-id>"]}'` | `auth0_organization_member_roles` |
| Create an invitation | `auth0 orgs invitations create` (see below) | not covered |

Check `auth0 commands orgs --detailed` for the current subcommand surface before
falling back to `auth0 api`, and read flag names off `--help` rather than
inferring them from the field they set.

Reading connections back returns a **bare array**, so use `jq '.[]'`, not
`jq '.enabled_connections[]'`.

### Finding or creating a login connection

An organization with no enabled connection has no way for its members to log in.
Reuse an existing database connection when the tenant has one, and only create
one when it does not:

```bash
# List database connections in the tenant and pick one explicitly by name —
# the API defines no ordering, so `.[0]` silently grabs an arbitrary connection.
auth0 api get "connections?strategy=auth0" | jq -r '.[] | select(.name=="<connection-name>") | .id'

# Create one only if there is none matching. `name` must match
# ^[a-zA-Z0-9](-[a-zA-Z0-9]|[a-zA-Z0-9])*$, max 128 chars.
auth0 api post connections --data '{"name":"<connection-name>","strategy":"auth0"}'

# Enable it for the organization — without this, org members have no way to log in.
auth0 api post "organizations/<org-id>/enabled_connections" \
  --data '{"connection_id":"<con-id>","assign_membership_on_login":true}'

# Enable it for each app that will use it — status false disables. Max 50 per call.
auth0 api patch "connections/<con-id>/clients" \
  --data '[{"client_id":"<client-id>","status":true}]'

# Read back which apps are enabled.
auth0 api get "connections/<con-id>/clients" | jq -r '.clients[].client_id'
```

The read is checkpoint-paginated: `take` defaults to 50 (max 1000), and a `next`
token comes back while more remain, so pass it as `from` until `next` is absent.
If listing to find a match automatically rather than by a known name, page
through all results and fail rather than guess unless exactly one connection
matches.

`connections/<con-id>/clients` only enables the connection for applications —
it does not make the connection usable by the organization. An org whose
connection is enabled for clients but never added to
`organizations/<org-id>/enabled_connections` still has no way for members to
log in.

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
#    Read the current value FIRST — the setting is tenant-wide, and you may need
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
it — restore it to an empty string (`{"default_redirection_uri":""}`), not the
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

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Forgetting `organization` in `authorizationParams` | Always pass the org identifier at login time |
| Using `org_id` from ID token on backend | Validate from the access token, not ID token |
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
