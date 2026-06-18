---
name: auth0-express-api
description: Use when protecting Express.js API endpoints with JWT Bearer token authentication using the @auth0/auth0-express-api SDK - covers requiresAuth middleware, scope-based authorization with scopesInclude, and claim-based RBAC with claimEquals/claimIncludes/claimCheck. Do NOT use for the older express-oauth2-jwt-bearer package or for server-side web apps with login UI.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F510"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0 Express API SDK Integration

Protect Express.js API endpoints with JWT Bearer token authentication using `@auth0/auth0-express-api`.

> **Note:** This skill covers the `@auth0/auth0-express-api` SDK (currently in beta). For the older `express-oauth2-jwt-bearer` package, use the `express-oauth2-jwt-bearer` skill instead.

---

## Prerequisites

- Express.js application
- Node.js 22 LTS or newer
- Auth0 account with a configured **API** (Resource Server)
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Server-side web apps with login UI** - Use `auth0-express` for session-based auth
- **Next.js applications** - Use `auth0-nextjs`
- **Using express-oauth2-jwt-bearer package** - Use `express-oauth2-jwt-bearer` skill
- **Python/Go/ASP.NET APIs** - Use the corresponding language-specific skill

---

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-express-api@beta dotenv
```

### 2. Configure Environment

Create `.env`:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
```

### 3. Register Auth0 API Router

```javascript
import 'dotenv/config';
import express from 'express';
import { createAuth0Api } from '@auth0/auth0-express-api';

const app = express();

// Reads AUTH0_DOMAIN and AUTH0_AUDIENCE from environment automatically
app.use(createAuth0Api());

app.listen(3000, () => console.log('API running on http://localhost:3000'));
```

### 4. Protect Endpoints

```javascript
import { requiresAuth } from '@auth0/auth0-express-api';

app.get('/api/private', requiresAuth(), (req, res) => {
  res.json({ message: `Hello, ${req.auth0.user.sub}` });
});
```

### 5. Test Authentication

```bash
# Should return 401 (no token)
curl http://localhost:3000/api/private

# Should return 200 (valid token from Auth0 Dashboard → APIs → your API → Test tab)
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/private
```

---

## Detailed Documentation

- **[Setup Guide](references/setup.md)** - Auth0 API registration, .env configuration, obtaining test tokens
- **[Integration Patterns](references/integration.md)** - Protected endpoints, scope/claim-based RBAC, error handling, CORS
- **[API Reference](references/api.md)** - Full configuration options, middleware reference, `req.auth0` object

---

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Created an Application instead of an API | Token validation fails | Create an **API** (Resource Server) in Auth0 Dashboard → APIs |
| Audience doesn't match API Identifier | `401 Unauthorized` — audience mismatch | Copy the exact API Identifier from Auth0 Dashboard → APIs |
| `AUTH0_DOMAIN` missing `https://` | SDK will handle this; just use the domain | e.g. `your-tenant.auth0.com` (not the full URL) |
| CORS not configured before auth middleware | Preflight OPTIONS returns 401 | Add `cors()` middleware before `createAuth0Api()` |
| `.env` file not loaded | `undefined` domain/audience | Add `import 'dotenv/config'` at the top of the entry file |
| Hardcoded domain/audience in source | Secrets in version control | Put values in `.env` only; never inline literal values |
| Using `requiresAuth` from `@auth0/auth0-express` in an API project | Type mismatch / wrong behavior | Import `requiresAuth` from `@auth0/auth0-express-api` |
| Calling claim middleware before `requiresAuth` | `req.auth0.user` is undefined | Always call `requiresAuth()` first in the middleware chain |

---

## Related Skills

- `auth0-express` - For Express web apps with login UI using @auth0/auth0-express
- `express-oauth2-jwt-bearer` - For Express APIs using the older express-oauth2-jwt-bearer SDK
- `auth0-nextjs` - For Next.js server-side web apps
- `go-jwt-middleware` - JWT middleware for Go APIs
- `auth0-cli` - Manage Auth0 resources from the terminal

---

## Quick Reference

**Core Middleware:**

| Function | Description | Returns |
|----------|-------------|---------|
| `requiresAuth(options?)` | JWT validation; validates Bearer token | 401 if missing/invalid |
| `scopesInclude(scopes, options?)` | Validates token has required scopes | 403 if missing |
| `claimEquals(claim, value)` | Validates a claim equals a value | 401 if mismatch |
| `claimIncludes(claim, values)` | Validates claim includes all values | 401 if incomplete |
| `claimCheck(fn, options?)` | Custom claim validation function | 401 if fn returns false |

**`req.auth0` After Authentication:**

```javascript
req.auth0.user     // Decoded JWT payload (sub, iss, aud, exp, permissions, etc.)
req.auth0.client   // ApiClient instance
```

**Environment Variables:**

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Auth0 tenant domain (e.g. `tenant.auth0.com`) |
| `AUTH0_AUDIENCE` | API Identifier (e.g. `https://your-api-identifier`) |

---

## References

- [@auth0/auth0-express-api on npm](https://www.npmjs.com/package/@auth0/auth0-express-api)
- [GitHub: auth0/auth0-express (auth0-express-api package)](https://github.com/auth0/auth0-express)
- [Auth0 Node.js API Quickstart](https://auth0.com/docs/quickstart/backend/nodejs/interactive)
- [Auth0 APIs Dashboard](https://manage.auth0.com/#/apis)
