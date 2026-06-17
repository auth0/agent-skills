# Auth0 Express SDK Setup Guide

Setup instructions for Express.js applications using `@auth0/auth0-express`.

---

## Quick Setup (Automated)

Below automates the setup using the Auth0 CLI. The client secret must be filled in manually by the user.

**Never read the contents of `.env.local` or `.env` at any point during setup.** The file may contain sensitive secrets. If you need to read it for any reason, ask the user for explicit permission first.

**Before writing to any env file, ask the user for explicit confirmation.**

### Step 1: Check for existing env files and confirm with user

```bash
test -f .env.local && echo "ENV_LOCAL_EXISTS" || echo "ENV_LOCAL_NOT_FOUND"
test -f .env && echo "ENV_EXISTS" || echo "ENV_NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding:

- If `.env.local` exists: "A `.env.local` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
- If `.env.local` doesn't exist but `.env` exists: "A `.env` file already exists. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
- If neither exists: "This setup will create a `.env.local` file with Auth0 credentials. Do you want to proceed?"

### Step 2: Run automated setup (only after confirmation)

```bash
#!/bin/bash

# Install Auth0 CLI if needed
if ! command -v auth0 &> /dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0/auth0-cli/auth0
  else
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh -o /tmp/auth0-install.sh
    echo "⚠️  Review the install script at /tmp/auth0-install.sh before running"
    sh /tmp/auth0-install.sh -b /usr/local/bin
    rm /tmp/auth0-install.sh
  fi
fi

# Login
auth0 login 2>/dev/null || auth0 login

# Create/select app
auth0 apps list
read -p "Enter app ID (or Enter to create new): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create --name "${PWD##*/}-express" --type regular \
    --callbacks "http://localhost:3000/auth/callback" \
    --logout-urls "http://localhost:3000" \
    --metadata "created_by=agent_skills" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
fi

# Get credentials
DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
SESSION_SECRET=$(openssl rand -hex 64)

# Determine target env file
if [ -f .env.local ]; then
  TARGET_FILE=".env.local"
elif [ -f .env ]; then
  TARGET_FILE=".env"
else
  TARGET_FILE=".env.local"
fi

# Append credentials
cat >> "$TARGET_FILE" << ENVEOF
AUTH0_DOMAIN=$DOMAIN
AUTH0_CLIENT_ID=$CLIENT_ID
AUTH0_CLIENT_SECRET=YOUR_CLIENT_SECRET
APP_BASE_URL=http://localhost:3000
AUTH0_SESSION_SECRET=$SESSION_SECRET
ENVEOF

echo "✅ Auth0 credentials written to $TARGET_FILE"
```

After the script runs, remind the user to:
1. Replace `YOUR_CLIENT_SECRET` with the actual client secret from Auth0 Dashboard → Applications → your app → Settings.
2. Ensure the env file is listed in `.gitignore`.

---

## Manual Setup

### Install Package

```bash
npm install @auth0/auth0-express@beta dotenv
```

### Create .env

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
APP_BASE_URL=http://localhost:3000
AUTH0_SESSION_SECRET=your-long-random-secret-here
```

Generate session secret: `openssl rand -hex 64`

### Auth0 Dashboard Configuration

1. Go to [Auth0 Dashboard](https://manage.auth0.com) → Applications → your app
2. Ensure **Application Type** is **Regular Web Application**
3. Under **Allowed Callback URLs** add: `http://localhost:3000/auth/callback`
4. Under **Allowed Logout URLs** add: `http://localhost:3000`
5. Save changes

### Get Auth0 Credentials

CLI: `auth0 apps show <app-id> --reveal-secrets`

Dashboard: Applications → your app → Settings tab

---

## Migration from express-openid-connect

If migrating from `express-openid-connect`, the SDK supports legacy env var names for compatibility:

| Old Variable | New Variable |
|---|---|
| `ISSUER_BASE_URL` | `AUTH0_DOMAIN` (full URL or just domain) |
| `CLIENT_ID` | `AUTH0_CLIENT_ID` |
| `CLIENT_SECRET` | `AUTH0_CLIENT_SECRET` |
| `BASE_URL` | `APP_BASE_URL` |
| `SECRET` | `AUTH0_SESSION_SECRET` |

The `AUTH0_*` prefixed names are recommended.

Note the route paths have changed:
- `/login` → `/auth/login`
- `/logout` → `/auth/logout`
- `/callback` → `/auth/callback`

---

## Troubleshooting

**"Invalid state" error:** Regenerate `AUTH0_SESSION_SECRET` with `openssl rand -hex 64`

**Client secret required:** Make sure Application Type is Regular Web Application (not SPA)

**Callback URL mismatch:** Add `/auth/callback` to Allowed Callback URLs (note `/auth/` prefix vs old `/callback`)

---

## Next Steps

- [Integration Guide](integration.md)
- [API Reference](api.md)
- [Main Skill](../SKILL.md)
