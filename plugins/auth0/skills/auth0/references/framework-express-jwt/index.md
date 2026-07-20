
# Node OAuth2 JWT Bearer Integration

The `express-oauth2-jwt-bearer` package provides Express middleware for validating Auth0 JWT Bearer access tokens. It handles token extraction, signature verification, audience and issuer validation, and expiry checks per RFC 6750 — letting you focus on business logic rather than JWT parsing.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/node-oauth2-jwt-bearer/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all `package.json` dependency lines instead of any hardcoded version below.

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **Express** 4.x or 5.x
- **npm** or **yarn**
- An **Auth0 account** with a configured API (Resource Server)
- **Auth0 CLI** (for automatic setup): `npm install -g @auth0/auth0-cli`

## When NOT to Use

| Use Case | Use Instead |
|----------|-------------|
| Building a server-side web app with login UI (Express sessions) | the Auth0 integration workflow for Express (web app) |
| Building a Next.js app with server-side auth | the Auth0 integration workflow for Next.js |
| Building a React/Angular/Vue SPA | the Auth0 integration workflow for React, Angular, or Vue |
| Building a React Native or mobile app | the Auth0 integration workflow for React Native, Android, or Swift |
| ASP.NET Core Web API | the Auth0 integration workflow for ASP.NET Core (API) |
| Go API with JWT middleware | the Auth0 integration workflow for Go |
| Python API (Flask/FastAPI) | the Auth0 integration workflow for Flask or FastAPI |

## Quick Start Workflow

> **Agent instruction:** Follow these steps to integrate `express-oauth2-jwt-bearer` into the user's Node.js API project.
>
> 1. **Fetch latest version** (see instruction above).
>
> 2. **Install the SDK:**
>    ```bash
>    npm install express-oauth2-jwt-bearer
>    ```
>
> 3. **Configure Auth0** — follow the Setup Guide section below. If the user already provided their Auth0 Domain and API Audience in the prompt, use them directly — skip automatic setup and do NOT call `AskUserQuestion` to re-confirm. Otherwise, offer automatic setup via the Auth0 CLI or manual setup.
>
> 4. **Set up middleware** — add to `app.js` or `server.js`:
>    ```javascript
>    import { auth } from 'express-oauth2-jwt-bearer';
>
>    const checkJwt = auth({
>      issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
>      audience: process.env.AUTH0_AUDIENCE,
>    });
>
>    app.use(checkJwt); // apply globally, or per-route
>    ```
>
> 5. **Protect endpoints** — apply middleware globally or to specific routes:
>    ```javascript
>    // Global protection
>    app.use(checkJwt);
>
>    // Or per-route
>    app.get('/api/private', checkJwt, (req, res) => {
>      res.json({ sub: req.auth.payload.sub });
>    });
>    ```
>
> 6. **Add RBAC** (optional) — use `requiredScopes()` or `claimIncludes()` for permission-based access:
>    ```javascript
>    import { auth, requiredScopes, claimIncludes } from 'express-oauth2-jwt-bearer';
>
>    app.get('/api/messages', checkJwt, requiredScopes('read:messages'), (req, res) => {
>      res.json({ messages: [] });
>    });
>    ```
>    > **Important:** `requiredScopes` accepts a single argument — a space-separated string or an array. Do NOT pass multiple string arguments: `requiredScopes('read:msg', 'write:msg')` silently ignores everything after the first. Use `requiredScopes('read:msg write:msg')` or `requiredScopes(['read:msg', 'write:msg'])` instead.
>
> 7. **Verify the integration** — build and test:
>    ```bash
>    node server.js
>    curl http://localhost:3000/api/private         # should return 401
>    curl -H "Authorization: Bearer <token>" http://localhost:3000/api/private  # should return 200
>    ```
>
> 8. **Failcheck:** If the server fails to start or tokens are rejected unexpectedly, check the Common Issues section below for common issues. After 5-6 failed iterations, use `AskUserQuestion` to ask the user for more details about their environment.

## Detailed Documentation

