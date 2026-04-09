# Auth0 CLI Command Reference

Complete reference for all Auth0 CLI commands organized by category.

---

## Table of Contents

- [Authentication & Tenants](#authentication--tenants)
- [Applications](#applications)
- [APIs](#apis)
- [Users](#users)
- [Roles & Permissions](#roles--permissions)
- [Organizations](#organizations)
- [Actions](#actions)
- [Logs & Monitoring](#logs--monitoring)
- [Universal Login](#universal-login)
- [Testing & Debugging](#testing--debugging)
- [Global Flags & Output Formats](#global-flags--output-formats)

---

## Authentication & Tenants

Authenticate to your Auth0 tenant and manage tenant context.

### Login

```bash
# Device authorization flow (interactive, opens browser)
auth0 login

# Client credentials flow (non-interactive, for CI/CD)
auth0 login --client-id <client-id> --client-secret <client-secret> --domain <tenant>.auth0.com
```

### Logout

```bash
auth0 logout
```

### Tenant Management

```bash
# List all authenticated tenants
auth0 tenants list

# Switch to a different tenant
auth0 tenants use <tenant-name>

# Open tenant in dashboard
auth0 tenants open
```

---

## Applications

Create and manage Auth0 applications (clients).

### Create Application

```bash
auth0 apps create [flags]
```

| Flag | Short | Type | Description |
|------|-------|------|-------------|
| `--name` | `-n` | string | Application name |
| `--type` | `-t` | string | `native`, `spa`, `regular`, `m2m`, or `resource_server` |
| `--callbacks` | `-c` | strings | Comma-separated allowed callback URLs |
| `--logout-urls` | `-l` | strings | Comma-separated allowed logout redirect URLs |
| `--origins` | `-o` | strings | Comma-separated allowed CORS origins |
| `--web-origins` | `-w` | strings | Comma-separated allowed web origins (Cross-Origin Auth) |
| `--auth-method` | `-a` | string | Token endpoint auth: `None`, `Post`, or `Basic` |
| `--description` | `-d` | string | Description (max 140 chars) |
| `--grants` | `-g` | strings | Grant types: `code`, `implicit`, `refresh-token`, `credentials`, `password`, `password-realm`, `mfa-oob`, `mfa-otp`, `mfa-recovery-code`, `device-code` |
| `--metadata` | | key=value | Arbitrary metadata (max 255 chars each) |
| `--reveal-secrets` | `-r` | bool | Show client_secret and signing_keys in output |
| `--refresh-token` | `-z` | string | Refresh token config as JSON |

**Examples by application type:**

```bash
# Single Page Application (React, Vue, Angular)
auth0 apps create \
  --name "My SPA" \
  --type spa \
  --callbacks "http://localhost:3000" \
  --logout-urls "http://localhost:3000" \
  --origins "http://localhost:3000" \
  --web-origins "http://localhost:3000"

# Regular Web Application (Next.js, Express, Fastify)
auth0 apps create \
  --name "My Web App" \
  --type regular \
  --callbacks "http://localhost:3000/api/auth/callback" \
  --logout-urls "http://localhost:3000"

# Native Application (React Native, iOS, Android)
auth0 apps create \
  --name "My Mobile App" \
  --type native \
  --callbacks "myapp://callback" \
  --logout-urls "myapp://logout"

# Machine-to-Machine (backend services, cron jobs)
auth0 apps create \
  --name "My API Service" \
  --type m2m
```

### List Applications

```bash
auth0 apps list
auth0 apps list --json
```

### Show Application Details

```bash
auth0 apps show <app-id>
auth0 apps show <app-id> --reveal-secrets  # includes client_secret
```

### Update Application

```bash
auth0 apps update <app-id> [flags]
```

Accepts the same flags as `create`. Only specified flags are updated.

```bash
# Add production callback URL
auth0 apps update <app-id> \
  --callbacks "http://localhost:3000,https://myapp.com/callback"

# Update logout URLs
auth0 apps update <app-id> \
  --logout-urls "http://localhost:3000,https://myapp.com"
```

### Delete Application

```bash
auth0 apps delete <app-id>
```

### Other App Commands

```bash
# Set default application for CLI
auth0 apps use <app-id>

# Open application settings in browser
auth0 apps open <app-id>
```

---

## APIs

Manage API resource servers and their scopes.

### Create API

```bash
auth0 apis create \
  --name "My API" \
  --identifier "https://api.myapp.com"
```

| Flag | Short | Type | Description |
|------|-------|------|-------------|
| `--name` | `-n` | string | API name |
| `--identifier` | | string | Unique API identifier (audience) |
| `--scopes` | `-s` | strings | Comma-separated scopes |
| `--token-lifetime` | | int | Access token lifetime in seconds |
| `--allow-offline-access` | | bool | Allow refresh tokens |
| `--signing-alg` | | string | Signing algorithm (`RS256` or `HS256`) |

### List, Show, Update, Delete

```bash
auth0 apis list
auth0 apis show <api-id>
auth0 apis update <api-id> --name "Updated Name"
auth0 apis delete <api-id>
auth0 apis open <api-id>
```

### Manage Scopes

```bash
auth0 apis scopes list <api-id>
```

---

## Users

Manage user accounts, blocks, and role assignments.

### Create User

```bash
auth0 users create \
  --name "Jane Doe" \
  --email "jane@example.com" \
  --password "SecurePassword123!" \
  --connection "Username-Password-Authentication"
```

| Flag | Short | Type | Description |
|------|-------|------|-------------|
| `--name` | `-n` | string | User's full name |
| `--email` | `-e` | string | User's email address |
| `--password` | `-p` | string | User's password |
| `--connection` | `-c` | string | Database connection name |
| `--username` | `-u` | string | Username (if connection requires it) |

### Search Users

```bash
# Search with Lucene query syntax
auth0 users search --query "email:*@example.com"
auth0 users search --query "name:Jane"

# Search by email (shortcut)
auth0 users search-by-email "jane@example.com"
```

### Show, Update, Delete

```bash
auth0 users show <user-id>
auth0 users update <user-id> --name "Jane Smith"
auth0 users delete <user-id>
auth0 users open <user-id>
```

### Bulk Import

```bash
auth0 users import --connection "Username-Password-Authentication" users.json
```

The JSON file should follow the [Auth0 bulk import schema](https://auth0.com/docs/manage-users/user-migration/bulk-user-imports).

### User Blocks

```bash
# List blocks for a user (brute-force protection)
auth0 users blocks list <user-id>

# Unblock a user
auth0 users blocks unblock <user-id>
```

### User Roles

```bash
# Assign roles to a user
auth0 users roles assign <user-id> --roles <role-id>

# Show user's roles
auth0 users roles show <user-id>

# Remove roles from a user
auth0 users roles remove <user-id> --roles <role-id>
```

---

## Roles & Permissions

Manage roles and their permissions for Role-Based Access Control (RBAC).

### Create Role

```bash
auth0 roles create --name "Admin" --description "Administrator role"
```

### List, Show, Update, Delete

```bash
auth0 roles list
auth0 roles show <role-id>
auth0 roles update <role-id> --name "Super Admin"
auth0 roles delete <role-id>
```

### Manage Permissions

```bash
# Add permissions to a role
auth0 roles permissions add <role-id>

# List permissions for a role
auth0 roles permissions list <role-id>

# Remove permissions from a role
auth0 roles permissions remove <role-id>
```

---

## Organizations

Manage organizations for multi-tenant B2B applications.

### Create Organization

```bash
auth0 orgs create --name "Acme Corp" --display "Acme Corporation"
```

### List, Show, Update, Delete

```bash
auth0 orgs list
auth0 orgs show <org-id>
auth0 orgs update <org-id> --display "New Display Name"
auth0 orgs delete <org-id>
auth0 orgs open <org-id>
```

### Members

```bash
auth0 orgs members list <org-id>
```

### Invitations

```bash
# Create invitation
auth0 orgs invitations create <org-id>

# List invitations
auth0 orgs invitations list <org-id>

# Show invitation details
auth0 orgs invitations show <org-id> <invitation-id>

# Delete invitation
auth0 orgs invitations delete <org-id> <invitation-id>
```

### Organization Roles

```bash
auth0 orgs roles list <org-id>
auth0 orgs roles members list <org-id> <role-id>
```

---

## Actions

Manage serverless functions that execute at specific points in the Auth0 pipeline.

### Create Action

```bash
auth0 actions create [flags]
```

| Flag | Short | Type | Description |
|------|-------|------|-------------|
| `--name` | `-n` | string | Action name |
| `--trigger` | `-t` | string | Trigger point (see trigger types below) |
| `--code` | `-c` | string | JavaScript code (inline or from file) |
| `--runtime` | `-r` | string | `node22` (recommended), `node18`, `node16`, `node12` |
| `--dependency` | `-d` | key=value | NPM dependency and version (repeatable) |
| `--secret` | `-s` | key=value | Secret key-value pair (repeatable) |

**Trigger types:** `post-login`, `credentials-exchange`, `pre-user-registration`, `post-user-registration`, `post-change-password`, `send-phone-message`

```bash
# Create with inline code
auth0 actions create \
  --name "Add Custom Claim" \
  --trigger post-login \
  --runtime node22 \
  --code "exports.onExecutePostLogin = async (event, api) => {
    api.idToken.setCustomClaim('roles', event.authorization?.roles || []);
  };"

# Create with code from file
auth0 actions create \
  --name "Enrich Profile" \
  --trigger post-login \
  --runtime node22 \
  --code "$(cat action.js)" \
  --dependency "axios=1.6.0" \
  --secret "API_KEY=my-secret-key"
```

### Deploy, List, Show, Update, Delete

```bash
# Deploy action (makes it active)
auth0 actions deploy <action-id>

# List all actions
auth0 actions list

# Show action details
auth0 actions show <action-id>

# Update action
auth0 actions update <action-id> --name "Updated Name"

# View changes before deploying
auth0 actions diff <action-id>

# Delete action
auth0 actions delete <action-id>

# Open in dashboard
auth0 actions open <action-id>
```

---

## Logs & Monitoring

View tenant activity logs and configure log streaming.

### View Logs

```bash
# List recent log entries
auth0 logs list

# Real-time log streaming
auth0 logs tail

# Filter logs by type
auth0 logs tail --filter "type:f"   # Failed logins
auth0 logs tail --filter "type:s"   # Successful logins
auth0 logs tail --filter "type:fp"  # Failed password change
```

### Log Streams

Route logs to external services for long-term storage and analysis.

```bash
# List configured streams
auth0 logs streams list

# Show stream details
auth0 logs streams show <stream-id>

# Create streams by provider
auth0 logs streams create datadog
auth0 logs streams create eventbridge
auth0 logs streams create eventgrid
auth0 logs streams create http
auth0 logs streams create splunk
auth0 logs streams create sumo

# Update stream
auth0 logs streams update <stream-id>

# Delete stream
auth0 logs streams delete <stream-id>
```

---

## Universal Login

Customize the authentication experience.

### Branding Settings

```bash
# Show current branding
auth0 universal-login show

# Update branding settings
auth0 universal-login update
```

### Custom Prompts Text

```bash
# Show custom text for a prompt
auth0 universal-login prompts show

# Update custom text
auth0 universal-login prompts update
```

### Templates

```bash
# Show current template
auth0 universal-login templates show

# Update template
auth0 universal-login templates update
```

### ACUL (Advanced Customization)

The newer ACUL commands replace the deprecated `customize` command (deprecated June 15, 2026):

```bash
auth0 acul init          # Initialize ACUL project
auth0 acul dev           # Start development server
auth0 acul config get    # Get current config
auth0 acul config set    # Set config values
auth0 acul config list   # List all config
auth0 acul screen add    # Add a new screen
```

---

## Testing & Debugging

Validate your authentication configuration.

### Test Login Flow

```bash
# Test Universal Login flow for an application
auth0 test login <app-client-id>
```

Opens a browser with the application's login page, completing the full authentication flow.

### Get Test Token

```bash
# Get an access token for API testing
auth0 test token <app-client-id>
```

Returns a valid access token you can use to test protected API endpoints.

### Debug with Logs

```bash
# Stream logs in real-time while testing
auth0 logs tail --filter "type:f"
```

---

## Global Flags & Output Formats

These flags work with any command.

| Flag | Description |
|------|-------------|
| `--json` | Output in pretty-printed JSON |
| `--json-compact` | Output in single-line JSON (useful for piping) |
| `--debug` | Enable verbose debug logging |
| `--no-color` | Disable colored output |
| `--no-input` | Disable interactive prompts (required for scripts/CI) |
| `--tenant <name>` | Override the default tenant for this command |

### Output Format Examples

```bash
# Pretty JSON output
auth0 apps list --json

# Compact JSON for scripting
auth0 apps list --json-compact

# Pipe to jq for filtering
auth0 apps list --json | jq '.[].client_id'

# Non-interactive with specific tenant
auth0 apps list --no-input --tenant my-tenant --json
```

### Getting Help

```bash
# General help
auth0 --help

# Help for any command
auth0 apps --help
auth0 apps create --help

# Shell completion
auth0 completion bash   # Bash
auth0 completion zsh    # Zsh
```
