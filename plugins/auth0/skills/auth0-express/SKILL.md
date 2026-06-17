---
name: auth0-express
description: Use when adding authentication (login, logout, protected routes) to Express.js web applications using the @auth0/auth0-express SDK - session-based auth with built-in /auth/login, /auth/logout, /auth/callback routes, requireAuth middleware, and claim-based authorization. Do NOT use for the older express-openid-connect package.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F510"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0 Express SDK Integration

Add authentication to Express.js web applications using `@auth0/auth0-express`.

> **Note:** This skill covers the `@auth0/auth0-express` SDK (currently in beta). For the older `express-openid-connect` package, use the `express-openid-connect` skill instead.

---

## Prerequisites

- Express.js application
- Node.js 20 LTS or newer
- Auth0 account and a **Regular Web Application** configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Single Page Applications** - Use `auth0-react`, `auth0-vue`, or `auth0-angular`
- **Next.js applications** - Use `auth0-nextjs`
- **Mobile applications** - Use `auth0-react-native`
- **Stateless APIs** - Use `auth0-express-api` or `express-oauth2-jwt-bearer`
- **Using express-openid-connect package** - Use `express-openid-connect` skill

---

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-express@beta dotenv
```

### 2. Configure Environment

Create `.env`:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
APP_BASE_URL=http://localhost:3000
AUTH0_SESSION_SECRET=your-long-random-secret-here
```

Generate session secret: `openssl rand -hex 64`

Auth0 Dashboard setup:
- Add `http://localhost:3000/auth/callback` to **Allowed Callback URLs**
- Add `http://localhost:3000` to **Allowed Logout URLs**

### 3. Register Auth0 Router

```javascript
import 'dotenv/config';
import express from 'express';
import { createAuth0 } from '@auth0/auth0-express';

const app = express();

// Reads AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET,
// APP_BASE_URL, AUTH0_SESSION_SECRET from environment automatically
app.use(createAuth0());

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
```

This automatically mounts:
- `/auth/login` - Initiates login flow
- `/auth/logout` - Logs the user out
- `/auth/callback` - OAuth callback (must be in Auth0 Allowed Callback URLs)
- `/auth/backchannel-logout` - Back-channel logout support

### 4. Protect Routes

```javascript
import { requireAuth } from '@auth0/auth0-express';

// Redirects to /auth/login if not authenticated
app.get('/profile', requireAuth(), async (req, res) => {
  const user = await req.auth0.client.getUser();
  res.json({ user });
});

// Returns 401 for API requests (requests that accept JSON but not HTML)
app.get('/api/me', requireAuth(), async (req, res) => {
  const user = await req.auth0.client.getUser();
  res.json({ user });
});
```

### 5. Access User Info

```javascript
app.get('/dashboard', requireAuth(), async (req, res) => {
  const user = await req.auth0.client.getUser();
  const session = await req.auth0.client.getSession();

  res.render('dashboard', { user, session });
});
```

---

## Detailed Documentation

- **[Setup Guide](references/setup.md)** - Environment configuration, Auth0 CLI setup, session secrets
- **[Integration Guide](references/integration.md)** - Route protection, sessions, API access tokens, claim middleware
- **[API Reference](references/api.md)** - Full configuration options, `req.auth0` API, middleware reference

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| App type is SPA in Auth0 Dashboard | Must be **Regular Web Application** type |
| Callback URL not registered | Add `/auth/callback` path to Allowed Callback URLs |
| Using `AUTH0_AUDIENCE` for API access without configuring SDK | Set `audience` in `createAuth0()` config or `AUTH0_AUDIENCE` env var |
| Weak or missing session secret | Generate with `openssl rand -hex 64` and set as `AUTH0_SESSION_SECRET` |
| Hardcoding credentials in source | Always use environment variables; never inline domain/client ID |
| Calling `getUser()` outside `requireAuth()` protected route | `getUser()` returns `undefined` if session not established |

---

## Related Skills

- `express-openid-connect` - For Express web apps using the older express-openid-connect SDK
- `auth0-express-api` - For Express APIs protected with JWT Bearer tokens using @auth0/auth0-express-api
- `express-oauth2-jwt-bearer` - For Express APIs using the older express-oauth2-jwt-bearer SDK
- `auth0-quickstart` - Basic Auth0 setup
- `auth0-mfa` - Add Multi-Factor Authentication
- `auth0-cli` - Manage Auth0 resources from the terminal

---

## Quick Reference

**Mounted Routes** (automatic when using `createAuth0()`):
- `/auth/login` - Start login; supports `?returnTo=/path` query param
- `/auth/logout` - Logout user
- `/auth/callback` - OAuth callback
- `/auth/backchannel-logout` - Back-channel logout

**Middleware:**
- `requireAuth(options?)` - Protects a route; redirects HTML requests to `/auth/login`, returns 401 for API requests

**`req.auth0.client` Methods:**
- `getUser()` - Returns user profile or `undefined`
- `getSession()` - Returns session or `undefined`
- `getAccessToken()` - Returns `{ accessToken }` (requires `audience` configured)
- `startInteractiveLogin(options)` - Returns authorization URL for custom login routes
- `completeInteractiveLogin(url)` - Completes callback for custom login routes
- `logout(options)` - Returns logout URL for custom logout routes

**Environment Variables:**
- `AUTH0_DOMAIN` - Your Auth0 tenant domain (e.g. `tenant.auth0.com`)
- `AUTH0_CLIENT_ID` - Application client ID
- `AUTH0_CLIENT_SECRET` - Application client secret
- `APP_BASE_URL` - Application base URL (e.g. `http://localhost:3000`)
- `AUTH0_SESSION_SECRET` - Session encryption secret (min 64 hex chars recommended)
- `AUTH0_AUDIENCE` - Optional API audience for access tokens

---

## References

- [@auth0/auth0-express on npm](https://www.npmjs.com/package/@auth0/auth0-express)
- [GitHub: auth0/auth0-express](https://github.com/auth0/auth0-express)
- [Auth0 Express Quickstart](https://auth0.com/docs/quickstart/webapp/express)
