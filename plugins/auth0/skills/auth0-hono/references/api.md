# auth0-hono API Reference & Testing

## Configuration Reference

The `auth0()` middleware accepts an optional configuration object. All values can also be set via environment variables (see below).

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `domain` | `string` | `AUTH0_DOMAIN` env | OIDC provider base URL (e.g., `tenant.auth0.com`) |
| `baseURL` | `string` | `APP_BASE_URL` env | Application base URL (e.g., `http://localhost:3000`) |
| `clientID` | `string` | `AUTH0_CLIENT_ID` env | Application client ID |
| `clientSecret` | `string` | `AUTH0_CLIENT_SECRET` env | Client secret (needed for refresh token flow) |
| `authRequired` | `boolean` | `true` | Require authentication for all routes |
| `idpLogout` | `boolean` | `true` | Use IDP's logout endpoint |
| `session` | `object` | See below | Session configuration |
| `session.secret` | `string \| string[]` | `AUTH0_SESSION_ENCRYPTION_KEY` env | Encryption key (32+ characters required) |
| `session.rolling` | `boolean` | `true` | Reset session expiry on activity |
| `session.absoluteDuration` | `number` | `259200` (3 days) | Maximum session lifetime in seconds |
| `session.inactivityDuration` | `number` | `86400` (1 day) | Session timeout after inactivity in seconds |
| `session.cookie.name` | `string` | `'appSession'` | Cookie name |
| `session.cookie.domain` | `string` | — | Cookie domain |
| `session.cookie.sameSite` | `'lax' \| 'strict' \| 'none'` | `'lax'` | Cookie SameSite attribute |
| `session.cookie.secure` | `boolean` | auto | Auto-determined from `baseURL` protocol |
| `session.store` | `SessionStore` | — | Custom session store implementation |
| `customRoutes` | `(keyof Routes)[]` | `[]` | Routes to exclude from auto-mounting |
| `mountRoutes` | `boolean` | `true` | Whether to mount default auth routes |
| `routes.login` | `string` | `'/auth/login'` | Login route path |
| `routes.logout` | `string` | `'/auth/logout'` | Logout route path |
| `routes.callback` | `string` | `'/auth/callback'` | Callback route path |
| `routes.backchannelLogout` | `string` | `'/auth/backchannel-logout'` | Backchannel logout route path |
| `authorizationParams` | `object` | See below | Authorization request parameters |
| `authorizationParams.response_type` | `string` | `'code'` | OAuth response type |
| `authorizationParams.scope` | `string` | `'openid profile email'` | OAuth scopes |
| `authorizationParams.response_mode` | `string` | — | OAuth response mode (auto: `'form_post'` when response_type ≠ `'code'`) |
| `authorizationParams.audience` | `string` | `AUTH0_AUDIENCE` env | API audience for access tokens |
| `forwardAuthorizationParams` | `string[]` | — | Forward query params to authorization request |
| `tokenEndpointParams` | `Record<string, string>` | — | Additional token endpoint parameters |
| `pushedAuthorizationRequests` | `boolean` | `false` | Use Pushed Authorization Requests (PAR) |
| `clockTolerance` | `number` | `60` | Clock tolerance in seconds for token validation |
| `enableTelemetry` | `boolean` | `true` | Telemetry flag (not currently implemented) |
| `httpTimeout` | `number` | `5000` | HTTP timeout in milliseconds |
| `onCallback` | `function` | — | Hook called on login callback (success or error) |
| `clientAuthMethod` | `string` | auto | Client authentication method |
| `clientAssertionSigningKey` | `any` | — | Signing key for `private_key_jwt` auth |
| `clientAssertionSigningAlg` | `string` | `'RS256'` | Signing algorithm for client assertions |
| `errorOnRequiredAuth` | `boolean` | `false` | Return 401 instead of redirecting to login |
| `attemptSilentLogin` | `boolean` | `false` | Attempt silent login on protected routes |
| `excludedClaims` | `string[]` | OIDC defaults | Claims to exclude from user identity |
| `idTokenSigningAlg` | `string` | `'RS256'` | Expected ID token signing algorithm |
| `discoveryCacheMaxAge` | `number` | `600000` (10 min) | OIDC discovery cache TTL in milliseconds |
| `httpUserAgent` | `string` | `'hono-openid-connect'` | HTTP User-Agent header |
| `fetch` | `function` | `globalThis.fetch` | Custom fetch implementation |
| `logoutParams` | `Record<string, any>` | — | Additional logout endpoint parameters |
| `debug` | `function` | — | Logger function `(message, metadata?) => void` |

