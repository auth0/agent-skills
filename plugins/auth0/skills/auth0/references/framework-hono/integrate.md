# Integration: Login, Logout, Protected Routes, Sessions, and Tokens

Implement authentication flows, protect routes, manage sessions, and handle access tokens.

## Middleware Initialization

Initialize the Auth0 middleware in your Hono application:

```typescript
import { Hono } from 'hono';
import { auth0 } from '@auth0/auth0-hono';

const app = new Hono();

app.use('*', auth0({
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  baseURL: process.env.APP_BASE_URL,
  session: {
    secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY,
  },
}));
```

**Configuration defaults:**
- `authRequired: true` — Most routes require authentication by default; set to false for public routes
- `idpLogout: false` — App logout does not automatically logout from Auth0; set to true to redirect to Auth0 logout

## Context Shape After Middleware

After the `auth0()` middleware runs, the Hono context includes:

```typescript
c.var.auth0 = {
  user: Auth0User | null,        // User profile (null if unauthenticated)
  session: Auth0Session | null,  // Session data (null if unauthenticated)
  org: Auth0Organization | null, // Organization info (null if not in org)
}
```

**Important:** The context ONLY contains `user`, `session`, and `org` — there is no `tokens` field. Access tokens are fetched on-demand via `getAccessToken(c)`.

## Protected Routes

Use `requiresAuth()` to require authentication on a route. If unauthenticated, it throws `LoginRequiredError` (401):

```typescript
import { requiresAuth } from '@auth0/auth0-hono';

// Protected route: requires login
app.get('/profile', requiresAuth(), (c) => {
  const user = c.var.auth0.user;
  return c.json({
    message: `Hello, ${user.name}`,
    email: user.email,
  });
});
```

**Middleware order matters:** Place `requiresAuth()` BEFORE claim guards (e.g., `requiresOrg()`, `claimIncludes()`) so authentication is verified first.

### Error Behavior

By default, `requiresAuth()` on an unauthenticated request:
- For HTML requests (browser): redirects to `/login`
- For API requests: throws `LoginRequiredError` (401 JSON)

To always throw (for API routes), use:

```typescript
app.get('/api/profile', requiresAuth('error'), (c) => {
  return c.json({ user: c.var.auth0.user });
});
```

To always redirect (for web routes), use:

```typescript
app.get('/dashboard', requiresAuth('login'), (c) => {
  return c.html('<h1>Dashboard</h1>');
});
```

## Organizations

Organizations enable multi-tenant B2B applications. Use `requiresOrg()` to require the user to be in an organization:

```typescript
import { requiresOrg } from '@auth0/auth0-hono';

app.get('/org-details', requiresAuth(), requiresOrg(), (c) => {
  const org = c.var.auth0.org; // { id, name? }
  return c.json({ org });
});
```

**CRITICAL: `requiresOrg()` MUST run AFTER `requiresAuth()`** — running it before will throw a 500 error.

Organizations provide multi-tenant isolation:

```typescript
app.get('/org/:orgId', requiresAuth(), requiresOrg(), (c) => {
  const userOrg = c.var.auth0.org.id;
  const requestedOrg = c.req.param('orgId');
  
  if (userOrg !== requestedOrg) {
    return c.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  return c.json({ org: userOrg, data: 'sensitive' });
});
```

## Role-Based Access Control (RBAC)

Use claim guards to enforce role and permission checks. Claim guards throw `AccessDeniedError` (403) on mismatch.

### `claimEquals(claim, value)`

Check if a claim exactly matches a value:

```typescript
import { claimEquals } from '@auth0/auth0-hono';

app.get('/admin-only', requiresAuth(), claimEquals('role', 'admin'), (c) => {
  return c.text('Admin area');
});
```

### `claimIncludes(claim, ...values)`

Check if a claim includes any of the specified values (useful for roles/permissions arrays):

```typescript
import { claimIncludes } from '@auth0/auth0-hono';

app.get('/moderator-panel', 
  requiresAuth(), 
  claimIncludes('roles', 'admin', 'moderator'), 
  (c) => {
    return c.text('Moderation panel');
  }
);
```

### `claimCheck(predicate)`

Use a custom predicate function for complex checks:

```typescript
import { claimCheck } from '@auth0/auth0-hono';

app.get('/premium-feature', 
  requiresAuth(),
  claimCheck((user) => user.subscription === 'premium' && user.subscription_active),
  (c) => {
    return c.text('Premium feature');
  }
);
```