- **Setup Guide** (see the Setup Guide section below) — Auth0 API registration, .env configuration, Auth0 CLI for automated setup, and secret management
- **Integration Patterns** (see the Integration Patterns section below) — Protected endpoints, RBAC with scopes and claims, DPoP, CORS setup, error handling, and testing with curl
- **API Reference & Testing** (see the API Reference & Testing section below) — Full configuration options, claims reference, complete code example, testing checklist, and common issues

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Created an **Application** instead of an **API** in Auth0 Dashboard | Token validation fails; wrong audience | Create a new **API** (Resource Server) in Auth0 Dashboard → APIs |
| Audience doesn't match API identifier exactly | `401 Unauthorized` — "Audience mismatch" | Copy the exact API Identifier string from Auth0 Dashboard → APIs |
| Domain includes `https://` prefix | `Error: Invalid URL` at startup | Use hostname only: `your-tenant.us.auth0.com`, not `https://...` |
| Checking `scope` claim instead of `permissions` for RBAC | 403 always returned or permissions ignored | Use `requiredScopes()` for scope-based RBAC; use `claimIncludes('permissions', 'read:data')` for Auth0 RBAC permission claims |
| CORS not configured before auth middleware | Preflight OPTIONS requests return 401 | Add `cors()` middleware before `auth()` in the middleware chain |
| `.env` file not loaded | `undefined` for domain/audience | Add `import 'dotenv/config'` at the top of the entry file |
| `req.auth` is undefined | `TypeError: Cannot read properties of undefined` | Verify `checkJwt` middleware runs before the handler |

## Related Skills

- Express web apps with login UI (sessions, cookies) → the Auth0 integration workflow for Express
- Next.js server-side web apps → the Auth0 integration workflow for Next.js
- .NET Web API (BACKEND_API reference implementation) → the Auth0 integration workflow for ASP.NET Core
- JWT middleware for Go APIs → the Auth0 integration workflow for Go
- JWT validation for Python APIs (Flask/FastAPI) → the Auth0 integration workflow for FastAPI or Flask
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

### Core Middleware

| Function | Description | Returns |
|----------|-------------|---------|
| `auth(options?)` | JWT Bearer validation middleware | `Handler` — 401 if token invalid/missing |
| `requiredScopes(scopes)` | Validates token has all required scopes | `Handler` — 403 if scopes missing |
| `scopeIncludesAny(scopes)` | Validates token has at least one scope | `Handler` — 403 if no match |
| `claimEquals(claim, value)` | Validates a claim equals a value | `Handler` — 401 if mismatch |
| `claimIncludes(claim, ...values)` | Validates claim includes all values | `Handler` — 401 if incomplete |
| `claimCheck(fn, desc?)` | Custom claim validation function | `Handler` — 401 if fn returns false |

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `issuerBaseURL` | `string` | Auth0 domain with `https://` (required unless using env vars) |
| `audience` | `string` | API Identifier from Auth0 Dashboard (required unless using env vars) |
| `tokenSigningAlg` | `string` | Signing algorithm (default: `RS256`; use `HS256` for symmetric) |
| `authRequired` | `boolean` | Set `false` to make authentication optional (default: `true`) |
| `clockTolerance` | `number` | Clock skew tolerance in seconds (no default; undefined unless set) |
| `dpop` | `DPoPOptions` | DPoP configuration (see the DPoP Support section below) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ISSUER_BASE_URL` | Auth0 domain with `https://` (auto-detected by SDK) |
| `AUDIENCE` | API Identifier (auto-detected by SDK) |

### Request Object

After successful validation, `req.auth` contains:
```typescript
req.auth.payload    // Decoded JWT payload (sub, iss, aud, exp, permissions, etc.)
req.auth.header     // JWT header (alg, typ, kid)
req.auth.token      // Raw JWT string
```

## SDK Architecture

The `node-oauth2-jwt-bearer` monorepo contains three packages:

| Package | Purpose |
|---------|---------|
| `express-oauth2-jwt-bearer` | **Main package.** Express middleware for JWT Bearer validation. Published to npm. |
| `access-token-jwt` | Low-level JWT verification utilities (used internally). |
| `oauth2-bearer` | RFC 6750 Bearer token extraction (used internally). |

