# Real-World Patterns and Examples

## Basic App with Navigation

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { html } from 'hono/html'
import { auth0, requiresAuth, Auth0Error, LoginRequiredError } from '@auth0/auth0-hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()
app.use('*', auth0({ authRequired: false }))

app.get('/', (c) => {
  const user = c.var.auth0.user
  return c.html(html`
    <nav>
      ${user
        ? html`<span>Hi, ${user.name}</span> <a href="/profile">Profile</a> <a href="/auth/logout">Logout</a>`
        : html`<a href="/auth/login">Login</a>`
      }
    </nav>
    <h1>Welcome</h1>
  `)
})

app.get('/profile', requiresAuth(), (c) => {
  const user = c.var.auth0.user
  return c.html(html`
    <h1>Profile</h1>
    <img src="${user?.picture}" alt="${user?.name}" width="80" />
    <dl>
      <dt>Name</dt><dd>${user?.name}</dd>
      <dt>Email</dt><dd>${user?.email} ${user?.email_verified ? '✓' : '⚠ Not verified'}</dd>
      <dt>User ID</dt><dd>${user?.sub}</dd>
    </dl>
    <a href="/">Home</a>
  `)
})

app.onError((err, c) => {
  if (err instanceof LoginRequiredError) return c.redirect('/auth/login')
  if (err instanceof Auth0Error) return c.json({ error: err.code, error_description: err.description }, err.status)
  return c.json({ error: 'Internal server error' }, 500)
})

serve({ fetch: app.fetch, port: 3000 })
```

## Role-Based Access Control (RBAC)

### Middleware Approach

```typescript
import { requiresAuth, claimEquals, claimIncludes, claimCheck } from '@auth0/auth0-hono'

// Admin-only route (exact role claim)
app.get('/admin', requiresAuth(), claimEquals('https://my-app.com/roles', 'admin'), (c) => {
  return c.json({ message: 'Admin panel' })
})

// Permission-based (RBAC permissions array)
app.get('/reports', requiresAuth(), claimIncludes('permissions', 'read:reports'), (c) => {
  return c.json({ data: 'report data' })
})

// Multiple permissions required
app.delete('/users/:id', requiresAuth(), claimIncludes('permissions', 'delete:users', 'admin:users'), (c) => {
  return c.json({ deleted: c.req.param('id') })
})

// Custom check function
app.get('/premium', requiresAuth(), claimCheck((user) => {
  const roles = user['https://my-app.com/roles'] || []
  return roles.includes('premium') || roles.includes('admin')
}), (c) => {
  return c.json({ message: 'Premium content' })
})
```

### Role Helper Factory

```typescript
function hasRole(...roles: string[]) {
  return claimCheck((user) => {
    const userRoles = user['https://my-app.com/roles'] || []
    return roles.some((r) => userRoles.includes(r))
  })
}

function hasPermission(...perms: string[]) {
  return claimIncludes('permissions', ...perms)
}

// Usage
app.get('/admin', requiresAuth(), hasRole('admin'), handler)
app.get('/reports', requiresAuth(), hasPermission('read:reports'), handler)
```

## Organization-Based Multi-Tenancy

```typescript
import { requiresAuth, requiresOrg } from '@auth0/auth0-hono'

// Require any organization membership
app.get('/org/dashboard', requiresAuth(), requiresOrg(), (c) => {
  const org = c.var.auth0.org
  return c.json({ orgId: org?.id, orgName: org?.name })
})

// Require specific organization
app.get('/org/acme', requiresAuth(), requiresOrg({ orgId: 'org_acme123' }), (c) => {
  return c.json({ message: 'Acme Corp dashboard' })
})

// Dynamic org check (e.g., from URL param)
app.get('/org/:orgId/settings', requiresAuth(), (c) => {
  const requestedOrg = c.req.param('orgId')
  const userOrg = c.var.auth0.org
  if (userOrg?.id !== requestedOrg) {
    return c.json({ error: 'Access denied to this organization' }, 403)
  }
  return c.json({ settings: {} })
})

// Login with organization prompt
import { handleLogin } from '@auth0/auth0-hono'

