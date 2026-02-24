---
name: auth0-svelte
description: Use when adding authentication to Svelte applications (login, logout, user sessions, protected routes) - integrates @auth0/auth0-spa-js SDK for SPAs with SvelteKit or Vite
---

# Auth0 Svelte Integration

Add authentication to Svelte single-page applications using @auth0/auth0-spa-js.

---

## Prerequisites

- Svelte 5.x+ application (SvelteKit or Vite)
- Auth0 account and application configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Server-side rendered Svelte with authentication middleware** - Consider custom server-side implementation
- **Embedded login** - This SDK uses Auth0 Universal Login (redirect-based)
- **Backend API authentication** - Use JWT validation instead
- **Mobile apps** - Use native SDKs for iOS/Android

---

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-spa-js
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see [Setup Guide](references/setup.md) for complete scripts.

**For manual setup:**

Create `.env` file:

```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

### 3. Create Auth0 Service

Create `src/lib/auth0.js`:

```javascript
import { Auth0Client } from '@auth0/auth0-spa-js';
import { writable, derived } from 'svelte/store';

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

// Initialize Auth0 client
const auth0Client = new Auth0Client({
  domain,
  clientId,
  authorizationParams: {
    redirect_uri: window.location.origin
  }
});

// Create reactive stores
export const isLoading = writable(true);
export const isAuthenticated = writable(false);
export const user = writable(null);
export const error = writable(null);

// Initialize authentication state
async function initAuth() {
  try {
    // Check if returning from Auth0 redirect
    const query = window.location.search;
    if (query.includes('code=') && query.includes('state=')) {
      await auth0Client.handleRedirectCallback();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if user is authenticated
    const authenticated = await auth0Client.isAuthenticated();
    isAuthenticated.set(authenticated);

    if (authenticated) {
      const userProfile = await auth0Client.getUser();
      user.set(userProfile);
    }
  } catch (err) {
    error.set(err.message);
  } finally {
    isLoading.set(false);
  }
}

// Auth actions
export const login = () => auth0Client.loginWithRedirect();

export const logout = () => {
  auth0Client.logout({
    logoutParams: {
      returnTo: window.location.origin
    }
  });
};

export const getAccessToken = async () => {
  try {
    return await auth0Client.getTokenSilently();
  } catch (err) {
    error.set(err.message);
    throw err;
  }
};

// Initialize on module load
initAuth();
```

### 4. Add Authentication UI

Create a login component `src/lib/LoginButton.svelte`:

```svelte
<script>
  import { isLoading, isAuthenticated, user, login, logout } from './auth0';
</script>

{#if $isLoading}
  <div>Loading...</div>
{:else if $isAuthenticated}
  <div class="user-profile">
    <span>Welcome, {$user?.name}</span>
    <button on:click={logout}>Logout</button>
  </div>
{:else}
  <button on:click={login}>Login</button>
{/if}

<style>
  .user-profile {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
</style>
```

### 5. Test Authentication

Start your dev server and test the login flow:

```bash
npm run dev
```

---

## Detailed Documentation

- **[Setup Guide](references/setup.md)** - Automated setup scripts (Bash/PowerShell), CLI commands, manual configuration
- **[Integration Guide](references/integration.md)** - Protected routes, API calls, error handling, advanced patterns
- **[API Reference](references/api.md)** - Complete SDK API, configuration options, testing strategies

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add redirect URI in Auth0 Dashboard | Add your application URL (e.g., `http://localhost:5173`, `https://app.example.com`) to Allowed Callback URLs in Auth0 Dashboard |
| Using wrong env var prefix | Vite uses `VITE_` prefix for environment variables |
| Not handling loading state | Always check `$isLoading` before rendering auth-dependent UI |
| Storing tokens in localStorage | Never manually store tokens - SDK handles secure storage automatically |
| Not handling redirect callback | Must call `handleRedirectCallback()` when URL contains code/state parameters |
| Missing await on auth methods | Auth0 methods are async - always use `await` |
| Forgetting $ prefix for stores | Svelte stores must be accessed with `$` prefix in templates |

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-migration` - Migrate from another auth provider
- `auth0-mfa` - Add Multi-Factor Authentication

---

## Quick Reference

**Core Functions:**
- `login()` - Initiate login
- `logout()` - Log out user
- `getAccessToken()` - Get access token for API calls

**Stores:**
- `$isAuthenticated` - Check if user is logged in
- `$user` - User profile information
- `$isLoading` - Loading state
- `$error` - Error messages

**Common Use Cases:**
- Login/Logout buttons → See Step 4 above
- Protected routes → [Integration Guide](references/integration.md#protected-routes)
- API calls with tokens → [Integration Guide](references/integration.md#calling-apis)
- Error handling → [Integration Guide](references/integration.md#error-handling)

---

## References

- [Auth0 SPA JS SDK Documentation](https://auth0.com/docs/libraries/auth0-spa-js)
- [Auth0 Svelte Quickstart](https://auth0.com/docs/quickstart/spa/svelte)
- [SDK GitHub Repository](https://github.com/auth0/auth0-spa-js)