In practice, you only install and import `express-oauth2-jwt-bearer`.

## Auth Flow Comparison

| Auth Pattern | SDK | When to Use |
|-------------|-----|-------------|
| JWT Bearer (stateless) | `express-oauth2-jwt-bearer` | APIs called by SPAs, mobile apps, M2M clients |
| Session-based (stateful) | `@auth0/express-openid-connect` | Web apps with login UI and server-side sessions |

## Testing Quick Reference

```bash
# Capture a token into a shell variable — see "Testing Patterns" below for the
# full command. Reference $ACCESS_TOKEN rather than pasting the raw token
# inline; inline token values leak into shell history and terminal scrollback.

# 1. Verify 401 on protected route (no token)
curl -v http://localhost:3000/api/private

# 2. Verify 200 with valid token
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3000/api/private

# 3. Verify 403 with valid token but missing scope
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3000/api/admin

# 4. Verify CORS preflight
curl -v -X OPTIONS http://localhost:3000/api/private \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"
```

## References

- [express-oauth2-jwt-bearer on npm](https://www.npmjs.com/package/express-oauth2-jwt-bearer)
- [GitHub: auth0/node-oauth2-jwt-bearer](https://github.com/auth0/node-oauth2-jwt-bearer)
- [Auth0 Node.js API Quickstart](https://auth0.com/docs/quickstart/backend/nodejs/interactive)
- [Auth0 APIs Dashboard](https://manage.auth0.com/#/apis)
- [RFC 6750 — Bearer Token Usage](https://datatracker.ietf.org/doc/html/rfc6750)

---

# express-oauth2-jwt-bearer API Reference & Testing

## Configuration Reference

All options are passed to the `auth()` function or set via environment variables.

### auth() Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `issuerBaseURL` | `string` | Yes (or `ISSUER_BASE_URL` env var) | — | Auth0 domain with `https://`, e.g. `https://your-tenant.us.auth0.com` |
| `audience` | `string` | Yes (or `AUDIENCE` env var) | — | API Identifier from Auth0 Dashboard, e.g. `https://my-api.com` |
| `secret` | `string` | For HS256 only | — | Shared secret for symmetric JWT signing (HS256). Not required for RS256. |
| `tokenSigningAlg` | `string` | No | `RS256` | JWT signing algorithm. Use `HS256` for symmetric keys. |
| `issuer` | `string` | No (alternative to `issuerBaseURL`) | — | Issuer claim value — use with `jwksUri` for non-standard setups |
| `jwksUri` | `string` | No | Derived from `issuerBaseURL` | Custom JWKS endpoint URL |
| `authRequired` | `boolean` | No | `true` | Set `false` to allow unauthenticated requests through (attach auth info if present) |
| `clockTolerance` | `number` | No | `(none)` | Clock skew tolerance in seconds (undefined unless explicitly set) |
| `validators` | `Validators` | No | — | Custom validator overrides. Set `{ iss: false }` to skip issuer validation. |
| `dpop` | `DPoPOptions` | No | — | DPoP configuration (see below) |

### DPoPOptions

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | `boolean` | Enable DPoP token binding. Default is `true` (hybrid Bearer+DPoP mode). |
| `required` | `boolean` | Set `true` to reject plain Bearer tokens (DPoP-only mode). Default: `false`. |
| `iatOffset` | `number` | Max age of a DPoP proof in seconds. |
| `iatLeeway` | `number` | Leeway for `iat` claim in DPoP proofs. |

### Environment Variables (auto-detected)

When no options are passed to `auth()`, these variables are read automatically:

| Variable | Description |
|----------|-------------|
| `ISSUER_BASE_URL` | Auth0 domain with `https://` prefix: `https://your-tenant.us.auth0.com` |
| `AUDIENCE` | API Identifier: `https://your-api.example.com` |

**Note:** `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` are the conventional `.env` keys used in this skill. Pass them explicitly:
```javascript
auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
})
```

## Claims Reference

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | `string` | Subject identifier — the user's or M2M app's unique Auth0 ID |
| `iss` | `string` | Issuer — your Auth0 tenant URL (e.g. `https://your-tenant.us.auth0.com/`) |
| `aud` | `string \| string[]` | Audience — must match your API Identifier |
| `exp` | `number` | Expiration timestamp (Unix epoch) |
| `iat` | `number` | Issued-at timestamp (Unix epoch) |
| `scope` | `string` | Space-separated scopes granted to the token |
| `permissions` | `string[]` | Array of RBAC permissions (Auth0-specific, enabled via RBAC settings on the API) |
| `azp` | `string` | Authorized party — client ID of the application that requested the token |
| `org_id` | `string` | Organization ID (Auth0 Organizations feature) |

**Accessing claims in a handler:**
```javascript
app.get('/api/me', checkJwt, (req, res) => {
  const { sub, permissions, scope } = req.auth.payload;
  res.json({ sub, permissions });
});
```

## Code Examples

### Complete minimal example

```javascript
// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { auth, requiredScopes, claimIncludes } from 'express-oauth2-jwt-bearer';

const app = express();

// 1. CORS before auth (required for preflight requests)
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  allowedHeaders: ['Authorization', 'Content-Type', 'DPoP'],
}));

app.use(express.json());

// 2. JWT validation middleware
const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// 3. Public endpoint (no auth required)
app.get('/api/public', (req, res) => {
  res.json({ message: 'This is a public endpoint' });
});

// 4. Private endpoint (JWT required)
app.get('/api/private', checkJwt, (req, res) => {
  res.json({
    message: 'Authenticated',
    sub: req.auth.payload.sub,
  });
});

// 5. Scoped endpoint (specific scope required)
app.get('/api/messages', checkJwt, requiredScopes('read:messages'), (req, res) => {
  res.json({ messages: ['Hello', 'World'] });
});

// 6. Permission-based endpoint (RBAC permissions claim)
app.get('/api/admin', checkJwt, claimIncludes('permissions', 'admin:access'), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// 7. RFC 6750 error handler
app.use((err, req, res, next) => {
  if (err.status) {
    return res.status(err.status).json({
      error: err.code,
      message: err.message,
    });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
```

### Environment configuration (.env)

```env
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://your-api.example.com
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### TypeScript example

```typescript
import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { auth, requiredScopes } from 'express-oauth2-jwt-bearer';

// Note: express-oauth2-jwt-bearer already declares req.auth on the Express
// Request interface in its own .d.ts — no need to redeclare it here.

const app = express();

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

app.get('/api/private', checkJwt, (req: Request, res: Response) => {
  const sub = req.auth?.payload.sub;
  res.json({ sub });
});
```

## Testing Checklist

- [ ] **Public endpoint** returns `200` without a token: `curl http://localhost:3000/api/public`
- [ ] **Protected endpoint** returns `401` without a token: `curl http://localhost:3000/api/private`
- [ ] **Protected endpoint** returns `200` with valid M2M token: `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/private`
- [ ] **Scoped endpoint** returns `403` with token missing required scope
- [ ] **Scoped endpoint** returns `200` with token that has the required scope
- [ ] **Expired token** returns `401` with error description
- [ ] **Wrong audience** returns `401`
- [ ] **CORS preflight** (`OPTIONS`) returns `200` from protected routes
- [ ] `req.auth.payload.sub` contains the expected subject
- [ ] `req.auth.payload.permissions` array is populated (if RBAC is enabled on the Auth0 API)

### Getting a test token with M2M credentials

```bash
curl --request POST \
  --url "https://YOUR_AUTH0_DOMAIN/oauth/token" \
  --header "content-type: application/json" \
  --data '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "YOUR_API_AUDIENCE",
    "grant_type": "client_credentials"
  }'
```

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `UnauthorizedError: No authorization token was found` | No `Authorization: Bearer ...` header | Add the bearer token to the request header |
| `UnauthorizedError: invalid_token — jwt audience invalid` | Audience mismatch | Verify `AUTH0_AUDIENCE` matches the API Identifier in Auth0 Dashboard exactly |
| `UnauthorizedError: invalid_token — jwt issuer invalid` | Domain mismatch | Verify `AUTH0_DOMAIN` is the Auth0 tenant hostname (no `https://`) |
| `UnauthorizedError: invalid_token — jwt expired` | Token has expired | Request a new token; check system clock drift (`clockTolerance` option) |
| `Error: JWKS request failed` | Network or domain misconfiguration | Verify `AUTH0_DOMAIN` is reachable; check network/proxy settings |
| `InsufficientScopeError: Insufficient scope` | Token lacks required scope | Verify the requesting app has the scope granted; check `requiredScopes()` call |
| `CORS error` on OPTIONS preflight | Auth middleware running before CORS | Move `cors()` middleware before `auth()` in the middleware chain |
| `TypeError: Cannot read properties of undefined (reading 'payload')` | `req.auth` is undefined | Check that `checkJwt` middleware runs before the handler |

## Security Considerations

- **Never log tokens.** Full JWT strings contain sensitive claims. Log only `sub` or `jti` for tracing.
- **CORS before auth.** Always register `cors()` before `auth()`. Auth middleware rejects OPTIONS preflight requests with 401 if CORS isn't set first.
- **Audience validation is critical.** Without a matching `audience`, your API would accept tokens issued for other services.
- **Issuer validation.** The `issuerBaseURL` is used to fetch the JWKS and validate the `iss` claim. Never disable issuer validation in production.
- **RBAC via `permissions` claim.** Auth0 RBAC stores user permissions in the `permissions` JWT claim (not `scope`). Enable "Add Permissions in the Access Token" on your Auth0 API settings.
- **DPoP.** For APIs requiring sender-constrained tokens, enable DPoP with `dpop: { enabled: true, required: true }`. This prevents token theft — stolen tokens cannot be replayed without the original private key.
- **Helmet.** Pair with `helmet` for security headers: `npm install helmet` + `app.use(helmet())`.
- **Production secrets.** Never commit `.env` to source control. Use environment variables in production (Railway, Heroku, Fly.io, etc.).

---

# Integration Patterns

## Authentication Flow

```text
Client → API
  1. Client obtains access token from Auth0 (via /oauth/token)
  2. Client sends request with "Authorization: Bearer <token>" header
  3. express-oauth2-jwt-bearer middleware:
     a. Extracts bearer token from Authorization header
     b. Fetches public key from Auth0 JWKS endpoint (cached)
     c. Verifies token signature, issuer, audience, expiry
     d. Attaches decoded token to req.auth
  4. Route handler accesses req.auth.payload
```

## Protected Endpoints

### Global protection

Apply `checkJwt` middleware globally to protect all routes:

```javascript
import { auth } from 'express-oauth2-jwt-bearer';

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// All routes below this require a valid JWT
app.use(checkJwt);
app.get('/api/users', (req, res) => {
  res.json({ sub: req.auth.payload.sub });
});
```

### Per-route protection

Apply middleware to specific routes only:

```javascript
// Public — no auth
app.get('/api/public', (req, res) => {
  res.json({ message: 'Public endpoint' });
});

// Protected — JWT required
app.get('/api/private', checkJwt, (req, res) => {
  res.json({ sub: req.auth.payload.sub });
});
```

### Optional authentication

Allow unauthenticated requests but attach auth info when present:

```javascript
const optionalAuth = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
  authRequired: false,
});

app.get('/api/profile', optionalAuth, (req, res) => {
  if (req.auth) {
    res.json({ sub: req.auth.payload.sub, authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});
```

## RBAC — Scope-Based Authorization

Use `requiredScopes()` to enforce scopes on access tokens:

```javascript
import { auth, requiredScopes } from 'express-oauth2-jwt-bearer';

// All scopes must be present
app.get('/api/messages', checkJwt, requiredScopes('read:messages'), (req, res) => {
  res.json({ messages: [] });
});

// Multiple scopes required
app.post('/api/messages', checkJwt, requiredScopes('read:messages write:messages'), (req, res) => {
  res.json({ created: true });
});
```

### Permission-based RBAC (Auth0 RBAC feature)

When Auth0 RBAC is enabled on the API, permissions are stored in the `permissions` claim:

```javascript
import { auth, claimIncludes } from 'express-oauth2-jwt-bearer';

// Require 'read:messages' in the permissions claim
app.get('/api/messages', checkJwt, claimIncludes('permissions', 'read:messages'), (req, res) => {
  res.json({ messages: [] });
});

// Require multiple permissions
app.delete('/api/messages/:id', checkJwt, claimIncludes('permissions', 'delete:messages'), (req, res) => {
  res.json({ deleted: true });
});
```

## Claim Validation

### claimEquals — exact value match

```javascript
import { auth, claimEquals } from 'express-oauth2-jwt-bearer';

// Require org_id to equal a specific value
app.get('/api/org-data', checkJwt, claimEquals('org_id', 'org_123'), (req, res) => {
  res.json({ org: 'org_123' });
});
```

### claimIncludes — array contains all values

```javascript
import { auth, claimIncludes } from 'express-oauth2-jwt-bearer';

// Require the roles claim to include 'admin'
app.get('/api/admin', checkJwt, claimIncludes('roles', 'admin'), (req, res) => {
  res.json({ admin: true });
});
```

### claimCheck — custom validation logic

```javascript
import { auth, claimCheck } from 'express-oauth2-jwt-bearer';

// Custom validation function
app.get('/api/premium', checkJwt, claimCheck((payload) => {
  return payload?.subscription === 'premium' && payload?.active === true;
}, 'Premium subscription required'), (req, res) => {
  res.json({ premium: true });
});
```

## CORS Configuration

**Critical:** CORS middleware must come before auth middleware. Auth rejects OPTIONS preflight requests with 401 if CORS isn't configured first.

```javascript
import cors from 'cors';
import { auth } from 'express-oauth2-jwt-bearer';

// 1. CORS first (handles OPTIONS preflight)
app.use(cors({
  origin: 'http://localhost:5173',  // Your frontend URL
  allowedHeaders: ['Authorization', 'Content-Type', 'DPoP'],
  exposedHeaders: ['WWW-Authenticate'],
}));

// 2. Auth second
const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});
```

## DPoP Support

DPoP (Demonstration of Proof-of-Possession) binds tokens to the client's key pair, preventing token theft. The SDK supports DPoP natively.

### Hybrid mode (Bearer or DPoP both accepted — default)

```javascript
const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
  dpop: {
    enabled: true,
    required: false,  // Accept both Bearer and DPoP tokens
  },
});
```

### DPoP-only mode (rejects plain Bearer tokens)

```javascript
const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
  dpop: {
    enabled: true,
    required: true,  // Reject plain Bearer tokens
  },
});
```

### Bearer-only mode (disable DPoP)

```javascript
const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
  dpop: { enabled: false },
});
```


## Error Handling

The SDK throws RFC 6750-compliant errors with `.status` and `.headers` properties. Add an error handler after your routes:

```javascript
app.use((err, req, res, next) => {
  if (err.status) {
    // JWT validation error — send WWW-Authenticate header per RFC 6750
    res.set(err.headers);
    return res.status(err.status).json({
      error: err.code,
      error_description: process.env.NODE_ENV === 'production' ? undefined : err.message,
    });
  }
  // Other errors
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});
```

### Error types

| Error Class | Status | Code | Cause |
|------------|--------|------|-------|
| `UnauthorizedError` | 401 | `invalid_token` | Missing, expired, or malformed token |
| `InvalidRequestError` | 400 | `invalid_request` | Malformed Authorization header |
| `InvalidTokenError` | 401 | `invalid_token` | Token signature/claims validation failed |
| `InsufficientScopeError` | 403 | `insufficient_scope` | Token lacks required scope |

```javascript
import {
  UnauthorizedError,
  InvalidTokenError,
  InsufficientScopeError
} from 'express-oauth2-jwt-bearer';

app.use((err, req, res, next) => {
  if (err instanceof InsufficientScopeError) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (err instanceof UnauthorizedError || err instanceof InvalidTokenError) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next(err);
});
```

## Testing Patterns

### Manual testing with curl

```bash
# 1. Get a test token (from Auth0 Dashboard → APIs → Test, or via M2M credentials)
ACCESS_TOKEN=$(curl -s --request POST \
  --url "https://YOUR_AUTH0_DOMAIN/oauth/token" \
  --header "content-type: application/json" \
  --data '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "YOUR_API_AUDIENCE",
    "grant_type": "client_credentials"
  }' | jq -r '.access_token')

# 2. Test protected endpoint
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3000/api/private

# 3. Test scoped endpoint
curl -H "Authorization: Bearer $ACCESS_TOKEN" http://localhost:3000/api/messages
```

### Unit testing with Jest/Vitest

```javascript
import request from 'supertest';
import app from './app.js';

describe('API Authentication', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/private');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    // Use a test token from Auth0 or a mocked JWT
    const res = await request(app)
      .get('/api/private')
      .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`);
    expect(res.status).toBe(200);
  });
});
```

### Mocking in unit tests

For unit tests, you can mock the `auth` middleware to bypass JWT validation:

```javascript
// test-utils.js
import { jest } from '@jest/globals';

