---
name: auth0-express-api
description: Use when adding Auth0 token validation to Express APIs - integrates express-oauth2-jwt-bearer SDK to protect Express endpoints with JWT Bearer authentication, scope-based authorization, and DPoP support
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
---

# Express OAuth2 JWT Bearer Integration

Protects Express.js API endpoints with JWT Bearer access token validation using the `express-oauth2-jwt-bearer` SDK. Supports scope-based authorization, custom claim validation, and DPoP (Demonstration of Proof-of-Possession) token binding per RFC 9449.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/node-oauth2-jwt-bearer/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below.

## Prerequisites

- Node.js 18 LTS or newer
- npm 8+ (or yarn/pnpm)
- Express.js 4.x or 5.x
- Node.js 20+ (for bootstrap script automation)
- An Auth0 API resource (audience)

## When NOT to Use

| Use Case | Recommended Skill |
|----------|------------------|
| Server-rendered web app with login UI (Express + sessions) | [auth0-express](/auth0-express) |
| Single Page Application (React, Angular, Vue) | [auth0-react](/auth0-react), [auth0-angular](/auth0-angular), [auth0-vue](/auth0-vue) |
| Next.js web application | [auth0-nextjs](/auth0-nextjs) |
| Mobile application (iOS, Android) | [auth0-swift](/auth0-swift), [auth0-android](/auth0-android) |
| ASP.NET Core Web API | [auth0-aspnetcore-api](/auth0-aspnetcore-api) |
| Fastify API | [auth0-fastify-api](/auth0-fastify-api) |

## Quick Start Workflow

> **Agent instruction:** Follow these steps in order. At each step, verify success before proceeding. If any step fails after 5–6 iterations, use `AskUserQuestion` to ask the user for help.

### Step 1 — Install SDK

```bash
npm install express-oauth2-jwt-bearer
```

Also install common companions:

```bash
npm install cors dotenv helmet
```

### Step 2 — Create Auth0 API Resource

> **Agent instruction (critical checkpoint):** Before proceeding, check if the user's prompt already provides Auth0 credentials (domain and audience). If yes, skip directly to Step 3. If not, use `AskUserQuestion`:
>
> "How would you like to configure Auth0 for this project?"
> - Option A: "Automatic setup (recommended)" — uses the bootstrap script
> - Option B: "Manual setup" — provide Auth0 credentials manually
>
> **Wait for user answer before continuing.** See [Setup Guide](./references/setup.md) for both paths.

Create an API resource (not an Application) in Auth0 Dashboard:
1. Go to **Applications → APIs → Create API**
2. Set a **Name** (e.g., "My Express API")
3. Set an **Identifier** / Audience (e.g., `https://my-api.example.com`)
4. Select **RS256** signing algorithm

Or via Auth0 CLI:
```bash
auth0 apis create --name "My Express API" --identifier "https://my-api.example.com" --signing-alg "RS256"
```

### Step 3 — Configure Environment

Create a `.env` file:

```env
AUTH0_AUDIENCE=https://my-api.example.com
AUTH0_DOMAIN=your-tenant.us.auth0.com
PORT=3000
```

> **Agent instruction:** Ensure `require('dotenv').config()` (or `import 'dotenv/config'`) executes before any Auth0 middleware initialization.

### Step 4 — Configure Auth Middleware

```javascript
const { auth } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});
```

> **Agent instruction:** CORS middleware MUST be registered before the auth middleware:
> ```javascript
> app.use(cors({ origin: 'http://localhost:3000', allowedHeaders: ['Authorization'], exposedHeaders: ['WWW-Authenticate'] }));
> ```

### Step 5 — Protect Endpoints

```javascript
// Public endpoint — no auth required
app.get('/api/public', (req, res) => {
  res.json({ message: 'Public endpoint — no authentication required' });
});

// Protected endpoint — requires valid JWT
app.get('/api/private', checkJwt, (req, res) => {
  res.json({ message: 'Protected endpoint', sub: req.auth.payload.sub });
});
```

### Step 6 — Test API

> **Agent instruction:** Build and verify the API works:
> ```bash
> node server.js
> ```
> Test endpoints:
> ```bash
> curl http://localhost:3000/api/public
> curl http://localhost:3000/api/private -H "Authorization: Bearer YOUR_TOKEN"
> ```
> If the build or test fails, read the error output, diagnose the issue, fix it, and retry.

## Detailed Documentation

