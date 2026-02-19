# Auth0 Express Setup Guide

Setup instructions for Express.js applications.

---

## Quick Setup (Automated)

Below automates the setup, except for the CLIENT_SECRET. Inform the user that they have to fill in the value for the CLIENT_SECRET themselves.

```bash
#!/bin/bash

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  [[ "$OSTYPE" == "darwin"* ]] && brew install auth0/auth0-cli/auth0 || \
  curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
fi

# Login
auth0 login 2>/dev/null || auth0 login

# Create/select app  
auth0 apps list
read -p "Enter app ID (or Enter to create): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create --name "${PWD##*/}-express" --type regular \
    --callbacks "http://localhost:3000/callback" \
    --logout-urls "http://localhost:3000" \
    --metadata "created_by=agent_skills" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
fi

# Get credentials
DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
SECRET=$(openssl rand -hex 32)

# Create .env
cat >> .env << ENVEOF
SECRET=$SECRET
BASE_URL=http://localhost:3000
CLIENT_ID=$CLIENT_ID
CLIENT_SECRET='YOUR_CLIENT_SECRET'
ISSUER_BASE_URL=https://$DOMAIN
ENVEOF

echo "✅ Created .env file"
```

---

## Manual Setup

### Install Packages

```bash
npm install express-openid-connect dotenv
```

### Create .env

```bash
SECRET=<openssl-rand-hex-32>
BASE_URL=http://localhost:3000
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
ISSUER_BASE_URL=https://your-tenant.auth0.com
```

### Get Auth0 Credentials

CLI: `auth0 apps show <app-id> --reveal-secrets`

Dashboard: Create Regular Web Application, copy credentials

---

## Troubleshooting

**"Invalid state" error:** Regenerate `SECRET`

**Client secret required:** Express uses Regular Web Application type

**Callback URL mismatch:** Add `/callback` to Allowed Callback URLs

---

## Next Steps

- [Integration Guide](integration.md)
- [API Reference](api.md)
- [Main Skill](../SKILL.md)