export function mockAuth(payload = { sub: 'test-user' }) {
  jest.mock('express-oauth2-jwt-bearer', () => ({
    auth: () => (req, res, next) => {
      req.auth = { payload };
      next();
    },
    requiredScopes: (scopes) => (req, res, next) => {
      const tokenScopes = req.auth?.payload?.scope?.split(' ') || [];
      const missing = [scopes].flat().filter(s => !tokenScopes.includes(s));
      if (missing.length) return res.status(403).json({ error: 'insufficient_scope' });
      next();
    },
    claimIncludes: () => (req, res, next) => next(),
  }));
}
```

---

# express-oauth2-jwt-bearer Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **Check if credentials are already provided in the user's prompt:** If the user's prompt already includes Auth0 Domain and API Audience (e.g. `your-tenant.us.auth0.com` and `https://api.example.com`), use them directly — skip to "Write the .env file" below. Do NOT call `AskUserQuestion` to re-confirm provided credentials, and do NOT run automatic setup.
>
> If credentials are NOT provided, offer setup choices:
>
> Use `AskUserQuestion` to ask the user:
> "How would you like to configure Auth0 for this project?"
> - Option A: **Automatic setup (recommended)** — use the Auth0 CLI to create the Auth0 API automatically
> - Option B: **Manual setup** — provide Auth0 credentials manually
>
> **If Automatic Setup (Option A):**
>
> 1. **Pre-flight checks:**
>    - Verify Auth0 CLI installed: `auth0 --version`
>    - Verify logged in: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide user to install/login, or fall back to Option B
>
> 2. **Create the Auth0 API (Resource Server)** with the Auth0 CLI, then read back the identifier as `AUTH0_AUDIENCE`:
>    ```bash
>    auth0 apis create \
>      --name "My Node API" \
>      --identifier "https://my-api.example.com" \
>      --json --no-input
>    ```
>    - The `--identifier` you choose becomes the `AUTH0_AUDIENCE` value your middleware validates against.
>    - Get the tenant domain for `AUTH0_DOMAIN` with `auth0 tenants list --csv --no-input`.
>    - If an API with that identifier already exists, skip creation and reuse it (`auth0 apis list --json --no-input`).
>
> 3. **Write the `.env` configuration file** with the Domain + Audience (see below).
>
> **If Manual Setup (Option B):**
>
> Ask the user for:
> - **Auth0 Domain** (e.g., `your-tenant.us.auth0.com`)
> - **API Audience** — the API Identifier you set when creating the Auth0 API (e.g., `https://your-api.example.com`)
>
> Then write the `.env` file (see below).
>
> **Write the .env file** (both paths):
> ```env
> AUTH0_DOMAIN=your-tenant.us.auth0.com
> AUTH0_AUDIENCE=https://your-api.example.com
> PORT=3000
> ```

