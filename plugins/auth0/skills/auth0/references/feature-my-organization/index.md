# Auth0 My Organization API

Let a customer's own admins manage their organization from inside your product — in whatever stack the project already uses — without giving them your Auth0 tenant and without a tenant-wide credential in the request path.

> **Early Access.** The API is opt-in and off by default on every tenant, and
> Auth0 states it will remain opt-in. Activate it before writing code, and expect
> a `403` on every route until it is activated. Disabling it later cuts off every
> connected application at once.

---

## Overview

### What is the My Organization API?

The My Organization API is an **organization-scoped, user-called** API covering
identity providers, organization profile and branding, verified domains, members,
roles, and invitations. It is the API behind embedded delegated administration.

In the **delegated flow** this reference is built around, an organization admin
calls it with their **own** user access token. That is what distinguishes it from
the Management API: the caller's `org_id` scopes every call, so no tenant-wide
secret sits in the request path and no organization's admin can reach another
organization's data.

A trusted server-side job can also call this API, on a separate and deliberately
configured path — an explicit machine-to-machine grant plus an `organization`
value pinning the token to one organization. See "Server-side jobs
(machine-to-machine)". Everything else in this reference describes the delegated
flow unless it says otherwise.

Integrating it is the same three moves in every stack: get the caller a user
access token for the `my-org/` audience, call the endpoints with it, and render
the result. The framework reference loaded alongside this one owns the login and
session mechanics for the SDK in play; this reference owns the audience, the
scopes, the endpoints, and the tenant configuration they require.

### When to Use This Skill

- Letting a customer's own admins edit their organization profile, branding, or verified domains from inside your product
- Self-service SSO — a customer connects their own OIDC or SAML identity provider without filing a support ticket
- Member management within one organization: invitations, role assignment, removal
- Replacing a Management API machine-to-machine proxy that today performs org-admin operations on the customer's behalf
- Building B2B SaaS admin screens where each organization's admin must be confined to their own organization

### When NOT to Use This API

- **Creating or deleting organizations, or changing membership tenant-side** — those are tenant-owner operations; use the Management API `/api/v2/organizations`.
- **Per-user profile, password, passkey, or MFA self-service** — use the My Account API, audience `https://YOUR_AUTH0_DOMAIN/me/`.
- **A hosted UI you don't want to own** — Universal Portals renders the pages at an Auth0 URL; ask for Universal Portals (`feature:universal-portals`).
- **Changing `organization_access_level` on a connection** — readable and writable only through the Management API.
- **Unattended automation, unless it is set up on purpose** — the default machine-to-machine policy is deny-all, so a client-credentials token is refused until the tenant grants this API to that client. When a background job genuinely needs organization-scoped access, follow "Server-side jobs (machine-to-machine)"; for anything tenant-wide, use the Management API.

### Pick the right surface

| The developer wants | Use | Why |
|---|---|---|
| React admin screens for org settings, SSO, members, or domains, shipped fast | `@auth0/universal-components-react` (see "Universal Components") | Prebuilt, themeable components that call this API for you |
| A hosted portal at an Auth0 URL, with no UI code to own | Universal Portals — ask for `feature:universal-portals` | Auth0 hosts and renders the pages |
| Their own UI calling the API directly, or a non-React stack | `@auth0/myorganization-js`, or plain HTTP in any language (see "TypeScript SDK" and "Step 4") | Full control of markup and flow |
| A working end-to-end app to start from | The SaaStart reference app (see "Bootstrap from SaaStart") | Auth client, middleware, session, and RBAC already wired |
| To create or delete organizations, or manage membership tenant-side | Management API `/api/v2/organizations` | Org lifecycle is a tenant-owner operation, outside this API |
| Per-user profile, password, passkeys, or MFA self-service | My Account API, audience `https://YOUR_AUTH0_DOMAIN/me/` | User-level, not organization-level |

### Key Concepts

| Concept | What to do with it when integrating |
|---------|-------------------------------------|
| Audience `https://YOUR_AUTH0_DOMAIN/my-org/` | Put this exact string, trailing slash included, in the login request and in every token request. |
| `organization` login parameter | Pass it at login (or let an organization picker set it) so the issued token carries `org_id`. |
| `org_id` claim | Selects the organization every call acts on — which is why no organization ID appears in any path or request body. |
| `my_org:*` scopes | Request the ones the current screen calls, and assign those same names as RBAC permissions on the admin's role. |
| `my_organization_configuration` | Per-client object the API requires before it will answer: Connection Profile, User Attribute Profile, allowed IdP strategies, connection deletion behavior. |
| 600-second access token | Fixed lifetime. Request `offline_access` and refresh on demand instead of caching a token in module scope. |
| MRRT (Multi-Resource Refresh Tokens) | Enable when the app also calls your own API, so one refresh token can mint tokens for both audiences. |
| `organization_access_level` | Per-connection setting that decides whether an SSO screen can read or edit a given connection. |
| `@auth0/myorganization-js` | The typed client for JS/TS stacks; initialize it with a token supplier rather than a fixed token. |
| `@auth0/universal-components-react` | Prebuilt React screens; the provider acquires tokens, so the app supplies only the domain and proxy or auth context. |

---

## Critical rules

- **The audience MUST be `https://YOUR_AUTH0_DOMAIN/my-org/`**, with the trailing
  slash. Tokens minted for `/api/v2/` (Management API) or `/me/` (My Account API)
  are rejected. Use the **same** domain — canonical or custom — for the token
  request, the `audience` value, and the API call.
