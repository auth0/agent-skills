# Integration Patterns

## Middleware Setup

### Basic Setup (All Routes Require Auth)

```typescript
import { Hono } from 'hono'
import { auth0 } from '@auth0/auth0-hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()
app.use('*', auth0())
```

With `authRequired: true` (default), unauthenticated users are redirected to `/auth/login` automatically.

### Optional Auth (Public + Protected Routes)

```typescript
app.use('*', auth0({ authRequired: false }))
```

Session is loaded on every request, but unauthenticated users are not redirected. Use `requiresAuth()` on individual routes.

### Explicit Configuration (Overrides .env)

```typescript
app.use('*', auth0({
  domain: 'tenant.auth0.com',
  clientID: 'abc123',
  clientSecret: 'secret',
  baseURL: 'http://localhost:3000',
  session: {
    secret: 'your-32-char-encryption-key-here!',
    cookie: {
      name: 'auth_session',
      sameSite: 'lax',
      secure: true,
    },
  },
  authorizationParams: {
    scope: 'openid profile email',
    audience: 'https://api.example.com',
  },
}))
```

### With Custom Route Paths

```typescript
app.use('*', auth0({
  routes: {
    login: '/signin',
    logout: '/signout',
    callback: '/oauth/callback',
  },
}))
```

Routes become: `/signin`, `/signout`, `/oauth/callback` (values are used as-is, must start with `/`)

## Authentication Flow

1. User visits `/auth/login` — redirected to Auth0 Universal Login
2. User authenticates at Auth0 — Auth0 redirects to `/auth/callback`
3. Middleware exchanges authorization code for tokens
4. Encrypted session cookie is created with user identity
5. User is redirected to the application
6. On each request, middleware decrypts cookie and populates `c.var.auth0`
7. `/auth/logout` destroys session cookie and (optionally) calls Auth0 logout

### Auto-Mounted Routes

When `mountRoutes: true` (default), these routes are handled automatically:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Initiates login redirect to Auth0 |
| GET/POST | `/auth/callback` | Handles OAuth callback, creates session |
| GET | `/auth/logout` | Destroys session, redirects |
| POST | `/auth/backchannel-logout` | Handles backchannel logout from Auth0 |

## Protected Routes

### Basic Protection

```typescript
import { requiresAuth } from '@auth0/auth0-hono'

app.get('/profile', requiresAuth(), (c) => {
  const user = c.var.auth0.user
  return c.json({ name: user?.name, email: user?.email })
})
```

### Claim-Based Authorization

```typescript
import { claimEquals, claimIncludes, claimCheck } from '@auth0/auth0-hono'

// Exact claim match
app.get('/admin', requiresAuth(), claimEquals('role', 'admin'), (c) => {
  return c.json({ message: 'Admin panel' })
})

// Array claim includes value(s)
app.get('/reports', requiresAuth(), claimIncludes('permissions', 'read:reports', 'admin:reports'), (c) => {
  return c.json({ message: 'Reports' })
})

// Custom claim validation function
app.get('/verified', requiresAuth(), claimCheck((user) => user.email_verified === true), (c) => {
  return c.json({ message: 'Verified users only' })
})
```

### Organization-Based Authorization

```typescript
import { requiresOrg } from '@auth0/auth0-hono'

// Require any organization
app.get('/org', requiresAuth(), requiresOrg(), handler)

// Require specific organization
app.get('/org', requiresAuth(), requiresOrg({ orgId: 'org_123' }), handler)

// Dynamic organization check
app.get('/org', requiresAuth(), requiresOrg((c) => {
  return c.var.auth0.user?.org_id === 'org_123'
}), handler)
```

## Session Management

### Read Session

```typescript
import { getSession, getUser } from '@auth0/auth0-hono'

// Returns null if not authenticated
const session = await getSession(c)

// Throws LoginRequiredError if not authenticated
const user = getUser(c)
```

### Context Variables

Set by middleware on every request after session decryption:

```typescript
c.var.auth0.user     // Auth0User | null — user identity claims
c.var.auth0.session  // Auth0Session | null — full session data
c.var.auth0.org      // Auth0Organization | null — { id, name }
```

### Update Session

```typescript
import { updateSession } from '@auth0/auth0-hono'

app.post('/preferences', requiresAuth(), async (c) => {
  const body = await c.req.json()
  await updateSession(c, {
    preferences: body.preferences,
    lastUpdated: Date.now(),
  })
  return c.json({ success: true })
})
```

### Custom Session Store

For large sessions or server-side storage:

```typescript
import type { SessionStore } from '@auth0/auth0-hono'

const redisStore: SessionStore = {
  async set(name, data, isTransaction, ctx) {
    await redis.set(`session:${data.internal.sid}`, JSON.stringify(data))
  },
  async get(name, ctx) {
    const data = await redis.get(`session:${name}`)
    return data ? JSON.parse(data) : null
  },
}

app.use('*', auth0({ session: { store: redisStore, secret: '...' } }))
```

## Access Tokens

### Get Access Token (with Auto-Refresh)

```typescript
import { getAccessToken } from '@auth0/auth0-hono'

app.get('/api-data', requiresAuth(), async (c) => {
  const { accessToken } = await getAccessToken(c)

  const res = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return c.json(await res.json())
})
```

Requires `audience` configured in `authorizationParams` and `AUTH0_CLIENT_SECRET` set for token refresh.

### Get Token for Specific Connection (Federated Token Exchange)