### Auth0 API Registration (Resource Server)

The Automatic setup path runs `auth0 apis create` to register your API as a Resource Server. This produces the `AUTH0_AUDIENCE` value (the API Identifier) that your middleware uses for token validation.

**Auth0 CLI command:**
```bash
auth0 apis create \
  --name "My Node API" \
  --identifier "https://my-api.example.com" \
  --json --no-input
```

### Creating the Auth0 API manually (Dashboard)

1. Go to [Auth0 Dashboard → APIs](https://manage.auth0.com/#/apis)
2. Click **Create API**
3. Set:
   - **Name**: Your API name (e.g., "My Node API")
   - **Identifier**: A URL-like identifier (e.g., `https://my-api.example.com`) — this becomes `AUTH0_AUDIENCE`
   - **Signing Algorithm**: `RS256` (recommended)
4. Click **Create**
5. Note the **API Identifier** — this is your Audience value

### Enable RBAC (optional)

To use `claimIncludes('permissions', 'read:data')` with Auth0 RBAC:

1. Go to Auth0 Dashboard → APIs → your API → Settings
2. Enable **"Enable RBAC"**
3. Enable **"Add Permissions in the Access Token"**
4. Add permissions under the **Permissions** tab
5. Assign permissions to roles, and roles to users via Auth0 Dashboard

## Post-Setup Steps

After completing automatic (Auth0 CLI) or manual setup:

1. **Verify domain and audience** are correct in `.env`
2. **Test the API is reachable**: `auth0 apis list --json --no-input | grep your-api`
3. **Confirm CORS is configured** before auth middleware in your server file (see the CORS Configuration section below)
4. **Request a test token** using M2M credentials or the Auth0 Dashboard test feature:
   - Go to Auth0 Dashboard → APIs → your API → Test tab
   - Click **Copy Token** to get a test access token

## SDK Installation

```bash
npm install express-oauth2-jwt-bearer
```

**With additional recommended packages:**
```bash
npm install express-oauth2-jwt-bearer dotenv cors helmet
npm install --save-dev @types/express @types/cors  # TypeScript projects
```

**package.json dependency:**
```json
{
  "dependencies": {
    "express-oauth2-jwt-bearer": "^1.7.4",
    "dotenv": "^16.0.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0"
  }
}
```

## Secret Management

`express-oauth2-jwt-bearer` requires only **Domain** and **Audience** — no Client Secret. The middleware validates tokens using the Auth0 JWKS (JSON Web Key Set) endpoint, which provides the public signing keys. This means:

- **No client secret needed** for token validation
- The JWKS endpoint is publicly accessible at `https://{AUTH0_DOMAIN}/.well-known/jwks.json`
- The middleware fetches and caches keys automatically

### .env file (development)

```env
# .env — Never commit to source control
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://your-api.example.com
PORT=3000
```

### Production environment variables

Set these as environment variables in your hosting platform (not in `.env` files):

| Variable | Example Value |
|----------|--------------|
| `AUTH0_DOMAIN` | `your-tenant.us.auth0.com` |
| `AUTH0_AUDIENCE` | `https://your-api.example.com` |
| `PORT` | `3000` |

**Never commit `.env` to source control.** Add `.env` to `.gitignore`:
```bash
echo ".env" >> .gitignore
```

**Load `.env` in your entry file:**
```javascript
import 'dotenv/config'; // must be at the top
// or: require('dotenv').config();
```

## Verification

After setup, verify everything is working:

1. **Start the server:**
   ```bash
   node server.js
   # or: npm start
   ```

2. **Test public endpoint:**
   ```bash
   curl http://localhost:3000/api/public
   # Expected: 200 OK
   ```

3. **Test protected endpoint without token:**
   ```bash
   curl http://localhost:3000/api/private
   # Expected: 401 Unauthorized
   ```

4. **Get a test token** from Auth0 Dashboard → APIs → your API → Test tab, then:
   ```bash
   curl -H "Authorization: Bearer <your-test-token>" http://localhost:3000/api/private
   # Expected: 200 OK with payload data
   ```