- **[Setup Guide](./references/setup.md)** — Auth0 API creation, environment configuration, bootstrap script, secret management
- **[Integration Patterns](./references/integration.md)** — Scope-based authorization, custom claim validation, DPoP, error handling, CORS, testing
- **[API Reference](./references/api.md)** — Configuration options, middleware API, claims reference, troubleshooting

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Created **Application** instead of **API** in Auth0 Dashboard | Go to Applications → APIs → Create API. APIs use audience-based JWT validation, not client credentials. |
| Audience doesn't match API Identifier | The `AUTH0_AUDIENCE` env var must exactly match the Identifier you set when creating the API in Auth0 Dashboard |
| Domain includes `https://` prefix | Use hostname only: `your-tenant.us.auth0.com`, not `https://your-tenant.us.auth0.com` |
| CORS not configured before auth middleware | Register `cors()` BEFORE `auth()` — Express middleware runs in order |
| Checking `scope` claim instead of `permissions` for RBAC | Use `requiredScopes()` for OAuth scopes; for Auth0 RBAC, read `req.auth.payload.permissions` array |
| Missing `dotenv` config before middleware init | `require('dotenv').config()` must run before `auth()` is called, or env vars will be undefined |
| Using `client_secret` in API config | Express API uses JWKS public key validation — no client secret needed |
| `req.user` instead of `req.auth` | This SDK sets `req.auth` (with `.header`, `.payload`, `.token`), not `req.user` |

## Related Skills

- [auth0-express](/auth0-express) — Express web app with server-side sessions (Regular Web Application)
- [auth0-fastify-api](/auth0-fastify-api) — Fastify API with JWT validation
- [auth0-aspnetcore-api](/auth0-aspnetcore-api) — ASP.NET Core Web API with JWT validation
- [auth0-react](/auth0-react) — React SPA (common frontend for this API)

## Quick Reference

### Core Middleware

| Function | Purpose |
|----------|---------|
| `auth(options)` | JWT validation middleware — returns 401 if valid Bearer token absent |
| `requiredScopes('read:data write:data')` | Validates token scope claim — returns 403 `insufficient_scope` |
| `scopeIncludesAny(['read:data', 'audit:read'])` | Requires at least one scope from list — returns 403 |
| `claimEquals('claim', 'value')` | Verifies claim equals value — returns 401 `invalid_token` |
| `claimIncludes('claim', 'val1', 'val2')` | Verifies claim includes values — returns 401 `invalid_token` |
| `claimCheck(payload => payload.org_id === 'org_123')` | Custom validation function — returns 401 `invalid_token` |

### Request Properties (after auth)

| Property | Description |
|----------|-------------|
| `req.auth.payload` | Decoded JWT payload (claims) |
| `req.auth.header` | Decoded JWT header |
| `req.auth.token` | Raw JWT token string |
| `req.auth.payload.sub` | User ID (subject claim) |
| `req.auth.payload.scope` | Space-separated scopes string |
| `req.auth.payload.permissions` | Permissions array (Auth0 RBAC) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ISSUER_BASE_URL` | Auth0 issuer domain (`https://your-tenant.auth0.com`) — alternative to `issuerBaseURL` option |
| `AUDIENCE` | API identifier — alternative to `audience` option |
| `AUTH0_DOMAIN` | Auth0 tenant domain (used with dotenv pattern) |
| `AUTH0_AUDIENCE` | API audience (used with dotenv pattern) |

## TypeScript Support

The SDK ships with TypeScript type definitions. For TypeScript Express projects:

```bash
npm install -D typescript @types/express @types/node @types/cors
```

TypeScript usage:

```typescript
import express, { Request, Response } from 'express';
import { auth, requiredScopes, AuthResult } from 'express-oauth2-jwt-bearer';

const app = express();

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

app.get('/api/private', checkJwt, (req: Request, res: Response) => {
  // req.auth is typed as AuthResult | undefined
  const payload = req.auth?.payload;
  res.json({ sub: payload?.sub });
});
```

## References

- [express-oauth2-jwt-bearer GitHub](https://github.com/auth0/node-oauth2-jwt-bearer)
- [Auth0 Node.js API Quickstart](https://auth0.com/docs/quickstart/backend/nodejs/interactive)
- [Auth0 API Authorization docs](https://auth0.com/docs/get-started/apis)
- [express-oauth2-jwt-bearer API docs](https://auth0.github.io/node-oauth2-jwt-bearer/)
