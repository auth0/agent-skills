# Auth0 Express API SDK API Reference

Complete API reference for `@auth0/auth0-express-api`.

---

## `createAuth0Api(options?)`

Registers the Auth0 API middleware. Call with `app.use()`.

```javascript
import { createAuth0Api } from '@auth0/auth0-express-api';

app.use(createAuth0Api({
  domain: 'your-tenant.auth0.com',
  audience: 'https://your-api-identifier',
}));
```

All options can be set via environment variables — call `createAuth0Api()` with no arguments to rely entirely on env vars.

### Options

| Option | Env Var | Type | Description |
|--------|---------|------|-------------|
| `domain` | `AUTH0_DOMAIN` | `string` | Auth0 tenant domain (e.g. `tenant.auth0.com`) |
| `audience` | `AUTH0_AUDIENCE` | `string` | API Identifier from Auth0 Dashboard |
| `clientId` | `AUTH0_CLIENT_ID` | `string` | Application client ID (optional) |
| `clientSecret` | `AUTH0_CLIENT_SECRET` | `string` | Application client secret (optional) |
| `clientAssertionSigningKey` | `AUTH0_CLIENT_ASSERTION_SIGNING_KEY` | `string` | Private key for client assertion (optional) |
| `clientAssertionSigningAlg` | — | `string` | Signing algorithm for client assertion (e.g. `RS256`) |
| `customFetch` | — | `function` | Custom fetch implementation for HTTP requests |

### Legacy Environment Variable Compatibility

| Legacy | Preferred |
|--------|-----------|
| `ISSUER_BASE_URL` | `AUTH0_DOMAIN` |
| `AUDIENCE` | `AUTH0_AUDIENCE` |

---

## `requireAuth(options?)`

Validates the JWT Bearer token in the `Authorization` header. Returns `401 Unauthorized` if the token is missing, expired, or invalid.

```javascript
import { requireAuth } from '@auth0/auth0-express-api';

app.get('/api/private', requireAuth(), handler);

// Require specific scopes (all must be present)
app.get('/api/admin', requireAuth({ scopes: ['read:admin', 'write:admin'] }), handler);
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `scopes` | `string[]` | Array of scopes; all must be present in the token |

---

## `scopesInclude(scopes, options?)`

Validates token has the required scopes. Must be used after `requireAuth()`.

```javascript
import { scopesInclude } from '@auth0/auth0-express-api';

// Match ANY scope (default)
app.get('/api/data', requireAuth(), scopesInclude('read:data read:admin'), handler);

// Match ALL scopes
app.get('/api/admin', requireAuth(), scopesInclude('read:admin write:admin', { match: 'all' }), handler);

// Array syntax
app.get('/api/data', requireAuth(), scopesInclude(['read:data', 'read:admin']), handler);
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `match` | `'any' \| 'all'` | `'any'` | Whether to require any or all of the provided scopes |

Returns `403 Forbidden` if scope requirements are not met.

---

## `claimEquals(claim, value)`

Validates that a specific claim equals an expected value. Returns `403 Forbidden` on mismatch.

```javascript
import { claimEquals } from '@auth0/auth0-express-api';

app.get('/admin', requireAuth(), claimEquals('isAdmin', true), handler);
app.get('/vip', requireAuth(), claimEquals('tier', 'premium'), handler);
app.get('/level5', requireAuth(), claimEquals('level', 5), handler);
```

Supports string, number, and boolean values.

---

## `claimIncludes(claim, values)`

Validates that a claim (array or space-separated string) includes all of the specified values. Returns `403 Forbidden` if any value is missing.

```javascript
import { claimIncludes } from '@auth0/auth0-express-api';

app.delete('/users/:id', requireAuth(), claimIncludes('roles', ['admin']), handler);
app.get('/admin/edit', requireAuth(), claimIncludes('roles', ['admin', 'editor']), handler);
```

---

## `claimCheck(fn, options?)`

Custom claim validation. The function receives the full token payload and must return `true` to grant access. Returns `403 Forbidden` when function returns false.

```javascript
import { claimCheck } from '@auth0/auth0-express-api';

app.get('/premium',
  requireAuth(),
  claimCheck(
    (token) => token.tier === 'premium' || token.roles?.includes('admin'),
    { errorMessage: 'Premium or admin required' }
  ),
  handler
);
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `errorMessage` | `string` | Custom error message returned on failure |

---

## `req.auth0` Object

After `createAuth0Api()` is registered and `requireAuth()` validates the token, `req.auth0` is available.

| Property | Type | Description |
|----------|------|-------------|
| `req.auth0.user` | `Token` | Decoded JWT payload |
| `req.auth0.client` | `ApiClient` | Auth0 API client instance |

### Token Claims (`req.auth0.user`)

Standard JWT claims plus any custom claims from your Auth0 rules/actions:

```javascript
req.auth0.user.sub          // Subject (user ID)
req.auth0.user.iss          // Issuer
req.auth0.user.aud          // Audience
req.auth0.user.exp          // Expiration timestamp
req.auth0.user.permissions  // Permissions array (from Auth0 RBAC)
req.auth0.user.scope        // Space-separated scopes string
```

### Custom Token Types (TypeScript)

```typescript
declare module '@auth0/auth0-express-api' {
  interface Token {
    tier: string;
    roles: string[];
    org_id: string;
  }
}
```

---

## Complete Application Example

```javascript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createAuth0Api, requireAuth, scopesInclude, claimIncludes } from '@auth0/auth0-express-api';

const app = express();
app.use(express.json());

// CORS before auth middleware
app.use(cors({ origin: process.env.FRONTEND_URL }));

// Auth0 API setup (reads from env vars)
app.use(createAuth0Api());

// Public endpoint
app.get('/api/public', (req, res) => {
  res.json({ message: 'Public data' });
});

// Protected endpoint
app.get('/api/private', requireAuth(), (req, res) => {
  res.json({ sub: req.auth0.user.sub });
});

// Scope-based access
app.get('/api/messages',
  requireAuth(),
  scopesInclude('read:messages'),
  (req, res) => {
    res.json({ messages: [] });
  }
);

// RBAC - require admin permission
app.delete('/api/users/:id',
  requireAuth(),
  claimIncludes('permissions', ['delete:users']),
  (req, res) => {
    res.json({ deleted: req.params.id });
  }
);

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));
```

---

## SDK Architecture

`@auth0/auth0-express-api` wraps `@auth0/auth0-api-js` for Express-specific middleware integration. You only need to install and import `@auth0/auth0-express-api`.

---

## References

- [@auth0/auth0-express-api on npm](https://www.npmjs.com/package/@auth0/auth0-express-api)
- [GitHub: auth0/auth0-express](https://github.com/auth0/auth0-express)
- [Auth0 Node.js API Quickstart](https://auth0.com/docs/quickstart/backend/nodejs/interactive)
- [Auth0 APIs Dashboard](https://manage.auth0.com/#/apis)
