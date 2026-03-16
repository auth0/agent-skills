---
name: auth0-vanilla-js
description: Use when adding authentication to vanilla JavaScript applications (login, logout, user sessions) - integrates @auth0/auth0-spa-js SDK for SPAs without frameworks
---

# Auth0 Vanilla JavaScript Integration

Add authentication to vanilla JavaScript single-page applications using @auth0/auth0-spa-js.

---

## Prerequisites

- Modern JavaScript (ES6+) knowledge
- Build tool like Vite (optional but recommended)
- Auth0 account and application configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Framework-based apps** - Use framework-specific skills (React, Vue, Angular, Svelte)
- **Server-side rendered apps** - Consider using a backend framework
- **Embedded login** - This SDK uses Auth0 Universal Login (redirect-based)
- **Backend API authentication** - Use JWT validation instead

---

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-spa-js
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see [Setup Guide](references/setup.md) for complete scripts.

**For manual setup with Vite:**

Create `.env` file:

```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

### 3. Create Auth Module

Create `auth.js`:

```javascript
import { Auth0Client } from '@auth0/auth0-spa-js';

let auth0Client;
let isAuthenticated = false;
let user = null;

// Initialize Auth0
export async function initAuth0() {
  auth0Client = new Auth0Client({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  });

  // Check if returning from Auth0 redirect
  const query = window.location.search;
  if (query.includes('code=') && query.includes('state=')) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // Update authentication state
  isAuthenticated = await auth0Client.isAuthenticated();
  if (isAuthenticated) {
    user = await auth0Client.getUser();
  }

  return { isAuthenticated, user };
}

// Login
export function login() {
  return auth0Client.loginWithRedirect();
}

// Logout
export function logout() {
  return auth0Client.logout({
    logoutParams: {
      returnTo: window.location.origin
    }
  });
}

// Get access token
export async function getAccessToken() {
  return await auth0Client.getTokenSilently();
}

// Get current auth state
export function getAuthState() {
  return { isAuthenticated, user };
}
```

### 4. Create UI

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auth0 Vanilla JS</title>
</head>
<body>
  <div id="app">
    <div id="loading">Loading...</div>
    <div id="authenticated" style="display: none;">
      <div id="user-info"></div>
      <button id="logout-btn">Logout</button>
    </div>
    <div id="unauthenticated" style="display: none;">
      <button id="login-btn">Login</button>
    </div>
  </div>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

Create `app.js`:

```javascript
import { initAuth0, login, logout, getAuthState } from './auth.js';

async function updateUI() {
  const { isAuthenticated, user } = getAuthState();

  const loading = document.getElementById('loading');
  const authenticated = document.getElementById('authenticated');
  const unauthenticated = document.getElementById('unauthenticated');
  const userInfo = document.getElementById('user-info');

  loading.style.display = 'none';

  if (isAuthenticated) {
    authenticated.style.display = 'block';
    unauthenticated.style.display = 'none';
    userInfo.innerHTML = `
      <img src="${user.picture}" alt="${user.name}" width="48" />
      <h2>Welcome, ${user.name}!</h2>
      <p>${user.email}</p>
    `;
  } else {
    authenticated.style.display = 'none';
    unauthenticated.style.display = 'block';
  }
}

// Initialize app
(async () => {
  await initAuth0();
  updateUI();

  // Attach event listeners
  document.getElementById('login-btn')?.addEventListener('click', login);
  document.getElementById('logout-btn')?.addEventListener('click', logout);
})();
```

### 5. Test Authentication

Start your dev server:

```bash
npm run dev  # If using Vite
# or
npx vite     # Direct Vite command
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
| Not handling redirect callback | Must call `handleRedirectCallback()` when URL contains code/state parameters |
| Missing await on async functions | All Auth0 methods are async - always use `await` |
| Accessing env vars in browser | Use `import.meta.env.VITE_*` with Vite, not `process.env` |
| Not initializing before use | Call `initAuth0()` before using any auth functions |

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-migration` - Migrate from another auth provider
- `auth0-mfa` - Add Multi-Factor Authentication

---

## Quick Reference

**Core Functions:**
- `initAuth0()` - Initialize Auth0 client (call first)
- `login()` - Initiate login
- `logout()` - Log out user
- `getAccessToken()` - Get access token for API calls
- `getAuthState()` - Get current auth state

**Common Use Cases:**
- Login/Logout buttons → See Step 4 above
- Protected pages → [Integration Guide](references/integration.md#protected-pages)
- API calls with tokens → [Integration Guide](references/integration.md#calling-apis)
- Error handling → [Integration Guide](references/integration.md#error-handling)

---

## References

- [Auth0 SPA JS SDK Documentation](https://auth0.com/docs/libraries/auth0-spa-js)
- [Auth0 Vanilla JS Quickstart](https://auth0.com/docs/quickstart/spa/vanillajs)
- [SDK GitHub Repository](https://github.com/auth0/auth0-spa-js)
