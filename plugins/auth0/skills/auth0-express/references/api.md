# Auth0 Express SDK API Reference

Complete API reference for `@auth0/auth0-express`.

---

## `createAuth0(options?)`

Registers the Auth0 Express router. Call with `app.use()`.

```javascript
import { createAuth0 } from '@auth0/auth0-express';

app.use(createAuth0({
  domain: 'your-tenant.auth0.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  appBaseUrl: 'http://localhost:3000',
  sessionSecret: 'your-session-secret',
}));
```

All options can be set via environment variables instead — call `createAuth0()` with no arguments to rely entirely on env vars.

### Options

| Option | Env Var | Type | Description |
|--------|---------|------|-------------|
| `domain` | `AUTH0_DOMAIN` | `string` | Auth0 tenant domain (e.g. `tenant.auth0.com`) |
| `clientId` | `AUTH0_CLIENT_ID` | `string` | Application client ID |
| `clientSecret` | `AUTH0_CLIENT_SECRET` | `string` | Application client secret |
| `appBaseUrl` | `APP_BASE_URL` | `string` | Application base URL (e.g. `http://localhost:3000`) |
| `sessionSecret` | `AUTH0_SESSION_SECRET` | `string` | Secret for encrypting session cookies |
| `audience` | `AUTH0_AUDIENCE` | `string` | API audience for access tokens (optional) |
| `mountRoutes` | — | `boolean` | Mount `/auth/*` routes automatically (default: `true`) |
| `customFetch` | — | `function` | Custom fetch implementation for HTTP requests |

### Legacy Environment Variable Compatibility

For migration from `express-openid-connect`, these env var names are also supported (but `AUTH0_*` names are preferred):

| Legacy | Preferred |
|--------|-----------|
| `ISSUER_BASE_URL` | `AUTH0_DOMAIN` |
| `CLIENT_ID` | `AUTH0_CLIENT_ID` |
| `CLIENT_SECRET` | `AUTH0_CLIENT_SECRET` |
| `BASE_URL` | `APP_BASE_URL` |
| `SECRET` | `AUTH0_SESSION_SECRET` |

---

## Mounted Routes

When `mountRoutes: true` (default), these routes are registered automatically:

| Route | Description |
|-------|-------------|
| `GET /auth/login` | Initiates login; accepts `?returnTo=/path` query param |
| `GET /auth/logout` | Logs user out and redirects to `appBaseUrl` |
| `GET /auth/callback` | Handles OAuth callback (must be in Auth0 Allowed Callback URLs) |
| `POST /auth/backchannel-logout` | Receives back-channel logout tokens |

---

## `requireAuth(options?)`

Middleware that protects a route. Import from `@auth0/auth0-express`.

- For browser requests (accepts `text/html`): redirects to `/auth/login`
- For API requests (accepts `application/json` but not `text/html`): returns `401 Unauthorized`

```javascript
import { requireAuth } from '@auth0/auth0-express';

app.get('/protected', requireAuth(), handler);
app.get('/admin', requireAuth({ returnTo: '/admin' }), handler);
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `returnTo` | `string` | URL to return to after login (default: current request URL) |

---

## Claim Middleware

All claim middleware returns `403 Forbidden` when the check fails. Must be used after `requireAuth()`.

### `claimEquals(claim, value, options?)`

Validates that a specific claim equals an expected value.

```javascript
import { claimEquals } from '@auth0/auth0-express';

app.get('/admin', requireAuth(), claimEquals('role', 'admin'), handler);
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tokenType` | `'id' \| 'access'` | `'id'` | Which token's claims to check |

### `claimIncludes(claim, values, options?)`

Validates that a claim (array or space-separated string) includes the specified value(s). User needs at least one of the values when an array is passed.

```javascript
import { claimIncludes } from '@auth0/auth0-express';

app.delete('/users/:id', requireAuth(), claimIncludes('permissions', 'delete:users'), handler);
app.get('/admin', requireAuth(), claimIncludes('permissions', ['read:users', 'admin:all']), handler);
```

### `claimCheck(fn, options?)`

Validates claims using a custom function. Function receives `(claims, req)` and must return `true` to allow access.

```javascript
import { claimCheck } from '@auth0/auth0-express';

app.get('/premium',
  requireAuth(),
  claimCheck((claims) => claims.subscription === 'premium'),
  handler
);
```

---

## `req.auth0` Object

After `createAuth0()` is registered, `req.auth0` is available on all requests.

| Property | Type | Description |
|----------|------|-------------|
| `req.auth0.client` | `ServerClient` | Auth0 server client instance |
| `req.auth0.config` | `object` | SDK configuration (includes `appBaseUrl`) |

### `req.auth0.client` Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getUser()` | `Promise<User \| undefined>` | User profile from ID token claims |
| `getSession()` | `Promise<Session \| undefined>` | Full session object |
| `getAccessToken()` | `Promise<{ accessToken: string }>` | Access token (requires `audience` configured) |
| `startInteractiveLogin(options)` | `Promise<URL>` | Returns authorization URL for custom login |
| `completeInteractiveLogin(url)` | `Promise<void>` | Completes callback for custom login |
| `logout(options)` | `Promise<URL>` | Returns logout URL for custom logout |

---

## Complete Application Example

```javascript
import 'dotenv/config';
import express from 'express';
import { createAuth0, requireAuth, claimIncludes } from '@auth0/auth0-express';

const app = express();
app.set('view engine', 'ejs');

// Register Auth0 (reads from env vars)
app.use(createAuth0());

// Public route
app.get('/', async (req, res) => {
  const user = await req.auth0.client.getUser();
  res.render('home', { user });
});

// Protected route
app.get('/profile', requireAuth(), async (req, res) => {
  const user = await req.auth0.client.getUser();
  res.render('profile', { user });
});

// RBAC - requires 'admin' permission in token
app.get('/admin',
  requireAuth(),
  claimIncludes('permissions', 'admin:read'),
  async (req, res) => {
    res.render('admin');
  }
);

// Call external API
app.get('/data', requireAuth(), async (req, res) => {
  const { accessToken } = await req.auth0.client.getAccessToken();
  const response = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  res.json(await response.json());
});

app.listen(3000, () => console.log('Running on http://localhost:3000'));
```

---

## References

- [@auth0/auth0-express GitHub](https://github.com/auth0/auth0-express)
- [@auth0/auth0-express npm](https://www.npmjs.com/package/@auth0/auth0-express)
- [Auth0 Express Quickstart](https://auth0.com/docs/quickstart/webapp/express)