Claims are read from `c.var.auth0.user` (e.g., `user.roles`, `user.permissions`, custom claims). Configure custom claims in Auth0 Rules or Actions.

## Session Management

### Accessing the Session

After middleware, access the session:

```typescript
app.get('/', (c) => {
  const session = c.var.auth0.session;
  
  if (session) {
    return c.json({ authenticated: true, session });
  } else {
    return c.json({ authenticated: false });
  }
});
```

### Session Shape

The session object contains:

```typescript
{
  user: Auth0User,              // User profile
  idToken?: string,             // OpenID Connect ID token
  refreshToken?: string,        // Refresh token (if offline_access scope)
  tokenSets?: Auth0TokenSet[],  // Token sets for audiences
  connectionTokenSets?: {...},  // Connection-specific tokens
  internal: {
    sid: string,                // Session ID
    createdAt: number,          // Creation timestamp (milliseconds)
  }
}
```

**Important:** Session does NOT have an `expiresAt` field. Use `session.internal.createdAt` for the session creation time, or `getAccessToken().expiresAt` for access token expiration.

### Updating Session

Enrich the session with custom data using `updateSession()`:

`updateSession()` is async and persists to the session store — always `await` it inside an `async` handler:

```typescript
import { updateSession } from '@auth0/auth0-hono';

app.post('/preferences', requiresAuth(), async (c) => {
  await updateSession(c, {
    preferences: { theme: 'dark', language: 'en' },
  });

  return c.json({ ok: true });
});
```

**Reserved fields** (cannot be overwritten): `user`, `idToken`, `refreshToken`, `tokenSets`, `connectionTokenSets`, `internal`.

## Access Tokens

Fetch access tokens on-demand to call protected APIs:

`getAccessToken()` never returns null — on failure it throws an `Auth0Error` subclass (`InvalidGrantError`, `TokenRefreshError`). Wrap the call in try/catch:

```typescript
import { getAccessToken, InvalidGrantError, TokenRefreshError } from '@auth0/auth0-hono';

app.get('/api-data', requiresAuth(), async (c) => {
  let token;
  try {
    token = await getAccessToken(c);
  } catch (err) {
    if (err instanceof InvalidGrantError || err instanceof TokenRefreshError) {
      return c.json({ error: 'Could not obtain access token' }, { status: 401 });
    }
    throw err;
  }

  // Call your API
  const response = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });

  return c.json(await response.json());
});
```

The returned token object has:

```typescript
{
  accessToken: string,
  expiresAt: number,  // Unix timestamp
  ...
}
```

**Token auto-refresh:** If the access token is expired, `getAccessToken()` automatically refreshes it using the refresh token.

To request access tokens for a specific API, configure the audience in your config:

```typescript
app.use('*', auth0({
  // ... other config
  authorizationParams: {
    audience: 'https://api.example.com',
  },
}));
```

### Connection-Specific Tokens

For multi-connection scenarios, fetch tokens for a specific connection:

```typescript
import { getAccessTokenForConnection } from '@auth0/auth0-hono';

app.get('/connection-token', requiresAuth(), async (c) => {
  const token = await getAccessTokenForConnection(c, {
    connection: 'google-oauth2',
    loginHint: 'user@gmail.com', // optional
  });

  return c.json({ accessToken: token.accessToken });
});
```

## Silent Login

Silent login restores the user's session from the Auth0 SSO cookie without redirecting to the login page. This is useful for remembering users across page reloads or new tabs.

### Attempt Silent Login

Use the `attemptSilentLogin` middleware early in your middleware chain:

```typescript
import { attemptSilentLogin } from '@auth0/auth0-hono';

app.use('*', attemptSilentLogin());
app.use('*', auth0({
  // ... config
}));
```

If the SSO cookie exists and is valid, the session is restored automatically. Otherwise, the middleware passes through.

### Cancel Silent Login

To cancel silent login (set the skip cookie), use `cancelSilentLogin()`. It is a **zero-argument factory** that returns a middleware — mount it in the route chain, then let the next handler produce the response:

```typescript
import { cancelSilentLogin } from '@auth0/auth0-hono';

app.get('/cancel-sso', cancelSilentLogin(), (c) => {
  return c.redirect('/');
});
```

