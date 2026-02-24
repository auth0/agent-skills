# Auth0 Svelte Setup Guide

Complete setup instructions with automated scripts and manual configuration options.

---

## Quick Setup (Automated)

### Bash Script (macOS/Linux)

Run this script to automatically set up everything:

```bash
#!/bin/bash

# Detect OS and install Auth0 CLI if needed
if ! command -v auth0 &> /dev/null; then
  echo "Installing Auth0 CLI..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0/auth0-cli/auth0
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
  elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    echo "Please install Auth0 CLI: https://github.com/auth0/auth0-cli#installation"
    exit 1
  fi
fi

# Check if logged in to Auth0
if ! auth0 tenants list &> /dev/null; then
  echo ""
  echo "======================================"
  echo "Auth0 Login Required"
  echo "======================================"
  echo ""
  read -p "Do you have an Auth0 account? (y/n): " HAS_ACCOUNT

  if [[ "$HAS_ACCOUNT" != "y" ]]; then
    echo ""
    echo "Let's create your free Auth0 account!"
    echo ""
    echo "1. Visit: https://auth0.com/signup"
    echo "2. Sign up with your email or GitHub"
    echo "3. Choose a tenant domain (e.g., 'mycompany')"
    echo "4. Complete the onboarding"
    echo ""
    read -p "Press Enter when you've created your account..."
  fi

  echo ""
  echo "Logging in to Auth0..."
  echo "A browser will open for authentication."
  echo ""
  auth0 login

  if ! auth0 tenants list &> /dev/null; then
    echo "❌ Login failed. Please try again or visit https://auth0.com/docs"
    exit 1
  fi

  echo "✅ Successfully logged in to Auth0!"
fi

# List apps and prompt for selection
echo "Your Auth0 applications:"
auth0 apps list

read -p "Enter your Auth0 app ID (or press Enter to create a new one): " APP_ID

if [ -z "$APP_ID" ]; then
  echo "Creating new Auth0 SPA application..."
  APP_NAME="${PWD##*/}-svelte-app"
  APP_ID=$(auth0 apps create \
    --name "$APP_NAME" \
    --type spa \
    --callbacks "http://localhost:5173,http://localhost:3000" \
    --logout-urls "http://localhost:5173,http://localhost:3000" \
    --origins "http://localhost:5173,http://localhost:3000" \
    --web-origins "http://localhost:5173,http://localhost:3000" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
  echo "Created app with ID: $APP_ID"
fi

# Get app details and create .env file
echo "Fetching Auth0 credentials..."
AUTH0_DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)

# Create .env file
cat > .env << EOF
VITE_AUTH0_DOMAIN=$AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
EOF

echo "✅ Auth0 configuration complete!"
echo "Created .env file with:"
echo "  VITE_AUTH0_DOMAIN=$AUTH0_DOMAIN"
echo "  VITE_AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID"
```

### PowerShell Script (Windows)

```powershell
# Install Auth0 CLI if not present
if (!(Get-Command auth0 -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Auth0 CLI..."
  scoop install auth0
}

# Check if logged in
try {
  auth0 tenants list | Out-Null
} catch {
  Write-Host ""
  Write-Host "======================================"
  Write-Host "Auth0 Login Required"
  Write-Host "======================================"
  Write-Host ""

  $hasAccount = Read-Host "Do you have an Auth0 account? (y/n)"

  if ($hasAccount -ne "y") {
    Write-Host ""
    Write-Host "Let's create your free Auth0 account!"
    Write-Host ""
    Write-Host "1. Visit: https://auth0.com/signup"
    Write-Host "2. Sign up with your email or GitHub"
    Write-Host "3. Choose a tenant domain (e.g., 'mycompany')"
    Write-Host "4. Complete the onboarding"
    Write-Host ""
    Read-Host "Press Enter when you've created your account"
  }

  Write-Host ""
  Write-Host "Logging in to Auth0..."
  Write-Host "A browser will open for authentication."
  Write-Host ""
  auth0 login

  try {
    auth0 tenants list | Out-Null
    Write-Host "✅ Successfully logged in to Auth0!"
  } catch {
    Write-Host "❌ Login failed. Please try again or visit https://auth0.com/docs"
    exit 1
  }
}

# List and select app
Write-Host "Your Auth0 applications:"
auth0 apps list

$appId = Read-Host "Enter your Auth0 app ID (or press Enter to create new)"

if ([string]::IsNullOrEmpty($appId)) {
  $appName = Split-Path -Leaf (Get-Location)
  Write-Host "Creating new Auth0 SPA application..."
  $appJson = auth0 apps create --name "$appName-svelte-app" --type spa `
    --callbacks "http://localhost:5173,http://localhost:3000" `
    --logout-urls "http://localhost:5173,http://localhost:3000" `
    --origins "http://localhost:5173,http://localhost:3000" `
    --web-origins "http://localhost:5173,http://localhost:3000" --json

  $appId = ($appJson | ConvertFrom-Json).client_id
  Write-Host "Created app with ID: $appId"
}

# Get credentials and create .env
Write-Host "Fetching Auth0 credentials..."
$appDetails = auth0 apps show $appId --json | ConvertFrom-Json

@"
VITE_AUTH0_DOMAIN=$($appDetails.domain)
VITE_AUTH0_CLIENT_ID=$($appDetails.client_id)
"@ | Out-File -FilePath .env -Encoding UTF8

Write-Host "✅ Auth0 configuration complete!"
Write-Host "Created .env file with:"
Write-Host "  VITE_AUTH0_DOMAIN=$($appDetails.domain)"
Write-Host "  VITE_AUTH0_CLIENT_ID=$($appDetails.client_id)"
```

---

## Manual Setup

If you prefer manual setup or the scripts don't work:

### Step 1: Install SDK

```bash
npm install @auth0/auth0-spa-js
```

### Step 2: Install Auth0 CLI

**macOS:**
```bash
brew install auth0/auth0-cli/auth0
```

**Linux:**
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh
```

**Windows:**
```powershell
scoop install auth0
# Or: choco install auth0-cli
```

### Step 3: Get Credentials

```bash
# Login to Auth0
auth0 login

# List your apps
auth0 apps list

# Get app details (replace <app-id>)
auth0 apps show <app-id>
```

### Step 4: Create .env File

```bash
VITE_AUTH0_DOMAIN=<your-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<your-client-id>
```

---

## Creating an Auth0 Application via Dashboard

If you prefer using the Auth0 Dashboard instead of the CLI:

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose:
   - Name: Your app name
   - Type: **Single Page Web Applications**
5. Configure:
   - **Allowed Callback URLs**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Logout URLs**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Origins (CORS)**: `http://localhost:5173, http://localhost:3000`
6. Copy your **Domain** and **Client ID**
7. Create `.env` file as shown in Step 4 above

---

## Troubleshooting Setup

### CLI Installation Issues

**macOS - Homebrew not found:**
```bash
# Install Homebrew first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Windows - Scoop not found:**
```powershell
# Install Scoop first
iwr -useb get.scoop.sh | iex
```

### Login Issues

**Browser doesn't open:**
```bash
# Use device code flow
auth0 login --no-browser
```

**"Not logged in" error:**
```bash
# Force new login
auth0 login --force
```

### Environment Variable Issues

**Variables not loading:**
- Ensure variables start with `VITE_`
- Restart dev server after creating `.env`
- Check file is named exactly `.env` (not `.env.local`)

---

## Next Steps

After setup is complete:
1. Return to [main skill guide](../SKILL.md) for integration steps
2. See [Integration Guide](integration.md) for advanced patterns
3. Check [API Reference](api.md) for complete SDK documentation
