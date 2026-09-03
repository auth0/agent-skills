# Patterns: RBAC, Organizations, Multi-Runtime, Custom Session Store, and Session Enrichment

Advanced implementation patterns for production Hono applications.

## Role-Based Access Control (RBAC)

Protect routes based on user roles and permissions using claim guards.

### Basic Role Check

Use `claimEquals()` to check for a single role:

```typescript
import { requiresAuth, claimEquals } from '@auth0/auth0-hono';

app.get('/admin-panel', 
  requiresAuth(), 
  claimEquals('role', 'admin'), 
  (c) => {
    return c.html('<h1>Admin Panel</h1>');
  }
);
```

### Multiple Roles

Use `claimIncludes()` to check if the user has any of several roles:

```typescript
import { claimIncludes } from '@auth0/auth0-hono';

app.get('/moderation', 
  requiresAuth(), 
  claimIncludes('roles', 'admin', 'moderator'), 
  (c) => {
    return c.json({ message: 'Moderation tools' });
  }
);
```

### Custom Claim Logic

Use `claimCheck()` for complex conditions:

```typescript
import { claimCheck } from '@auth0/auth0-hono';

app.get('/premium-feature',
  requiresAuth(),
  claimCheck((user) => {
    return user.subscription === 'premium' && user.subscription_active === true;
  }),
  (c) => {
    return c.text('Premium feature');
  }
);
```

### Permission-Based Access

Combine multiple checks for fine-grained access:

```typescript
app.post('/publish-article',
  requiresAuth(),
  claimIncludes('permissions', 'write:articles'),
  claimCheck((user) => user.content_approved === true),
  (c) => {
    return c.json({ status: 'Article published' });
  }
);
```

## Organizations for B2B SaaS

Use organizations to build multi-tenant applications where users belong to organizations and have role assignments within each org.

### Require Organization

Use `requiresOrg()` to ensure the user is in an organization:

```typescript
import { requiresAuth, requiresOrg } from '@auth0/auth0-hono';

app.get('/org-dashboard',
  requiresAuth(),
  requiresOrg(),
  (c) => {
    const org = c.var.auth0.org; // { id, name? }
    return c.json({ 
      message: `Dashboard for ${org.name || org.id}`,
      org,
    });
  }
);
```

**Important:** `requiresOrg()` MUST come AFTER `requiresAuth()` — calling it first will throw a 500 error.

### Multi-Tenant Route Protection

Verify the requested organization matches the user's organization:

```typescript
app.get('/org/:orgId/settings',
  requiresAuth(),
  requiresOrg(),
  (c) => {
    const userOrgId = c.var.auth0.org.id;
    const requestedOrgId = c.req.param('orgId');
    
    if (userOrgId !== requestedOrgId) {
      return c.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    return c.json({ 
      orgId: requestedOrgId,
      settings: { /* org settings */ },
    });
  }
);
```

### Organization Admin Routes

Combine `requiresOrg()` with role checks for org-scoped admin features:

```typescript
app.post('/org/:orgId/members',
  requiresAuth(),
  requiresOrg(),
  claimIncludes('org_roles', 'org_admin'),
  (c) => {
    const org = c.var.auth0.org;
    return c.json({ message: `Added member to ${org.name}` });
  }
);
```

## Cloudflare Workers Deployment

Deploy Hono with Auth0 on Cloudflare Workers. Call `auth0()` with no arguments — the middleware reads the Worker's per-request bindings automatically (via `hono/adapter`). Do not build a config object at module scope; there is no request context there.

### Basic Setup

```typescript
import { Hono } from 'hono';
import { auth0 } from '@auth0/auth0-hono';

type Bindings = {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  APP_BASE_URL: string;
  AUTH0_SESSION_ENCRYPTION_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// auth0() reads AUTH0_* + APP_BASE_URL bindings per-request; no explicit config needed.
app.use('*', auth0());

export default app;
```

### wrangler.toml Configuration

Configure environment variables and secrets in `wrangler.toml`:

```toml
[env.development]
vars = {
  AUTH0_DOMAIN = "your-tenant.us.auth0.com",
  APP_BASE_URL = "https://my-app.workers.dev"
}
secrets = ["AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SESSION_ENCRYPTION_KEY"]

[env.production]
vars = {
  AUTH0_DOMAIN = "your-tenant.us.auth0.com",
  APP_BASE_URL = "https://my-app.com"
}
secrets = ["AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SESSION_ENCRYPTION_KEY"]
```

Set secrets via command line:

```bash
wrangler secret put AUTH0_CLIENT_ID --env development
wrangler secret put AUTH0_CLIENT_SECRET --env development
wrangler secret put AUTH0_SESSION_ENCRYPTION_KEY --env development
```

Deploy:

```bash
wrangler deploy --env development
```

## Deno Deployment

