# Auth0 Express Integration Patterns

Server-side authentication patterns for Express.js.

---

## Protected Routes

### Single Route

```javascript
const { requiresAuth } = require('express-openid-connect');

app.get('/admin', requiresAuth(), (req, res) => {
  res.send(`Admin: ${req.oidc.user.name}`);
});
```

### Multiple Routes

```javascript
// Protect all /admin routes
app.use('/admin', requiresAuth());

app.get('/admin/dashboard', (req, res) => {
  res.send('Dashboard');
});

app.get('/admin/settings', (req, res) => {
  res.send('Settings');
});
```

### Require Auth Globally

```javascript
app.use(auth({
  authRequired: true  // All routes require authentication
}));

// Make specific routes public
app.get('/public', (req, res) => {
  res.send('Public page');
});
```

---

## Calling APIs

### Get Access Token

```javascript
app.get('/api-call', requiresAuth(), async (req, res) => {
  const { access_token } = req.oidc.accessToken;

  const response = await fetch('https://your-api.com/data', {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  const data = await response.json();
  res.json(data);
});
```

Configure audience in middleware:

```javascript
app.use(auth({
  authorizationParams: {
    audience: 'https://your-api-identifier'
  },
  // ... other config
}));
```

---

## Custom Login/Logout

### Custom Login Handler

```javascript
app.get('/custom-login', (req, res) => {
  res.oidc.login({
    returnTo: '/dashboard',
    authorizationParams: {
      connection: 'google-oauth2'
    }
  });
});
```

### Custom Logout Handler

```javascript
app.get('/custom-logout', (req, res) => {
  res.oidc.logout({
    returnTo: '/goodbye'
  });
});
```

---

## Silent Authentication

### Automatic Silent Login

Check if user is already authenticated at their IDP without forcing a login prompt.

```javascript
const { auth, attemptSilentLogin } = require('express-openid-connect');

app.use(auth({
  authRequired: false
}));

// Try silent authentication on first visit
app.use(attemptSilentLogin());

// Your routes
app.get('/', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.send(`Welcome back, ${req.oidc.user.name}!`);
  } else {
    res.send('Not logged in <a href="/login">Login</a>');
  }
});
```

**How it works:**
- On the user's first visit, redirects to Auth0 with `prompt=none`
- If user has active IDP session, they're silently logged in
- If not, they see your page as anonymous
- Uses a cookie to prevent repeated silent login attempts

**Use cases:**
- Show login/logout button based on IDP session status
- Pre-authenticate users who have existing IDP sessions
- Provide seamless experience for returning users

---

## Session Management

### Access User Info

```javascript
app.get('/user', requiresAuth(), (req, res) => {
  res.json({
    isAuthenticated: req.oidc.isAuthenticated(),
    user: req.oidc.user,
    idToken: req.oidc.idToken,
    accessToken: req.oidc.accessToken
  });
});
```

### Refresh Tokens

Request refresh tokens by including `offline_access` scope:

```javascript
app.use(auth({
  authorizationParams: {
    scope: 'openid profile email offline_access'
  }
}));
```

**Automatic Token Refresh:**

The `req.oidc.accessToken` object includes methods to check expiration and refresh:

```javascript
app.get('/api', requiresAuth(), async (req, res) => {
  let { access_token, isExpired, refresh } = req.oidc.accessToken;

  // Check if token is expired
  if (isExpired()) {
    // Automatically refresh and get new token
    const result = await refresh());
    access_token = result.access_token;
  }

  // Use fresh access token
  const response = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${access_token}` }
  });

  res.json(await response.json());
});
```

**Manual Refresh Token Access:**

```javascript
app.get('/refresh-info', requiresAuth(), (req, res) => {
  const refreshToken = req.oidc.refreshToken;
  res.json({ hasRefreshToken: !!refreshToken });
});
```

---

## Claim-Based Authorization

Require specific claim values for route access.

### Require Specific Claim Value

```javascript
const { claimEquals } = require('express-openid-connect');

// Only users with specific role
app.get('/admin', claimEquals('role', 'admin'), (req, res) => {
  res.send('Admin dashboard');
});

// Only users from specific organization
app.get('/org', claimEquals('org_id', 'org_123'), (req, res) => {
  res.send('Organization page');
});
```

### Require Multiple Claim Values

```javascript
const { claimIncludes } = require('express-openid-connect');

// Require specific permissions (space-separated string or array)
app.get('/api/write', claimIncludes('permissions', 'read:data', 'write:data'), (req, res) => {
  res.send('Write access granted');
});

// Require specific scopes
app.get('/api/data', claimIncludes('scope', 'read:data'), (req, res) => {
  res.json({ data: 'sensitive information' });
});
```

### Custom Claim Validation

```javascript
const { claimCheck } = require('express-openid-connect');

// Custom validation logic
app.get('/premium', claimCheck((req, claims) => {
  // Return true to allow access, false to deny
  return claims.subscription === 'premium' && claims.age >= 18;
}), (req, res) => {
  res.send('Premium content for adults');
});

// Complex validation
app.get('/feature', claimCheck((req, claims) => {
  const hasPermission = claims.permissions?.includes('feature:access');
  const isVerified = claims.email_verified === true;
  return hasPermission && isVerified;
}), (req, res) => {
  res.send('Feature access');
});
```

---

## Fetching Additional User Info

Fetch additional user information from the `/userinfo` endpoint:

```javascript
app.get('/userinfo', requiresAuth(), async (req, res) => {
  try {
    // Fetch additional user info from Auth0
    const userInfo = await req.oidc.fetchUserInfo();
    res.json(userInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Note:** This requires an access token. Ensure your auth configuration includes:

```javascript
app.use(auth({
  authorizationParams: {
    response_type: 'code',  // Code flow provides access token
    scope: 'openid profile email'
  }
}));
```

---

## Error Handling

```javascript
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).send('Unauthorized');
  } else {
    next(err);
  }
});
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid state" | Regenerate SECRET |
| Session not persisting | Check cookie settings, use HTTPS in production |
| Redirect loop | Set `authRequired: false` - default is `true` |
| Callback URL mismatch | Verify callback URL matches Auth0 config |

---

## Next Steps

- [API Reference](api.md)
- [Setup Guide](setup.md)
- [Main Skill](../SKILL.md)