### Client Authentication Methods

| Method | When Used |
|--------|-----------|
| `'none'` | Default when `response_type` is `id_token` and PAR is disabled |
| `'private_key_jwt'` | Default when `clientAssertionSigningKey` is provided |
| `'client_secret_basic'` | Default for all other configurations |
| `'client_secret_post'` | Alternative — sends secret in POST body |
| `'client_secret_jwt'` | Signs JWT with client secret |

### Excluded Claims (Default)

The following claims are excluded from `c.var.auth0.user` by default:

```text
aud, iss, iat, exp, nbf, nonce, azp, auth_time, s_hash, at_hash, c_hash
```

Override with the `excludedClaims` option.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain (e.g., `tenant.auth0.com`) |
| `AUTH0_CLIENT_ID` | Yes | Application client ID |
| `AUTH0_CLIENT_SECRET` | No | Client secret (required for refresh token flow) |
| `APP_BASE_URL` | Yes | Application base URL (e.g., `http://localhost:3000`) |
| `AUTH0_SESSION_ENCRYPTION_KEY` | Yes | Session encryption key (32+ characters) |
| `AUTH0_AUDIENCE` | No | API audience for access tokens |

Environment variables are read at runtime via Hono's `env(c)` adapter (not `process.env`), making the SDK compatible with Cloudflare Workers, Deno, Bun, and Node.js.

**Resolution order:** Explicit config > Environment variables > Zod schema defaults

## Claims Reference

### Standard OIDC Claims

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | `string` | Subject identifier (unique user ID) |
| `name` | `string` | Full name |
| `given_name` | `string` | First name |
| `family_name` | `string` | Last name |
| `nickname` | `string` | Casual name |
| `picture` | `string` | Profile picture URL |
| `email` | `string` | Email address |
| `email_verified` | `boolean` | Whether email is verified |
| `locale` | `string` | Locale |
| `updated_at` | `string` | Last profile update timestamp |

### Auth0-Specific Claims

| Claim | Type | Description |
|-------|------|-------------|
| `org_id` | `string` | Organization ID (when using Organizations) |
| `org_name` | `string` | Organization name |
| `permissions` | `string[]` | RBAC permissions (requires API + RBAC enabled) |

## Complete Code Example

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import {
  auth0,
  requiresAuth,
  claimEquals,
  claimIncludes,
  getSession,
  getAccessToken,
  Auth0Error,
  LoginRequiredError,
  AccessDeniedError,
} from '@auth0/auth0-hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()

// Register auth0 middleware (reads config from .env via hono/adapter)
app.use('*', auth0({ authRequired: false }))

// Public route
app.get('/', (c) => {
  const user = c.var.auth0.user
  if (!user) {
    return c.json({ message: 'Welcome! Visit /auth/login to sign in.' })
  }
  return c.json({ message: `Hello, ${user.name}!`, email: user.email })
})

// Protected route — requires authentication
app.get('/profile', requiresAuth(), (c) => {
  const user = c.var.auth0.user
  return c.json({
    sub: user?.sub,
    name: user?.name,
    email: user?.email,
    email_verified: user?.email_verified,
  })
})

// Claims-based authorization
app.get('/admin', requiresAuth(), claimEquals('role', 'admin'), (c) => {
  return c.json({ message: 'Admin panel' })
})