- **The token MUST carry exactly one organization's context**, and how it does so
  depends on the flow. In a **delegated (user-facing)** flow it MUST be a user
  access token from Authorization Code or Authorization Code with PKCE, carrying
  the caller's `org_id`; a client-credentials token is refused there, so when a
  delegated call fails, fix the login until the token carries `org_id` rather than
  switching credentials. A **server-side job** instead needs an explicit
  machine-to-machine grant of this API plus a required `organization` value that
  pins the token to one organization — see "Server-side jobs
  (machine-to-machine)".
- **Access tokens live 600 seconds (10 minutes)** by design and the lifetime is not
  configurable. Request `offline_access` and refresh on demand so a long admin
  session keeps working; for a sensitive operation, trigger step-up MFA rather than
  stretching the token lifetime.
- **Auth0 is the source of organizations, members, and roles.**

---

## Prerequisites

- An Auth0 tenant with **My Organization API** activated (Early Access, opt-in — Step 2 covers activation).
- At least one organization, with the calling application associated to it and the organization's connection enabled.
- An application using Authorization Code (with PKCE for a browser or native client), granted `offline_access`, and carrying a `my_organization_configuration` object.
- An admin role **inside that organization** holding the `my_org:*` scopes as RBAC permissions.
- Auth0 CLI authenticated (`auth0 login`) for the tenant configuration steps, or Dashboard access.
- Multi-Resource Refresh Tokens enabled on the application when it also calls your own API.
- For Universal Components: React 18+, `react-hook-form` ^7, and `@tanstack/react-query` ^4 or ^5.

---

## Step 1: Detect the project and pick the integration shape

Read the workspace before asking the developer anything. Two facts decide
everything downstream: which Auth0 SDK the project already uses, and which tier
owns the user's session — because that is the only tier that can mint a
`my-org/` token.

| What the workspace shows | Shape | Where the org-scoped token comes from |
|---|---|---|
| `@auth0/nextjs-auth0`, `express-openid-connect`, `@auth0/auth0-fastify`, `auth0-server-python`, `com.auth0:mvc-auth-commons`, `Auth0.AspNetCore.Authentication`, `auth0/login` | Server-rendered web app | The server-side session; the server calls the API and renders the result |
| `@auth0/auth0-react`, `@auth0/auth0-vue`, `@auth0/auth0-angular`, `@auth0/auth0-spa-js` | Single-page app | The SDK's in-memory token; the browser calls the API directly, so CORS must be configured |
| `react-native-auth0`, Auth0.swift, `com.auth0.android:auth0`, `auth0_flutter` | Native or mobile | The SDK's credentials manager; the app calls the API directly |
| A resource server with no login UI (`express-oauth2-jwt-bearer`, `auth0-fastapi-api`, `spring-security-oauth2-resource-server`) | Backend acting for a signed-in admin | Not mintable here — see the note below |
| No Auth0 SDK, or a non-JS/non-SDK stack | Direct HTTP | Whatever the stack's OIDC library stores; send it as a bearer header (Step 4) |
| Empty workspace, or no stack chosen | Scaffold | SaaStart already wires all of it (Step 5) |

**The resource-server case needs care.** An API that received a token for *your*
own audience cannot reuse it against `my-org/` — the audiences differ, and the
API will reject it. Mint the `my-org/` token in the tier that owns the user's
session (the web app or SPA that holds their refresh token, with MRRT enabled),
then either call the API from there or forward the org-scoped token to the
backend for the duration of the request.

Detect the domain the same way: read `AUTH0_DOMAIN` / `AUTH0_ISSUER_BASE_URL`
from `.env*`, then fall back to `auth0 tenants list`. Ask for a domain only when
both come back empty.

---

## Step 2: Activate the API and configure the client

Activate **My Organization API** in the Dashboard under **Applications → APIs**.
Then confirm which organizations exist:

```bash
auth0 api get "organizations?per_page=10"
```

With zero organizations, create one as part of the implementation. With exactly
one, use it. With more than one, list the display names and ask which
organization the screens are being built for.

### `my_organization_configuration` on the client

A client that calls this API **MUST** carry a `my_organization_configuration`
object; requests from a client without one fail. Read the current value before
changing it:

```bash
auth0 api get "clients/YOUR_CLIENT_ID?fields=client_id,name,my_organization_configuration&include_fields=true"
```

| Field | Value |
|---|---|
| `connection_profile_id` | A Connection Profile in the same tenant. Features that depend on one stop working when it is absent. |
| `user_attribute_profile_id` | A User Attribute Profile in the same tenant. Same dependency as above. |
| `allowed_strategies` | Unique values drawn from `pingfederate`, `ad`, `adfs`, `waad`, `google-apps`, `okta`, `oidc`, `samlp` — the IdP kinds a customer admin may create. |
| `connection_deletion_behavior` | `allow` deletes the connection and its users. `allow_if_empty` refuses deletion while users remain. Prefer `allow_if_empty` unless the developer states that cascading user deletion is intended. |

Patch it with the CLI, or set it in the Dashboard under **APIs → My Organization
API → Application Access → Edit** (which also carries the User Access and Client
Credential authorization settings):

```bash
auth0 api patch "clients/YOUR_CLIENT_ID" --data '{
  "my_organization_configuration": {
    "connection_profile_id": "YOUR_CONNECTION_PROFILE_ID",
    "user_attribute_profile_id": "YOUR_USER_ATTRIBUTE_PROFILE_ID",
    "allowed_strategies": ["oidc", "samlp", "okta"],
    "connection_deletion_behavior": "allow_if_empty"
  }
}'
```

Re-read the client afterward to confirm the stored value.

### Grants, RBAC, and CORS

