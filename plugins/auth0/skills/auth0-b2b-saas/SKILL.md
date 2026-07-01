---
name: auth0-b2b-saas
description: Use when building a B2B SaaS app where customers are companies that each need isolation — Auth0 Organizations, per-org connections (database/social/enterprise SSO), org-aware login, just-in-time membership, invitations, org-scoped RBAC roles, and token shaping (org_id, roles) enforced server-side. Trigger on "multi-tenant SaaS", "per-customer login", "Organizations", "enterprise SSO per customer", "invite teammates", or "org-scoped roles".
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F3E2"
    homepage: https://github.com/auth0/agent-skills
    requires:
      bins:
        - auth0
    os:
      - darwin
      - linux
    install:
      - id: brew
        kind: brew
        package: auth0/auth0-cli/auth0
        bins: [auth0]
        label: 'Install Auth0 CLI (brew)'
---

# Auth0 B2B SaaS Multi-Tenancy

Stand up a complete B2B SaaS auth setup where each customer is an Auth0 **Organization** with
its own connections, members, and roles — and the app enforces tenant isolation from the token.

This is a **scenario skill**: it composes primitives end to end (CLI provisioning →
org-aware login → JIT membership & invitations → org-scoped RBAC → token shaping → app
enforcement). For raw command flags see `auth0-cli`; for full framework SDK setup see the matching
framework skill (`auth0-nextjs`, `auth0-react`, `express-oauth2-jwt-bearer`, etc.). The
**org-scoped enforcement pattern** (reading `org_id` from the token and scoping all data to it) is
B2B-specific and lives in this skill's stack-specific integration references (Step 5).

---

## Overview

### When to use this skill

- Customers are **companies**, each needing isolated users, login, and roles
- **Login methods differ per customer** — one signs in with email + password (or code/passkey), another with Okta/Entra SSO
- Teammates are added via **invitations** or **just-in-time (JIT) membership**
- Authorization is **org-scoped**: the same user can be admin in org A and viewer in org B

### Mental model

| Concept | What it is |
|---------|-----------|
| **Organization** | A customer/tenant. Has its own enabled connections, members, branding |
| **Enabled connection** | A login method (email/password/code/passkey, social, or enterprise SSO) turned on *for one org* |
| **JIT membership** | Auto-join an org the first time a user authenticates via its connection (`assign_membership_on_login`) |
| **Invitation** | Email link that adds an existing/new user to an org, optionally with roles |
| **Org-scoped role** | A role assigned to a user *within a specific org* — surfaces in `event.authorization.roles` |
| **`org_id` claim** | Auto-added to the access token when a user authenticates through an org. **This is the tenant boundary** |

### End-to-end flow

```
choose architecture → provision (CLI) → sign-up / org creation → org-aware login (organization param)
  → membership (JIT or invitation) → org-scoped RBAC → token shaping (org_id + roles) → enforce in app
```

### Pick the account model first

Before provisioning, decide **which user-and-team shape fits your app**. Most B2B SaaS falls into one
of four patterns:

| Pattern | Description | Use when | Example |
|---------|-----------|----------|---------|
| **Company Tenant** | First user signs up, creates their company org, becomes admin, invites teammates; each company isolated | Most B2B SaaS (the skill's default) | GitHub/Vercel free→team, most B2B |
| **Isolated Workspace** | Each workspace/company is fully isolated — separate subscription, zero cross-workspace data | Communication platforms | Slack, Notion |
| **Cross-Org Member** | One identity belongs to many companies with different roles; cross-org collaboration | Collaboration tools, project mgmt | GitHub, Linear, Vercel, Figma |
| **Project Platform** | Users build multiple projects/apps, each with its own team | Multi-tenant platforms | Stripe Connect, Shopify |

**Read [Account Models](references/account-models.md)** to compare these patterns across market-leading SaaS apps (Vercel, GitHub, Linear, Slack, Notion, Stripe, Figma), then map to Auth0 Organizations. This is foundational — the rest of the skill assumes you've chosen a pattern.

Then read [Architecture Patterns](references/architecture.md) for provisioning, signup flows, login methods, and role models. Highlights:

- **Two Auth0 clients**: a *Dashboard* client (`organization_usage: require`) for org-context
  login, and a separate *Management* client (machine credentials) for privileged provisioning.
- **Self-service org creation**: the first user signs up, verifies email, creates the org via the
  Management API, and is assigned the **admin** role — then re-logs in org-bound (the **Company Tenant** default).
- **Per-org enterprise SSO** configured self-service by the customer, routed by `domain_aliases`
  **only after DNS domain-ownership verification**.

---

## CRITICAL security default — enforce isolation from the token

**Always derive the active tenant from the access token's `org_id` claim, server-side. Never
trust an org id from the URL, request body, or a client-set header.**

A user can be a member of many orgs. The `org_id` in the validated access token is the *only*
trustworthy statement of which org this request acts on. Authorization checks (roles,
permissions) must be evaluated **relative to that `org_id`** — a role grants access only inside
the org it was assigned in. Skipping this is the classic B2B cross-tenant data-leak bug.

See [Integration & Enforcement](references/integration-js.md) for the JavaScript/TypeScript enforcement pattern, or the stack-specific reference in Step 5.

---

## Step 1 — Provision the tenant (Auth0 CLI)

Run these once per environment. Full flags: [Setup & Provisioning](references/setup.md).

```bash
auth0 login                                          # authenticate the CLI

# Register the app (SPA shown; use regular for server-rendered) and the API
auth0 apps create --name "Acme SaaS" --type spa --json
auth0 apis create --name "Acme API" --identifier "https://api.acme.com" --json

# Create an organization per customer
auth0 orgs create --name "customer-a" --display "Customer A" --json

# Enable a connection for that org, with JIT membership on first login
auth0 api post "organizations/<org-id>/enabled-connections" \
  --data '{"connection_id":"<conn-id>","assign_membership_on_login":true}'

# Org-scoped roles (RBAC). Create the role, attach API permissions
auth0 roles create --name "org-admin" --description "Org administrator" --json
auth0 roles permissions add <role-id> --api-id <api-id> \
  --permissions "read:billing,write:members" --json
```

Enable **RBAC** + **Add Permissions in the Access Token** on the API so a `permissions` claim is
emitted (this also upgrades the token dialect to `*_authz`). Roles still need the Action in Step 4.

---

## Step 2 — Org-aware login

Send users through their organization's login prompt by passing the `organization` parameter to
`/authorize`. For invitation acceptance, your login route must also forward the `invitation`
parameter from the email link.

```
GET /authorize?...&organization=<org-id>
# invitation link: https://app/login?invitation=<ticket>&organization=<org-id>&organization_name=<slug>
```

**`organization` accepts an org ID by default.** You can pass the org **name** instead, but only
if the tenant enables *Use Organization Names in the Authentication API*; the token then carries
both `org_id` and `org_name`, and you should validate `org_name` **in addition to** `org_id`.
Prefer IDs as the trust anchor — names are mutable.

How the app *resolves which org* to pass (subdomain, org name, identifier-first + Home Realm
Discovery, or post-login prompt) is an architecture choice — see the resolution table in
[Architecture Patterns](references/architecture.md#organization-resolution-at-login--how-the-user-reaches-the-right-org).
How you pass `organization` for a given SDK is in the stack-specific integration reference in Step 5.

---

## Step 3 — Membership: invitations & JIT

- **JIT** — set `assign_membership_on_login: true` on the org's enabled connection (Step 1). Any
  user who authenticates via that connection is auto-added to the org. Use for enterprise SSO
  where everyone on the IdP belongs to the customer.
- **Invitations** — for explicit, role-bearing onboarding:

```bash
auth0 orgs invitations create --org-id <org-id> \
  --inviter-name "Admin" --invitee-email "teammate@customer-a.com" \
  --client-id <app-client-id> --roles <role-id> --json
```

The invitee gets an email; the link lands on your login route with `invitation` + `organization`.

**Brand the invitation email** with org Liquid variables (`organization.display_name`,
`organization.branding.*`, `inviter.name`, `roles.name`) — and the verification email's redirect
is what kicks off self-service org creation. Both, plus the custom-domain requirement and the
`resultUrl` restriction on newer tenants, are covered in
[Architecture → Onboarding & invitation emails](references/architecture.md#onboarding--invitation-emails).

---

## Step 4 — Token shaping (post-login Action)

`org_id` is added automatically. To put **roles** in the token, deploy a post-login Action that
reads the org-scoped `event.authorization.roles`:

```bash
auth0 actions create --name "B2B token shaping" --trigger post-login \
  --code 'exports.onExecutePostLogin = async (event, api) => {
    const ns = "https://acme.com";
    if (event.authorization) {
      api.accessToken.setCustomClaim(`${ns}/roles`, event.authorization.roles);
      api.idToken.setCustomClaim(`${ns}/roles`, event.authorization.roles);
    }
  }' --json
# then deploy it and add it to the Login flow
auth0 actions deploy <action-id>
```

Use a namespaced claim (`https://acme.com/roles`) — Auth0 silently drops non-namespaced custom
claims. See [API & Token Reference](references/api.md) for the claim shapes and dialects.

For JIT and invited users who arrive without a role, also deploy an **Add Default Role** Action
that assigns `member` when `event.organization` is set and the user has no role yet — see the
three-Action sequence in [Architecture Patterns](references/architecture.md#post-login-actions-deploy-in-this-order).

---

## Step 5 — Enforce in the app

On every protected request: validate the access token, read `org_id`, scope all data and
authorization to it, then check `permissions`/roles. Choose the reference for your stack:

| Stack | Reference |
|-------|-----------|
| JavaScript / TypeScript (Next.js, React SPA, Express) | [Integration & Enforcement — JS](references/integration-js.md) |
| Python (FastAPI, Flask) | [Integration & Enforcement — Python](references/integration-python.md) |
| Java (Spring Boot) | [Integration & Enforcement — Java](references/integration-java.md) |
| Go | [Integration & Enforcement — Go](references/integration-go.md) |
| .NET (ASP.NET Core) | [Integration & Enforcement — .NET](references/integration-dotnet.md) |

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Trusting org id from URL/body | Read `org_id` from the validated access token only |
| Checking roles globally | Roles are org-scoped — evaluate them relative to the token's `org_id` |
| Non-namespaced custom claim | Use `https://yourdomain/roles`; Auth0 drops un-namespaced claims |
| Expecting roles in token without an Action | `org_id` is automatic; roles require the post-login Action (Step 4) |
| Enabling a connection tenant-wide for one customer | Enable it *per org* via `enabled-connections` |
| Forgetting to forward `invitation` | Invitation acceptance fails without the `invitation` param on `/authorize` |
| Honoring an SSO `domain_aliases` without proof | Verify domain ownership (DNS TXT) first — otherwise one org can hijack another's email domain |
| One client for both login and provisioning | Split into a Dashboard client (login) and a Management client (Management API), per [Architecture Patterns](references/architecture.md) |

---

## Advanced organization capabilities

Once the core flow works, Auth0 Organizations support more. See
[Advanced Capabilities](references/advanced.md):

- **Self-service enterprise SSO** — a hosted assistant lets a customer's admin connect their own
  IdP (no UI work for you); on completion Auth0 creates the connection and enables it on the org.
- **M2M (Client Credentials) scoped per org** — a customer's backend gets an `org_id`-bound machine
  token; associate the client grant per org and shape claims via a **credentials-exchange** Action
  (the post-login Action in Step 4 does **not** run for M2M).
- **SCIM directory sync** — central provisioning/deprovisioning from the customer's IdP.
- **Per-org branding**, **org metadata** (plan/feature gating), and **per-org token quota**.

## Verifying the setup

After provisioning, confirm the tenant behaves as configured (login works, `org_id` lands in the
token, scope enforcement rejects the wrong org). See [API & Token Reference](references/api.md#verification)
for the manual checks (`auth0 test login`, decode the token, assert `org_id` + roles + permissions).

---

## Related skills

- `auth0-cli` — full command/flag reference for orgs, roles, actions, connections
- `auth0-nextjs` / `auth0-react` / `express-oauth2-jwt-bearer` — framework login & API enforcement
- `auth0-mfa` — add step-up MFA for sensitive org actions
- `auth0-custom-domains` — per-tenant custom domains (required to customize the invitation flow)
- `auth0-branding` — authoring the invitation / verification email templates and Universal Login text

## References in this skill

- [Account Models](references/account-models.md) — map market-leading B2B SaaS account shapes (personal/team, workspace-first, platform/marketplace) to Auth0 patterns
- [Architecture Patterns](references/architecture.md) — two-client setup, signup flows, login methods, role model
- [Setup & Provisioning](references/setup.md) — CLI commands for organizations, connections, roles, actions
- [Integration & Enforcement — JS](references/integration-js.md) — Next.js, React SPA, Express: org-aware login + org_id-scoped middleware
- [Integration & Enforcement — Python](references/integration-python.md) — FastAPI and Flask: org-aware login + org_id-scoped enforcement
- [Integration & Enforcement — Java](references/integration-java.md) — Spring Boot: org_id claim extraction + scoped controller/aspect pattern
- [Integration & Enforcement — Go](references/integration-go.md) — go-jwt-middleware: typed B2B claims + org_id-scoped handler
- [Integration & Enforcement — .NET](references/integration-dotnet.md) — ASP.NET Core: ClaimsPrincipal org_id + scoped OrgContext service
- [Advanced Capabilities](references/advanced.md) — self-service SSO, M2M-per-org, SCIM, per-org branding/metadata/token quota

## References

- [Reference starter app: auth0-b2b-saas-starter ("SaaStart")](https://github.com/auth0-developer-hub/auth0-b2b-saas-starter) — the architecture patterns here are drawn from this
- [B2B SaaS architecture](https://auth0.com/docs/get-started/architecture-scenarios/business-to-business)
- [Organizations](https://auth0.com/docs/manage-users/organizations)
- [Login flows for Organizations](https://auth0.com/docs/manage-users/organizations/login-flows-for-organizations)
- [Enable organization connections](https://auth0.com/docs/manage-users/organizations/configure-organizations/enable-connections)
- [Use Organization Names in the Authentication API](https://auth0.com/docs/manage-users/organizations/configure-organizations/use-org-name-authentication-api)
- [Using tokens with Organizations](https://auth0.com/docs/manage-users/organizations/using-tokens)
