# Auth0 Vanilla JavaScript Setup Guide

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
  fi
fi

# Check if logged in to Auth0
if ! auth0 tenants list &> /dev/null; then
  echo "Logging in to Auth0..."
  auth0 login
fi

# List apps and prompt for selection
echo "Your Auth0 applications:"
auth0 apps list

read -p "Enter your Auth0 app ID (or press Enter to create a new one): " APP_ID

if [ -z "$APP_ID" ]; then
  echo "Creating new Auth0 SPA application..."
  APP_NAME="vanilla-js-app"
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
  Write-Host "Logging in to Auth0..."
  auth0 login
}

# List and select app
Write-Host "Your Auth0 applications:"
auth0 apps list

$appId = Read-Host "Enter your Auth0 app ID (or press Enter to create new)"

if ([string]::IsNullOrEmpty($appId)) {
  Write-Host "Creating new Auth0 SPA application..."
  $appJson = auth0 apps create --name "vanilla-js-app" --type spa `
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
```

---

## Manual Setup

### Step 1: Install SDK

```bash
npm install @auth0/auth0-spa-js
```

### Step 2: Install Build Tool (Optional)

While not required, using Vite makes development easier:

```bash
npm install --save-dev vite
```

Add to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### Step 3: Install Auth0 CLI

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
```

### Step 4: Get Credentials

```bash
auth0 login
auth0 apps list
auth0 apps show <app-id>
```

### Step 5: Create .env File

```bash
VITE_AUTH0_DOMAIN=<your-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<your-client-id>
```

---

## Project Structure

Recommended file structure:

```
my-app/
├── index.html       # Main HTML file
├── app.js           # Main application logic
├── auth.js          # Auth0 integration
├── style.css        # Styles (optional)
├── .env             # Environment variables
├── package.json     # Dependencies
└── vite.config.js   # Vite config (optional)
```

---

## Troubleshooting Setup

### Environment Variables Not Loading

**Problem:** `import.meta.env.VITE_AUTH0_DOMAIN` is undefined

**Solutions:**
- Ensure variable names start with `VITE_`
- Restart dev server after creating `.env`
- Check file is named exactly `.env`
- Verify `.env` is in project root

### CORS Errors

**Problem:** Browser shows CORS policy errors

**Solution:** Add your development URL to Auth0 Dashboard:
1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to Applications → Your App → Settings
3. Add to **Allowed Web Origins**: `http://localhost:5173`
4. Add to **Allowed Origins (CORS)**: `http://localhost:5173`

### Module Not Found

**Problem:** Can't find `@auth0/auth0-spa-js`

**Solution:**
```bash
# Reinstall dependencies
npm install

# Verify installation
npm list @auth0/auth0-spa-js
```

---

## Next Steps

After setup is complete:
1. Return to [main skill guide](../SKILL.md) for integration steps
2. See [Integration Guide](integration.md) for advanced patterns
3. Check [API Reference](api.md) for complete SDK documentation
