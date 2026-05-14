# auth0-hono Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **Credential check (always first):**
> If the user's prompt already provides Auth0 credentials (domain, client ID, and client secret), use them directly — skip the bootstrap script and do NOT call `AskUserQuestion`. Write the `.env` file and proceed with integration.
>
> **If credentials are NOT in the prompt**, use `AskUserQuestion`:
> "How would you like to configure Auth0 for this project?"
> - Option A: "Automatic setup (recommended)" — uses the bootstrap script
> - Option B: "Manual setup" — provide Auth0 credentials manually
>
> **If Automatic Setup (Option A):**
>
> 1. **Pre-flight checks:**
>    - Verify Node.js 20+ is installed: `node --version`
>    - Verify Auth0 CLI is installed: `auth0 --version`
>    - Verify logged in: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide user to install/login, or fall back to manual setup
>
> 2. **Run bootstrap script:**
>    ```bash
>    cd scripts && npm install && node bootstrap.mjs <project-path>
>    ```
>    The script will:
>    - Validate the Hono project structure (checks for `hono` in `package.json`)
>    - Discover existing Auth0 apps and database connections
>    - Show a change plan and ask for confirmation
>    - Create a Regular Web Application in Auth0
>    - Set up database connection (Username-Password-Authentication)
>    - Write the `.env` file with all required variables
>    - Print a summary with remaining manual steps
>
> **If Manual Setup (Option B):**
>
> Ask the user for their Auth0 credentials:
> - Domain (e.g., `your-tenant.auth0.com`)
> - Client ID
> - Client Secret
>
> Write the `.env` file with provided values:
> ```
> AUTH0_DOMAIN=your-tenant.auth0.com
> AUTH0_CLIENT_ID=your-client-id
> AUTH0_CLIENT_SECRET=your-client-secret
> APP_BASE_URL=http://localhost:3000
> AUTH0_SESSION_ENCRYPTION_KEY=<generate-random-32-char-string>
> ```

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

- Set environment variables directly in your hosting platform (Cloudflare Workers, AWS, etc.)
- Never use `.env` files in production deployments
- `AUTH0_SESSION_ENCRYPTION_KEY` must be consistent across server restarts — changing it invalidates all sessions
- Use a strong random value for `AUTH0_SESSION_ENCRYPTION_KEY` (64+ characters recommended)

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
