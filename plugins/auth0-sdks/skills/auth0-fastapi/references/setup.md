# Auth0 FastAPI Setup Guide

Complete setup instructions for Auth0 with FastAPI.

---

## Quick Setup (Automated)

### Bash Script (macOS/Linux)

```bash
#!/bin/bash

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install auth0-fastapi "uvicorn[standard]" python-dotenv itsdangerous

# Install Auth0 CLI if needed
if ! command -v auth0 &> /dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0/auth0-cli/auth0
  else
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh
  fi
fi

# Login to Auth0
auth0 login

# Create app or select existing
read -p "Enter Auth0 app ID (or press Enter to create new): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create \
    --name "fastapi-app" \
    --type regular \
    --callbacks "http://localhost:3000/auth/callback" \
    --logout-urls "http://localhost:3000" \
    --origins "http://localhost:3000" \
    --reveal-secrets \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
fi

# Get credentials
AUTH0_DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_ID=$(auth0 apps show "$APP_ID" --reveal-secrets --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_SECRET=$(auth0 apps show "$APP_ID" --reveal-secrets --json | grep -o '"client_secret":"[^"]*' | cut -d'"' -f4)
SESSION_SECRET=$(openssl rand -hex 64)

# Create .env file
cat > .env << EOF
AUTH0_DOMAIN=$AUTH0_DOMAIN
AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET=$AUTH0_CLIENT_SECRET
SESSION_SECRET=$SESSION_SECRET
APP_BASE_URL=http://localhost:3000
EOF

echo "✅ Setup complete! Credentials saved to .env"
```

---

## Manual Setup

### Step 1: Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
```

### Step 2: Install Dependencies

```bash
pip install auth0-fastapi "uvicorn[standard]" python-dotenv itsdangerous
```

### Step 3: Create Auth0 Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose:
   - Name: Your app name
   - Type: **Regular Web Applications** (NOT Single Page)
5. Configure:
   - **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`

### Step 4: Create .env File

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
SESSION_SECRET=$(openssl rand -hex 64)
APP_BASE_URL=http://localhost:3000
```

**Important:** Replace placeholders with actual values from Auth0 Dashboard → Application Settings.

---

## Troubleshooting

### Virtual Environment Issues

**Command not found after activation:**
```bash
# Ensure you're in the virtual environment
which python  # Should show venv/bin/python

# Reinstall if needed
deactivate
rm -rf venv
python -m venv venv
source venv/bin/activate
```

### Package Installation Errors

**uvicorn[standard] glob expansion error:**
```bash
# Always quote the brackets
pip install "uvicorn[standard]"
```

**Missing itsdangerous:**
```bash
pip install itsdangerous
```

### Auth0 CLI Issues

**Not logged in:**
```bash
auth0 login --force
```

---

## Next Steps

1. Return to [main skill guide](../SKILL.md)
2. See [Integration Guide](integration.md) for protected routes
3. Check [API Reference](api.md) for full SDK documentation
