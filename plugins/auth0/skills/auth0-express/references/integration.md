# Auth0 Express SDK Integration Patterns

Server-side authentication patterns for Express.js using `@auth0/auth0-express`.

---

## Protected Routes

### Using requiresAuth Middleware

`requiresAuth()` protects routes automatically:
- For HTML requests (browsers): redirects to `/auth/login` with a `returnTo` parameter
- For API requests (those accepting JSON but not HTML): returns `401 Unauthorized`

```javascript
import { requiresAuth } from '@auth0/auth0-express';

// Protects a page route - browser is redirected to login
app.get('/profile', requiresAuth(), async (req, res) => {
  const user = await req.auth0.client.getUser();
  res.render('profile', { user });
});

// Custom return URL after login
app.get('/admin', requiresAuth({ returnTo: '/admin/dashboard' }), (req, res) => {
  res.send('Admin page');
});
```

### Using Custom Middleware

For fine-grained control, build your own middleware:

```javascript
async function requireSession(req, res, next) {
  const session = await req.auth0.client.getSession();
  if (!session) {
    return res.redirect('/auth/login');
  }
  next();
}

app.get('/protected', requireSession, async (req, res) => {
  const user = await req.auth0.client.getUser();
  res.render('page', { user });
});
```

---

## Accessing User Information

```javascript
app.get('/dashboard', requiresAuth(), async (req, res) => {
  // Get user profile from ID token
  const user = await req.auth0.client.getUser();

  // Get full session object
  const session = await req.auth0.client.getSession();

  res.render('dashboard', { user, session });
});
```

`getUser()` returns `undefined` if the user is not authenticated.

---

## Calling External APIs (Access Tokens)

To get an access token for a downstream API, set the `audience` when registering the router:

```javascript
app.use(createAuth0({
  audience: process.env.AUTH0_AUDIENCE, // or set AUTH0_AUDIENCE env var
}));
```

Then retrieve the token in a route:

```javascript
app.get('/call-api', requiresAuth(), async (req, res) => {
  const { accessToken } = await req.auth0.client.getAccessToken();

  const response = await fetch('https://your-api.com/data', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  res.json(await response.json());
});
```

Add `AUTH0_AUDIENCE=https://your-api-identifier` to your `.env`.

---

## Authorization with Claims

The SDK provides claim-based authorization middleware for RBAC.

### claimEquals — Check exact claim value

```javascript
import { requiresAuth, claimEquals } from '@auth0/auth0-express';

// Only allow users with role 'admin' (from ID token by default)
app.get('/admin', requiresAuth(), claimEquals('role', 'admin'), handler);

// Check access token claims instead
app.get('/admin', requiresAuth(), claimEquals('role', 'admin', { tokenType: 'access' }), handler);
```

### claimIncludes — Check claim array contains value(s)

```javascript
import { requiresAuth, claimIncludes } from '@auth0/auth0-express';

// User needs 'delete:users' permission
app.delete('/users/:id',
  requiresAuth(),
  claimIncludes('permissions', 'delete:users'),
  handler
);

// User needs at least one of multiple permissions
app.get('/admin/users',
  requiresAuth(),
  claimIncludes('permissions', ['read:users', 'admin:all']),
  handler
);
```

### claimCheck — Custom claim validation

```javascript
import { requiresAuth, claimCheck } from '@auth0/auth0-express';

app.get('/premium',
  requiresAuth(),
  claimCheck((claims) => claims.subscription === 'premium' && claims.email_verified === true),
  handler
);

// With access to request params
app.get('/org/:orgId/settings',
  requiresAuth(),
  claimCheck((claims, req) => claims.org_id === req.params.orgId && claims.org_role === 'owner'),
  handler
);
```

Claim middleware returns:
- `403 Forbidden` for HTML requests when authorization fails
- `403 Forbidden` with JSON error for API requests

---

## Custom Login/Logout Routes

When `mountRoutes: false` is set, implement routes manually:

```javascript
app.use(createAuth0({ mountRoutes: false }));

app.get('/custom/login', async (req, res) => {
  const authorizationUrl = await req.auth0.client.startInteractiveLogin({
    authorizationParams: {
      redirect_uri: 'http://localhost:3000/custom/callback',
    }
  });
  res.redirect(authorizationUrl.href);
});

app.get('/custom/callback', async (req, res) => {
  await req.auth0.client.completeInteractiveLogin(
    new URL(req.url, req.auth0.config.appBaseUrl)
  );
  res.redirect('/');
});

app.get('/custom/logout', async (req, res) => {
  const logoutUrl = await req.auth0.client.logout({ returnTo: 'http://localhost:3000' });
  res.redirect(logoutUrl.href);
});
```

---

## HTML Login/Logout Links

When using built-in mounted routes:

```html
<a href="/auth/login">Log in</a>
<a href="/auth/login?returnTo=/dashboard">Log in to dashboard</a>
<a href="/auth/logout">Log out</a>
```

---

## Template Rendering (EJS Example)

```bash
npm install ejs
```

```javascript
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
  const user = await req.auth0.client.getUser();
  res.render('index', { user });
});
```

```html
<!-- views/index.ejs -->
<% if (user) { %>
  <h1>Welcome, <%= user.name %>!</h1>
  <a href="/auth/logout">Logout</a>
<% } else { %>
  <a href="/auth/login">Login</a>
<% } %>
```

---

## Error Handling

```javascript
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| `getUser()` returns `undefined` | Route not protected with `requiresAuth()` or user not logged in |
| Redirect after login goes to wrong page | Use `?returnTo=/path` on `/auth/login` link or `requiresAuth({ returnTo })` |
| Callback URL mismatch | Register `http://localhost:3000/auth/callback` in Auth0 Dashboard |
| Access token missing | Set `audience` in `createAuth0()` config or `AUTH0_AUDIENCE` env var |
| Session not persisting | Verify `AUTH0_SESSION_SECRET` is set and consistent across restarts |

---

## Next Steps

- [API Reference](api.md)
- [Setup Guide](setup.md)
- [Main Skill](../SKILL.md)