// Permission-based authorization
app.get('/reports', requiresAuth(), claimIncludes('permissions', 'read:reports'), (c) => {
  return c.json({ message: 'Reports data' })
})

// API call with access token
app.get('/api-data', requiresAuth(), async (c) => {
  const { accessToken } = await getAccessToken(c)
  const res = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return c.json(await res.json())
})

// Session info
app.get('/session', requiresAuth(), async (c) => {
  const session = await getSession(c)
  return c.json({
    user: session?.user,
    expiresAt: session?.internal?.expiresAt,
  })
})

// Error handler
app.onError((err, c) => {
  if (err instanceof LoginRequiredError) {
    return c.redirect('/auth/login')
  }
  if (err instanceof AccessDeniedError) {
    return c.json({ error: 'Access denied' }, 403)
  }
  if (err instanceof Auth0Error) {
    return c.json(
      { error: err.code, error_description: err.description },
      err.status
    )
  }
  return c.json({ error: 'Internal server error' }, 500)
})

serve({ fetch: app.fetch, port: 3000 })
console.log('Server running at http://localhost:3000')
```

## Testing Checklist

- [ ] **Session persistence:** Login, refresh page, still authenticated
- [ ] **Login flow:** Visit `/auth/login`, redirects to Auth0 Universal Login
- [ ] **Callback:** After Auth0 login, redirects to `/auth/callback` then to `/`
- [ ] **Logout:** Visit `/auth/logout`, session destroyed, redirected
- [ ] **Protected routes:** Unauthenticated access to protected route redirects to login (or returns 401 if `errorOnRequiredAuth: true`)
- [ ] **User claims:** `c.var.auth0.user` contains `sub`, `name`, `email`
- [ ] **Access token:** `getAccessToken(c)` returns valid token when `audience` configured
- [ ] **Error handling:** `Auth0Error` subtypes caught in `app.onError`
- [ ] **Cookie security:** Session cookie has `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS)
- [ ] **Claim-based auth:** `claimEquals`, `claimIncludes`, `claimCheck` work correctly

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Missing session" error | `AUTH0_SESSION_ENCRYPTION_KEY` not set | Add 32+ character key to `.env` |
| Callback URL mismatch | Auth0 Dashboard config doesn't match app | Set Allowed Callback URL to `http://localhost:3000/auth/callback` |
| "Invalid grant" on refresh | Client secret not set or expired | Add `AUTH0_CLIENT_SECRET` to `.env` |
| Middleware not intercepting routes | `auth0()` registered after routes | Move `app.use('*', auth0())` before route definitions |
| Session lost after server restart | Encryption key changed between restarts | Use consistent `AUTH0_SESSION_ENCRYPTION_KEY` |
| CORS errors from frontend | Missing CORS middleware | Add `cors()` middleware before `auth0()` |
| `c.var.auth0` is undefined | Middleware not registered or path mismatch | Ensure `app.use('*', auth0())` covers the route |
| Silent login redirect loop | `attemptSilentLogin` without session cookie | Use `cancelSilentLogin()` on public routes |
| Token refresh fails | Missing `offline_access` scope | Add `scope: 'openid profile email offline_access'` to `authorizationParams` |

## Security Considerations

- Never commit `.env` files with secrets to source control
- Use HTTPS in production — the `session.cookie.secure` flag auto-detects based on `baseURL` protocol
- Set appropriate `absoluteDuration` and `inactivityDuration` for your security requirements
- Use `authRequired: true` (default) for apps requiring full authentication
- Validate claims server-side via `claimEquals`/`claimIncludes`/`claimCheck` — never trust client data
- Use `onCallback` hook to validate user permissions or organization membership at login time
- Store `AUTH0_CLIENT_SECRET` in environment variables, never in source code
- Use `errorOnRequiredAuth: true` for API-style routes that should return 401 JSON instead of redirecting
