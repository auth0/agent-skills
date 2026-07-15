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
or Terraform. The operations are:

**Create an organization:**
- CLI: `auth0 orgs create`
- Terraform: `auth0_organization` resource

**Add a member:**
- CLI: `auth0 orgs members add`
- Terraform: `auth0_organization_member` resource

**Enable a connection for an org:**
- CLI: `auth0 orgs connections add`
- Terraform: `auth0_organization_connections` resource

**Assign a role within an org:**
- CLI: `auth0 orgs roles assign`
- Management API: `POST /api/v2/organizations/{id}/members/{user_id}/roles`

---

## Invitation flow

```bash
# Create an invitation (user doesn't need an Auth0 account yet)
auth0 api post /api/v2/organizations/{org_id}/invitations \
  --data '{"invitee":{"email":"user@company.com"},"inviter":{"name":"Admin"},"client_id":"YOUR_CLIENT_ID"}'
```

The invitee receives an email. When they click the link, they authenticate and are added as a member.

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Forgetting `organization` in `authorizationParams` | Always pass the org identifier at login time |
| Using `org_id` from ID token on backend | Validate from the access token, not ID token |
| Mixing up org `id` (org_xxx) and `name` (slug) | `id` for API calls, `name` for display |
| Granting global roles instead of org-level roles | Use the org member roles endpoint, not the user roles endpoint |
| Not enabling a connection for the org | Dashboard → Organization → Connections → enable the connection |

---

## Multi-tenant architecture

For broader B2B SaaS architecture guidance (tenant isolation models, when to use one Auth0 organization per customer vs. shared connections), the router loads the multi-tenant pattern guidance alongside this file for architecture questions.