```typescript
import { Hono } from 'npm:hono@3';
import { auth0 } from 'npm:@auth0/auth0-hono';

const app = new Hono();

app.use('*', auth0({
  domain: Deno.env.get('AUTH0_DOMAIN')!,
  clientID: Deno.env.get('AUTH0_CLIENT_ID')!,
  clientSecret: Deno.env.get('AUTH0_CLIENT_SECRET')!,
  baseURL: Deno.env.get('APP_BASE_URL')!,
  session: {
    secret: Deno.env.get('AUTH0_SESSION_ENCRYPTION_KEY')!,
  },
}));

app.get('/', (c) => c.text('Hello from Deno'));

Deno.serve({ port: 3000 }, app.fetch);
```

Run with: `deno run --allow-net --allow-env --allow-read server.ts`

## Bun Deployment

```typescript
import { Hono } from 'hono';
import { auth0 } from '@auth0/auth0-hono';

const app = new Hono();

app.use('*', auth0({
  domain: process.env.AUTH0_DOMAIN!,
  clientID: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  baseURL: process.env.APP_BASE_URL!,
  session: {
    secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY!,
  },
}));

export default app;
```

Start: `bun run server.ts`

## Custom Session Store

Replace the default in-memory session store with a custom backend (Redis, database, etc.).

### SessionStore Contract

`SessionStore` is an **abstract class** exported by the SDK — extend it and implement all four methods. Persisted values are typed `StateData` (from `@auth0/auth0-server-js`), `get()` returns `StateData | undefined` (never `null`), and `deleteByLogoutToken` is **required** and takes `LogoutTokenClaims` (not a raw token string):

```typescript
import { SessionStore } from '@auth0/auth0-hono';
import type { StateData, LogoutTokenClaims } from '@auth0/auth0-server-js';
import type { Context } from 'hono';

// Abstract-class contract you must implement:
abstract class SessionStore {
  abstract set(identifier: string, stateData: StateData): Promise<void>;
  abstract get(identifier: string): Promise<StateData | undefined>;
  abstract delete(identifier: string): Promise<void>;
  abstract deleteByLogoutToken(claims: LogoutTokenClaims, c?: Context): Promise<void>;
}
```

### Redis Example

```typescript
import Redis from 'ioredis';
import { SessionStore } from '@auth0/auth0-hono';
import type { StateData, LogoutTokenClaims } from '@auth0/auth0-server-js';

const redis = new Redis();

class RedisStore extends SessionStore {
  async set(id: string, stateData: StateData): Promise<void> {
    await redis.set(id, JSON.stringify(stateData), 'EX', 86400); // 1-day TTL
  }

  async get(id: string): Promise<StateData | undefined> {
    const data = await redis.get(id);
    return data ? (JSON.parse(data) as StateData) : undefined;
  }

  async delete(id: string): Promise<void> {
    await redis.del(id);
  }

  async deleteByLogoutToken(claims: LogoutTokenClaims): Promise<void> {
    // Backchannel logout: locate session by claims.sid / claims.sub and delete.
    if (claims.sid) {
      await redis.del(claims.sid);
    }
  }
}

app.use('*', auth0({
  // ... other config
  session: {
    store: new RedisStore(),
    secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY,
  },
}));
```

### Database Example (Supabase/PostgreSQL)

```typescript
import { createClient } from '@supabase/supabase-js';
import { SessionStore } from '@auth0/auth0-hono';
import type { StateData, LogoutTokenClaims } from '@auth0/auth0-server-js';

const supabase = createClient(url, key);

class SupabaseStore extends SessionStore {
  async set(id: string, stateData: StateData): Promise<void> {
    const { error } = await supabase
      .from('sessions')
      .upsert({
        id,
        data: JSON.stringify(stateData),
        expires_at: new Date(Date.now() + 86400000), // 1 day
      });

    if (error) throw error;
  }

  async get(id: string): Promise<StateData | undefined> {
    const { data, error } = await supabase
      .from('sessions')
      .select('data')
      .eq('id', id)
      .single();

    if (error || !data) return undefined;
    return JSON.parse(data.data) as StateData;
  }

  async delete(id: string): Promise<void> {
    await supabase.from('sessions').delete().eq('id', id);
  }

  async deleteByLogoutToken(claims: LogoutTokenClaims): Promise<void> {
    // Backchannel logout: delete rows matching the logout token's session id.
    if (claims.sid) {
      await supabase.from('sessions').delete().eq('id', claims.sid);
    }
  }
}

app.use('*', auth0({
  // ... other config
  session: {
    store: new SupabaseStore(),
    secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY,
  },
}));
```

## Hybrid Web + API Routes

Serve both HTML web routes and JSON API routes with appropriate error handling.

### Web Route (Redirects on Auth Failure)

Web routes should redirect unauthenticated users to the login page:

```typescript
app.get('/dashboard',
  requiresAuth('login'), // Redirects to /login on unauthenticated
  (c) => {
    const user = c.var.auth0.user;
    return c.html(`<h1>Hello, ${user.name}</h1>`);
  }
);
```

