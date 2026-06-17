# Auth0 Express API SDK Integration Patterns

API protection patterns for Express.js using `@auth0/auth0-express-api`.

---

## Basic Protected Endpoint

```javascript
import { requiresAuth } from '@auth0/auth0-express-api';

app.get('/api/private', requiresAuth(), (req, res) => {
  res.json({ message: `Hello, ${req.auth0.user.sub}` });
});
```

`requiresAuth()` returns `401 Unauthorized` if the token is missing, expired, or invalid.

---

## Scope-Based Authorization

### Require All Scopes

```javascript
app.get('/api/admin/edit',
  requiresAuth({ scopes: ['read:admin', 'write:admin'] }),
  (req, res) => {
    res.json({ message: 'Full admin access' });
  }
);
```

### Flexible Scope Matching with `scopesInclude`

```javascript
import { requiresAuth, scopesInclude } from '@auth0/auth0-express-api';

// Match ANY of the provided scopes (default)
app.get('/api/messages',
  requiresAuth(),
  scopesInclude('read:messages read:admin'),
  (req, res) => {
    res.json({ messages: [] });
  }
);

// Match ALL of the provided scopes
app.get('/api/admin/edit',
  requiresAuth(),
  scopesInclude('read:admin write:admin', { match: 'all' }),
  (req, res) => {
    res.json({ success: true });
  }
);

// Array syntax also supported
app.get('/api/messages', requiresAuth(), scopesInclude(['read:messages', 'read:admin']), handler);
```

---

## Claim-Based Authorization

### `claimEquals` — Exact value check

```javascript
import { requiresAuth, claimEquals } from '@auth0/auth0-express-api';

app.get('/api/admin', requiresAuth(), claimEquals('isAdmin', true), handler);
app.get('/api/vip', requiresAuth(), claimEquals('tier', 'premium'), handler);
app.get('/api/level', requiresAuth(), claimEquals('level', 5), handler);
```

### `claimIncludes` — Array/string contains values

```javascript
import { requiresAuth, claimIncludes } from '@auth0/auth0-express-api';

// Check for a single value
app.delete('/api/users/:id',
  requiresAuth(),
  claimIncludes('roles', ['admin']),
  handler
);

// Check for multiple values (user must have ALL)
app.get('/api/admin/users',
  requiresAuth(),
  claimIncludes('roles', ['admin', 'editor']),
  handler
);
```

### `claimCheck` — Custom validation logic

```javascript
import { requiresAuth, claimCheck } from '@auth0/auth0-express-api';

app.get('/api/premium',
  requiresAuth(),
  claimCheck(
    (token) => token.tier === 'premium' || token.roles?.includes('admin'),
    { errorMessage: 'Premium tier or admin role required' }
  ),
  handler
);
```

The validation function receives the full token payload and must return `true` to grant access.

All claim middleware returns `401 Forbidden` when the check fails. Always use after `requiresAuth()`.

---

## Accessing Token Claims

After `requiresAuth()`, `req.auth0.user` contains the decoded JWT payload:

```javascript
app.get('/api/me', requiresAuth(), (req, res) => {
  const { sub, email, permissions } = req.auth0.user;
  res.json({ sub, email, permissions });
});
```

---

## Custom Token Type (TypeScript)

Extend the `Token` interface to get typed access to custom claims:

```typescript
declare module '@auth0/auth0-express-api' {
  interface Token {
    tier: string;
    roles: string[];
  }
}

app.get('/api/profile', requiresAuth(), (req, res) => {
  const { tier, roles } = req.auth0.user; // fully typed
  res.json({ tier, roles });
});
```

---

## CORS Configuration

Add CORS middleware **before** `createAuth0Api()` so preflight OPTIONS requests are handled correctly:

```javascript
import cors from 'cors';
import { createAuth0Api } from '@auth0/auth0-express-api';

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(createAuth0Api());
```

Without this, browser preflight requests will receive `401` before CORS headers are set.

---

## Error Handling

```javascript
app.use((err, req, res, next) => {
  if (err.status === 401) {
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
  if (err.status === 403) {
    return res.status(403).json({ error: 'Forbidden', message: err.message });
  }
  res.status(500).json({ error: 'Internal Server Error' });
});
```

---

## Testing with curl

```bash
# Get test token from Auth0 Dashboard → APIs → your API → Test tab

# 1. Verify 401 without token
curl -v http://localhost:3000/api/private

# 2. Verify 200 with valid token
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/private

# 3. Verify 403 with valid token but missing scope
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/admin

# 4. Verify CORS preflight
curl -v -X OPTIONS http://localhost:3000/api/private \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `401` — audience mismatch | `AUTH0_AUDIENCE` must match the API Identifier exactly |
| `401` — `req.auth0` undefined | Verify `createAuth0Api()` runs before the route handler |
| OPTIONS requests returning `401` | Add `cors()` middleware before `createAuth0Api()` |
| Claim check returning `403` unexpectedly | Log `req.auth0.user` to inspect the actual token claims |
| `.env` not loading | `import 'dotenv/config'` must be the first import |

---

## Next Steps

- [API Reference](api.md)
- [Setup Guide](setup.md)
- [Main Skill](../SKILL.md)
