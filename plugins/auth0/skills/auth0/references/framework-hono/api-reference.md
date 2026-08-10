# API Reference: @auth0/auth0-hono Config, Environment, and Types

Complete configuration options, environment variables, error types, and frequently asked questions.

## Beta Status

@auth0/auth0-hono v2.0.0-beta.0 ships session-based web application integration only:

**Supported:**
- Session management with encryption and rolling windows
- Protected routes and authentication guards
- Role-Based Access Control (RBAC) via claim guards
- Organizations for multi-tenant applications
- Runtimes: Node.js, Cloudflare Workers, Deno, Bun

**Not in beta (coming in future releases):**
- JWT verifier and `/api` subpath for stateless API authentication
- MFA and DPoP
- `/management` self-service endpoints
- `/testing` utilities
- Token revocation

API is likely to stabilize post-beta. User feedback is encouraged.

## Configuration Object

Pass configuration to the `auth0()` middleware:

```typescript
app.use('*', auth0({
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  baseURL: process.env.APP_BASE_URL,
  session: { secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY },
}));
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `domain` | string | Auth0 tenant domain (e.g., `your-tenant.us.auth0.com`) |
| `clientID` | string | Auth0 application client ID (note: capital **ID**) |
| `baseURL` | string | Base URL of your application (e.g., `http://localhost:3000`) |

### Optional Fields with Defaults

| Field | Default | Description |
|-------|---------|-------------|
| `clientSecret` | `undefined` | Client secret (required for standard OAuth flows) |
| `authRequired` | `true` | Require authentication globally; override per-route via `requiresAuth()` |
| `idpLogout` | `false` | Logout from Auth0 tenant when user logs out of app |
| `session.secret` | — | Session encryption secret (required, ≥32 chars; string or array for rotation) |
| `session.rolling` | `true` | Reset session expiry on each request |
| `session.absoluteDuration` | `259200` | Max session lifetime in seconds (3 days) |
| `session.inactivityDuration` | `86400` | Session expiry after inactivity in seconds (1 day) |
| `session.cookie.name` | `'appSession'` | Session cookie name |
| `session.cookie.sameSite` | `'lax'` | SameSite cookie policy (`'lax'` or `'strict'`) |
| `session.cookie.secure` | `auto` | Use secure flag; auto-detect from `baseURL` https |
| `routes.login` | `'/login'` | Login endpoint path |
| `routes.logout` | `'/logout'` | Logout endpoint path |
| `routes.callback` | `'/callback'` | OAuth callback path |
| `authorizationParams.response_type` | `'id_token'` | OpenID Connect response type |
| `authorizationParams.scope` | `'openid profile email'` | OIDC scopes |
| `authorizationParams.response_mode` | `'form_post'` | Form POST response mode |
| `authorizationParams.audience` | — | API audience (for access tokens) |
| `clockTolerance` | `60` | Clock skew tolerance in seconds (for token validation) |
| `enableTelemetry` | `true` | Send telemetry to Auth0 |
| `idTokenSigningAlg` | `'RS256'` | ID token signing algorithm |
| `onCallback` | — | Hook function run after callback |

### Example with Full Config

```typescript
app.use('*', auth0({
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  baseURL: process.env.APP_BASE_URL,
  
  authRequired: true,
  idpLogout: false,
  
  session: {
    secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY,
    rolling: true,
    absoluteDuration: 259200,      // 3 days
    inactivityDuration: 86400,     // 1 day
    cookie: {
      name: 'appSession',
      sameSite: 'lax',
      secure: true,
    },
  },
  
  routes: {
    login: '/login',
    logout: '/logout',
    callback: '/callback',
  },
  
  authorizationParams: {
    response_type: 'id_token',
    scope: 'openid profile email offline_access',
    audience: 'https://api.example.com',
  },
  
  clockTolerance: 60,
  idTokenSigningAlg: 'RS256',
  
  onCallback: (c, error, session) => {
    if (!error) {
      return { loginTime: Date.now() };
    }
  },
}));
```

## Environment Variables

Store sensitive configuration in environment variables:

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `AUTH0_DOMAIN` | Yes | `your-tenant.us.auth0.com` | Auth0 tenant domain |
| `AUTH0_CLIENT_ID` | Yes | `<client-id>` | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | Yes | `<secret>` | Auth0 application secret |
| `APP_BASE_URL` | Yes | `http://localhost:3000` | Application base URL |
| `AUTH0_SESSION_ENCRYPTION_KEY` | Yes | `<32+ hex chars>` | Session encryption key (generate via `openssl rand -hex 32`) |

## OpenID Connect Claims

Standard OpenID Connect claims available in `c.var.auth0.user`:

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | Subject (unique user ID) |
| `name` | string | User's full name |
| `email` | string | User's email address |
| `email_verified` | boolean | Whether email is verified |
| `picture` | string | Profile picture URL |
| `updated_at` | number | Last update timestamp |

Custom claims (configured in Auth0 Rules or Actions):
- `org_id` — Organization ID
- `roles` — Array of role names
- `permissions` — Array of permission strings
- Additional custom claims as defined in your Auth0 Actions

Access custom claims via:

```typescript
const user = c.var.auth0.user;
const roles = user.roles;           // Array
const orgId = user.org_id;          // String
const customField = user.custom;    // Any
```

