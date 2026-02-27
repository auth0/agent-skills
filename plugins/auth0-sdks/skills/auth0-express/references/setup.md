# Auth0 Express Setup Guide

---

## LLM Execution Instructions

**You MUST follow these steps in order to set up Auth0. Execute each command and proceed to the next step.**

1. Install the Auth0 CLI if not present
2. Ensure user is logged in to Auth0
3. Create a new Auth0 Regular Web Application automatically
4. Extract credentials from the CLI output
5. Write credentials to env file (after user confirmation)

**Note:** The CLIENT_SECRET cannot be automatically written to the env file for security reasons. After setup, inform the user they need to manually add the CLIENT_SECRET value.

**Do NOT show users manual Dashboard instructions unless the CLI approach completely fails after multiple attempts.**

---

## Step 1: Check for existing env file and get user confirmation

Before doing anything, check if env files exist and ask user for permission:

```bash
test -f .env.local && echo "ENV_LOCAL_EXISTS" || echo "ENV_LOCAL_NOT_FOUND"
test -f .env && echo "ENV_EXISTS" || echo "ENV_NOT_FOUND"
```

**Then ask the user:**
- If no env file exists: "This setup will create a `.env` file with Auth0 credentials. You'll need to manually add the CLIENT_SECRET afterward. Proceed?"
- If env file exists: "An env file exists. This will append Auth0 credentials without modifying existing content. Proceed?"

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
  --name "$(basename "$PWD")-express" \
  --type regular \
  --callbacks "http://localhost:3000/callback" \
  --logout-urls "http://localhost:3000" \
  --metadata "created_by=agent_skills" \
  --json
```

**This outputs JSON. Extract these values from the response:**
- `client_id` - This is your Auth0 Client ID
- `client_secret` - This is your Auth0 Client Secret (tell user to save this)
- `domain` - This is your Auth0 Domain (in the format `xxx.auth0.com` or `xxx.us.auth0.com`)

**Example output parsing:**
```bash
# The command above outputs JSON like:
# {"client_id":"abc123","client_secret":"xyz789","domain":"dev-example.us.auth0.com",...}
# Extract client_id, client_secret, and domain from this output
```

---

## Step 5: Generate SECRET

Generate a random secret for session encryption:

```bash
openssl rand -hex 32
```

Save this output - you'll need it for the env file.

---

## Step 6: Write credentials to env file

**Write the following to `.env`:**

```bash
cat >> .env << 'EOF'
SECRET=<generated-secret-from-step-5>
BASE_URL=http://localhost:3000
CLIENT_ID=<client_id-from-step-4>
CLIENT_SECRET=<client_secret-from-step-4>
ISSUER_BASE_URL=https://<domain-from-step-4>
EOF
```

**Replace placeholders with actual values from previous steps.**

**Important:** Tell the user to verify the CLIENT_SECRET was written correctly, as this is a sensitive value.

---

## Step 7: Install SDK

```bash
npm install express-openid-connect dotenv
```

---

## Verification

After setup, confirm to the user:
- Auth0 application created successfully
- Credentials written to `.env`
- SDK installed

Tell them to:
1. Verify CLIENT_SECRET is correct in the env file
2. Ensure the env file is in `.gitignore`
3. Restart the server to load environment variables

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

**"Invalid state" error:** Regenerate `SECRET` with `openssl rand -hex 32`

**Client secret required:** Express uses Regular Web Application type (not SPA)

**Callback URL mismatch:** Add `/callback` to Allowed Callback URLs via CLI:

```bash
auth0 apps update <app-id> --callbacks "http://localhost:3000/callback"
```

---

## Fallback: Manual Dashboard Setup

**Only use this if the CLI approach fails completely after troubleshooting.**

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose **Regular Web Applications**
5. Configure:
   - **Allowed Callback URLs**: `http://localhost:3000/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
6. Copy **Domain**, **Client ID**, and **Client Secret** to `.env` file

---

## Next Steps

- [Integration Guide](integration.md)
- [API Reference](api.md)
- [Main Skill](../SKILL.md)