### API Route (JSON on Auth Failure)

API routes should return JSON errors instead of redirecting:

```typescript
app.get('/api/me',
  requiresAuth('error'), // Returns 401 JSON on unauthenticated
  (c) => {
    const user = c.var.auth0.user;
    return c.json({ user });
  }
);
```

### Error Handler for Both

Set up a global error handler:

```typescript
app.onError((err, c) => {
  const isApiRoute = c.req.path.startsWith('/api/');
  
  if (err instanceof LoginRequiredError) {
    if (isApiRoute) {
      return c.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      return c.redirect('/login');
    }
  }
  
  if (err instanceof Auth0Error) {
    return c.json({ error: err.message }, { status: err.status });
  }
  
  return c.json({ error: 'Internal server error' }, { status: 500 });
});
```

## Standalone Route Handlers

When you disable the default mounted routes (`mountRoutes: false`, or opt out of individual routes via `customRoutes`), define the auth routes yourself using the standalone handlers. Each handler auto-initializes the OIDC client from the environment, so you do **not** pass client credentials (domain/clientID/baseURL) to them — those come from `auth0()` config or environment bindings.

### Available Handlers

- `handleLogin(params?: LoginParams)` — Initiate login
- `handleCallback(params?: CallbackParams)` — Handle OAuth callback
- `handleLogout(params?: LogoutParams)` — Clear session and logout
- `handleBackchannelLogout()` — Handle backchannel logout (OpenID Connect RP-Initiated Logout)

The `params` are **flow options**, not client configuration:
- `LoginParams`: `{ redirectAfterLogin?, silent?, authorizationParams?, forwardAuthorizationParams? }`
- `CallbackParams`: `{ redirectAfterLogin?, onCallback? }`
- `LogoutParams`: `{ redirectAfterLogout? }`

### Example: Custom Route Paths

```typescript
import { auth0, handleLogin, handleCallback, handleLogout } from '@auth0/auth0-hono';

// Disable the default /login, /logout, /callback routes...
app.use('*', auth0({ mountRoutes: false }));

// ...and mount your own at custom paths.
app.get('/auth/start', handleLogin({ redirectAfterLogin: '/dashboard' }));
app.get('/auth/return', handleCallback());
app.get('/auth/end', handleLogout({ redirectAfterLogout: '/goodbye' }));
```

For per-tenant deployments, run separate instances configured via environment bindings (see Cloudflare Workers above) rather than passing per-request client config — the SDK does not accept credentials on the standalone handlers.

## Session Enrichment

Add custom data to the user session using `updateSession()`:

```typescript
import { updateSession, requiresAuth } from '@auth0/auth0-hono';

app.post('/preferences',
  requiresAuth(),
  async (c) => {
    const body = await c.req.json();
    
    // Merge custom data into session (async — must await)
    await updateSession(c, {
      theme: body.theme,
      language: body.language,
      notifications_enabled: body.notificationsEnabled,
    });
    
    return c.json({ message: 'Preferences saved' });
  }
);

app.get('/preferences',
  requiresAuth(),
  (c) => {
    const session = c.var.auth0.session;
    return c.json({
      theme: session.theme,
      language: session.language,
      notifications_enabled: session.notifications_enabled,
    });
  }
);
```

**Important:** Reserved fields cannot be overwritten:
- `user` — User profile (read-only)
- `idToken` — ID token (read-only)
- `refreshToken` — Refresh token (read-only)
- `tokenSets` — Token sets (read-only)
- `connectionTokenSets` — Connection tokens (read-only)
- `internal` — Internal metadata (read-only)

Any other fields are custom and can be set/updated freely.

## Security Best Practices

### PKCE Protection

PKCE (Proof Key for Code Exchange) is enforced by default. This prevents authorization code injection attacks on mobile and desktop apps.

### State and Nonce Validation

All OAuth state parameters and OpenID Connect nonce values are server-validated automatically.

### Session Encryption

Sessions are encrypted using AES-256-GCM. The encryption key is provided in config and must be at least 32 characters:

```typescript
session: {
  secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY, // ≥32 chars
}
```

For key rotation, provide an array:

```typescript
session: {
  secret: [currentKey, previousKey], // Current key used for encryption; old keys for decryption
}
```

### Safe Redirects

Use `toSafeRedirect()` to prevent open-redirect attacks:

```typescript
import { toSafeRedirect } from '@auth0/auth0-hono';

app.get('/redirect', (c) => {
  const url = c.req.query('url');
  const safe = toSafeRedirect(url, process.env.APP_BASE_URL);
  return c.redirect(safe);
});
```

### Backchannel Logout

Backchannel logout handles OpenID Connect logout notifications from Auth0:

```typescript
import { handleBackchannelLogout } from '@auth0/auth0-hono';

app.post('/auth/backchannel-logout', handleBackchannelLogout());
```

Configure in Auth0 Dashboard:
- Backchannel Logout URL: `https://your-app.com/auth/backchannel-logout`

