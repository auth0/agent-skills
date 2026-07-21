# Auth0 CLI — Tenant Configuration

Use the Auth0 CLI when the project has no Terraform infrastructure and no active MCP session.
This is the default tooling. Install with: `brew install auth0/auth0-cli/auth0`

Authenticate: `auth0 login`

# Auth0 CLI — Command Reference

The Auth0 CLI (`auth0`) lets you manage your tenant from the terminal. Install it via Homebrew (`brew install auth0/auth0-cli/auth0`). For complete flag definitions and examples, see the Full CLI Reference section below.

---

## Before You Start: Authenticate

```bash
auth0 login                          # interactive device-code login
auth0 login --scopes "read:client_grants"  # request extra scopes if 403
auth0 login --domain <tenant>.auth0.com --client-id <id> --client-secret "$AUTH0_CLIENT_SECRET"  # CI/CD
```

See the Authentication Details section below for machine login with JWT, tenant management, and logout.

---

## Quick Decision Guide

| What you're doing | Command to use |
|-------------------|---------------|
| Setting up a new project | `auth0 apps create --type spa\|regular\|m2m\|native --json` |
| Need a client ID or secret | `auth0 apps show <id> -r --json` |
| Registering a backend API | `auth0 apis create --identifier "https://..." --json` |
| Finding a user's ID | `auth0 users search --query "email:..." --json` |
| Creating/managing roles (RBAC) | `auth0 roles create` / `auth0 users roles assign` |
| B2B multi-tenancy | `auth0 orgs create` |
| Custom login logic | `auth0 actions create --trigger post-login --json` |
| Branding the login page | `auth0 ul update --logo ... --accent ...` |
| Custom domain for login | `auth0 domains create --domain "auth.myapp.com" --json` |
| Debugging a failed login | `auth0 logs tail --filter "type:f" --json-compact` |
| Testing a login flow | `auth0 test login <client-id>` |
| Exporting config as Terraform | `auth0 terraform generate --output-dir ./terraform` |
| Managing connections, grants, hooks | `auth0 api get <path>` |
| Scripting / parsing output | Add `--json` or `--json-compact` to any command |
| Security hardening | `auth0 protection brute-force-protection update --enabled true` |
| Routing logs externally | `auth0 logs streams create datadog\|http\|splunk` |
| Bulk importing users | `auth0 users import --connection-name ... --users '...' --json` |

---

## Command Overview

### Apps — Manage Applications

Create or inspect Auth0 applications (client ID, secret, callback URLs, app type). Alias: `auth0 clients`.

```bash
auth0 apps create --name "My SPA" --type spa \
  --auth-method None \
  --callbacks "http://localhost:3000" \
  --logout-urls "http://localhost:3000" \
  --origins "http://localhost:3000" --json

auth0 apps list --json-compact
auth0 apps show <client-id> --json
auth0 apps update <client-id> --callbacks "http://localhost:3000,https://myapp.com" --json
auth0 apps delete <client-id> --force
```

App types: `spa`, `regular`, `m2m`, `native`, `resource_server`

### APIs — Manage API Resources

Register backend APIs (Resource Servers) to protect with Auth0 tokens. Alias: `auth0 resource-servers`.

```bash
auth0 apis create --name "My API" --identifier "https://api.myapp.com" \
  --scopes "read:data,write:data" --token-lifetime 3600 --json

auth0 apis list --json-compact
auth0 apis scopes list <api-id> --json
```

**Key distinction:** `apps` = the client requesting tokens. `apis` = the resource accepting tokens.

### Users — Manage Users

Create, search, inspect, import, and manage users in your tenant.

```bash
auth0 users search --query "email:user@example.com" --json
auth0 users search-by-email user@example.com --json-compact
auth0 users create --connection-name "Username-Password-Authentication" \
  --email "test@example.com" --password "$USER_PASSWORD" --json
auth0 users show <user-id> --json
auth0 users blocks list <email> --json
auth0 users blocks unblock <email>
auth0 users import --connection-name "Username-Password-Authentication" \
  --users '[...]' --upsert --json
```

