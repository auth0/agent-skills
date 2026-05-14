---
name: auth0-hono
description: Use when adding authentication (login, logout, protected routes) to Hono web applications - integrates @auth0/auth0-hono for session-based auth.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F510"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0 Hono Integration

Add authentication to Hono web applications using @auth0/auth0-hono.

---

## Prerequisites

- Hono application (v3.x or newer)
- Node.js 20 LTS or newer
- Project must use ESM (`"type": "module"` in `package.json`) — the SDK is ESM-only
- Auth0 account and application configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Single Page Applications** - Use `auth0-react`, `auth0-vue`, or `auth0-angular` for client-side auth
- **Next.js applications** - Use `auth0-nextjs` skill which handles both client and server
- **Mobile applications** - Use `auth0-react-native` for React Native/Expo
- **Stateless APIs** - Use JWT validation middleware instead of session-based auth
- **Express applications** - Use `auth0-express` for Express.js
- **Fastify applications** - Use `auth0-fastify` for Fastify

---

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-hono hono @hono/node-server
```

Verify your `package.json` has `"type": "module"` (SDK is ESM-only). If not:

```bash
npm pkg set type=module
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see [Setup Guide](references/setup.md) for complete scripts.

**For manual setup:**

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
APP_BASE_URL=http://localhost:3000
AUTH0_SESSION_ENCRYPTION_KEY=<random-string-at-least-32-characters>
```

Generate encryption key: `openssl rand -hex 32`

### 3. Configure Auth Middleware

Create your Hono server (`index.ts`):

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { auth0, requiresAuth } from '@auth0/auth0-hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()

// Register auth middleware BEFORE routes
app.use('*', auth0({ authRequired: false }))
```

This automatically creates:
- `/auth/login` - Login endpoint
- `/auth/logout` - Logout endpoint
- `/auth/callback` - OAuth callback
- `/auth/backchannel-logout` - Backchannel logout

### 4. Add Routes

```typescript
// Public route
app.get('/', (c) => {
  const user = c.var.auth0.user
  if (!user) {
    return c.json({ message: 'Welcome! Visit /auth/login to sign in.' })
  }
  return c.json({ message: `Hello, ${user.name}!`, email: user.email })
})

// Protected route
app.get('/profile', requiresAuth(), (c) => {
  const user = c.var.auth0.user
  return c.json({
    sub: user?.sub,
    name: user?.name,
    email: user?.email,
  })
})
```

### 5. Add Error Handler

```typescript
import { Auth0Error, LoginRequiredError } from '@auth0/auth0-hono'

app.onError((err, c) => {
  if (err instanceof LoginRequiredError) {
    return c.redirect('/auth/login')
  }
  if (err instanceof Auth0Error) {
    return c.json({ error: err.code, error_description: err.description }, err.status)
  }
  return c.json({ error: 'Internal server error' }, 500)
})

serve({ fetch: app.fetch, port: 3000 })
console.log('Server running at http://localhost:3000')
```

### 6. Test Authentication

Start your server:

```bash
npx tsx watch --env-file=.env index.ts
```

Visit `http://localhost:3000` and test the login flow.

---

## Detailed Documentation

- **[Setup Guide](references/setup.md)** - Automated setup scripts, environment configuration, Auth0 CLI usage, multi-runtime deployment (Workers, Deno, Bun)
- **[Integration Guide](references/integration.md)** - Protected routes, sessions, access tokens, silent login, error handling
- **[API Reference](references/api.md)** - Complete middleware API, configuration options, claims reference
- **[Examples](references/examples.md)** - Real-world patterns: RBAC, organizations, Cloudflare Workers, custom session stores, hybrid apps

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add callback URL in Auth0 Dashboard | Add `http://localhost:3000/auth/callback` to Allowed Callback URLs |
| Missing or short `AUTH0_SESSION_ENCRYPTION_KEY` | Must be 32+ characters for cookie encryption. Generate with `openssl rand -hex 32` |
| App created as SPA type in Auth0 | Must be **Regular Web Application** type for server-side auth |
| Middleware registered after routes | `app.use('*', auth0())` must come before all route handlers |
| Using deprecated `auth()` | Use `auth0()` instead — `auth()` is deprecated |
| Session secret exposed in code | Always use environment variables via `.env`, never hardcode secrets |
| Domain includes `https://` prefix | Use bare hostname: `tenant.auth0.com` |
| Using SPA SDK (`@auth0/auth0-react`) | Use `@auth0/auth0-hono` for server-side Hono apps |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` error | Add `"type": "module"` to `package.json` — SDK is ESM-only |

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-express` - Express.js web applications
- `auth0-fastify` - Fastify web applications
- `auth0-nextjs` - Next.js web applications
- `auth0-nuxt` - Nuxt web applications
- `auth0-migration` - Migrate from another auth provider
- `auth0-mfa` - Add Multi-Factor Authentication
- `auth0-cli` - Manage Auth0 resources from the terminal

---

## Quick Reference

**Middleware:**
- `auth0()` - Full auth (all routes require login)
- `auth0({ authRequired: false })` - Optional auth (session loaded but not required)

**Route Protection:**
- `requiresAuth()` - Require authentication
- `claimEquals('role', 'admin')` - Exact claim match
- `claimIncludes('permissions', 'read:data')` - Array claim includes
- `claimCheck((user) => user.email_verified === true)` - Custom check
- `requiresOrg()` - Require organization membership

**Session & User:**
- `c.var.auth0.user` - User identity (or null)
- `c.var.auth0.session` - Full session data (or null)
- `c.var.auth0.org` - Organization info (or null)
- `getSession(c)` - Get session (returns null if unauthenticated)
- `getUser(c)` - Get user (throws if unauthenticated)
- `updateSession(c, data)` - Enrich session with custom data

**Tokens:**
- `getAccessToken(c)` - Get access token (auto-refresh)
- `getAccessTokenForConnection(c, { connection: 'google-oauth2' })` - Federated token

**Silent Login:**
- `attemptSilentLogin()` - Try silent auth before requiresAuth
- `cancelSilentLogin()` - Skip silent login for specific routes
- `resumeSilentLogin()` - Resume silent login after cancellation
- `pauseSilentLogin()` - Temporarily pause silent login

**Standalone Handlers:**
- `handleLogin()`, `handleLogout()`, `handleCallback()`, `handleBackchannelLogout()`

**Utilities:**
- `toSafeRedirect(url, baseURL)` - Validate redirect URL against base URL

**Error Types:**
- `Auth0Error`, `AccessDeniedError`, `LoginRequiredError`, `InvalidGrantError`
- `MissingSessionError`, `MissingTransactionError`, `TokenRefreshError`, `ConnectionTokenError`

**TypeScript:**
- `OIDCEnv` - Context type for `new Hono<OIDCEnv>()`
- `Auth0User`, `Auth0Session`, `Auth0Organization`, `Auth0Context`

---

## References

- [Auth0 Hono Documentation](https://auth0.com/docs/quickstart/webapp/hono)
- [SDK GitHub Repository](https://github.com/auth0/auth0-hono)
