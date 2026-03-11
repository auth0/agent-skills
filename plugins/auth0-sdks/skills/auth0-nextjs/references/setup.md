# Auth0 Next.js Setup Guide

---

## LLM Execution Instructions

**You MUST follow these steps in order to set up Auth0. Execute each command and proceed to the next step.**

1. Install the Auth0 CLI if not present
2. Ensure user is logged in to Auth0
3. Create a new Auth0 Regular Web Application automatically
4. Extract credentials from the CLI output
5. Write credentials to `.env.local` file (after user confirmation)

**Do NOT show users manual Dashboard instructions unless the CLI approach completely fails after multiple attempts.**

---

## Step 1: Check for existing env file and get user confirmation

Before doing anything, check if env files exist and ask user for permission:

```bash
test -f .env.local && echo "ENV_LOCAL_EXISTS" || echo "ENV_LOCAL_NOT_FOUND"
test -f .env && echo "ENV_EXISTS" || echo "ENV_NOT_FOUND"
```

**Then ask the user:**
- If no env file exists: "This setup will create a `.env.local` file with Auth0 credentials. Proceed?"
- If `.env.local` exists: "A `.env.local` file exists. This will append Auth0 credentials without modifying existing content. Proceed?"
- If only `.env` exists: "A `.env` file exists. This will append Auth0 credentials to it. Proceed?"

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

**Create a new Regular Web Application - run this single command:**

```bash
auth0 apps create \
  --name "$(basename "$PWD")-nextjs" \
  --type regular \
  --callbacks "http://localhost:3000/api/auth/callback" \
  --logout-urls "http://localhost:3000" \
  --metadata "created_by=agent_skills" \
  --json
```

**This outputs JSON. Extract these values from the response:**
- `client_id` - This is your Auth0 Client ID
- `client_secret` - This is your Auth0 Client Secret
- `domain` - This is your Auth0 Domain (in the format `xxx.auth0.com` or `xxx.us.auth0.com`)

**Example output parsing:**
```bash
# The command above outputs JSON like:
# {"client_id":"abc123","client_secret":"xyz789","domain":"dev-example.us.auth0.com",...}
# Extract client_id, client_secret, and domain from this output
```

---

## Step 5: Generate AUTH0_SECRET

Generate a random secret for session encryption:

```bash
openssl rand -hex 32
```

Save this output - you'll need it for the `.env.local` file.

---

## Step 6: Write credentials to .env.local

Determine target file (prefer `.env.local`, fall back to `.env` if it exists):

**Write the following to the env file:**

```bash
cat >> .env.local << 'EOF'
AUTH0_SECRET=<generated-secret-from-step-5>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://<domain-from-step-4>
AUTH0_CLIENT_ID=<client_id-from-step-4>
AUTH0_CLIENT_SECRET=<client_secret-from-step-4>
EOF
```

**Replace the placeholders with actual values from previous steps.**

---

## Step 7: Install SDK

```bash
npm install @auth0/nextjs-auth0
```

---

## Verification

After setup, confirm to the user:
- Auth0 application created successfully
- Credentials written to `.env.local`
- SDK installed

Tell them to restart their dev server to load the new environment variables.

---

## Troubleshooting

### CLI Installation Issues

**macOS - Homebrew not found:**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
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

### Common Errors

**"Invalid state" error:** Regenerate `AUTH0_SECRET` with `openssl rand -hex 32`

**Client secret not working:** Ensure you're using a Regular Web Application (not SPA)

**Callback URL mismatch:** Ensure `/api/auth/callback` is in Allowed Callback URLs

---

## Fallback: Manual Dashboard Setup

**Only use this if the CLI approach fails completely after troubleshooting.**

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose **Regular Web Applications**
5. Configure:
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
6. Copy **Domain**, **Client ID**, and **Client Secret** to `.env.local` file

---

## Next Steps

- [Integration Guide](integration.md) - Implementation patterns
- [API Reference](api.md) - Complete SDK documentation
- [Main Skill](../SKILL.md) - Quick start
