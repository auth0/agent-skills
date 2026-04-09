# Integration Patterns

## Basic JWT Validation

The `auth()` middleware validates JWT Bearer tokens on every request. Attach it globally or per-route.

### Global Protection (all routes require auth)

```javascript
const { auth } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// All routes after this require a valid JWT
app.use(checkJwt);
```

### Per-Route Protection

```javascript
const { auth } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// Public — no middleware
app.get('/api/public', (req, res) => {
  res.json({ message: 'No auth required' });
});

// Protected — checkJwt middleware
app.get('/api/private', checkJwt, (req, res) => {
  res.json({ message: 'Authenticated', sub: req.auth.payload.sub });
});
```

### Optional Authentication

Use `authRequired: false` for routes where authentication is optional:

```javascript
const optionalAuth = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
  authRequired: false,
});

app.get('/api/mixed', optionalAuth, (req, res) => {
  if (req.auth) {
    res.json({ message: `Hello ${req.auth.payload.sub}` });
  } else {
    res.json({ message: 'Hello anonymous' });
  }
});
```

## Scope-Based Authorization

Use `requiredScopes()` to enforce OAuth2 scopes. The middleware checks the `scope` claim in the JWT payload.

```javascript
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// Requires "read:messages" scope
app.get('/api/messages', checkJwt, requiredScopes('read:messages'), (req, res) => {
  res.json({ messages: [] });
});

// Requires both "read:messages" AND "write:messages" scopes
app.post('/api/messages', checkJwt, requiredScopes('read:messages write:messages'), (req, res) => {
  res.json({ created: true });
});
```

### scopeIncludesAny — Require at Least One Scope

```javascript
const { auth, scopeIncludesAny } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// Requires either "read:messages" OR "audit:read"
app.get('/api/messages', checkJwt, scopeIncludesAny(['read:messages', 'audit:read']), (req, res) => {
  res.json({ messages: [] });
});
```

## RBAC Permissions (Auth0-Specific)

Auth0 RBAC uses the `permissions` claim (an array), not the `scope` claim. Enable RBAC in your API settings (Auth0 Dashboard → APIs → your API → Settings → Enable RBAC + Add Permissions in the Access Token).

```javascript
const { auth, claimIncludes, claimCheck } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// Check single permission
app.get('/api/admin', checkJwt, claimIncludes('permissions', 'read:admin'), (req, res) => {
  res.json({ admin: true });
});

// Check multiple permissions with custom logic
app.delete('/api/users/:id', checkJwt, claimCheck((payload) => {
  const permissions = payload.permissions || [];
  return permissions.includes('delete:users') && permissions.includes('admin:all');
}), (req, res) => {
  res.json({ deleted: true });
});

// Access permissions directly
app.get('/api/profile', checkJwt, (req, res) => {
  const permissions = req.auth.payload.permissions || [];
  res.json({
    sub: req.auth.payload.sub,
    permissions,
    canEdit: permissions.includes('edit:profile'),
  });
});
```

## Custom Claim Validation

### claimEquals — Exact Match

```javascript
const { auth, claimEquals } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// Require specific organization
app.get('/api/org-data', checkJwt, claimEquals('org_id', 'org_123abc'), (req, res) => {
  res.json({ data: 'org-specific' });
});
```

### claimIncludes — Contains Value

```javascript
// Require user has specific role in custom claim
app.get('/api/admin', checkJwt, claimIncludes('https://myapp.com/roles', 'admin'), (req, res) => {
  res.json({ admin: true });
});
```

### claimCheck — Custom Validation Function

```javascript
// Complex custom validation
app.get('/api/premium', checkJwt, claimCheck((payload) => {
  return payload['https://myapp.com/plan'] === 'premium' &&
         new Date(payload['https://myapp.com/subscription_end']) > new Date();
}), (req, res) => {
  res.json({ premium: true });
});
```

## Accessing User Claims

After successful authentication, JWT claims are available on `req.auth.payload`:

```javascript
app.get('/api/profile', checkJwt, (req, res) => {
  const { sub, scope, aud, iss, exp, iat } = req.auth.payload;
  const permissions = req.auth.payload.permissions || [];
  const email = req.auth.payload['https://myapp.com/email'];

  res.json({
    userId: sub,
    scopes: scope ? scope.split(' ') : [],
    permissions,
    email,
    tokenExpires: new Date(exp * 1000).toISOString(),
  });
});
```

## CORS Configuration

CORS must be configured **before** the auth middleware. Expose the `WWW-Authenticate` header so clients can read authentication error details.

