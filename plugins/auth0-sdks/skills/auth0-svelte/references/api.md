# Auth0 Svelte API Reference

Complete reference for the Auth0 SPA JS SDK integration in Svelte.

---

## Auth0Client Configuration

### Constructor Options

```javascript
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0Client = new Auth0Client({
  domain: 'your-tenant.auth0.com',        // Required
  clientId: 'your-client-id',              // Required
  authorizationParams: {
    redirect_uri: window.location.origin, // Required
    audience: 'https://your-api',         // Optional
    scope: 'openid profile email',         // Optional (default)
    responseType: 'code',                  // Optional (default)
  },
  cacheLocation: 'memory',                 // Optional: 'memory' or 'localstorage'
  useRefreshTokens: true,                  // Optional: enable refresh tokens
  useRefreshTokensFallback: false,         // Optional: fallback if RT not available
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `domain` | string | Required | Your Auth0 tenant domain |
| `clientId` | string | Required | Your Auth0 application client ID |
| `authorizationParams.redirect_uri` | string | Required | Where Auth0 redirects after auth |
| `authorizationParams.audience` | string | undefined | API identifier for access tokens |
| `authorizationParams.scope` | string | `'openid profile email'` | OAuth scopes to request |
| `cacheLocation` | string | `'memory'` | Where to store tokens (`'memory'` or `'localstorage'`) |
| `useRefreshTokens` | boolean | false | Enable refresh token rotation |

---

## Core Methods

### loginWithRedirect()

Redirect to Auth0 Universal Login:

```javascript
await auth0Client.loginWithRedirect({
  authorizationParams: {
    redirect_uri: window.location.origin,
    // Optional: pass additional parameters
    screen_hint: 'signup', // Show signup page
    prompt: 'login'        // Force re-authentication
  }
});
```

### handleRedirectCallback()

Handle the redirect back from Auth0:

```javascript
const result = await auth0Client.handleRedirectCallback();
// result contains: appState, user info
console.log(result.appState); // Custom state passed to login
```

### isAuthenticated()

Check if user is authenticated:

```javascript
const authenticated = await auth0Client.isAuthenticated();
console.log(authenticated); // true or false
```

### getUser()

Get the current user's profile:

```javascript
const user = await auth0Client.getUser();
console.log(user);
// {
//   sub: 'auth0|123456',
//   name: 'John Doe',
//   email: 'john@example.com',
//   picture: 'https://...',
//   ...
// }
```

### getTokenSilently()

Get an access token silently (without redirect):

```javascript
try {
  const token = await auth0Client.getTokenSilently({
    authorizationParams: {
      audience: 'https://your-api',
      scope: 'read:data'
    }
  });
  console.log(token); // JWT access token
} catch (err) {
  if (err.error === 'login_required') {
    // User needs to log in
    await auth0Client.loginWithRedirect();
  } else if (err.error === 'consent_required') {
    // User needs to grant permissions
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        prompt: 'consent'
      }
    });
  }
}
```

### logout()

Log out the user:

```javascript
auth0Client.logout({
  logoutParams: {
    returnTo: window.location.origin // Where to redirect after logout
  }
});
```

---

## Svelte Store Integration

### Reactive Stores

```javascript
import { writable, derived } from 'svelte/store';

// Basic stores
export const isLoading = writable(true);
export const isAuthenticated = writable(false);
export const user = writable(null);
export const error = writable(null);

// Derived stores
export const userName = derived(user, ($user) => $user?.name || 'Guest');
export const isEmailVerified = derived(user, ($user) => $user?.email_verified || false);
```

### Using Stores in Components

```svelte
<script>
  import { isAuthenticated, user, userName } from '$lib/auth0';

  // Access store values with $ prefix
  console.log($isAuthenticated);
  console.log($user);
  console.log($userName);
</script>

