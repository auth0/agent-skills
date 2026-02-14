# Auth0 Vanilla JavaScript API Reference

Complete reference for the Auth0 SPA JS SDK in vanilla JavaScript applications.

---

## Auth0Client Configuration

### Initialization

```javascript
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0Client = new Auth0Client({
  domain: 'your-tenant.auth0.com',        // Required
  clientId: 'your-client-id',              // Required
  authorizationParams: {
    redirect_uri: window.location.origin, // Required
    audience: 'https://your-api',         // Optional
    scope: 'openid profile email',         // Optional
  },
  cacheLocation: 'memory',                 // Optional
  useRefreshTokens: false,                 // Optional
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `domain` | string | Required | Your Auth0 tenant domain |
| `clientId` | string | Required | Your application client ID |
| `authorizationParams.redirect_uri` | string | Required | Callback URL after authentication |
| `authorizationParams.audience` | string | undefined | API identifier for access tokens |
| `authorizationParams.scope` | string | `'openid profile email'` | OAuth scopes |
| `cacheLocation` | string | `'memory'` | Token cache location |
| `useRefreshTokens` | boolean | false | Enable refresh tokens |

---

## Core Methods

### loginWithRedirect()

Redirect user to Auth0 login:

```javascript
await auth0Client.loginWithRedirect({
  authorizationParams: {
    redirect_uri: window.location.origin,
    screen_hint: 'signup', // Optional: show signup
    prompt: 'login'        // Optional: force re-auth
  }
});
```

### handleRedirectCallback()

Handle return from Auth0:

```javascript
const { appState } = await auth0Client.handleRedirectCallback();
console.log(appState); // Custom state passed to login

// Clean up URL
window.history.replaceState({}, document.title, window.location.pathname);
```

### isAuthenticated()

Check authentication status:

```javascript
const authenticated = await auth0Client.isAuthenticated();
console.log(authenticated); // true or false
```

### getUser()

Get user profile:

```javascript
const user = await auth0Client.getUser();
console.log(user);
// {
//   sub: 'auth0|123456',
//   name: 'John Doe',
//   email: 'john@example.com',
//   picture: 'https://...',
//   email_verified: true
// }
```

### getTokenSilently()

Get access token:

```javascript
try {
  const token = await auth0Client.getTokenSilently({
    authorizationParams: {
      audience: 'https://your-api',
      scope: 'read:data'
    }
  });
  console.log(token); // JWT token
} catch (err) {
  if (err.error === 'login_required') {
    await auth0Client.loginWithRedirect();
  }
}
```

### logout()

Log out user:

```javascript
auth0Client.logout({
  logoutParams: {
    returnTo: window.location.origin
  }
});
```

---

## Common Patterns

### Complete Initialization

```javascript
async function initAuth0() {
  const auth0Client = new Auth0Client({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  });

  // Handle redirect callback
  const query = window.location.search;
  if (query.includes('code=') && query.includes('state=')) {
    try {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      console.error('Callback error:', err);
    }
  }

  // Check authentication
  const isAuthenticated = await auth0Client.isAuthenticated();
  let user = null;

  if (isAuthenticated) {
    user = await auth0Client.getUser();
  }

  return { auth0Client, isAuthenticated, user };
}
```

### API Call Pattern

```javascript
async function callProtectedAPI(endpoint) {
  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch(`https://api.example.com${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('API call failed:', err);
    throw err;
  }
}
```

---

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `login_required` | User not authenticated | Call `loginWithRedirect()` |
| `consent_required` | Missing permissions | Redirect with `prompt: 'consent'` |
| `invalid_token` | Token invalid/expired | Re-authenticate |
| `access_denied` | User denied access | Show error, allow retry |

### Error Handler Pattern

```javascript
async function handleAuthError(err) {
  switch (err.error) {
    case 'login_required':
      await auth0Client.loginWithRedirect();
      break;
    case 'consent_required':
      await auth0Client.loginWithRedirect({
        authorizationParams: { prompt: 'consent' }
      });
      break;
    case 'invalid_token':
      alert('Your session has expired. Please log in again.');
      await auth0Client.loginWithRedirect();
      break;
    default:
      console.error('Auth error:', err);
      alert('Authentication failed. Please try again.');
  }
}
```

---

## Advanced Features

### Custom App State

Pass custom state through authentication:

```javascript
// Login with custom state
await auth0Client.loginWithRedirect({
  appState: {
    returnTo: '/dashboard',
    customData: { foo: 'bar' }
  }
});

// Retrieve after callback
const { appState } = await auth0Client.handleRedirectCallback();
if (appState?.returnTo) {
  window.location.href = appState.returnTo;
}
```

### Organizations

Support Auth0 Organizations:

```javascript
// Login to organization
await auth0Client.loginWithRedirect({
  authorizationParams: {
    organization: 'org_abc123'
  }
});

// Verify organization
const user = await auth0Client.getUser();
if (user.org_id !== 'org_abc123') {
  throw new Error('Unauthorized organization');
}
```

### Token Caching

```javascript
// Use localStorage for persistent cache
const auth0Client = new Auth0Client({
  domain: '...',
  clientId: '...',
  cacheLocation: 'localstorage', // Persist across page reloads
  useRefreshTokens: true         // Enable refresh tokens
});

// Clear cache on logout
await auth0Client.logout({ localOnly: true });
```

---

## Environment Variables

### Vite

```javascript
const config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID
};
```

### Plain JavaScript (no build tool)

If not using a build tool, create a config file:

```javascript
// config.js
export const auth0Config = {
  domain: 'your-tenant.auth0.com',
  clientId: 'your-client-id'
};
```

**Never commit credentials to source control!**

---

## Security Best Practices

1. **Use HTTPS** - Required in production
2. **Never expose tokens** - Don't log or display tokens
3. **Validate on server** - Client-side checks aren't sufficient
4. **Use appropriate scopes** - Request minimum required permissions
5. **Clear tokens on logout** - Use SDK's logout method
6. **Handle errors gracefully** - Don't expose sensitive details
7. **Use refresh tokens carefully** - Understand security implications

---

## Performance Tips

1. **Initialize once** - Create client instance only once
2. **Cache user data** - Don't fetch repeatedly
3. **Use memory cache** - Faster than localStorage for most cases
4. **Minimize token refreshes** - Let SDK handle automatically
5. **Lazy load auth** - Only initialize when needed

---

## Browser Compatibility

The SDK supports modern browsers with:
- ES6+ support
- Promise support
- Fetch API support
- localStorage/sessionStorage (for caching)

For older browsers, use polyfills:
```javascript
// Add to your HTML
<script src="https://polyfill.io/v3/polyfill.min.js?features=Promise,fetch"></script>
```

---

## References

- [Auth0 SPA JS SDK Documentation](https://auth0.com/docs/libraries/auth0-spa-js)
- [SDK GitHub Repository](https://github.com/auth0/auth0-spa-js)
- [Auth0 Authentication API](https://auth0.com/docs/api/authentication)
- [OAuth 2.0 Specification](https://oauth.net/2/)
