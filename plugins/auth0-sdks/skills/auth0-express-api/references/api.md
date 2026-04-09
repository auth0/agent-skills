# API Reference & Testing

## Configuration Reference

### auth(options) — JWT Validation Middleware

Returns an Express middleware that validates JWT Bearer access tokens.

```javascript
const { auth } = require('express-oauth2-jwt-bearer');
```

#### Configuration Methods

**Method 1: Environment variables** (zero-config)

Set `ISSUER_BASE_URL` and `AUDIENCE` as environment variables, then call `auth()` with no arguments:

```javascript
// Reads ISSUER_BASE_URL and AUDIENCE from env
app.use(auth());
```

**Method 2: Direct configuration**

```javascript
app.use(auth({
  issuerBaseURL: 'https://your-tenant.auth0.com',
  audience: 'https://my-api.example.com',
}));
```

**Method 3: Symmetric algorithm (HS256)**

```javascript
app.use(auth({
  issuer: 'https://your-tenant.auth0.com/',
  audience: 'https://my-api.example.com',
  secret: 'YOUR_SECRET',
  tokenSigningAlg: 'HS256',
}));
```

#### AuthOptions

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `issuerBaseURL` | `string` | Yes* | `ISSUER_BASE_URL` env | OAuth2 issuer domain. Used to discover JWKS endpoint. |
| `audience` | `string` | Yes* | `AUDIENCE` env | API identifier. Token `aud` claim must match. |
| `issuer` | `string` | No | — | Token issuer (for symmetric algorithms). Use instead of `issuerBaseURL`. |
| `secret` | `string` | No | — | Shared secret for HS256 signing. |
| `tokenSigningAlg` | `string` | No | `'RS256'` | Expected token signing algorithm. |
| `authRequired` | `boolean` | No | `true` | If `false`, unauthenticated requests pass through (req.auth will be undefined). |
| `validators` | `object` | No | — | Override built-in validators (e.g., `{ iss: false }` to skip issuer check). |
| `strict` | `boolean` | No | `false` | Strict mode — rejects tokens with unrecognized claims. |
| `jwksUri` | `string` | No | Auto-discovered | Explicit JWKS URI (skips discovery). |
| `clockTolerance` | `number` | No | — | Clock skew tolerance in seconds for `exp` and `iat` validation. |

*Required unless corresponding environment variable is set.

## Middleware API

### requiredScopes(scopes)

Validates that the JWT `scope` claim contains **all** specified scopes. Returns 403 `insufficient_scope` if any scope is missing. Accepts a space-separated string or an array of strings.

```javascript
const { requiredScopes } = require('express-oauth2-jwt-bearer');
// Space-separated string (all required)
app.get('/api/data', checkJwt, requiredScopes('read:data write:data'), handler);
// Or array form
app.get('/api/data', checkJwt, requiredScopes(['read:data', 'write:data']), handler);
```

> **Important:** Do NOT pass multiple string arguments — `requiredScopes('a', 'b')` only checks the first scope. Use a space-separated string or an array instead.

### scopeIncludesAny(scopes)

Validates that the JWT `scope` claim contains **at least one** of the specified scopes. Returns 403 `insufficient_scope` if none match.

```javascript
const { scopeIncludesAny } = require('express-oauth2-jwt-bearer');
app.get('/api/data', checkJwt, scopeIncludesAny(['read:data', 'audit:read']), handler);
```

### claimEquals(claim, value)

Verifies a JWT claim equals a specific value. Returns 401 `invalid_token` on mismatch.

```javascript
const { claimEquals } = require('express-oauth2-jwt-bearer');
app.get('/api/org', checkJwt, claimEquals('org_id', 'org_123'), handler);
```

### claimIncludes(claim, ...values)

Verifies a JWT claim (string or array) includes **all** specified values. Returns 401 `invalid_token` if missing.

```javascript
const { claimIncludes } = require('express-oauth2-jwt-bearer');
app.get('/api/admin', checkJwt, claimIncludes('permissions', 'read:admin'), handler);
```

### claimCheck(fn)

