# Setup & Provisioning (Auth0 CLI)

Provision the tenant for B2B multi-tenancy. Run once per environment (dev/stage/prod). All
commands use the `auth0` CLI — see the `auth0-cli` skill for complete flag definitions.

## 0. Authenticate

```bash
auth0 login                                          # interactive device-code login
# CI/CD:
auth0 login --domain <tenant>.auth0.com --client-id <id> --client-secret "$AUTH0_CLIENT_SECRET"
```

If a call returns `403 insufficient_scope`, re-login requesting the scope, e.g.
`auth0 login --scopes "create:organization_connections"`.

## 1. Application and API

```bash
# SPA (React/Vue/Angular). Use --type regular for server-rendered web apps.
auth0 apps create --name "Acme SaaS" --type spa \
  --callbacks "http://localhost:3000/callback" \
  --logout-urls "http://localhost:3000" \
  --origins "http://localhost:3000" --json

auth0 apis create --name "Acme API" --identifier "https://api.acme.com" --json
```

Capture the `client_id` and the API `id` (resource server id) from the JSON output.

### Make the application organization-aware

In the Dashboard (Application → Organizations) or via the Management API, set how the app handles
orgs:

- **Organization usage**: `require` (every login must target an org) or `allow`
- **Organization prompt**: `pre-login-prompt` lets users pick/enter their org if none is passed

```bash
auth0 api patch "clients/<client-id>" \
  --data '{"organization_usage":"require","organization_require_behavior":"pre_login_prompt"}'
```

## 2. Connections

Connections must exist at the tenant level first (the org "enables" an existing connection — it
cannot create one). There is no full CRUD CLI command for connections; use raw API mode.

```bash
auth0 api get connections --json-compact | jq '.[] | {id, name, strategy}'
```

Create connections in the Dashboard (Authentication → Database / Social / Enterprise) or via
`auth0 api post connections`. For enterprise SSO (Okta, Entra, generic SAML/OIDC) create one
connection per customer IdP.

## 3. Organizations (one per customer)

```bash
auth0 orgs create --name "customer-a" --display "Customer A" \
  --logo "https://customer-a.com/logo.png" --accent "#FF6600" --json
# capture org_id (org_xx…)
```

`--name` is a URL-safe slug (useful as a subdomain/path: `customer-a.app.com`). `--display` is the
label shown on the login prompt.

## 4. Enable connections per org (with JIT)

```bash
# Enable a connection for the org. assign_membership_on_login = JIT membership.
auth0 api post "organizations/<org-id>/enabled-connections" \
  --data '{"connection_id":"<conn-id>","assign_membership_on_login":true,"show_as_button":true}'

# Inspect / change later
auth0 api get  "organizations/<org-id>/enabled-connections" --json-compact
auth0 api patch "organizations/<org-id>/enabled-connections/<conn-id>" \
  --data '{"assign_membership_on_login":false}'
```

- `assign_membership_on_login: true` → user is auto-added to the org on first auth via this
  connection. Use for enterprise SSO where the whole IdP belongs to one customer.
- `show_as_button: true` → connection appears as a button on the org login prompt.

## 5. Org-scoped RBAC roles

```bash
# Enable RBAC on the API first (Dashboard → APIs → RBAC Settings, or):
auth0 api patch "resource-servers/<api-id>" \
  --data '{"enforce_policies":true,"token_dialect":"access_token_authz"}'

# Create a role and attach API permissions (scopes)
auth0 roles create --name "org-admin" --description "Org administrator" --json
auth0 roles permissions add <role-id> --api-id <api-id> \
  --permissions "read:billing,write:members" --json
```

`enforce_policies: true` + `access_token_authz` makes Auth0 emit a `permissions` claim in the
access token. Roles themselves go in the token via the Action in Step 6.

### Assign a role to a member within an org

```bash
# Add an existing user to the org, then assign the org-scoped role
auth0 api post "organizations/<org-id>/members" --data '{"members":["<user-id>"]}'
auth0 api post "organizations/<org-id>/members/<user-id>/roles" \
  --data '{"roles":["<role-id>"]}'
```

## 6. Token-shaping Action

See the Action code in `SKILL.md` Step 4 and the claim shapes in `api.md`. Create, deploy, and
bind it to the **Login / Post Login** flow.

## Idempotency / re-runs

These commands are imperative and not idempotent — re-running `orgs create` makes a second org.
Before re-provisioning, list existing resources (`auth0 orgs list`, `auth0 roles list`,
`auth0 api get "organizations/<org-id>/enabled-connections"`) and update instead of recreate.
This manual reconciliation is exactly what the **Apply** plane (declarative spec + diff) is meant
to replace.
