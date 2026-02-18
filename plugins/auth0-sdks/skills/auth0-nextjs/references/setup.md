# Auth0 Next.js Setup Guide

Setup instructions for Next.js with App Router or Pages Router.

---

## Quick Setup (Automated)

### Bash Script

```bash
#!/bin/bash

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  [[ "$OSTYPE" == "darwin"* ]] && brew install auth0/auth0-cli/auth0 || \
  curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
fi

# Login
if ! auth0 tenants list &> /dev/null; then
  echo "Visit https://auth0.com/signup if you need an account"
  auth0 login
fi

# Create/select app
auth0 apps list
read -p "Enter app ID (or Enter to create new): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create \
    --name "${PWD##*/}-nextjs" \
    --type regular \
    --callbacks "http://localhost:3000/api/auth/callback" \
    --logout-urls "http://localhost:3000" \
    --metadata "created_by=agent_skills" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
fi

# Get credentials
AUTH0_DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_SECRET=$(auth0 apps show "$APP_ID" --json | grep -o '"client_secret":"[^"]*' | cut -d'"' -f4)

# Generate secret
AUTH0_SECRET=$(openssl rand -hex 32)

# Create .env.local
cat > .env.local << ENVEOF
AUTH0_SECRET=$AUTH0_SECRET
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://$AUTH0_DOMAIN
AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET=$AUTH0_CLIENT_SECRET
ENVEOF

echo "✅ Created .env.local"
echo "⚠️  Add .env.local to .gitignore!"
```

---

## Manual Setup

### Step 1: Install SDK

```bash
npm install @auth0/nextjs-auth0
```

### Step 2: Create .env.local

```bash
AUTH0_SECRET=<openssl-rand-hex-32>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

Generate `AUTH0_SECRET`:
```bash
openssl rand -hex 32
```

### Step 3: Configure Auth0 Application

Via CLI:
```bash
auth0 login
auth0 apps create --name "My Next.js App" --type regular \
  --callbacks "http://localhost:3000/api/auth/callback" \
  --logout-urls "http://localhost:3000"
```

Via Dashboard:
1. Create **Regular Web Application**
2. Configure:
   - Allowed Callback URLs: `http://localhost:3000/api/auth/callback`
   - Allowed Logout URLs: `http://localhost:3000`
3. Copy credentials to `.env.local`

---

## Troubleshooting

**"Invalid state" error:**
- Regenerate `AUTH0_SECRET`
- Clear cookies and restart dev server

**Client secret not working:**
- Next.js uses Regular Web Application (not SPA)
- Verify client secret copied correctly

**Callback URL mismatch:**
- Ensure `/api/auth/callback` is in Allowed Callback URLs
- Check `AUTH0_BASE_URL` matches your domain

---

## Next Steps

- [Integration Guide](integration.md) - Implementation patterns
- [API Reference](api.md) - Complete SDK documentation
- [Main Skill](../SKILL.md) - Quick start
