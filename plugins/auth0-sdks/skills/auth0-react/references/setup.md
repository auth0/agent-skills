# Auth0 React Setup Guide

---

## LLM Execution Instructions

**You MUST follow these steps in order to set up Auth0. Execute each command and proceed to the next step.**

1. Install the Auth0 CLI if not present
2. Ensure user is logged in to Auth0
3. Create a new Auth0 SPA application automatically
4. Extract credentials from the CLI output
5. Write credentials to `.env` file (after user confirmation)

**Do NOT show users manual Dashboard instructions unless the CLI approach completely fails after multiple attempts.**

---

## Step 1: Check for existing .env and get user confirmation

Before doing anything, check if `.env` exists and ask user for permission:

```bash
test -f .env && echo "EXISTS" || echo "NOT_FOUND"
```

**Then ask the user:**
- If `.env` does **not** exist: "This setup will create a `.env` file with Auth0 credentials (domain and client ID). Proceed?"
- If `.env` **exists**: "A `.env` file exists. This will append Auth0 credentials without modifying existing content. Proceed?"

**Do not continue unless user confirms.**

---

## Step 2: Install Auth0 CLI

Check if Auth0 CLI is installed, install if needed:

```bash
command -v auth0 &> /dev/null && echo "AUTH0_CLI_INSTALLED" || echo "AUTH0_CLI_NOT_FOUND"
```

**If not installed, run the appropriate command for the user's OS:**

**macOS:**
```bash
brew install auth0/auth0-cli/auth0
```

**Linux:**
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
```

**Windows (PowerShell):**
```powershell
scoop install auth0
```

---

## Step 3: Ensure user is logged in to Auth0

Check login status:

```bash
auth0 tenants list 2>&1
```

**If the command fails or shows an error**, the user needs to log in:

```bash
auth0 login
```

Tell the user: "A browser window will open. Please log in to your Auth0 account (or create one at https://auth0.com/signup if needed)."

**Wait for user to complete login, then verify:**

```bash
auth0 tenants list
```

---

## Step 4: Create Auth0 Application

**Detect the project type first:**

```bash
grep -q '"vite"' package.json 2>/dev/null && echo "VITE" || (grep -q '"react-scripts"' package.json 2>/dev/null && echo "CRA" || echo "VITE")
```

**Create a new SPA application - run this single command:**

```bash
auth0 apps create \
  --name "$(basename "$PWD")-react-app" \
  --type spa \
  --callbacks "http://localhost:3000,http://localhost:5173" \
  --logout-urls "http://localhost:3000,http://localhost:5173" \
  --origins "http://localhost:3000,http://localhost:5173" \
  --web-origins "http://localhost:3000,http://localhost:5173" \
  --metadata "created_by=agent_skills" \
  --json
```

**This outputs JSON. Extract these values from the response:**
- `client_id` - This is your Auth0 Client ID
- `domain` - This is your Auth0 Domain (in the format `xxx.auth0.com` or `xxx.us.auth0.com`)

**Example output parsing (save the JSON output to extract values):**
```bash
# The command above outputs JSON like:
# {"client_id":"abc123","domain":"dev-example.us.auth0.com",...}
# Extract client_id and domain from this output
```

---

## Step 5: Write credentials to .env

**Based on project type detected in Step 4:**

**For Vite projects**, append to `.env`:
```bash
cat >> .env << 'EOF'
VITE_AUTH0_DOMAIN=<domain-from-step-4>
VITE_AUTH0_CLIENT_ID=<client_id-from-step-4>
EOF
```

**For Create React App projects**, append to `.env`:
```bash
cat >> .env << 'EOF'
REACT_APP_AUTH0_DOMAIN=<domain-from-step-4>
REACT_APP_AUTH0_CLIENT_ID=<client_id-from-step-4>
EOF
```

**Replace `<domain-from-step-4>` and `<client_id-from-step-4>` with the actual values from the JSON output.**

---

## Step 6: Install SDK

```bash
npm install @auth0/auth0-react
```

---

## Verification

After setup, confirm to the user:
- Auth0 application created successfully
- Credentials written to `.env`
- SDK installed

Tell them to restart their dev server to load the new environment variables.

---

## Troubleshooting

### CLI Installation Issues

**macOS - Homebrew not found:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Windows - Scoop not found:**
```powershell
iwr -useb get.scoop.sh | iex
```

### Login Issues

**Browser doesn't open:**
```bash
auth0 login --no-browser
```

**"Not logged in" error:**
```bash
auth0 login --force
```

### Environment Variable Issues

- **Vite**: Variables must start with `VITE_` prefix
- **CRA**: Variables must start with `REACT_APP_` prefix
- Always restart dev server after modifying `.env`

---

## Fallback: Manual Dashboard Setup

**Only use this if the CLI approach fails completely after troubleshooting.**

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose **Single Page Web Applications**
5. Configure:
   - **Allowed Callback URLs**: `http://localhost:3000, http://localhost:5173`
   - **Allowed Logout URLs**: `http://localhost:3000, http://localhost:5173`
   - **Allowed Web Origins**: `http://localhost:3000, http://localhost:5173`
6. Copy **Domain** and **Client ID** to `.env` file

---

## Next Steps

After setup is complete:
1. Return to [main skill guide](../SKILL.md) for integration steps
2. See [Integration Guide](integration.md) for advanced patterns
3. Check [API Reference](api.md) for complete SDK documentation
