# Multi-Tenant Architecture with Auth0

---

## The two models

### Model 1: Organizations (recommended for B2B SaaS)

One Auth0 tenant, multiple Organizations. Each customer gets an Organization with their own:
- User pool (members)
- Login connections (their Okta, Google Workspace, etc.)
- Per-org roles and permissions

Best for: SaaS platforms serving business customers who want SSO and user management isolation.

(Organizations implementation is in feature-organizations.md — the router loads both for architecture questions.)

### Model 2: Multiple Auth0 tenants

One Auth0 tenant per customer. Maximally isolated.

Best for: Regulated industries requiring dedicated infrastructure, or customers needing separate Auth0 configuration that can't be modeled with Organizations.

Downsides: Operational complexity, higher cost, no cross-tenant user insight.

---

## Routing users to their organization

**1. Email domain routing:**
```javascript
function getOrgForEmail(email) {
  const domain = email.split('@')[1];
  return orgsByDomain[domain]; // look up in your DB
}

const orgId = getOrgForEmail(userEmail);
loginWithRedirect({ authorizationParams: { organization: orgId } });
```

**2. Subdomain routing:**
```javascript
const subdomain = window.location.hostname.split('.')[0]; // acme.yourapp.com → acme
const orgId = await lookupOrgBySlug(subdomain);
loginWithRedirect({ authorizationParams: { organization: orgId } });
```

---

## Protecting API data by org

```javascript
function requireOrg(orgId) {
  return (req, res, next) => {
    if (req.auth.payload.org_id !== orgId) {
      return res.status(403).json({ error: 'Access denied: wrong organization' });
    }
    next();
  };
}
```

---

## Per-org SSO connections

Each Organization can have dedicated enterprise connections (Okta SAML, Azure AD, Google Workspace):

```bash
auth0 orgs connections add --org-id org_xxx --connection-id con_xxx
```

Users in that org authenticate through their company's IdP automatically.