- The API's default user-flow policy is `require_client_grant`, so create a client
  grant for the application against the `https://YOUR_AUTH0_DOMAIN/my-org/`
  audience listing the scopes you intend to use. Keep `require_client_grant`
  rather than switching user flows to `allow_all`.
- Assign the `my_org:*` scopes as **RBAC permissions on the admin role**, then
  assign that role to the admin inside the organization. Without the permission on
  the user, the request is refused with `403` even when the client grant is valid.
- For a SPA, native app, or any client calling the API from a different origin,
  enable cross-origin authentication on the application and add the origin to
  **Allowed Origins (CORS)**.

---

## Step 3: Request an org-scoped token

Two things have to be true of the token, whatever the stack: it was issued for
the `https://YOUR_AUTH0_DOMAIN/my-org/` audience, and it carries `org_id`. Pass
`organization` at login to get the second.

| Stack | Set the audience and scopes at login | Retrieve the token per request |
|---|---|---|
| `@auth0/nextjs-auth0` v4 | `authorizationParameters` on `Auth0Client` | `auth0.getAccessToken({ audience, scope })` |
| `@auth0/auth0-spa-js`, `-react`, `-vue`, `-angular` | `authorizationParams` on the client / provider | `getAccessTokenSilently({ authorizationParams: { audience, scope } })` |
| `express-openid-connect` | `authorizationParams.audience` + `scope` in the `auth()` config | `req.oidc.accessToken`; call `.refresh()` when it has expired |
| Native and mobile SDKs | `audience` and `scope` on the web-auth login call | The SDK's credentials manager, which refreshes on read |
| Any other OIDC library | `audience` and `scope` on the authorization request | The stored access token; refresh with the refresh token when expired |

Follow the framework reference loaded alongside this one for that SDK's exact
login and session API. The rest of this section shows the shapes that recur.

**Server-rendered web app — Next.js (`@auth0/nextjs-auth0` v4):**

```typescript
// lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server'

const MY_ORG_SCOPES = [
  'openid', 'profile', 'email', 'offline_access',
  'read:my_org:configuration',
  'read:my_org:details', 'update:my_org:details',
  'create:my_org:identity_providers', 'read:my_org:identity_providers',
  'update:my_org:identity_providers', 'delete:my_org:identity_providers',
].join(' ')

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  appBaseUrl: process.env.APP_BASE_URL!,
  secret: process.env.AUTH0_SECRET!,
  authorizationParameters: {
    audience: `https://${process.env.AUTH0_DOMAIN}/my-org/`,
    scope: MY_ORG_SCOPES,
    // Single-org app: pin the token to one organization so it carries `org_id`.
    organization: process.env.AUTH0_ORGANIZATION!,
  },
})
```

For a multi-organization app, pass the selected organization's ID dynamically at
login (from an organization picker) rather than a fixed `AUTH0_ORGANIZATION`, so
the token carries the `org_id` of the organization the admin chose.

Then retrieve the token where you need it. `scope` is a **space-delimited
string**, not an array:

```typescript
const { token } = await auth0.getAccessToken({
  audience: `https://${process.env.AUTH0_DOMAIN}/my-org/`,
  scope: 'read:my_org:details update:my_org:details',
})
```

Requesting an `audience` or `scope` beyond what login granted requires
**Multi-Resource Refresh Tokens (MRRT)** on the application's Refresh Token
Policies. When an app talks to both your own API and `my-org/`, enable MRRT for
both audiences instead of overloading a single token.

**Single-page app — `@auth0/auth0-spa-js` (same shape in `-react`, `-vue`, `-angular`):**

```javascript
const auth0 = new Auth0Client({
  domain: 'YOUR_AUTH0_DOMAIN',
  clientId: 'YOUR_CLIENT_ID',
  useRefreshTokens: true,
  authorizationParams: {
    organization: 'org_xxxxx',
    audience: 'https://YOUR_AUTH0_DOMAIN/my-org/',
    scope: 'openid profile email read:my_org:details update:my_org:identity_providers',
  },
})

const token = await auth0.getAccessTokenSilently({
  authorizationParams: {
    audience: 'https://YOUR_AUTH0_DOMAIN/my-org/',
    scope: 'read:my_org:details',
  },
})
```

`useRefreshTokens: true` is what lets `getAccessTokenSilently()` renew the
600-second `my-org/` token — without it the SDK falls back to hidden-iframe silent
auth, which browser third-party-cookie restrictions routinely break. Enable
**Refresh Token rotation** on the application for it to work. In this offline mode
the SDK adds `offline_access` to the request itself, so it does **not** need to be
listed in `scope`.

**Server-rendered web app — Express (`express-openid-connect`):**

```javascript
const { auth } = require('express-openid-connect')

app.use(auth({
  authRequired: false,
  auth0Logout: true,
  baseURL: process.env.APP_BASE_URL,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  authorizationParams: {
    response_type: 'code',
    audience: `https://${process.env.AUTH0_DOMAIN}/my-org/`,
    scope: 'openid profile email offline_access read:my_org:details update:my_org:details',
    organization: process.env.AUTH0_ORGANIZATION,
  },
}))