```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  exposedHeaders: ['WWW-Authenticate'],
}));

// Auth middleware AFTER cors
app.use(checkJwt);
```

## DPoP Support (RFC 9449)

DPoP (Demonstration of Proof-of-Possession) binds access tokens to a client's key pair, preventing token theft/replay. The `express-oauth2-jwt-bearer` SDK has built-in DPoP support.

By default, the SDK accepts both DPoP-bound and standard Bearer tokens. No additional configuration is needed — when a client sends a DPoP proof header alongside a DPoP-bound access token, the SDK validates both automatically.

```javascript
const { auth } = require('express-oauth2-jwt-bearer');

// Accepts both DPoP and standard Bearer tokens (default behavior)
const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});
```

> **Note:** DPoP enforcement modes (allowed, required, disabled) and timing options (`iatOffset`, `iatLeeway`) are configured via the SDK's DPoP options. See the [express-oauth2-jwt-bearer API docs](https://auth0.github.io/node-oauth2-jwt-bearer/) for the full DPoP configuration API.

## Error Handling

The SDK raises errors with `err.status` and `err.headers` per RFC 6750. Implement a custom error handler to avoid leaking sensitive details in production.

```javascript
const { UnauthorizedError, InvalidTokenError, InsufficientScopeError } = require('express-oauth2-jwt-bearer');

app.use((err, req, res, next) => {
  if (err instanceof InsufficientScopeError) {
    res.status(403).json({
      error: 'insufficient_scope',
      error_description: 'You do not have the required permissions',
    });
  } else if (err instanceof InvalidTokenError) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'The provided token is invalid or expired',
    });
  } else if (err instanceof UnauthorizedError) {
    res.status(401).json({
      error: 'unauthorized',
      error_description: 'A valid access token is required',
    });
  } else {
    next(err);
  }
});
```

## Complete Example Server

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { auth, requiredScopes, claimCheck } = require('express-oauth2-jwt-bearer');

const app = express();

// Security headers
app.use(helmet());

// CORS — BEFORE auth
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  allowedHeaders: ['Authorization', 'Content-Type'],
  exposedHeaders: ['WWW-Authenticate'],
}));

app.use(express.json());

// JWT validation middleware
const checkJwt = auth({
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  audience: process.env.AUTH0_AUDIENCE,
});

// Public
app.get('/api/public', (req, res) => {
  res.json({ message: 'Public endpoint' });
});

// Protected
app.get('/api/private', checkJwt, (req, res) => {
  res.json({ message: 'Protected', sub: req.auth.payload.sub });
});

// Scope-protected
app.get('/api/messages', checkJwt, requiredScopes('read:messages'), (req, res) => {
  res.json({ messages: [] });
});

// Permission-protected (Auth0 RBAC)
app.get('/api/admin', checkJwt, claimCheck((payload) => {
  return (payload.permissions || []).includes('read:admin');
}), (req, res) => {
  res.json({ admin: true });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.status) {
    res.status(err.status).json({
      error: err.code || 'auth_error',
      message: process.env.NODE_ENV === 'production'
        ? 'Authentication error'
        : err.message,
    });
  } else {
    next(err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));

module.exports = app;
```

## Testing

### Manual Testing with curl

```bash
# 1. Get a test token
auth0 test token --audience https://my-api.example.com --scopes "read:messages"

# 2. Test public endpoint
curl http://localhost:3000/api/public

# 3. Test protected endpoint (no token → 401)
curl -i http://localhost:3000/api/private

# 4. Test protected endpoint (valid token → 200)
curl http://localhost:3000/api/private \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Test scope-protected endpoint
curl http://localhost:3000/api/messages \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Integration Testing with Supertest

```javascript
const request = require('supertest');
const app = require('./app');

describe('API', () => {
  it('returns 200 on public endpoint', async () => {
    await request(app).get('/api/public').expect(200);
  });

  it('returns 401 on protected endpoint without token', async () => {
    await request(app).get('/api/private').expect(401);
  });

  it('returns 200 on protected endpoint with valid token', async () => {
    const token = process.env.TEST_TOKEN;
    await request(app)
      .get('/api/private')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

## Security Considerations

- **Never log tokens** — access tokens contain sensitive information
- **Use HTTPS in production** — JWTs are bearer tokens; anyone with the token can use it
- **Set minimal scopes** — request only the scopes your API needs
- **Add `helmet`** — for HTTP security headers
- **Validate audience** — always set the `audience` option to prevent token misuse across APIs
- **CORS before auth** — register CORS middleware before auth middleware in Express
- **No client secret** — this SDK validates JWTs via JWKS public keys; never store a client secret in API config