app.get('/org/:orgId/login', handleLogin({
  authorizationParams: { organization: 'org_acme123' },
}))
```

## API Backend with Access Tokens

```typescript
import { requiresAuth, getAccessToken, getAccessTokenForConnection } from '@auth0/auth0-hono'

// Call your own API with audience-scoped access token
app.get('/api/data', requiresAuth(), async (c) => {
  const { accessToken } = await getAccessToken(c)

  const res = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    return c.json({ error: 'API call failed' }, res.status)
  }
  return c.json(await res.json())
})

// Federated token exchange (e.g., Google Calendar)
app.get('/google/events', requiresAuth(), async (c) => {
  const token = await getAccessTokenForConnection(c, {
    connection: 'google-oauth2',
  })

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  })
  return c.json(await res.json())
})
```

## Session Enrichment with onCallback

```typescript
app.use('*', auth0({
  authRequired: false,
  async onCallback(c, error, session) {
    if (error) {
      console.error('Login failed:', error.code)
      return c.redirect('/login-error')
    }

    // Enrich session with app-specific data at login time
    const userId = session.user.sub
    const dbUser = await db.users.findByAuth0Id(userId)

    return {
      ...session,
      appUserId: dbUser.id,
      tier: dbUser.subscriptionTier,
      permissions: dbUser.permissions,
    }
  },
}))

// Access enriched data later
app.get('/dashboard', requiresAuth(), async (c) => {
  const session = c.var.auth0.session
  return c.json({
    tier: session?.tier,
    appUserId: session?.appUserId,
  })
})
```

## Custom Session Store (Redis)

```typescript
import { createClient } from 'redis'
import type { SessionStore } from '@auth0/auth0-hono'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

const redisStore: SessionStore = {
  async set(name, data, isTransaction, ctx) {
    const key = isTransaction ? `tx:${name}` : `session:${data.internal.sid}`
    const ttl = isTransaction ? 3600 : data.internal.expiresAt - Math.floor(Date.now() / 1000)
    await redis.setEx(key, ttl, JSON.stringify(data))
  },
  async get(name, ctx) {
    const data = await redis.get(`session:${name}`)
    return data ? JSON.parse(data) : null
  },
}

app.use('*', auth0({
  authRequired: false,
  session: { store: redisStore },
}))
```

## Cloudflare Workers Deployment

The SDK uses `env(c)` from `hono/adapter`, making it platform-agnostic:

```typescript
// src/index.ts (Cloudflare Worker)
import { Hono } from 'hono'
import { auth0, requiresAuth, Auth0Error, LoginRequiredError } from '@auth0/auth0-hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()
app.use('*', auth0({ authRequired: false }))

app.get('/', (c) => {
  const user = c.var.auth0.user
  return c.json(user ? { name: user.name } : { message: 'Not logged in' })
})

app.get('/profile', requiresAuth(), (c) => {
  return c.json(c.var.auth0.user)
})

app.onError((err, c) => {
  if (err instanceof LoginRequiredError) return c.redirect('/auth/login')
  if (err instanceof Auth0Error) return c.json({ error: err.code }, err.status)
  return c.json({ error: 'Internal server error' }, 500)
})

export default app
```

```toml
# wrangler.toml
name = "my-hono-app"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
APP_BASE_URL = "https://my-hono-app.workers.dev"

# Secrets set via: wrangler secret put AUTH0_DOMAIN, etc.
```

## Deno / Bun Deployment

```typescript
// Deno
import { Hono } from 'hono'
import { auth0, requiresAuth } from '@auth0/auth0-hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()
app.use('*', auth0({ authRequired: false }))

app.get('/', (c) => c.json({ user: c.var.auth0.user }))
app.get('/protected', requiresAuth(), (c) => c.json(c.var.auth0.user))

Deno.serve({ port: 3000 }, app.fetch)
```

```typescript
// Bun
import { Hono } from 'hono'
import { auth0, requiresAuth } from '@auth0/auth0-hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()
app.use('*', auth0({ authRequired: false }))

app.get('/', (c) => c.json({ user: c.var.auth0.user }))
app.get('/protected', requiresAuth(), (c) => c.json(c.var.auth0.user))