// Per request: req.oidc.accessToken.access_token, refreshed when stale
app.get('/admin/organization', async (req, res) => {
  let at = req.oidc.accessToken
  if (at.isExpired()) at = await at.refresh()
  // call the API with at.access_token — see Step 4
})
```

### Scopes

Request the narrowest set the screens need; each scope must also exist as an RBAC
permission on the caller's role.

| Area | Scopes |
|---|---|
| Configuration | `read:my_org:configuration` |
| Organization profile and branding | `read:my_org:details`, `update:my_org:details` |
| Identity providers | `create:my_org:identity_providers`, `read:my_org:identity_providers`, `update:my_org:identity_providers`, `delete:my_org:identity_providers`, `update:my_org:identity_providers_detach` |
| IdP domain mapping (HRD) | `create:my_org:identity_providers_domains`, `delete:my_org:identity_providers_domains` |
| SCIM provisioning | `create:my_org:identity_providers_provisioning`, `read:my_org:identity_providers_provisioning`, `update:my_org:identity_providers_provisioning`, `delete:my_org:identity_providers_provisioning` |
| SCIM tokens | `create:my_org:identity_providers_scim_tokens`, `read:my_org:identity_providers_scim_tokens`, `delete:my_org:identity_providers_scim_tokens` |
| Organization domains | `create:my_org:domains`, `read:my_org:domains`, `update:my_org:domains`, `delete:my_org:domains` |
| Members and roles | `read:my_org:members`, `read:my_org:member_roles`, `create:my_org:member_roles`, `delete:my_org:member_roles`, `delete:my_org:memberships` |
| Invitations | `create:my_org:member_invitations`, `read:my_org:member_invitations`, `delete:my_org:member_invitations` |
| Org-owned clients | `create:my_org:clients`, `read:my_org:clients`, `delete:my_org:clients`, `create:my_org:client_grants` |

There is no `update:my_org:member_roles`: change a member's roles by assigning
the new role and unassigning the old one.

---

## Step 4: Endpoint surface

Requests go to `https://YOUR_AUTH0_DOMAIN/my-org/v1/` — the `v1` API-version segment
is part of the request path. The **token audience** stays
`https://YOUR_AUTH0_DOMAIN/my-org/` without it: the audience is what you request at
login (Step 3), the versioned path is where you send the call. Every path below is
relative to the `/my-org/v1/` base. The organization is taken from the token's
`org_id`, so no organization ID appears in any path. (The TypeScript SDK adds `/v1`
for you, so SDK method calls never spell it out.)

| Area | Method and path |
|---|---|
| Organization profile | `GET details`, `PATCH details` |
| Configuration | `GET config`, `GET config/identity-providers` |
| Identity providers | `GET identity-providers`, `POST identity-providers`, `GET identity-providers/{idp_id}`, `PATCH identity-providers/{idp_id}`, `DELETE identity-providers/{idp_id}` |
| IdP attributes and detach | `PUT identity-providers/{idp_id}/update-attributes`, `POST identity-providers/{idp_id}/detach` |
| IdP domains and provisioning | `identity-providers/{idp_id}/domains`, `identity-providers/{idp_id}/provisioning`, `identity-providers/{idp_id}/provisioning/scim-tokens` |
| Organization domains | `GET domains`, `POST domains`, `GET domains/{domain_id}`, `DELETE domains/{domain_id}`, `POST domains/{domain_id}/verify`, `GET domains/{domain_id}/identity-providers` |
| Members | `GET members`, `GET members/{user_id}` |
| Member roles | `GET members/{user_id}/roles`, `POST members/{user_id}/roles`, `DELETE members/{user_id}/roles` |
| Memberships | `POST delete-memberships` |
| Invitations | `GET member-invitations`, `POST member-invitations`, `GET member-invitations/{invitation_id}`, `DELETE member-invitations/{invitation_id}` |
| Roles available to assign | `GET roles` |

`DELETE identity-providers/{idp_id}` also deletes the underlying identity
provider. To unlink it from the organization while keeping the provider itself,
call `POST identity-providers/{idp_id}/detach`.

### Calling it without an SDK

Any stack can use the API over plain HTTP: a bearer header and JSON. There is no
organization ID to supply.

```bash
curl -sS "https://YOUR_AUTH0_DOMAIN/my-org/v1/details" \
  -H "Authorization: Bearer $MY_ORG_TOKEN" \
  -H 'Content-Type: application/json'
```

Keep the token out of the transcript: read it into a shell variable inside a
single command chain and use it there, print only its length, and let the
variable go out of scope when the command ends. In application code, read it from
the session or SDK per request rather than logging or persisting it.

Rate limits apply per plan tier **and** per organization, so one busy customer
cannot starve the others. Treat `429` as expected under load: read `Retry-After`
and back off rather than retrying immediately in a tight loop.

Tenant logs carry dedicated events — `my_organization_api_config_failed`,
`my_organization_api_org_details_succeeded` / `_failed`,
`my_organization_api_idp_succeeded` / `_failed`, and
`my_organization_api_domain_succeeded` / `_failed`. Use them to confirm a call
reached the API and to see the reason it was refused.

---

## Step 5: Build the admin screens

Match the path to what the workspace already has. Ask the developer only when
detection is genuinely ambiguous — for example when the tenant holds several
organizations.

| What the workspace looks like | Path |
|---|---|
| Empty, or no stack chosen yet | Bootstrap from SaaStart. State that you are scaffolding Next.js with Universal Components rather than asking. |
| An existing app whose UI already covers this ground (SSO provider screens, org settings) via Management API calls | Port the API layer only. Keep the existing UI. |
| An existing React app with no admin UI yet | Add Universal Components. Install Tailwind, shadcn/ui, or `react-hook-form` if they are missing rather than falling back to hand-written forms. |
| A non-React JS/TS stack | Call the API with `@auth0/myorganization-js` and build the forms in the project's own framework. |
| A non-JS stack (Python, Go, Java, .NET, PHP, Ruby) | Use that language's My Organization SDK where one exists, otherwise plain HTTP as in Step 4, and build the forms in the project's own templating layer. |

