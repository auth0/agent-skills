# Auth0 ASP.NET Core Web API Setup Guide

Setup instructions for ASP.NET Core Web API applications.

---

## Quick Setup (Automated)

Below automates the setup using the Auth0 CLI. The approach creates an Auth0 API resource and writes the configuration to your `appsettings.json`.

**Before running any part of this setup that writes to config files, you MUST ask the user for explicit confirmation.** Follow the steps below precisely.

### Step 1: Check for existing configuration and confirm with user

Before writing credentials, check if Auth0 config already exists:

```bash
grep -l "Auth0" appsettings.json appsettings.Development.json 2>/dev/null || echo "NO_AUTH0_CONFIG"
```

Then ask the user for explicit confirmation before proceeding:

- If Auth0 config already exists, ask:
  - Question: "Auth0 configuration already exists in appsettings.json. This setup will overwrite the Auth0 section. Do you want to proceed?"
  - Options: "Yes, update existing config" / "No, I'll update it manually"

- If no Auth0 config exists, ask:
  - Question: "This setup will add Auth0 configuration (Domain, Audience) to appsettings.json. Do you want to proceed?"
  - Options: "Yes, add Auth0 config" / "No, I'll configure it manually"

**Do not proceed with writing to any config file unless the user selects the confirmation option.**

### Step 2: Install Auth0 CLI and create API resource

```bash
# Install Auth0 CLI (macOS)
brew install auth0/auth0-cli/auth0

# Login
auth0 login --no-input

# Create an Auth0 API resource
auth0 apis create \
  --name "My ASP.NET Core API" \
  --identifier https://my-api.example.com \
  --json
```

Note the `identifier` value - this is your Audience.

### Step 3: Write configuration (only after confirmation)

```bash
#!/bin/bash

# Get domain from Auth0 CLI (requires jq: https://jqlang.org/download/)
DOMAIN=$(auth0 tenants list --json | jq -r '.[0].name')

# The audience you used when creating the API
AUDIENCE="https://my-api.example.com"

# Write to appsettings.json (merge with existing content)
node -e "
  const fs = require('fs');
  const config = JSON.parse(fs.readFileSync('appsettings.json', 'utf8'));
  config.Auth0 = { Domain: '$DOMAIN', Audience: '$AUDIENCE' };
  fs.writeFileSync('appsettings.json', JSON.stringify(config, null, 2));
  console.log('Auth0 config written to appsettings.json');
"
```

After the script runs, remind the user to:
1. Verify `appsettings.json` contains the correct Domain and Audience.
2. Never commit secrets to source control (appsettings.json with domain/audience is typically safe, but use User Secrets or environment variables for sensitive values in production).

---

## Manual Setup

### Install Package

```bash
dotnet add package Auth0.AspNetCore.Authentication.Api
```

### Create Auth0 API Resource

1. Go to Auth0 Dashboard → Applications → APIs
2. Click **Create API**
3. Set a **Name** and an **Identifier** (e.g., `https://my-api.example.com`)
4. Note the Identifier - this is your `Audience`

### Configure appsettings.json

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "Audience": "https://my-api.example.com"
  }
}
```

**Important:** Domain format is `your-tenant.auth0.com` - do NOT include `https://`.

### Get Auth0 Credentials

- **Domain:** Auth0 Dashboard → Settings → Domain (or `auth0 tenants list`)
- **Audience:** The identifier you set when creating the API resource

### Using User Secrets for Local Development

For local development, use .NET User Secrets instead of modifying appsettings.json:

```bash
dotnet user-secrets init
dotnet user-secrets set "Auth0:Domain" "your-tenant.auth0.com"
dotnet user-secrets set "Auth0:Audience" "https://my-api.example.com"
```

### Using Environment Variables

For production/containers, set environment variables (these override appsettings.json):

```bash
export Auth0__Domain=your-tenant.auth0.com
export Auth0__Audience=https://my-api.example.com
```

Note the double underscore `__` separator for nested config in environment variables.

---

## Getting a Test Token

### Via Auth0 Dashboard

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Test** tab
4. Click **Copy Token** to get a test access token

### Via Auth0 CLI (Client Credentials)

```bash
# Get access token for testing
auth0 test token \
  --audience https://my-api.example.com \
  --scopes "read:messages"
```

### Via curl (Client Credentials Flow)

```bash
curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials"
  }'
```

---

## Troubleshooting

**401 Unauthorized - "invalid_token":** Verify that the `Audience` in config exactly matches your API Identifier in Auth0 Dashboard.

**401 Unauthorized - "invalid_issuer":** Ensure `Domain` does not include `https://` - use `your-tenant.auth0.com` format only.

**HTTPS certificate errors locally:** Run `dotnet dev-certs https --trust` to trust the development certificate.

**Token expired:** Test tokens from the Dashboard are short-lived. Request a fresh token.

---

## Next Steps

- [Integration Guide](integration.md)
- [API Reference](api.md)
- [Main Skill](../SKILL.md)