**Do NOT** call `cancelSilentLogin(c)` directly inside a response-returning handler. It takes no arguments, and its internal `next()` call can dispatch to Hono's 404 handler, which finalizes the context and silently discards a subsequent `c.redirect()`. Always use it as composable middleware as shown above.

**Note:** `pauseSilentLogin()` is deprecated; use `cancelSilentLogin()` instead.

## onCallback Hook

The `onCallback` hook runs after Auth0 redirects back with the authentication result. Use it to enrich the session, override redirects, or return custom responses.

### Hook Signature

```typescript
onCallback?: (c: Context, error: Auth0Error | null, session: SessionData | null) =>
  SessionData | Response | void | Promise<SessionData | Response | void>
```

### On Success (error is null)

When authentication succeeds, `session` contains the user data. Return:
- `SessionData` object to enrich the session (merged and persisted)
- `Response` to override the redirect (e.g., redirect to a custom post-login page)
- `void` for default behavior (redirect to home)

```typescript
onCallback: (c, error, session) => {
  if (error) {
    // Handle error (see below)
    return;
  }
  
  // Enrich session with custom data
  return {
    onboardingComplete: false,
    signupTime: Date.now(),
  };
}
```

### On Error (session is null)

When authentication fails, `error` contains the failure reason. Return:
- `Response` to show a custom error page (e.g., HTML error, JSON error)
- Anything else is ignored (default error page is shown)

```typescript
onCallback: (c, error, session) => {
  if (error) {
    return c.html('<h1>Login failed</h1><p>Please try again.</p>', { status: 400 });
  }
  // ...
}
```

### SECURITY-CRITICAL: Hook Errors Do Not Block Login

**Important:** Throwing an error from the `onCallback` hook does NOT block the login. Hook errors are logged but never mask the original authentication error. Login always completes unless you explicitly return a `Response` with a non-2xx status.

To deny a login from the hook, **return a `Response`** (e.g., 403 Forbidden):

```typescript
onCallback: async (c, error, session) => {
  if (error) {
    return c.json({ error: 'Auth failed' }, { status: 400 });
  }
  
  // Check custom condition
  if (!session.user.email_verified) {
    return c.json({ error: 'Email not verified' }, { status: 403 });
  }
  
  return { verified: true };
}
```

Do NOT rely on throwing errors to prevent login — it will not work. Always return a `Response` to deny access.

## Error Handling

Seven error types extend `Auth0Error` and propagate to Hono's `app.onError()` handler. Each has a specific HTTP status:

| Error | Status | When |
|-------|--------|------|
| `AccessDeniedError` | 403 | Access denied by policy (e.g., claim guard mismatch) |
| `LoginRequiredError` | 401 | No session; login required (e.g., `requiresAuth()` on public route) |
| `InvalidGrantError` | 401 | Token refresh failed (e.g., refresh token expired) |
| `MissingSessionError` | 401 | `getUser()` or `getSession()` called without active session |
| `MissingTransactionError` | 400 | `/callback` hit without a transaction state |
| `TokenRefreshError` | 401 | Failed to refresh access token |
| `ConnectionTokenError` | 401 | Failed to fetch connection-specific token |

Handle errors globally:

```typescript
app.onError((err, c) => {
  if (err instanceof LoginRequiredError) {
    return c.redirect('/login');
  }
  
  if (err instanceof AccessDeniedError) {
    return c.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  if (err instanceof Auth0Error) {
    return c.json({ error: err.message }, { status: err.status });
  }
  
  return c.json({ error: 'Internal server error' }, { status: 500 });
});
```

## TypeScript Typing

For full type safety, wrap your context type with `OIDCEnv`:

```typescript
import { Context } from 'hono';
import { OIDCEnv } from '@auth0/auth0-hono';

app.get('/profile', requiresAuth(), (c: Context<OIDCEnv>) => {
  // Now c.var.auth0 is typed as Auth0Context (user/session/org)
  const user = c.var.auth0.user; // Auth0User | null
  return c.json({ user });
});
```

For stricter form, use `OIDCVariables`:

```typescript
import { OIDCVariables } from '@auth0/auth0-hono';

type AppEnv = {
  Variables: OIDCVariables;
};

app.get('/protected', requiresAuth(), (c: Context<AppEnv>) => {
  // Guarantees c.var.auth0 is defined (not undefined)
  const user = c.var.auth0.user;
  return c.json({ user });
});
```