Custom validation function receiving the JWT payload. Return `true` to allow, `false` to reject (401 `invalid_token`).

```javascript
const { claimCheck } = require('express-oauth2-jwt-bearer');
app.get('/api/premium', checkJwt, claimCheck((payload) => {
  return payload['https://myapp.com/plan'] === 'premium';
}), handler);
```

## Error Classes

| Class | HTTP Status | WWW-Authenticate error | When |
|-------|-------------|----------------------|------|
| `UnauthorizedError` | 401 | — | No token provided |
| `InvalidTokenError` | 401 | `invalid_token` | Token malformed, expired, wrong issuer/audience |
| `InsufficientScopeError` | 403 | `insufficient_scope` | Token missing required scopes |

All errors include `err.status` and `err.headers` per RFC 6750.

## Claims Reference

### Standard JWT Claims

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | `string` | Subject — unique user identifier |
| `iss` | `string` | Issuer — Auth0 tenant URL |
| `aud` | `string \| string[]` | Audience — API identifier |
| `exp` | `number` | Expiration time (Unix timestamp) |
| `iat` | `number` | Issued at (Unix timestamp) |
| `scope` | `string` | Space-separated OAuth2 scopes |
| `azp` | `string` | Authorized party — client ID that requested the token |

### Auth0-Specific Claims

| Claim | Type | Description |
|-------|------|-------------|
| `permissions` | `string[]` | Auth0 RBAC permissions (requires RBAC enabled on API) |
| `org_id` | `string` | Auth0 Organization ID |
| `org_name` | `string` | Auth0 Organization name |

### Custom Claims (Namespaced)

Custom claims added via Auth0 Actions use namespaced keys:

```javascript
// In Auth0 Action (post-login):
// api.accessToken.setCustomClaim('https://myapp.com/role', 'admin');

// In Express API:
const role = req.auth.payload['https://myapp.com/role'];
```

## Testing Checklist

- [ ] 401 returned when no Bearer token is provided
- [ ] 200 returned with a valid JWT for protected endpoints
- [ ] 403 returned when required scopes are missing
- [ ] 401 returned with an expired token
- [ ] 401 returned with a token signed by a different issuer
- [ ] 401 returned with a token for a different audience
- [ ] CORS preflight (OPTIONS) requests succeed
- [ ] Public endpoints remain accessible without tokens
- [ ] `req.auth.payload.permissions` accessible when Auth0 RBAC is enabled
- [ ] Error handler returns JSON (not HTML) for auth failures

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `UnauthorizedError: Unexpected 'iss' value` | Token issuer doesn't match configured domain | Decode token at jwt.io; verify `iss` matches `https://{AUTH0_DOMAIN}/` |
| `UnauthorizedError: Unexpected 'aud' value` | Audience mismatch | Verify `AUTH0_AUDIENCE` matches API Identifier exactly |
| `401 on all requests` | `.env` not loaded before middleware init | Move `require('dotenv').config()` to top of entry file |
| `403 insufficient_scope` | Token doesn't have required scopes | Define scopes in Auth0 API → Permissions tab; request scopes in token flow |
| `TypeError: Cannot read property 'sub' of undefined` | Accessing `req.auth` on public route | Use `authRequired: false` for optional auth, or check `req.auth` exists |
| `CORS errors in browser` | CORS not configured or configured after auth | Register `cors()` middleware BEFORE `auth()` |
| `Token expired` | Test tokens have short TTL | Request a fresh token; adjust `clockTolerance` for minor clock skew |

## Security Considerations

- **Validate audience** — always configure `audience` to prevent token reuse across APIs
- **Use RS256** (default) — asymmetric signing via JWKS; never share private keys
- **Add `helmet`** — `npm install helmet` for HTTP security headers
- **Rate limit** — consider `express-rate-limit` for API abuse prevention
- **No client secret** — this SDK uses JWKS public key validation; API config should never contain a client secret
- **HTTPS in production** — JWTs are bearer tokens; transport security is critical
- **Minimal scopes** — define granular permissions; avoid catch-all admin scopes
- **Custom error handler** — prevent leaking token details in error responses (the default Express handler includes `err.message` in HTML)
