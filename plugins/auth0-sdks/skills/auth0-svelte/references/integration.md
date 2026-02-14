# Auth0 Svelte Integration Guide

Advanced patterns for integrating Auth0 into Svelte applications.

---

## Protected Routes

Protect routes by checking authentication status before rendering:

```svelte
<!-- src/routes/protected/+page.svelte -->
<script>
  import { isAuthenticated, isLoading, user, login } from '$lib/auth0';
  import { onMount } from 'svelte';

  onMount(() => {
    // Redirect to login if not authenticated
    if (!$isLoading && !$isAuthenticated) {
      login();
    }
  });
</script>

{#if $isLoading}
  <div>Loading...</div>
{:else if $isAuthenticated}
  <div>
    <h1>Protected Content</h1>
    <p>Welcome, {$user?.name}!</p>
  </div>
{:else}
  <div>Redirecting to login...</div>
{/if}
```

### Route Guard Component

Create a reusable route guard component:

```svelte
<!-- src/lib/ProtectedRoute.svelte -->
<script>
  import { isAuthenticated, isLoading, login } from './auth0';
  import { onMount } from 'svelte';

  onMount(() => {
    if (!$isLoading && !$isAuthenticated) {
      login();
    }
  });
</script>

{#if $isLoading}
  <div class="loading">Loading...</div>
{:else if $isAuthenticated}
  <slot />
{:else}
  <div>Redirecting...</div>
{/if}
```

Use it like this:

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script>
  import ProtectedRoute from '$lib/ProtectedRoute.svelte';
</script>

<ProtectedRoute>
  <h1>Dashboard</h1>
  <p>This content is protected</p>
</ProtectedRoute>
```

---

## Calling APIs

Get an access token to call your API:

```svelte
<script>
  import { getAccessToken } from '$lib/auth0';

  async function callApi() {
    try {
      const token = await getAccessToken();

      const response = await fetch('https://your-api.com/endpoint', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      console.log(data);
    } catch (err) {
      console.error('API call failed:', err);
    }
  }
</script>

<button on:click={callApi}>Call API</button>
```

### API with Audience

If your API requires an audience parameter:

Update `src/lib/auth0.js`:

```javascript
// Add audience to Auth0Client configuration
const auth0Client = new Auth0Client({
  domain,
  clientId,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: 'https://your-api-identifier' // Add this
  }
});

// Update getAccessToken to request specific audience
export const getAccessToken = async (options = {}) => {
  try {
    return await auth0Client.getTokenSilently({
      authorizationParams: {
        audience: 'https://your-api-identifier',
        ...options
      }
    });
  } catch (err) {
    error.set(err.message);
    throw err;
  }
};
```

---

## Error Handling

Handle authentication errors gracefully:

```svelte
<script>
  import { error, isLoading, isAuthenticated, login } from '$lib/auth0';
</script>

{#if $error}
  <div class="error">
    <p>Authentication error: {$error}</p>
    <button on:click={() => { $error = null; login(); }}>
      Try Again
    </button>
  </div>
{:else if $isLoading}
  <div>Loading...</div>
{:else if $isAuthenticated}
  <div>Authenticated content</div>
{:else}
  <button on:click={login}>Login</button>
{/if}

<style>
  .error {
    background: #fee;
    border: 1px solid #c00;
    padding: 1rem;
    border-radius: 4px;
  }
</style>
```

### Login Error Recovery

Handle specific login errors:

Update `src/lib/auth0.js`:

```javascript
export const login = async (options = {}) => {
  try {
    await auth0Client.loginWithRedirect(options);
  } catch (err) {
    if (err.error === 'login_required') {
      error.set('Please log in to continue');
    } else if (err.error === 'consent_required') {
      error.set('Please grant the required permissions');
    } else {
      error.set(err.message || 'Login failed');
    }
    throw err;
  }
};
```

---

## User Profile Management

Display and update user information:

```svelte
<script>
  import { user, isAuthenticated } from '$lib/auth0';
</script>

{#if $isAuthenticated && $user}
  <div class="profile">
    {#if $user.picture}
      <img src={$user.picture} alt={$user.name} />
    {/if}
    <div class="info">
      <h2>{$user.name}</h2>
      <p>{$user.email}</p>
      {#if $user.email_verified}
        <span class="verified">✓ Verified</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .profile {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  img {
    width: 64px;
    height: 64px;
    border-radius: 50%;
  }

  .verified {
    color: green;
    font-size: 0.875rem;
  }
</style>
```

---

## Silent Authentication

Automatically refresh authentication state:

```javascript
// src/lib/auth0.js
import { onMount } from 'svelte';

// Add this function to your auth0.js
export function setupSilentAuth() {
  // Check authentication status every 5 minutes
  setInterval(async () => {
    try {
      const authenticated = await auth0Client.isAuthenticated();
      isAuthenticated.set(authenticated);

      if (authenticated) {
        const userProfile = await auth0Client.getUser();
        user.set(userProfile);
      }
    } catch (err) {
      console.error('Silent auth check failed:', err);
    }
  }, 5 * 60 * 1000); // 5 minutes
}
```

Call it from your root layout:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { setupSilentAuth } from '$lib/auth0';
  import { onMount } from 'svelte';

  onMount(() => {
    setupSilentAuth();
  });
</script>

<slot />
```

---

## Testing

### Mock Auth0 for Testing

```javascript
// src/lib/auth0.test.js
import { writable } from 'svelte/store';

export const mockAuth0 = {
  isLoading: writable(false),
  isAuthenticated: writable(true),
  user: writable({
    name: 'Test User',
    email: 'test@example.com',
    picture: 'https://example.com/avatar.jpg'
  }),
  error: writable(null),
  login: vi.fn(),
  logout: vi.fn(),
  getAccessToken: vi.fn().mockResolvedValue('mock-token')
};
```

---

## SvelteKit Server-Side Considerations

If using SvelteKit with server-side rendering:

```javascript
// src/hooks.server.js - Optional server-side auth handling
export async function handle({ event, resolve }) {
  // Auth0 authentication is client-side only with this setup
  // For server-side auth, consider using a different approach
  return resolve(event);
}
```

**Note:** The @auth0/auth0-spa-js SDK is designed for client-side authentication. For full SSR with server-side authentication in SvelteKit, you may need to implement a custom server-side flow using Auth0's OAuth2/OIDC endpoints directly.

---

## Next Steps

- Check [API Reference](api.md) for complete SDK documentation
- See [Setup Guide](setup.md) for configuration options
- Return to [main skill guide](../SKILL.md) for overview
