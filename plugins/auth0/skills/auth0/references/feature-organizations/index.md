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

The org-login shape is protocol-level and identical across every SDK. Send the organization
identifier on the `/authorize` request, then read `org_id` back off the returned token. Only
how the SDK takes that identifier differs, and it is one of two modes. Get the exact call from
the **loaded `framework-{framework}/index.md` reference** (the router loads it alongside this
file), not from memory:

- **As a login argument** - pass `organization` inside the login call's authorization params,
  e.g. `loginWithRedirect({ authorizationParams: { organization: 'org_xxx' } })`. Some SDKs
  surface it as a URL param the handler forwards, e.g. `/auth/login?organization=org_xxx`.
- **As a builder option** - set it on the auth request builder before starting login, e.g.
  `.organization("org_xxx")` or `.withOrganization("org_xxx")`.

Match the detected SDK to whichever mode its own reference uses; do not infer the mode from the
SDK's platform.

For richer per-SDK examples (org switching, reading org claims) read the SDK's own file, only
the named section (from that heading to the next heading of the same or higher level):

| SDK | Raw example file (markdown) | Find section |
|---|---|---|
| `@auth0/auth0-react` | https://raw.githubusercontent.com/auth0/auth0-react/main/EXAMPLES.md | `## Use with Auth0 organizations` |
| `@auth0/auth0-spa-js` | https://raw.githubusercontent.com/auth0/auth0-spa-js/main/examples/organizations.md | `## Organizations` |
| `@auth0/auth0-vue` | https://raw.githubusercontent.com/auth0/auth0-vue/main/EXAMPLES.md | `## Organizations` |
| `@auth0/auth0-angular` | https://raw.githubusercontent.com/auth0/auth0-angular/main/EXAMPLES.md | `## Organizations` |
| `@auth0/nextjs-auth0` | https://raw.githubusercontent.com/auth0/nextjs-auth0/main/EXAMPLES.md | `## Passing authorization parameters` |
| `express-openid-connect` | https://raw.githubusercontent.com/auth0/express-openid-connect/master/EXAMPLES.md | `9. Validate Claims from an ID token before logging a user in` |
| `react-native-auth0` | https://raw.githubusercontent.com/auth0/react-native-auth0/master/EXAMPLES.md | `## Organizations` |
| `Auth0.swift` | https://raw.githubusercontent.com/auth0/Auth0.swift/master/examples/advanced-features/organizations.md | `Log in to an organization` |
| `Auth0.Android` | https://raw.githubusercontent.com/auth0/Auth0.Android/main/examples/organizations.md | `Organizations` |
| `auth0-server-python` | https://raw.githubusercontent.com/auth0/auth0-server-python/main/README.md | `#### Organizations` |

No matching row? The framework reference loaded alongside this file carries the SDK-specific
org login syntax; fall back to it plus the protocol shape above. 
Never hand-roll the authorize URL or decode the token by hand.

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

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Forgetting `organization` in `authorizationParams` | Always pass the org identifier at login time |
| Not forwarding the `invitation` param when accepting an invite | Read `invitation` + `organization` from the callback URL and forward both to `/authorize` |
| Using your default org for an invitation link | Forward the invite's own `organization` param - it may differ from your configured default |
| Reading `org_id` from the wrong token | Web/client apps read it from the ID token (display); APIs validate it from the access token (authorization) |
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