```typescript
import { getAccessTokenForConnection } from '@auth0/auth0-hono'

app.get('/google-data', requiresAuth(), async (c) => {
  const token = await getAccessTokenForConnection(c, {
    connection: 'google-oauth2',
    loginHint: 'user@example.com',
  })

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  })
  return c.json(await res.json())
})
```

## Silent Login

Attempt authentication without user interaction (uses existing Auth0 session cookie):

```typescript
import { attemptSilentLogin, cancelSilentLogin, resumeSilentLogin } from '@auth0/auth0-hono'

// Attempt silent login, then require auth
app.get('/dashboard', attemptSilentLogin(), requiresAuth(), (c) => {
  return c.json({ user: c.var.auth0.user })
})

// Cancel silent login for specific routes (avoid redirect loops)
app.get('/public-page', cancelSilentLogin(), (c) => {
  return c.json({ message: 'Public content' })
})
```

## Standalone Route Handlers

When using `customRoutes` or `mountRoutes: false`:

```typescript
import {
  handleLogin, handleLogout, handleCallback, handleBackchannelLogout
} from '@auth0/auth0-hono'

app.use('*', auth0({ mountRoutes: false }))

// Mount routes at custom paths
app.get('/signin', handleLogin())
app.get('/oauth/callback', handleCallback())
app.get('/signout', handleLogout())
app.post('/backchannel-logout', handleBackchannelLogout())
```

Or exclude specific routes while keeping others auto-mounted:

```typescript
app.use('*', auth0({ customRoutes: ['login'] }))

// Only login is custom — callback, logout, backchannel-logout still auto-mounted
app.get('/custom-login', handleLogin())
```

## onCallback Hook

Enrich the session on successful login or handle errors:

```typescript
app.use('*', auth0({
  async onCallback(c, error, session) {
    // On error: error is Auth0Error, session is null
    if (error) {
      console.error('Login failed:', error.code)
      return c.redirect('/login?error=true')
    }

    // On success: enrich session with custom data
    const permissions = await fetchUserPermissions(session.user.sub)
    return {
      ...session,
      permissions,
    }
  },
}))
```

Return values:
- `SessionData` — merged into session (persisted)
- `Response` — overrides redirect response
- `void` — default behavior

## Error Handling

Auth0 errors extend Hono's `HTTPException` and produce OAuth2-compliant JSON responses:

```typescript
import {
  Auth0Error,
  AccessDeniedError,
  LoginRequiredError,
  InvalidGrantError,
  MissingSessionError,
  MissingTransactionError,
  TokenRefreshError,
  ConnectionTokenError,
} from '@auth0/auth0-hono'

app.onError((err, c) => {
  if (err instanceof AccessDeniedError) {
    return c.json({ error: 'Access denied' }, 403)
  }
  if (err instanceof LoginRequiredError) {
    return c.redirect('/auth/login')
  }
  if (err instanceof InvalidGrantError) {
    return c.json({ error: 'Token expired, please log in again' }, 401)
  }
  if (err instanceof MissingSessionError) {
    return c.json({ error: 'Session required' }, 401)
  }
  if (err instanceof MissingTransactionError) {
    return c.json({ error: 'Invalid callback state' }, 400)
  }
  if (err instanceof TokenRefreshError) {
    return c.redirect('/auth/login')
  }
  if (err instanceof ConnectionTokenError) {
    return c.json({ error: 'Connection token failed' }, 401)
  }
  if (err instanceof Auth0Error) {
    return c.json(
      { error: err.code, error_description: err.description },
      err.status
    )
  }
  return c.json({ error: 'Internal server error' }, 500)
})
```

### Error Types

| Error | Status | Code | When Thrown |
|-------|--------|------|------------|
| `AccessDeniedError` | 403 | `access_denied` | User denied access to protected resource |
| `LoginRequiredError` | 401 | `login_required` | Authentication required but user not authenticated |
| `InvalidGrantError` | 401 | `invalid_grant` | Authorization code or refresh token invalid/expired |
| `MissingSessionError` | 401 | `missing_session` | No active session on authenticated operation |
| `MissingTransactionError` | 400 | `missing_transaction` | Callback without valid login transaction |
| `TokenRefreshError` | 401 | `token_refresh_error` | Automatic token refresh failed |
| `ConnectionTokenError` | 401 | `connection_token_error` | Federated token exchange failed |

## TypeScript Typing

```typescript
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()

// c.var.auth0 is now fully typed:
// c.var.auth0.user    — Auth0User | null
// c.var.auth0.session — Auth0Session | null
// c.var.auth0.org     — Auth0Organization | null
```

Import the env type augmentation for environment variable typing:

```typescript
import '@auth0/auth0-hono/lib/honoEnv'
```

## Testing Patterns

### Mock Auth Middleware for Unit Tests

```typescript
import { Hono } from 'hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()

// Replace auth0() with mock middleware in tests
app.use('*', async (c, next) => {
  c.set('auth0', {
    user: {
      sub: 'auth0|test123',
      name: 'Test User',
      email: 'test@example.com',
      email_verified: true,
    },
    session: {
      user: { sub: 'auth0|test123', name: 'Test User' },
    },
    org: null,
  })
  await next()
})

// Your routes work as normal with mocked auth context
app.get('/profile', (c) => c.json(c.var.auth0.user))
```

### Test Unauthenticated Access

```typescript
// Mock with null user for unauthenticated tests
app.use('*', async (c, next) => {
  c.set('auth0', { user: null, session: null, org: null })
  await next()
})
```