### Bootstrap from SaaStart

SaaStart (<https://github.com/auth0-ui-components/saas-starter-uicomponents>) is a
complete Next.js delegated-admin app: auth client, middleware, session handling,
and RBAC are already implemented.

```bash
git clone https://github.com/auth0-ui-components/saas-starter-uicomponents.git
cd saas-starter-uicomponents
npm install
cp .env.local.user.example .env.local.user
```

Fill in `.env.local.user`:

```bash
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.us.auth0.com
SESSION_ENCRYPTION_SECRET=<openssl rand -hex 32>
CUSTOM_CLAIMS_NAMESPACE=https://example.com
```

Its bootstrap script creates roles, an organization, and tenant Actions. Name
those resources to the developer and get confirmation before running it:

```bash
auth0 login --domain YOUR_AUTH0_DOMAIN
npm run auth0:bootstrap YOUR_AUTH0_DOMAIN
npm run dev
```

Visit `http://localhost:3000`, sign up with an organization name, and you land in
the dashboard. SaaStart's auth client lives at `lib/app-client.ts` and exports
`appClient` — edit that file in place when adding the `my-org/` audience and
scopes. Cite its README by section name (for example "Step Five: Run the sample
application") so the developer can follow along.

### Port existing Management API calls

Change the API layer and leave the UI alone. The typical case is SSO provider
management moving off a machine-to-machine credential:

```typescript
// Before: Management API — needs an M2M token, backend-only, tenant-wide reach
await managementClient.connections.get({ id: connectionId })
await managementClient.connections.create({ /* ... */ })

// After: My Organization API — the admin's own org-scoped token
import { myOrgClient } from '@/lib/my-org-client'

const { identity_providers } = await myOrgClient.organization.identityProviders.list()
await myOrgClient.organization.identityProviders.create({ /* ... */ })
```

What each call gains: the request is confined to the caller's `org_id`, so a
tenant-wide secret no longer sits in the request path. What it gives up: reach
beyond that organization. Keep the Management API for org creation and deletion,
tenant-side membership changes, and `organization_access_level` changes.

---

## TypeScript SDK

```bash
npm install @auth0/myorganization-js
```

Initialize with a **token supplier** so the SDK requests the scopes each call
needs, rather than pinning one token that expires inside 10 minutes. The supplier
is where the stack's own session API plugs in — the Next.js form is shown here;
substitute `getAccessTokenSilently`, `req.oidc.accessToken`, or the credentials
manager for the SDK in play:

```typescript
// lib/my-org-client.ts
import { MyOrganizationClient } from '@auth0/myorganization-js'
import { auth0 } from '@/lib/auth0'

export const myOrgClient = new MyOrganizationClient({
  domain: process.env.AUTH0_DOMAIN!,
  token: async ({ scope }) => {
    const { token } = await auth0.getAccessToken({
      audience: `https://${process.env.AUTH0_DOMAIN}/my-org/`,
      scope,
    })
    return token
  },
})
```

Method map:

| Area | Methods |
|---|---|
| Organization profile | `organizationDetails.get()`, `organizationDetails.update({ ... })` |
| Configuration | `organization.configuration.get()`, `organization.configuration.identityProviders.get()` |
| Identity providers | `organization.identityProviders.list()`, `.create({ ... })`, `.get(idpId)`, `.update(idpId, { ... })`, `.updateAttributes(idpId, { ... })`, `.delete(idpId)`, `.detach(idpId)` |
| IdP domains | `organization.identityProviders.domains.create(idpId, { ... })`, `.domains.delete(idpId, domain)` |
| SCIM | `organization.identityProviders.provisioning.get(idpId)`, `.create(idpId)`, `.updateAttributes(idpId, { ... })`, `.delete(idpId)`, `.provisioning.scimTokens.list(idpId)`, `.scimTokens.create(idpId, { ... })`, `.scimTokens.delete(idpId, tokenId)` |
| Organization domains | `organization.domains.list({ ... })`, `.create({ ... })`, `.get(domainId)`, `.delete(domainId)`, `.verify.create(domainId)`, `.identityProviders.get(domainId)` |
| Members and roles | `organization.members.list({ ... })`, `.get(userId)`, `.roles.list(userId)`, `.roles.assign(userId, { ... })`, `.roles.unassign(userId, { ... })` |
| Memberships | `organization.memberships.deleteMemberships({ ... })` |
| Invitations | `organization.invitations.list({ ... })`, `.create({ ... })`, `.get(invitationId)`, `.delete(invitationId)` |
| Roles | `organization.roles.list({ ... })` |

Per-call options include `headers`, `queryParams`, `maxRetries` (default `2`),
`timeoutInSeconds` (default `60`), and `abortSignal`. Use `.withRawResponse()`
when you need response headers alongside the parsed body.

### Retries and non-idempotent writes

The default `maxRetries: 2` retries `408`, `429`, and `5xx` — and it does so for
`POST` creates (identity providers, domains, invitations, member roles) just as it
does for reads. A retry after an **ambiguous** response — a timeout or `5xx` on a
request the server may already have committed — can create a duplicate. For a
non-idempotent call, either pass `maxRetries: 0` and handle the failure yourself, or
make the operation reconcilable: before retrying, check whether the resource already
exists (list identity providers, look up the invitation) and skip the create if it
does.

```typescript
await myOrgClient.organization.identityProviders.create(input, { maxRetries: 0 })
```

### Server-side jobs (machine-to-machine)

A background job — nightly membership reconciliation, a provisioning worker — has
no signed-in admin, so there is no `org_id` to scope the call. Two things are
required, and neither is a default:

1. **An explicit grant of this API to the machine-to-machine client.** The default
   policy is deny-all, so a client-credentials token is refused until the tenant
   authorizes that client for `https://YOUR_AUTH0_DOMAIN/my-org/`.
