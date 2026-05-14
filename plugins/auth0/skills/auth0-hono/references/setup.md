# auth0-hono Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **SECURITY: Never read the contents of `.env` at any point during setup.** The file may contain sensitive secrets that should not be exposed in the LLM context. If you determine you need to read the file for any reason, ask the user for explicit permission before doing so — do not proceed until the user confirms.
>
> **Before running any part of this setup that writes to an env file, you MUST ask the user for explicit confirmation.** Follow the steps below precisely.
>
> **Credential check (always first):**
> If the user's prompt already provides Auth0 credentials (domain, client ID, and client secret), use them directly — skip the bootstrap script and do NOT call `AskUserQuestion`. Write the `.env` file and proceed with integration.
>
> **If credentials are NOT in the prompt**, use `AskUserQuestion`:
> "How would you like to configure Auth0 for this project?"
> - Option A: "Automatic setup (recommended)" — uses the bootstrap script
> - Option B: "Manual setup" — provide Auth0 credentials manually

### Step 1: Check for existing env files and confirm with user

Before writing credentials, check which env files exist:

```bash
test -f .env && echo "ENV_EXISTS" || echo "ENV_NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding — do not continue until the user confirms:

- If `.env` exists, ask:
  - Question: "A `.env` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env" / "No, I'll update it manually"

- If `.env` does **not** exist, ask:
  - Question: "This setup will create a `.env` file containing Auth0 credentials (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_SESSION_ENCRYPTION_KEY) and a placeholder for AUTH0_CLIENT_SECRET that you will need to fill in manually. Do you want to proceed?"
  - Options: "Yes, create .env" / "No, I'll configure it manually"

**Do not proceed with writing to any env file unless the user selects the confirmation option.**

### Step 2a: Automatic Setup (only after confirmation)

> **Pre-flight checks:**
> - Verify Node.js 20+ is installed: `node --version`
> - Verify Auth0 CLI is installed: `auth0 --version`
> - Verify logged in: `auth0 tenants list --csv --no-input`
> - If any check fails, guide user to install/login, or fall back to manual setup

> **Run bootstrap script:**
> ```bash
> cd scripts && npm install && node bootstrap.mjs <project-path>
> ```
> The script will:
> - Validate the Hono project structure (checks for `hono` in `package.json`)
> - Verify `"type": "module"` in `package.json` (warn if missing — SDK is ESM-only)
> - Discover existing Auth0 apps and database connections
> - Show a change plan and ask for confirmation
> - Create a Regular Web Application in Auth0
> - Set up database connection (Username-Password-Authentication)
> - Write the `.env` file with all required variables
> - Print a summary with remaining manual steps

### Step 2b: Manual Setup (only after confirmation)

Ask the user for their Auth0 credentials:
- Domain (e.g., `your-tenant.auth0.com`)
- Client ID
- Client Secret

Determine target env file and append Auth0 credentials:

```bash
#!/bin/bash

# Get credentials from user (passed as arguments or prompted)
AUTH0_DOMAIN="${1}"
AUTH0_CLIENT_ID="${2}"

# Generate encryption key
AUTH0_SESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Append Auth0 credentials
cat >> .env << ENVEOF
AUTH0_DOMAIN=$AUTH0_DOMAIN
AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET='YOUR_CLIENT_SECRET'
APP_BASE_URL=http://localhost:3000
AUTH0_SESSION_ENCRYPTION_KEY=$AUTH0_SESSION_ENCRYPTION_KEY
ENVEOF

echo "Auth0 credentials written to .env"
```

After the script runs, remind the user to:
1. Replace `YOUR_CLIENT_SECRET` with the actual client secret from Auth0.
2. Ensure `.env` is listed in `.gitignore` to avoid accidentally committing secrets.

---

## Project Setup Verification

Before proceeding with SDK integration, verify the project is correctly configured:

```bash
# Check ESM module type (required for @auth0/auth0-hono)
node -e "const p=require('./package.json'); if(p.type!=='module'){console.log('WARNING: Add \"type\": \"module\" to package.json — SDK is ESM-only');process.exit(1)}"
```

If the project doesn't have `"type": "module"`, add it:
```bash
npm pkg set type=module
```

---

## Post-Setup Steps

1. **Configure Auth0 Dashboard:**
   - Go to Applications > Your App > Settings
   - Set **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
   - Set **Allowed Logout URLs**: `http://localhost:3000`
   - Set **Allowed Web Origins**: `http://localhost:3000`
   - Ensure Application Type is **Regular Web Application**

2. **Verify middleware placement:**
   - `app.use('*', auth0())` must come before all route definitions
   - CORS middleware (if used) should come before `auth0()`

3. **Test the login flow:**
   - Start the dev server
   - Visit `http://localhost:3000/auth/login`
   - Should redirect to Auth0 Universal Login
   - After login, should redirect back to your app

## SDK Installation

```bash
npm install @auth0/auth0-hono
```

If you don't have Hono and a Node.js server adapter installed yet:

```bash
npm install hono @hono/node-server
```

For TypeScript projects, ensure you have TypeScript configured:

```bash
npm install -D typescript @types/node tsx
```

## Secret Management

### Development

Use a `.env` file in the project root:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
APP_BASE_URL=http://localhost:3000
AUTH0_SESSION_ENCRYPTION_KEY=a-random-string-with-at-least-32-characters
AUTH0_AUDIENCE=https://api.example.com
```

Load the `.env` file when starting the dev server:

```bash
npx tsx watch --env-file=.env index.ts
```

Or with Node.js 20+:

```bash
node --env-file=.env index.js
```

### Production

- Set environment variables directly in your hosting platform (Cloudflare Workers, Deno Deploy, Bun, AWS, etc.)
- Never use `.env` files in production deployments
- `AUTH0_SESSION_ENCRYPTION_KEY` must be consistent across server restarts — changing it invalidates all sessions
- Use a strong random value for `AUTH0_SESSION_ENCRYPTION_KEY` (64+ characters recommended)

### Cloudflare Workers

Environment variables are set via `wrangler secret` or `wrangler.toml` `[vars]`:

```bash
wrangler secret put AUTH0_DOMAIN
wrangler secret put AUTH0_CLIENT_ID
wrangler secret put AUTH0_CLIENT_SECRET
wrangler secret put AUTH0_SESSION_ENCRYPTION_KEY
```

Non-secret values can go in `wrangler.toml`:

```toml
[vars]
APP_BASE_URL = "https://your-app.workers.dev"
```

### Deno Deploy

Set environment variables in the Deno Deploy dashboard or via `deployctl`:

```bash
deployctl deploy --env AUTH0_DOMAIN=tenant.auth0.com ...
```

### Security Rules

- **Never** commit `.env` to source control — add `.env` to `.gitignore`
- **Never** hardcode `AUTH0_CLIENT_SECRET` in source files
- `AUTH0_SESSION_ENCRYPTION_KEY` must be at least 32 characters
- Rotate secrets by updating Auth0 Dashboard and `.env` simultaneously

## Verification

1. **Start the dev server:**
   ```bash
   npx tsx watch --env-file=.env index.ts
   ```

2. **Test login:** Visit `http://localhost:3000/auth/login` — should redirect to Auth0 Universal Login

3. **Test callback:** After authenticating, should redirect to `http://localhost:3000/auth/callback` then to `/`

4. **Test session:** Refresh the page — should still be authenticated

5. **Test logout:** Visit `http://localhost:3000/auth/logout` — session destroyed, redirected to homepage

6. **Test protected route:** While unauthenticated, visit a `requiresAuth()` protected route — should redirect to login or return 401
