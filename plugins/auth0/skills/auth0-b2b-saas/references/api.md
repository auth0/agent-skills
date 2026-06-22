# API & Token Reference

Token claim shapes, RBAC/dialect behavior, key Management API endpoints, and manual verification
steps for the B2B scenario.

## Token claims with Organizations

When a user authenticates **through an organization**, the access token includes `org_id`
automatically. Roles and permissions depend on configuration:

```jsonc
// Access token payload (decoded) — illustrative
{
  "iss": "https://acme.us.auth0.com/",
  "aud": "https://api.acme.com",
  "sub": "auth0|abc123",
  "org_id": "org_abc123",                       // AUTOMATIC — the tenant boundary
  "org_name": "customer-a",
  "permissions": ["read:billing", "write:members"], // present if RBAC + "Add Permissions" on
  "https://acme.com/roles": ["org-admin"]       // present only if the post-login Action sets it
}
```

| Claim | Source | Notes |
|-------|--------|-------|
| `org_id` | Automatic when `organization` param used | Tenant identity. Enforce against this |
| `org_name` | Automatic | Slug; convenience only, do not authorize on it |
| `permissions` | API RBAC + "Add Permissions in the Access Token" | Upgrades dialect to `*_authz` |
| `https://<ns>/roles` | Post-login Action (`event.authorization.roles`) | Must be namespaced or Auth0 drops it |

### Roles vs permissions

- **Permissions** (scopes) land in the token natively once RBAC + "Add Permissions" is on. Check
  with `requiredScopes(...)` / a `permissions` check.
- **Roles** are NOT in the token by default — add them via the post-login Action. Roles are
  coarse; permissions are the fine-grained enforcement primitive. Prefer permission checks for
  authorization and use roles for UI/role-display.

### Token dialects

Enabling RBAC "Add Permissions in the Access Token" auto-upgrades the dialect:
`access_token` → `access_token_authz`, `rfc9068_profile` → `rfc9068_profile_authz`. You don't set
this by hand when using the Dashboard toggle; via the Management API set
`token_dialect: "access_token_authz"` on the resource server.

## Key Management API endpoints

| Action | Endpoint |
|--------|----------|
| Enable connection on org | `POST organizations/{org_id}/enabled-connections` |
| List org connections | `GET organizations/{org_id}/enabled-connections` |
| Modify org connection (JIT) | `PATCH organizations/{org_id}/enabled-connections/{conn_id}` |
| Add members | `POST organizations/{org_id}/members` |
| Add member roles | `POST organizations/{org_id}/members/{user_id}/roles` |
| Create invitation | `POST organizations/{org_id}/invitations` |
| List a user's memberships | `GET users/{user_id}/organizations` |

`assign_membership_on_login` (boolean) on the enabled-connection object controls JIT membership.

## Common errors

| Status / code | Cause | Fix |
|---------------|-------|-----|
| `403 insufficient_scope` (CLI) | CLI token lacks the scope | `auth0 login --scopes "create:organization_connections"` |
| Login: `invalid_request` org mismatch | User not a member and no JIT/invitation | Enable JIT, send an invitation, or assign membership |
| No `org_id` in token | Logged in without the `organization` param | Pass `organization` to `/authorize` |
| Custom roles claim missing | Action not deployed/bound, or claim not namespaced | Deploy the Action to the Login flow; namespace the claim |
| `permissions` claim missing | RBAC or "Add Permissions" off | Enable both on the API |

## Verification

Until a runtime verify harness exists for this scenario, verify manually:

```bash
# 1. Login against the app, targeting an org, and capture tokens
auth0 test login <client-id> --audience "https://api.acme.com" \
  --params "organization=<org-id>"

# 2. Decode the access token and assert the tenant + authz claims
#    (paste the access_token; or pipe through a jwt decoder)
#    EXPECT: org_id == <org-id>, permissions includes the role's scopes,
#            https://<ns>/roles includes the assigned role

# 3. Scope enforcement — call the API with and without the required scope
curl -H "Authorization: Bearer <token-with-scope>"   https://api.acme.com/members   # expect 200
curl -H "Authorization: Bearer <token-without-scope>" https://api.acme.com/members  # expect 403

# 4. Cross-tenant isolation — a token for org A must not read org B's data
#    Call the API with an org-A token against an org-B resource → expect 403/empty
```

These four checks (login, `org_id` lands, scope enforcement, cross-tenant rejection) are the
minimum readiness set the Verify plane will automate for this scenario.