2. **An `organization` value on the credentials** — typed `organization: string`,
   required, documented in the SDK as "Organization ID or name". It replaces
   `org_id` as the scoping mechanism, so a job covering several organizations
   builds one client per organization rather than one client for the tenant.

```typescript
// Server environments only — never ship a client secret or private key to a browser.
import { createMyOrganizationClientWithClientCredentials } from '@auth0/myorganization-js/server'

// Two arguments: `domain` goes in the client options, and the credentials object
// omits it (its type is Omit<ClientCredentialsOptions, 'domain'>).
const client = createMyOrganizationClientWithClientCredentials(
  { domain: process.env.AUTH0_DOMAIN! },
  {
    clientId: process.env.MY_ORG_M2M_CLIENT_ID!,
    clientSecret: process.env.MY_ORG_M2M_CLIENT_SECRET!,
    organization: orgId, // required — scopes the token to this one organization
  },
)
```

To authenticate with a private key JWT instead, swap `clientSecret` for
`privateKey` (a `string` or `CryptoKey`) and optionally set
`clientAssertionSigningAlg`. To own token acquisition yourself, construct a
`ClientCredentialsTokenProvider` — it takes a single flat object that **does**
include `domain`, alongside `clientId`, the secret or key, and `organization` —
then pass it as `new MyOrganizationClient({ domain, tokenProvider })`. Both paths
also accept optional `audience`, `useMtls`, and `customFetch`.

Keep this path out of user-facing screens: a delegated flow that switches to
client credentials loses the per-admin confinement that is the reason to use this
API instead of the Management API.

Auth0 also ships My Organization SDKs for Java, .NET, Go, and Python; the audience
and scope rules above are identical in each.

---

## Universal Components (React)

```bash
npm install @auth0/universal-components-react
```

Peer dependencies: `react`, `react-dom`, `react-hook-form` (^7), and
`@tanstack/react-query` (^4 or ^5). A missing peer dependency, Tailwind config, or
shadcn/ui setup is a thing to install — not a reason to hand-write the forms.
Reserve custom UI for a non-React framework.

Wrap the app in `Auth0ComponentProvider`, which handles token acquisition,
caching, theming, and i18n. Import it from the entry point matching your app
shape:

```tsx
// app/providers.tsx — server-rendered app (Next.js): proxy mode
'use client'
import { Auth0ComponentProvider } from '@auth0/universal-components-react/rwa'
import '@auth0/universal-components-react/styles'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Auth0ComponentProvider
      mode="proxy"
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      proxyConfig={{ baseUrl: '/api/auth' }}
    >
      {children}
    </Auth0ComponentProvider>
  )
}
```

For a single-page app, import the provider from
`@auth0/universal-components-react/spa` instead and pass `authContext` (mode
defaults to `direct`). Tailwind projects can import
`@auth0/universal-components-react/tailwind` in place of `styles`. Other provider
props: `themeSettings`, `i18n`, `toastSettings`, `cacheConfig`, `loader`,
`previewMode`, `telemetry`.

Components come from the **package root**, not the `/rwa` or `/spa` entry point —
those export only the provider:

| Component | Covers |
|---|---|
| `OrganizationDetailsEdit` | Organization profile and branding. The shortest path to a working screen. |
| `SsoProviderTable`, `SsoProviderCreate`, `SsoProviderEdit` | Customer-managed OIDC and SAML identity providers |
| `OrganizationMemberManagement`, `OrganizationMemberDetail` | Members, their roles, and invitations |
| `DomainTable` | Verified organization domains and Home Realm Discovery |
| `UserMFAManagement`, `UserPasskeyManagement` | Per-user security settings — these call the **My Account** API, so grant `me/` scopes for them |

Each of the `*View` exports (`OrganizationDetailsEditView`, …) is the presentational
half of its container, for when you want to supply your own data layer.

```tsx
// app/dashboard/organization/page.tsx
import { OrganizationDetailsEdit } from '@auth0/universal-components-react'

export const dynamic = 'force-dynamic'

export default function OrganizationPage() {
  return <OrganizationDetailsEdit />
}
```

Match the components to the project's look through the provider's `themeSettings`
prop and the CSS variables the stylesheet exposes; derive the values from the
project's existing design tokens instead of introducing a second palette.

---

## Protect the admin surface

Whatever the stack, the admin routes need two checks before they act: the caller
has a session, and that session carries the `org_id` the request is about. Put
roles into the token with a post-login Action that sets a namespaced custom claim,
then read that claim in the handler — reading a role from a request body or a
client prop lets any caller claim to be an admin.

**Next.js middleware and server actions:**

```typescript
// middleware.ts
import { auth0 } from '@/lib/auth0'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default async function middleware(req: NextRequest) {
  const authRes = await auth0.middleware(req)
  const session = await auth0.getSession(req)

  if (!session?.user) return authRes            // let the SDK drive login
  if (!session.user.org_id) {
    return NextResponse.redirect(new URL('/onboarding', req.url))
  }
  return authRes
}

export const config = { matcher: ['/dashboard/:path*'] }
```