<div>
  {#if $isAuthenticated}
    <p>Hello, {$userName}!</p>
  {/if}
</div>
```

---

## Error Handling

### Common Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `login_required` | User needs to authenticate | Call `loginWithRedirect()` |
| `consent_required` | User needs to grant permissions | Call `loginWithRedirect({ prompt: 'consent' })` |
| `invalid_token` | Token is invalid or expired | Refresh token or re-authenticate |
| `access_denied` | User denied authorization | Show error message, allow retry |

### Error Handling Pattern

```javascript
export const getAccessToken = async () => {
  try {
    return await auth0Client.getTokenSilently();
  } catch (err) {
    switch (err.error) {
      case 'login_required':
        error.set('Please log in to continue');
        await login();
        break;
      case 'consent_required':
        error.set('Additional permissions required');
        await auth0Client.loginWithRedirect({
          authorizationParams: { prompt: 'consent' }
        });
        break;
      case 'invalid_token':
        error.set('Session expired, please log in again');
        await login();
        break;
      default:
        error.set(err.message || 'Authentication error');
    }
    throw err;
  }
};
```

---

## Advanced Patterns

### Custom State with Login

Pass custom state through the authentication flow:

```javascript
export const login = (customState = {}) => {
  auth0Client.loginWithRedirect({
    authorizationParams: {
      redirect_uri: window.location.origin
    },
    appState: customState // Will be returned after authentication
  });
};

// In handleRedirectCallback
const { appState } = await auth0Client.handleRedirectCallback();
if (appState?.returnTo) {
  window.location.href = appState.returnTo;
}
```

### Token Caching

Control token caching behavior:

```javascript
// Use localStorage for persistent tokens
const auth0Client = new Auth0Client({
  domain,
  clientId,
  cacheLocation: 'localstorage',
  useRefreshTokens: true // Enable refresh tokens
});

// Clear cached tokens
await auth0Client.logout({ localOnly: true });
```

### Organizations

Support Auth0 Organizations:

```javascript
// Login to specific organization
export const loginToOrg = (orgId) => {
  auth0Client.loginWithRedirect({
    authorizationParams: {
      redirect_uri: window.location.origin,
      organization: orgId // Organization ID or slug
    }
  });
};

// Validate user belongs to organization
const user = await auth0Client.getUser();
if (user?.org_id !== expectedOrgId) {
  error.set('Unauthorized organization');
}
```

---

## Testing

### Mock SDK for Tests

```javascript
// test/mocks/auth0.js
export const mockAuth0Client = {
  loginWithRedirect: vi.fn(),
  handleRedirectCallback: vi.fn().mockResolvedValue({
    appState: {}
  }),
  isAuthenticated: vi.fn().mockResolvedValue(true),
  getUser: vi.fn().mockResolvedValue({
    sub: 'auth0|123',
    name: 'Test User',
    email: 'test@example.com'
  }),
  getTokenSilently: vi.fn().mockResolvedValue('mock-token'),
  logout: vi.fn()
};
```

### Component Testing

```javascript
// Component.test.js
import { render } from '@testing-library/svelte';
import Component from './Component.svelte';
import { mockAuth0 } from './test/mocks/auth0';

// Mock the auth0 module
vi.mock('$lib/auth0', () => mockAuth0);

test('renders user when authenticated', () => {
  const { getByText } = render(Component);
  expect(getByText('Test User')).toBeInTheDocument();
});
```

---

## Security Best Practices

1. **Never hardcode credentials** - Always use environment variables
2. **Use HTTPS in production** - Required for secure token handling
3. **Set appropriate scopes** - Request only needed permissions
4. **Validate tokens server-side** - Don't trust client-side validation alone
5. **Use refresh tokens carefully** - Enable only if needed, understand security implications
6. **Clear tokens on logout** - Use `logout()` method, not manual clearing
7. **Handle errors gracefully** - Don't expose sensitive error details to users

---

## Performance Tips

1. **Use memory cache** - Faster than localStorage for most use cases
2. **Minimize token refreshes** - Cache tokens appropriately
3. **Lazy load user data** - Only fetch when needed
4. **Debounce authentication checks** - Don't check on every route change
5. **Use derived stores** - Compute values reactively instead of repeatedly

---

## References

- [Auth0 SPA JS SDK Documentation](https://auth0.com/docs/libraries/auth0-spa-js)
- [Svelte Store Documentation](https://svelte.dev/docs#run-time-svelte-store)
- [Auth0 Authentication API](https://auth0.com/docs/api/authentication)
- [OAuth 2.0 Specification](https://oauth.net/2/)
