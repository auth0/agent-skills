# Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **First, check if credentials are already in the user's prompt.** If the user provided Auth0 domain and API audience, use them directly — skip the bootstrap script and `AskUserQuestion`. Write the `.env` file and proceed to integration.
>
> **If credentials are NOT provided**, use `AskUserQuestion` to ask the user:
> "How would you like to configure Auth0 for this project?"
> - Option A: "Automatic setup (recommended)" — uses the bootstrap script
> - Option B: "Manual setup" — provide Auth0 credentials manually
>
> **If Automatic Setup:**
>
> 1. **Pre-flight checks:**
>    - Verify Node.js 20+ is installed: `node --version`
>    - Verify Auth0 CLI is installed: `auth0 --version`
>    - Verify logged in: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide user to install/login, or fall back to manual setup
>
> 2. **Run bootstrap script:**
>    ```bash
>    cd <skill-dir>/scripts && npm install && node bootstrap.mjs <project-path>
>    ```
>    The script will:
>    - Validate the Express project structure
>    - Discover existing Auth0 APIs
>    - Show a change plan and ask for confirmation
>    - Create the Auth0 API resource
>    - Write the `.env` configuration file
>    - Print a summary with remaining manual steps
>
> **If Manual Setup:**
>
> Ask the user for their Auth0 credentials:
> - Domain (e.g., `your-tenant.auth0.com`)
> - API Audience / Identifier (e.g., `https://my-api.example.com`)
>
> Write the `.env` file with provided values. No client secret is needed — the SDK validates JWTs via JWKS public keys.

## Post-Setup Steps

After Auth0 configuration is complete:

1. **Verify `.env` is loaded** — ensure `require('dotenv').config()` or `import 'dotenv/config'` runs before Auth0 middleware initialization
2. **Verify CORS configuration** — `cors()` middleware must be registered before `auth()` middleware
3. **Test with curl:**
   ```bash
   # Public endpoint should return 200
   curl http://localhost:3000/api/public

   # Protected endpoint without token should return 401
   curl http://localhost:3000/api/private

   # Protected endpoint with valid token should return 200
   curl http://localhost:3000/api/private -H "Authorization: Bearer YOUR_TOKEN"
   ```

## SDK Installation

```bash
npm install express-oauth2-jwt-bearer
```

Common companions:

```bash
npm install cors dotenv helmet
```

For TypeScript projects:

```bash
npm install -D typescript @types/express @types/node @types/cors
```

## Secret Management

The `express-oauth2-jwt-bearer` SDK validates JWTs using JWKS (JSON Web Key Set) public keys fetched from your Auth0 tenant. **No client secret is needed.**

Configuration requires only:
- `AUTH0_DOMAIN` — your Auth0 tenant domain
- `AUTH0_AUDIENCE` — your API identifier

### Development

Use a `.env` file (add to `.gitignore`):

```env
AUTH0_AUDIENCE=https://my-api.example.com
AUTH0_DOMAIN=your-tenant.us.auth0.com
PORT=3000
```

### Production

Set environment variables directly:

```bash
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export AUTH0_AUDIENCE=https://my-api.example.com
export PORT=3000
```

## Getting a Test Token

### Via Auth0 Dashboard

1. Go to **Applications → APIs** → select your API → **Test** tab
2. Copy the provided access token

### Via Auth0 CLI

```bash
auth0 test token --audience https://my-api.example.com --scopes "read:messages write:messages"
```

### Via curl (Client Credentials Flow)

```bash
curl -X POST https://your-tenant.us.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials"
  }'
```

## Verification

After setup, verify the integration:

1. Start the server: `node server.js` (or `npm start`)
2. Test public endpoint: `curl http://localhost:3000/api/public` → 200 OK
3. Test protected endpoint without token: `curl http://localhost:3000/api/private` → 401 Unauthorized
4. Test protected endpoint with valid token: `curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/private` → 200 OK
5. Test scope-protected endpoint without required scope: → 403 Forbidden