```typescript
// lib/with-server-action-auth.ts
import { auth0 } from '@/lib/auth0'

type Role = 'admin' | 'member'

export function withServerActionAuth<A extends unknown[], R>(
  action: (...args: [...A, session: { user: { sub: string; org_id: string } }]) => R,
  options: { role?: Role } = {},
) {
  return async function (...args: A) {
    const session = await auth0.getSession()
    if (!session?.user) throw new Error('Authentication required')
    if (!session.user.org_id) throw new Error('Organization context required')

    if (options.role) {
      const roles: string[] = session.user['https://example.com/roles'] ?? []
      if (!roles.includes(options.role)) {
        throw new Error(`${options.role} role required`)
      }
    }
    return action(...args, session as never)
  }
}
```

**Express, same two checks:**

```javascript
const { requiresAuth } = require('express-openid-connect')

const requiresOrgAdmin = [
  requiresAuth(),
  (req, res, next) => {
    const claims = req.oidc.user ?? {}
    if (!claims.org_id) return res.redirect('/onboarding')
    const roles = claims['https://example.com/roles'] ?? []
    if (!roles.includes('admin')) return res.sendStatus(403)
    next()
  },
]

app.use('/admin', requiresOrgAdmin)
```

For a SPA or native app there is no server route to guard, so the check that
matters is the API's own: the token's `org_id` and scopes bound what the call can
do. Use the UI state for affordance only, and let a `403` from the API surface as
a permission message.

On Next.js, add `export const dynamic = 'force-dynamic'` to every auth-gated page
or layout that calls `auth0.getSession()` or any async Auth0 API. Next.js 15.5.x
raises a `workUnitAsyncStorage` invariant when an async Auth0 call runs inside a
statically rendered server component, and opting the route out of static
rendering is the fix.

---

## Connection ownership limits

An organization admin's reach over a connection is set by
`organization_access_level` on the enabled connection, which is changeable
**only** through the Management API (`/api/v2/organizations/{id}/connections`,
scopes `create:organization_connections`, `read:organization_connections`,
`update:organization_connections`, `delete:organization_connections`, with an
optional `is_enabled=true|false` filter):

| Level | The org admin can |
|---|---|
| `none` | Not see the connection |
| `readonly` | View it |
| `limited` | Change `show_as_button` and `is_enabled` |
| `full` | Also change options, `display_name`, and `domains` |

Set the connection's `name` through the Management API before moving it off
`none`; an unnamed connection cannot be promoted. `organization_connection_name`
is likewise readable and writable only through the Management API. Even at `full`,
the Connection Profile still bounds what an admin may change — so if a field
refuses to update at `full`, inspect the Connection Profile rather than raising
the access level further.

---

## Security Considerations

- **Keep secrets out of the transcript.** Write `AUTH0_CLIENT_SECRET` and
  `AUTH0_SECRET` straight into the env file and confirm the file was written; do
  not print or echo them. When a secret must be read back, have the developer run
  `auth0 apps show YOUR_CLIENT_ID --reveal-secrets` in their own terminal.
- **Scope per screen, not per app.** Request only the `my_org:*` scopes the
  current screen calls, so a token leaked from one page cannot drive another.
- **Restrict `allowed_strategies`** to the identity-provider kinds the product
  actually supports; each entry is a provider type a customer admin may create.
- **Keep `connection_deletion_behavior` at `allow_if_empty`** unless the developer
  states that deleting a connection should delete its users too.
- **Require step-up MFA before destructive org-admin actions** — deleting an
  identity provider, removing the last admin, deleting a verified domain — rather
  than widening scopes or token lifetime to make them easier.
- **Grant `organization_access_level` sparingly.** Start at `readonly` and raise
  it per connection only when a customer admin needs to change that connection.

---

## Error Handling

With the TypeScript SDK, failures come in two classes and the catch block has to
tell them apart:

- **`MyOrganizationError`** — the API answered with a status code, *or* the response
  was unusable (empty/unparseable body, or a network/fetch failure that never
  reached a status). It carries `statusCode` (**absent** on those non-status cases,
  so don't assume it is a number), `message`, `body`, and `rawResponse`. Branch on
  it for `403` and the other HTTP cases that need a message in the UI.
- **`MyOrganizationTimeoutError`** — the request exceeded `timeoutInSeconds`. It
  carries a `message` and the original `cause` but **no** `statusCode` or `body`, so
  a handler that reads `err.statusCode` sees `undefined`. Treat it as transient.

The SDK already retries `408`, `429`, and `5xx` twice; add your own handling for the
timeout and 4xx cases:

```typescript
import { MyOrganizationError, MyOrganizationTimeoutError } from '@auth0/myorganization-js'

try {
  await myOrgClient.organization.identityProviders.create(input)
} catch (err) {
  if (err instanceof MyOrganizationTimeoutError) {
    // No statusCode/body — the request timed out. For an idempotent read, retry;
    // for a non-idempotent create, reconcile (check whether it already exists)
    // before re-sending — see "Retries and non-idempotent writes".
  } else if (err instanceof MyOrganizationError) {
    if (err.statusCode === 403) {
      // Missing scope, missing RBAC permission, or the API is not activated
    }
    console.error(err.statusCode, err.message, err.body)
  }
  throw err
}
```

Over plain HTTP the same information arrives as the response status plus a JSON
body; branch on the status and read `error` / `error_description` from the body.
In either case, retry `408`, `429`, and `5xx` with backoff (honoring
`Retry-After`), and treat 4xx as terminal for that request.

Surface `403` to the admin as a permission message rather than a generic failure —
at this layer it almost always means the caller's role lacks the RBAC permission,
not that the request was malformed. Log `statusCode` and `body`; keep the access
token out of the log line.

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `403` on every route, valid-looking token | The API is not activated on the tenant | Activate **My Organization API** under **Applications → APIs**, then request a fresh token |
| `403 insufficient_scope` with the scope in the token request | The scope is not an RBAC permission on the caller's role, or the client grant omits it | Add the permission to the admin role, confirm the role is assigned inside that organization, and add the scope to the client grant |
| `401` / access denied although scopes look right | The audience is `https://YOUR_AUTH0_DOMAIN/` or `.../api/v2/` instead of `.../my-org/` | Fix `audience`, get a new token, and confirm the `aud` claim by decoding it |
| A backend API's own token is rejected by `my-org/` | That token was issued for a different audience | Mint the `my-org/` token in the tier holding the user's session and forward it, rather than reusing the API's token |
| Calls work for minutes, then `401` mid-workflow | The 600-second token lifetime elapsed | Request `offline_access` and refresh; add MRRT when more than one audience is in play |
| Token request rejects a `my_org:*` scope as invalid | The scope name is wrong or unsupported | Check it against the scope table above — there is no `update:my_org:member_roles` and no `create:my_org:invitations` |
| `org_id` absent from the session after login | `organization` was not passed at login, the user is not a member, or the org's connection is not enabled for the application | Add the member, enable the connection on the organization, associate the organization with the application, then re-authenticate |
| Requests from the browser blocked by CORS | The origin is not allowed for cross-origin authentication | Enable cross-origin authentication on the application and add the origin under **Allowed Origins (CORS)** |
| `Callback URL mismatch` at login | The callback is not in the application's allowlist | `auth0 api patch "clients/YOUR_CLIENT_ID" --data '{"callbacks":["http://localhost:3000/auth/callback"],"allowed_logout_urls":["http://localhost:3000"],"web_origins":["http://localhost:3000"]}'` |
| `Invalid state` after the login redirect | `AUTH0_SECRET` is missing or under 32 bytes | Generate one with `openssl rand -hex 32`, set `APP_BASE_URL` to the URL the app actually serves, and restart |
| `The client was not found` | `AUTH0_CLIENT_ID` names no client on this tenant — usually a stale value or the wrong domain | Run `auth0 apps list`, copy the matching `client_id` and secret into the env file, confirm `AUTH0_DOMAIN`, and restart |
| `workUnitAsyncStorage` invariant on Next.js 15.5.x | An async Auth0 call ran in a statically rendered server component | Add `export const dynamic = 'force-dynamic'` to the page or layout, and check the installed `next` version against the `peerDependencies` range in `@auth0/nextjs-auth0` |
| Dev server exits at startup with a socket error | A missing env var threw during module init before the port was bound | Confirm `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, and `APP_BASE_URL`, then restart |
| `EAGAIN: resource temporarily unavailable` | An OS file-descriptor limit, not a code defect | Ask the developer to re-run the command in their own terminal |

---

## Testing

1. Decode the access token and confirm `aud` is `https://YOUR_AUTH0_DOMAIN/my-org/`, `org_id` matches the organization under test, and `scope` carries what the screen calls.
2. Exercise each screen as an organization admin: edit the profile, add and detach an identity provider, add and verify a domain, invite a member, change a member's roles.
3. Repeat as a plain member holding no `my_org:*` permissions and confirm every mutating call returns `403`.
4. Sign in as an admin of a **second** organization and confirm the first organization's data is unreachable.
5. Read the matching `my_organization_api_*` tenant log event for each call to confirm it reached the API, and to see the reason for any refusal.
6. Leave an admin session idle past 10 minutes, then act again, to confirm the refresh path works and the expired token is not surfaced to the user.

---

## Common Mistakes

- **Mirroring organizations, members, or roles into a local database** "for speed" — read them from the API or the session on each request instead.
- **Reusing a token minted for your own API** against `my-org/` — mint a token for the `my-org/` audience in the tier that holds the user's session.
- **Requesting the `/api/v2/` audience and expecting `my-org/` routes to answer** — the two audiences are distinct.
- **Passing `scope` to `getAccessToken` as an array** — it takes a space-delimited string.
- **Importing components from `@auth0/universal-components-react/rwa`** — that entry point exports only `Auth0ComponentProvider`; components come from the package root.
- **Hand-writing forms because `react-hook-form` or Tailwind isn't installed** — install the peer dependency and use the prebuilt component.
- **Assuming a client grant is sufficient** — the scope must also exist as an RBAC permission on the caller's role.
- **Deleting an identity provider to unlink it** — `POST identity-providers/{idp_id}/detach` unlinks it and leaves the provider intact.
- **Putting an organization ID in the path or body** — the API reads it from the token's `org_id`.

---

## Related Capabilities

- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Login and session mechanics for the SDK in play — follow the framework reference loaded alongside this one
- Organization lifecycle, membership, and B2B login flows — ask for Organizations (`feature:organizations`)
- An Auth0-hosted portal instead of your own admin screens — ask for Universal Portals (`feature:universal-portals`)
- Step-up verification before a destructive org-admin action — ask for MFA (`feature:mfa`)
- Multi-tenant data isolation and B2B architecture review — ask for guidance (`guidance`)

---

## References

- [My Organization API](https://auth0.com/docs/manage-users/my-organization-api)
- [Auth0 Organizations](https://auth0.com/docs/manage-users/organizations)
- [`@auth0/myorganization-js`](https://github.com/auth0/myorganization-js)
- [Universal Components overview](https://auth0.com/docs/get-started/universal-components/universal-components-overview)
- [SaaStart reference app](https://github.com/auth0-ui-components/saas-starter-uicomponents)
- [Multi-Resource Refresh Tokens](https://auth0.com/docs/secure/tokens/refresh-tokens/multi-resource-refresh-token)