export default { port: 3000, fetch: app.fetch }
```

## API-Style Error Responses (No Redirects)

For JSON APIs that should return 401/403 instead of redirecting:

```typescript
// Configure at middleware level
app.use('/api/*', auth0({
  authRequired: true,
  errorOnRequiredAuth: true, // Returns 401 JSON, no redirect
}))

// Or per-route error handling
app.onError((err, c) => {
  // API routes: return JSON errors
  if (c.req.path.startsWith('/api/')) {
    if (err instanceof LoginRequiredError) {
      return c.json({ error: 'authentication_required', message: 'Bearer token or session required' }, 401)
    }
    if (err instanceof AccessDeniedError) {
      return c.json({ error: 'insufficient_permissions', message: 'Missing required permissions' }, 403)
    }
  }
  // Web routes: redirect
  if (err instanceof LoginRequiredError) return c.redirect('/auth/login')
  if (err instanceof Auth0Error) return c.json({ error: err.code }, err.status)
  return c.json({ error: 'Internal server error' }, 500)
})
```

## Silent Login (SSO Experience)

```typescript
import { attemptSilentLogin, cancelSilentLogin, requiresAuth } from '@auth0/auth0-hono'

// Dashboard: try silent login first, then require auth
// If user has active Auth0 session (e.g., from another app), they won't see login page
app.get('/dashboard', attemptSilentLogin(), requiresAuth(), (c) => {
  return c.json({ user: c.var.auth0.user })
})

// Public marketing pages: never attempt silent login (avoid redirect loops)
app.get('/pricing', cancelSilentLogin(), (c) => {
  return c.json({ plans: ['free', 'pro', 'enterprise'] })
})
```

## Hybrid App (Web + API Routes)

```typescript
import { cors } from 'hono/cors'
import { auth0, requiresAuth } from '@auth0/auth0-hono'
import type { OIDCEnv } from '@auth0/auth0-hono'

const app = new Hono<OIDCEnv>()

// CORS must come before auth0
app.use('/api/*', cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))

// Auth middleware for all routes
app.use('*', auth0({ authRequired: false }))

// Web routes (session-based, redirects)
app.get('/', (c) => c.html('<h1>Welcome</h1>'))
app.get('/dashboard', requiresAuth(), (c) => c.html('<h1>Dashboard</h1>'))

// API routes (session-based, JSON errors)
app.get('/api/me', requiresAuth(), (c) => {
  return c.json(c.var.auth0.user)
})

app.onError((err, c) => {
  if (c.req.path.startsWith('/api/') && err instanceof LoginRequiredError) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  if (err instanceof LoginRequiredError) return c.redirect('/auth/login')
  if (err instanceof Auth0Error) return c.json({ error: err.code }, err.status)
  return c.json({ error: 'Internal server error' }, 500)
})
```

## Standalone Route Handlers (Custom Paths)

```typescript
import {
  auth0, handleLogin, handleLogout, handleCallback, handleBackchannelLogout
} from '@auth0/auth0-hono'

// Disable auto-mounted routes
app.use('*', auth0({ mountRoutes: false, authRequired: false }))

// Mount at custom paths
app.get('/signin', handleLogin())
app.all('/oauth/callback', handleCallback())
app.get('/signout', handleLogout())
app.post('/webhooks/backchannel-logout', handleBackchannelLogout())

// Login with custom parameters
app.get('/signup', handleLogin({
  authorizationParams: {
    screen_hint: 'signup',
  },
}))

// Login with return URL
app.get('/login-and-return', handleLogin({
  returnTo: '/dashboard',
}))
```

## Update Session (Enrich After Login)

```typescript
import { requiresAuth, updateSession, getSession } from '@auth0/auth0-hono'

// Store user preferences in session
app.post('/preferences', requiresAuth(), async (c) => {
  const body = await c.req.json()
  await updateSession(c, {
    preferences: {
      theme: body.theme,
      language: body.language,
    },
    lastUpdated: Date.now(),
  })
  return c.json({ success: true })
})

// Read enriched session
app.get('/settings', requiresAuth(), async (c) => {
  const session = await getSession(c)
  return c.json({
    user: session?.user,
    preferences: session?.preferences,
  })
})
```