## Error Types Reference

All errors extend `Auth0Error` and propagate to Hono's `app.onError()` handler:

| Error | Status | When | Example |
|-------|--------|------|---------|
| `Auth0Error` | 500 | Base error class (rarely thrown directly) | — |
| `AccessDeniedError` | 403 | Claim guard mismatch or policy denied | `claimIncludes()` returns false |
| `LoginRequiredError` | 401 | No session on protected route | `requiresAuth()` without session |
| `InvalidGrantError` | 401 | Token refresh failed | Refresh token expired |
| `MissingSessionError` | 401 | `getUser()` / `getSession()` without session | Called on public route |
| `MissingTransactionError` | 400 | `/callback` hit without valid transaction | CSRF/state validation failure |
| `TokenRefreshError` | 401 | Access token refresh failed | Network error or server rejection |
| `ConnectionTokenError` | 401 | Failed to fetch connection-specific token | Invalid connection name |

Import errors:

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
  Auth0Exception, // Deprecated alias for Auth0Error
} from '@auth0/auth0-hono';
```

## Context Variables

After the `auth0()` middleware, the Hono context includes:

```typescript
c.var.auth0 = {
  user: Auth0User | null,
  session: Auth0Session | null,
  org: Auth0Organization | null,
}
```

### Auth0User (extends UserClaims)

```typescript
{
  sub: string;                    // Unique user ID
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  org_id?: string;                // Organization ID
  org_name?: string;              // Organization name
  roles?: string[];               // User roles (custom claim)
  permissions?: string[];         // User permissions (custom claim)
  [custom: string]: any;          // Additional custom claims
}
```

### Auth0Session

```typescript
{
  user: Auth0User;
  idToken?: string;               // OpenID Connect ID token
  refreshToken?: string;          // Refresh token (if offline_access scope)
  tokenSets?: Auth0TokenSet[];    // Token sets for audiences
  connectionTokenSets?: {...};    // Connection-specific tokens
  internal: {
    sid: string;                  // Session ID
    createdAt: number;            // Session creation time (milliseconds since epoch)
  }
}
```

**Note:** Session does NOT have an `expiresAt` field. Use `session.internal.createdAt` for session creation time or `getAccessToken().expiresAt` for access token expiration.

### Auth0Organization

```typescript
{
  id: string;         // Organization ID
  name?: string;      // Organization display name
}
```

## Testing Checklist

Before deploying to production, verify:

- [ ] Login redirects to Auth0 Universal Login page
- [ ] Successful login redirects back to app with session cookie set
- [ ] Protected route throws `LoginRequiredError` (401) when unauthenticated
- [ ] Logout clears session and redirects to logout URL
- [ ] `getAccessToken()` returns token with valid `expiresAt` timestamp
- [ ] Silent login via `attemptSilentLogin` restores session without redirect
- [ ] `onCallback` hook receives error on failed authentication
- [ ] Claim guards throw `AccessDeniedError` (403) on mismatch
- [ ] `app.onError` handler catches and properly formats `Auth0Error` exceptions
- [ ] Organizations: `requiresOrg()` populates `c.var.auth0.org`
- [ ] Token refresh: `getAccessToken()` auto-refreshes expired tokens
- [ ] Multi-runtime: Same code runs on Node.js, Cloudflare Workers, Deno, Bun

## Common Issues and FAQ

**Q: Why does session not have an `expiresAt` field?**

Session data doesn't track token expiration directly. To check session age, use `session.internal.createdAt`. To check access token expiration, call `getAccessToken()` which returns `{ accessToken, expiresAt, ... }`.

**Q: How do I read tokens from the context?**

The context shape is `{ user, session, org }` — there is NO `tokens` field. Fetch tokens on-demand:
- Access token: `await getAccessToken(c)` → `{ accessToken, expiresAt, ... }`
- Connection-specific token: `await getAccessTokenForConnection(c, opts)`
- ID token: `c.var.auth0.session.idToken` (if offline_access scope)

**Q: Can I reject a login by throwing an error in the `onCallback` hook?**

No. Throwing from the hook is logged but does NOT block the login. To deny a login, **return a `Response`** with a non-2xx status (e.g., `c.json({ error: 'Denied' }, { status: 403 })`). Login will fail and the Response is sent to the client.

**Q: Is there a `getOrg()` function?**

No. Access the organization via:
- `c.var.auth0.org` (populated by `requiresOrg()`)
- `c.var.auth0.user.org_id` (organization ID from claims)

**Q: Is `revokeSession()` available?**

No, not in beta. Clear the session by redirecting to `/logout`.

**Q: Is `pauseSilentLogin` still available?**

`pauseSilentLogin` is deprecated. Use `cancelSilentLogin()` instead to cancel silent login and clear the SSO cookie.

**Q: Where are the `/api` JWT verifier routes?**

The `/api` subpath (JWT verifier, MFA, etc.) is not in the published beta. Use session-based web routes only. JWT verifier support is planned for a future release.

**Q: Why no `/management` or `/testing` subpaths?**

These subpaths are not in the published beta:
- `/management` — Self-service management endpoints (future release)
- `/testing` — Testing utilities (future release)

**Q: Can I use this in a stateless API?**

No. This SDK is for session-based web applications only. For stateless APIs, use JWT validation (coming in future release or use `@auth0/auth0-server-js` directly).