**Note:** `--json` output for user commands returns full profiles (email, metadata) and import payloads carry password hashes — avoid piping to shared logs/CI output.

### Roles — Manage RBAC Roles

Create roles, assign permissions, and assign roles to users.

```bash
auth0 roles create --name "editor" --description "Can edit content" --json
auth0 roles permissions add <role-id> --api-id <api-id> --permissions "read:data,write:data" --json
auth0 users roles assign <user-id> --roles <role-id>
auth0 users roles show <user-id> --json-compact
```

### Organizations — B2B Multi-Tenancy

Manage organizations for B2B SaaS scenarios. Alias: `auth0 orgs`.

```bash
auth0 orgs create --name "acme-corp" --display "Acme Corporation" \
  --logo "https://acme.com/logo.png" --accent "#FF6600" --json
auth0 orgs members list <org-id> --json
auth0 orgs invitations create --org-id <org-id> --invitee-email "new@acme.com" \
  --inviter-name "Admin" --client-id <id> --json
```

### Actions — Serverless Auth Pipeline

Create and deploy serverless functions at auth pipeline trigger points.

```bash
auth0 actions create --name "Add Claims" --trigger "post-login" \
  --code 'exports.onExecutePostLogin = async (event, api) => { ... }' --json
auth0 actions deploy <action-id>
```

Triggers: `post-login`, `credentials-exchange`, `pre-user-registration`, `post-user-registration`, `post-change-password`, `send-phone-message`

**Important:** You must `deploy` after creating or updating for changes to take effect.

### Logs — Debugging & Monitoring

```bash
auth0 logs tail --filter "type:f" --json-compact    # real-time failed logins
auth0 logs list --filter "type:f" --number 20 --json-compact  # historical
```

Common codes: `s` (success), `f` (failed login), `slo` (logout), `fs` (silent auth failure)

### Domains — Custom Domains

```bash
auth0 domains create --domain "auth.myapp.com" --type "auth0_managed_certs" --json
auth0 domains verify <domain-id> --json
```

### Universal Login — Branding

```bash
auth0 ul update --accent "#FF6600" --background "#FFFFFF" \
  --logo "https://myapp.com/logo.png" --json
```

### Terraform — Export as IaC

```bash
auth0 terraform generate --output-dir ./terraform --resources "auth0_client,auth0_connection"
```

### Test — Verify Login Flows

```bash
auth0 test login <client-id>
auth0 test login <client-id> --audience "https://api.myapp.com" --scopes "openid profile email"
```

### Attack Protection — Security Hardening

```bash
auth0 protection brute-force-protection update --enabled true
auth0 protection breached-password-detection update --enabled true
auth0 protection bot-detection update --enabled true
```

### Log Streams — External Routing

```bash
auth0 logs streams create datadog    # interactive setup
auth0 logs streams create http       # custom webhook
auth0 logs streams list --json
```

Supported: eventbridge, eventgrid, http, datadog, splunk, sumo

### Raw API Mode — Direct Management API Access

When a dedicated command doesn't exist, `auth0 api` calls Management API v2 endpoints directly.

```bash
auth0 api get connections
auth0 api post client-grants --data '{"client_id":"...","audience":"...","scope":["read:data"]}'
auth0 api get stats/daily -q "from=20240101" -q "to=20240131"
```

---

## Output Formatting

Always use `--json` or `--json-compact` for machine-readable output.

| Flag | When to use |
|------|-------------|
| `--json` | Human inspection, debugging — pretty-printed with indentation |
| `--json-compact` | Piping to `jq`, scripting, pipelines — compact single-line |
| `--csv` | Spreadsheets and tabular export |

```bash
auth0 apps list --json-compact | jq '.[] | {client_id, name}'
auth0 users show <user-id> --json-compact | jq '{id: .user_id, email: .email}'
auth0 roles list --json-compact | jq '.[].name'
```

---

## References

- [Auth0 CLI Documentation](https://auth0.github.io/auth0-cli/)
- [Auth0 Management API v2](https://auth0.com/docs/api/management/v2)
- [Auth0 Documentation](https://auth0.com/docs)
