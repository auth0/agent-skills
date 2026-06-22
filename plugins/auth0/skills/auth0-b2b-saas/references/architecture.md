# B2B SaaS Architecture Patterns

Common patterns for real B2B SaaS apps, grounded in Auth0's official reference starter
([auth0-b2b-saas-starter / "SaaStart"](https://github.com/auth0-developer-hub/auth0-b2b-saas-starter),
Next.js + `@auth0/nextjs-auth0`). Use this to decide *how* to shape sign-up, login methods,
and login routing for the app you're building — then provision with `setup.md` and enforce with
`integration.md`.

## Two-client architecture (the backbone)

Use **two** Auth0 applications, never one for both jobs:

| Client | Type | Purpose | Key config |
|--------|------|---------|-----------|
| **Dashboard** | `regular_web` | End-user login *in org context* | `organization_usage: "require"`, `organization_require_behavior: "post_login_prompt"` |
| **Management** | `regular` + client-grant | Privileged provisioning (create orgs, members, roles, connections, SCIM) | Client-grant for Management API scopes; secret never reaches the browser |

The Dashboard client issues org-bound user tokens; the Management client (machine credentials)
performs Management API writes from the server only. The onboarding/signup step uses the
Management client to create the org *before* the user has an org-bound session.

Also set tenant flag `enable_client_connections: false` so connections are enabled **per
org/client explicitly**, not auto-enabled tenant-wide.

## Sign-up / onboarding — self-service org creation

The default B2B sign-up is **self-service tenant creation**: the first user creates the
organization and becomes its admin.

```
sign up (shared DB connection, no org) → verify email
  → /onboarding/create : Management API creates org, adds user as member, assigns ADMIN role
  → redirect to /auth/login?organization=<org_id> : user gets an org-bound token
```

Reference server action (`app/onboarding/create/actions.ts`):

```ts
const { data: organization } = await managementClient.organizations.create({
  name: slugify(organizationName),          // URL-safe slug
  display_name: organizationName,
  enabled_connections: [{ connection_id: process.env.DEFAULT_CONNECTION_ID }],
});
await managementClient.organizations.addMembers({ id: organization.id },
  { members: [session.user.sub] });
await managementClient.organizations.addMemberRoles(
  { id: organization.id, user_id: session.user.sub },
  { roles: [process.env.AUTH0_ADMIN_ROLE_ID] });        // creator becomes admin
// then redirect to /auth/login?organization=<id>
```

The email-verification template's `resultUrl` points back at `/onboarding/create`, so a verified
user lands on the org-creation step. Use a verified email before allowing org creation.

### Three membership models — pick per customer

| Model | When | Mechanism |
|-------|------|-----------|
| **Self-service org creation** | New customer signs up themselves (hobby/personal or company org) | Onboarding flow above |
| **Invitation** | Admin adds named teammates, optionally with roles | `POST organizations/{id}/invitations`; email link carries `invitation` + `organization` |
| **JIT (auto-membership)** | Everyone on a customer's IdP belongs to that org | `assign_membership_on_login: true` on the org's enabled connection |

## Login methods

Think in terms of the **login experience** you want, not connection types. Pick one or more — they
can differ per org:

| Login method | What the user does | Auth0 implementation |
|--------------|--------------------|----------------------|
| **Email + password** | Email + a password | Shared connection, password method |
| **Email + code** | Email + a one-time code (no password) | Shared connection, email OTP |
| **Email + passkey** | Email + Face ID / Touch ID / security key | Shared connection, passkey (+ a fallback method) |
| **Phone** | Phone number + SMS one-time code | Shared connection, phone OTP |
| **Social** | "Continue with Google / GitHub" | Social connection, enabled per org |
| **Enterprise SSO** | Redirected to their company IdP (Okta, Entra, SAML) | Per-org enterprise connection, routed by verified domain |

For most apps, start with **email + password** (or **email + code** for a passwordless baseline),
then let enterprise customers add SSO later. You don't have to choose just one — offer several.

**Implementation note (skip if you don't care):** the first four rows are all the *same* Auth0
"database" connection (`strategy: "auth0"`) — you just turn on different **identifiers**
(email / phone / username) and **methods** (password, email/phone OTP, passkey) via Flexible
Identifiers on that one connection, enabled on the Dashboard + Management clients and on each org.
Social and Enterprise SSO are separate connections enabled per org (SSO routed via `domain_aliases`).
Caveats: passkeys need at least one fallback method; phone/email codes require Universal Login +
Identifier-First (phone also needs an SMS provider). Email-code signup auto-verifies the email
(`email_verified = true`) — handy, since org creation needs a verified email.

Self-service SSO creation (reference `.../sso/oidc/new/actions.ts`, admin-gated):

```ts
const { data: connection } = await managementClient.connections.create({
  display_name: displayName,
  name: `${slugify(displayName)}-${crypto.randomBytes(4).toString("hex")}`, // globally unique
  strategy: "oidc",
  enabled_clients: [process.env.AUTH0_CLIENT_ID],
  options: { type, discovery_url, client_id, client_secret, domain_aliases, scope },
});
await managementClient.organizations.addEnabledConnection(
  { id: session.user.org_id! },
  { connection_id: connection.id, assign_membership_on_login: true /* JIT toggle */ });
```

### Verify domain ownership before Home Realm Discovery

`domain_aliases` drive Home Realm Discovery (a work email auto-routes to that org's IdP). **Never
honor a domain alias the customer hasn't proven they own** — otherwise org A could claim
`@victim.com` and intercept its logins. The reference verifies a **DNS TXT record** first:

```ts
// issue a per-org token, store on org metadata, ask customer to add a TXT record, then:
const txt = await resolveTxt(domain);            // node:dns/promises
const ok = txt.some(r => r.join("").replace(`${RECORD_ID}=`, "") === org.metadata.domainVerificationToken);
// only attach domain_aliases once ok === true
```

### Option B (recommended): Auth0 Self-Service Enterprise Configuration — hosted SSO setup

Instead of building and maintaining the SSO-config UI yourself (Option A above), Auth0 has a
first-class **Self-Service Enterprise Configuration** feature: a *hosted* setup assistant that
walks the customer's admin through connecting their IdP, optionally verifying domains and
configuring SCIM provisioning. When they finish, Auth0 creates the Enterprise connection in your
tenant automatically and enables it on the chosen organization. Prefer this for hosted SSO unless
you need a fully custom in-app SSO UI.

Two resources, both managed via the Management API client (`managementClient.selfServiceProfiles`):

1. **Self-service profile** — created once per customer segment (up to 20 per tenant). Defines
   which IdP strategies the assistant offers and which user attributes it captures.

   ```ts
   const { data: profile } = await managementClient.selfServiceProfiles.create({
     name: "Enterprise customers",
     branding: { logo_url: "https://acme.com/logo.png", colors: { primary: "#FF6600" } },
     allowed_strategies: ["oidc", "samlp", "okta", "pingfederate"],
     user_attributes: [
       { name: "email", description: "Email", is_optional: false },
     ],
   });
   ```

2. **SSO access ticket** — a short-lived URL you generate and hand to the customer admin to launch
   the assistant. Bind the resulting connection straight to the org, optionally require domain
   verification and request SCIM scopes:

   ```ts
   const { data: ticket } = await managementClient.selfServiceProfiles.createSsoTicket(
     { id: profile.id },
     {
       enabled_organizations: [
         { organization_id: orgId, assign_membership_on_login: true, show_as_button: true },
       ],
       // 'required' forces the admin to add + verify a domain before the connection enables
       domain_aliases_config: { domain_verification: "required" },
       // optional SCIM directory sync provisioning set up in the same flow
       provisioning_config: { scopes: ["get:users", "post:users", "put:users", "delete:users"] },
       ttl_sec: 432000, // default 5 days
     }
   );
   // redirect / email the customer admin to ticket.ticket (the hosted assistant URL)
   ```

   Revoke with `managementClient.selfServiceProfiles.revokeSsoTicket(...)` if a ticket leaks or the
   deal falls through — this also terminates any in-progress assistant sessions.

Notes:
- `domain_verification: "required"` makes Auth0 enforce the same domain-ownership guarantee Option A
  hand-rolls — the connection won't enable until the admin proves domain ownership. Use `optional`
  or `none` only when HRD-by-domain isn't part of your routing.
- Dashboard roles **Admin** and **Editor – Connections** can create/manage profiles; the customer
  never needs access to your Auth0 tenant — they only touch the hosted assistant.
- Allowed strategies include `oidc`, `samlp`, `okta`, `adfs`, `waad` (Entra), `google-apps`,
  `pingfederate`, `keycloak-samlp`, and more.

## Organization resolution at login — how the user reaches the right org

| Strategy | How | Notes |
|----------|-----|-------|
| **Explicit `organization` (ID)** | App passes `?organization=org_xxx` to `/authorize` | Preferred. From subdomain, path, or prior selection |
| **Organization name** | Pass the org *name* as `organization` | Requires tenant setting "Use Organization Names in the Authentication API". Token then carries `org_name`; **validate `org_name` in addition to `org_id`** — IDs remain the trust anchor (names are mutable) |
| **Identifier-first + HRD** | `prompts.identifier_first: true`; user types email; `domain_aliases` route to the org's connection | Self-service enterprise SSO experience |
| **Organization prompt** | `organization_require_behavior: "post_login_prompt"`; Universal Login prompts for org | Fallback when the app can't determine the org up front |
| **Subdomain** | `customer-a.app.com` → look up org, pass its `org_id` | App maps subdomain → org id before redirecting to `/authorize` |

## Post-login Actions (deploy in this order)

The reference binds three post-login Actions:

1. **Add Default Role** — if the user has no org role yet and `event.organization` is set, assign
   the default `member` role via the Management API. Bootstraps JIT/invited users.
2. **Add Role to Tokens** — set the namespaced `${NS}/roles` claim from
   `event.authorization.roles` on both ID and access tokens.
3. **Security Policies** — enforce org-level policy (e.g. require MFA) read from org metadata.

Bind via `PATCH actions/triggers/post-login/bindings` in that sequence.

## Role model

The reference keeps it simple: **two roles, one per user** — `admin` (manage org config, members,
SSO, policies) and `member`. `lib/roles.ts` reads the first role from the claim and defaults to
`member`. Scale to more granular org-scoped roles + API permissions as needed, but a single
coarse role per user covers most B2B apps.

## App-side enforcement recap

Gate privileged server actions on **role + org**, and confirm any resource being modified belongs
to the caller's `org_id` (the reference's `withServerActionAuth` checks the session role; the SSO
delete action re-checks that the connection belongs to `session.user.org_id`). See
`integration.md` for the full enforcement contract.
