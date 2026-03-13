# Auth0 CLI Workflows

Step-by-step recipes for common real-world scenarios.

---

## Table of Contents

- [Set Up a New Application](#set-up-a-new-application)
- [Debug Authentication Failures](#debug-authentication-failures)
- [Manage Users in Bulk](#manage-users-in-bulk)
- [Deploy Auth0 Actions](#deploy-auth0-actions)
- [Set Up Log Streaming](#set-up-log-streaming)
- [CI/CD Automation](#cicd-automation)

---

## Set Up a New Application

Create and configure an Auth0 application for local development.

### Step 1: Choose Application Type

| Your App | Type Flag | Callback Pattern |
|----------|-----------|-----------------|
| React, Vue, Angular SPA | `--type spa` | `http://localhost:3000` |
| Next.js, Express, Fastify | `--type regular` | `http://localhost:3000/api/auth/callback` |
| React Native, iOS, Android | `--type native` | `myapp://callback` |
| Backend service, cron job | `--type m2m` | (none needed) |

### Step 2: Create the Application

```bash
# Example: Regular web app (Next.js)
auth0 apps create \
  --name "My Next.js App" \
  --type regular \
  --callbacks "http://localhost:3000/api/auth/callback" \
  --logout-urls "http://localhost:3000" \
  --reveal-secrets \
  --json
```

The `--reveal-secrets` flag shows the client secret immediately, and `--json` gives structured output.

### Step 3: Retrieve Credentials

```bash
# List apps to find the one you just created
auth0 apps list

# Get full details including credentials
auth0 apps show <client-id> --reveal-secrets
```

Save the `client_id` and `client_secret` (for regular/m2m apps) to your `.env` file.

### Step 4: Add Production URLs Later

```bash
auth0 apps update <client-id> \
  --callbacks "http://localhost:3000/api/auth/callback,https://myapp.com/api/auth/callback" \
  --logout-urls "http://localhost:3000,https://myapp.com"
```

---

## Debug Authentication Failures

Systematically diagnose why authentication isn't working.

### Step 1: Start Log Tailing

Open a separate terminal and stream logs in real-time:

```bash
# All logs
auth0 logs tail

# Only failed events
auth0 logs tail --filter "type:f"
```

### Step 2: Reproduce the Issue

Trigger the login flow in your application or test directly:

```bash
auth0 test login <client-id>
```

### Step 3: Analyze Log Output

Common log type codes:

| Code | Meaning | Common Fix |
|------|---------|------------|
| `f` | Failed login | Check credentials, connection config |
| `fp` | Failed password change | Verify password policy |
| `fu` | Failed user update | Check permissions |
| `fsa` | Failed silent auth | Check session, third-party cookies |
| `fcoa` | Failed cross-origin auth | Verify allowed web origins |

### Step 4: Verify Application Configuration

```bash
# Check callback URLs are correct
auth0 apps show <client-id> --json | jq '.callbacks'

# Check allowed origins
auth0 apps show <client-id> --json | jq '.web_origins'

# Verify application type
auth0 apps show <client-id> --json | jq '.app_type'
```

### Step 5: Test Token Generation

```bash
# Get a test token to verify API configuration
auth0 test token <client-id>
```

If token generation fails, the issue is likely in your API or application configuration.

---

## Manage Users in Bulk

Import, update, and organize users at scale.

### Bulk Import Users

Prepare a JSON file following the Auth0 bulk import schema:

```json
[
  {
    "email": "jane@example.com",
    "name": "Jane Doe",
    "password_hash": "$2b$10$...",
    "email_verified": true
  },
  {
    "email": "john@example.com",
    "name": "John Smith",
    "password_hash": "$2b$10$...",
    "email_verified": true
  }
]
```

```bash
auth0 users import \
  --connection "Username-Password-Authentication" \
  users.json
```

### Search and Filter Users

```bash
# Search by email domain
auth0 users search --query "email:*@acme.com"

# Search by name
auth0 users search --query "name:Jane"

# Quick email lookup
auth0 users search-by-email "jane@example.com"

# Get JSON output for scripting
auth0 users search --query "email:*@acme.com" --json
```

### Assign Roles to Users

```bash
# First, find the role ID
auth0 roles list --json | jq '.[] | {id, name}'

# Assign role to a user
auth0 users roles assign <user-id> --roles <role-id>

# Verify assignment
auth0 users roles show <user-id>
```

### Handle Blocked Users

```bash
# Check if a user is blocked
auth0 users blocks list <user-id>

# Unblock a user
auth0 users blocks unblock <user-id>
```

---

## Deploy Auth0 Actions

Create, test, and deploy custom logic that runs during authentication.

### Step 1: Write Your Action Code

Create a file `action.js`:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Add user roles to the ID token
  const roles = event.authorization?.roles || [];
  api.idToken.setCustomClaim('https://myapp.com/roles', roles);

  // Add metadata to access token
  api.accessToken.setCustomClaim('https://myapp.com/email', event.user.email);
};
```

### Step 2: Create the Action

```bash
auth0 actions create \
  --name "Enrich Tokens" \
  --trigger post-login \
  --runtime node22 \
  --code "$(cat action.js)"
```

### Step 3: Add Dependencies and Secrets (if needed)

```bash
auth0 actions update <action-id> \
  --dependency "axios=1.7.0" \
  --secret "API_KEY=your-api-key"
```

### Step 4: Review Changes

```bash
# See what changed before deploying
auth0 actions diff <action-id>

# View the full action
auth0 actions show <action-id>
```

### Step 5: Deploy

```bash
auth0 actions deploy <action-id>
```

### Step 6: Monitor

```bash
# Watch logs for action execution
auth0 logs tail --filter "type:sapi"
```

---

## Set Up Log Streaming

Route Auth0 logs to external monitoring services.

### Available Providers

| Provider | Command | Use Case |
|----------|---------|----------|
| Datadog | `auth0 logs streams create datadog` | APM and log aggregation |
| AWS EventBridge | `auth0 logs streams create eventbridge` | AWS event-driven architecture |
| Azure Event Grid | `auth0 logs streams create eventgrid` | Azure integration |
| HTTP Webhook | `auth0 logs streams create http` | Custom endpoints |
| Splunk | `auth0 logs streams create splunk` | Enterprise log management |
| Sumo Logic | `auth0 logs streams create sumo` | Cloud-native analytics |

### Step 1: Create a Stream

```bash
# Interactive mode guides you through configuration
auth0 logs streams create datadog
```

The CLI will prompt for provider-specific configuration (API keys, endpoints, regions).

### Step 2: Verify the Stream

```bash
# List all configured streams
auth0 logs streams list

# Check stream details
auth0 logs streams show <stream-id>
```

### Step 3: Test It

Trigger a login event and check your external service:

```bash
auth0 test login <client-id>
```

### Managing Streams

```bash
# Update stream configuration
auth0 logs streams update <stream-id>

# Delete a stream
auth0 logs streams delete <stream-id>

# Open in dashboard
auth0 logs streams open <stream-id>
```

---

## CI/CD Automation

Automate Auth0 resource management in pipelines.

### Authentication

Use client credentials (never device flow) in CI:

```bash
auth0 login \
  --client-id "$AUTH0_CLIENT_ID" \
  --client-secret "$AUTH0_CLIENT_SECRET" \
  --domain "$AUTH0_DOMAIN"
```

Store credentials as CI secrets (GitHub Actions secrets, GitLab CI variables, etc.).

### Required Flags for Non-Interactive Use

Always include these flags in CI scripts:

```bash
auth0 <command> --no-input --json
```

- `--no-input` prevents the CLI from waiting for interactive input
- `--json` gives machine-parseable output

### Example: Create App in CI

```bash
#!/bin/bash
set -euo pipefail

# Authenticate
auth0 login \
  --client-id "$AUTH0_CLIENT_ID" \
  --client-secret "$AUTH0_CLIENT_SECRET" \
  --domain "$AUTH0_DOMAIN"

# Create application and capture output
APP_OUTPUT=$(auth0 apps create \
  --name "staging-app-${CI_COMMIT_SHA:0:7}" \
  --type regular \
  --callbacks "$STAGING_URL/api/auth/callback" \
  --logout-urls "$STAGING_URL" \
  --no-input \
  --json)

# Extract client ID
CLIENT_ID=$(echo "$APP_OUTPUT" | jq -r '.client_id')
echo "Created app with client_id: $CLIENT_ID"
```

### Example: Deploy Action in CI

```bash
#!/bin/bash
set -euo pipefail

# Authenticate
auth0 login \
  --client-id "$AUTH0_CLIENT_ID" \
  --client-secret "$AUTH0_CLIENT_SECRET" \
  --domain "$AUTH0_DOMAIN"

# Update action code from repo
auth0 actions update "$ACTION_ID" \
  --code "$(cat ./auth0/actions/post-login.js)" \
  --no-input

# Deploy
auth0 actions deploy "$ACTION_ID" --no-input
```

### Error Handling

The CLI uses standard exit codes:
- `0` - Success
- `1` - General error
- Check stderr for error messages

```bash
if ! auth0 apps show "$APP_ID" --no-input --json 2>/dev/null; then
  echo "App not found, creating..."
  auth0 apps create --name "My App" --type spa --no-input --json
fi
```
