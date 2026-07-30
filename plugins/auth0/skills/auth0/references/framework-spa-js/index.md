
# Auth0 SPA JS Integration

Add authentication to any browser-based single-page application using `@auth0/auth0-spa-js` — the low-level Auth0 SDK for Vanilla JS, Svelte, SolidJS, and any SPA not using React, Angular, or Vue.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```
> gh api repos/auth0/auth0-spa-js/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below. If the command fails, fall back to checking https://github.com/auth0/auth0-spa-js/releases.

## Critical rules

- **You MUST ask the user for explicit confirmation before running any setup step that writes to `.env`.** Never read the contents of `.env` during setup; if you believe you need to, ask the user for explicit permission first and wait for confirmation.

## Prerequisites

- Modern browser with ES2017+ support
- npm or yarn (or use CDN for no-bundler apps)
- Auth0 account with a Single Page Application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **React SPAs** (hooks, Auth0Provider): use the Auth0 integration workflow for React
- **Angular SPAs** (AuthModule, AuthGuard): use the Auth0 integration workflow for Angular
- **Vue 3 SPAs** (createAuth0, useAuth0): use the Auth0 integration workflow for Vue
- **Next.js** (server-side sessions, App Router): use the Auth0 integration workflow for Next.js
- **Nuxt** (server-side SSR): use the Auth0 integration workflow for Nuxt
- **Express server-side web apps**: use the Auth0 integration workflow for Express
- **React Native / Expo mobile apps**: use the Auth0 integration workflow for React Native

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-spa-js
```

Or via CDN (no bundler). Run this to get the latest version, then use it in your HTML:
```bash
VERSION=$(npm view @auth0/auth0-spa-js version)
```
```html
<script src="https://cdn.auth0.com/js/auth0-spa-js/$VERSION/auth0-spa-js.production.js"></script>
```

### 2. Configure Auth0

**For automated setup with Auth0 CLI**, see the Setup Guide section below for complete scripts.

**For manual setup**, create `.env` (Vite):

```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

In Auth0 Dashboard, set for your **Single Page Application**:
- **Allowed Callback URLs**: `http://localhost:5173`
- **Allowed Logout URLs**: `http://localhost:5173`
- **Allowed Web Origins**: `http://localhost:5173`

### 3. Initialize Auth0 Client

```js
import { createAuth0Client } from '@auth0/auth0-spa-js';

const auth0 = await createAuth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin
  }
});

// Handle redirect callback after login
const query = new URLSearchParams(window.location.search);
if ((query.has('code') || query.has('error')) && query.has('state')) {
  await auth0.handleRedirectCallback();
  window.history.replaceState({}, document.title, window.location.pathname);
}
```

### 4. Add Login / Logout

> **Agent instruction:** Before adding new UI elements, search the project for existing click handlers for login, logout, sign-in, or sign-out buttons. If existing handlers are found, hook the Auth0 code into them without modifying the existing UI. Only create new buttons if no existing handlers are found.

```js
// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  await auth0.loginWithRedirect();
});

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  auth0.logout({
    logoutParams: { returnTo: window.location.origin }
  });
});

// Update UI based on auth state
const isAuthenticated = await auth0.isAuthenticated();
if (isAuthenticated) {
  const user = await auth0.getUser();
  console.log(user.name, user.email);
}
```

### 5. Get Access Tokens for API Calls

```js
const accessToken = await auth0.getTokenSilently();

const response = await fetch('https://your-api.example.com/data', {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

### 6. Build & Verify

> **Agent instruction:** After completing the integration, build the project to verify it compiles successfully:
> ```bash
> npm run build
> ```
> If the build fails, analyze the error output and fix the issues. Common integration build failures include:
> - **Module not found**: Missing `npm install @auth0/auth0-spa-js` — run the install command
> - **Cannot find name 'import.meta'**: TypeScript target too low — set `"target": "ES2020"` or higher in `tsconfig.json`
> - **`createAuth0Client` is not a function**: Wrong import path or CDN usage without bundle step
> - **Env vars undefined at runtime**: Vite requires `VITE_` prefix; webpack/CRA requires `REACT_APP_` prefix
>
> Re-run the build after each fix. Track the number of build-fix iterations.
>
> **Failcheck:** If the build still fails after 5–6 fix attempts, stop and ask the user using `AskUserQuestion`:
> _"The build is still failing after several fix attempts. How would you like to proceed?"_
> - **Let the skill continue fixing iteratively** — continue the build-fix loop for another 5–6 attempts
> - **Fix it manually** — show the remaining errors and let the user resolve them
> - **Skip build verification** — proceed without a successful build

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Callback URL port mismatch (e.g., `localhost:3001` vs `localhost:5173`) | Match Allowed Callback URLs exactly to your dev server port in Auth0 Dashboard |
| `client_secret` in SPA code | SPAs must never have a client secret — remove it. Auth0 sets auth method to `None` for SPA apps |
| Tokens stored in `localStorage` | Use in-memory storage (default) or `sessionStorage`. Never `localStorage` — XSS risk |
| `getTokenSilently()` throws `login_required` on page refresh | Add your app origin to **Allowed Web Origins** in Auth0 Dashboard |
| `handleRedirectCallback()` not called after redirect | Must call after login redirect to exchange the auth code; without this the URL params persist and re-trigger |
| Domain includes `https://` prefix | Auth0 domain should be hostname only: `your-tenant.auth0.com`, not `https://your-tenant.auth0.com` |
| `loginWithPopup()` called from async init code | Popups must be triggered directly from a user gesture (click handler). Never call from init or page load code |
| Using `Auth0Provider` from `@auth0/auth0-react` in Vanilla JS | For Vanilla JS, use `createAuth0Client()` directly — no provider component needed |

## Related Capabilities

- Auth0 setup — run the CLI: `auth0 login`, then `auth0 apps create`
- React SPAs with hooks — use the Auth0 integration workflow for React
- Angular SPAs — use the Auth0 integration workflow for Angular
- Vue 3 SPAs — use the Auth0 integration workflow for Vue
- Multi-factor authentication → ask for MFA (feature:mfa)
- Manage Auth0 resources from the terminal — the Auth0 CLI (`tooling-cli`)

## Quick Reference

### Core Methods

| Method | Description |
|--------|-------------|
| `createAuth0Client(options)` | Create and initialize client (calls `checkSession` internally) |
| `new Auth0Client(options)` | Instantiate without auto session check |
| `auth0.loginWithRedirect(options?)` | Redirect to Auth0 Universal Login |
| `auth0.loginWithPopup(options?)` | Open Auth0 login in a popup |
| `auth0.logout(options?)` | Clear session and redirect |
| `auth0.handleRedirectCallback(url?)` | Process redirect result after login |
| `auth0.isAuthenticated()` | `Promise<boolean>` |
| `auth0.getUser()` | `Promise<User \| undefined>` |
| `auth0.getTokenSilently(options?)` | `Promise<string>` — access token |
| `auth0.checkSession()` | Attempt silent re-authentication |

### Common Use Cases

- Login/Logout → See Step 4 above
- Protecting content → see the Protecting Content section below
- API calls with tokens → see the Calling Protected APIs section below
- Refresh tokens → see the Refresh Token Rotation section below
- Organizations → see the Organizations section below
- MFA handling → see the MFA Handling section below
- Error handling → see the Error Handling section below

## References

- [Auth0 SPA JS SDK Documentation](https://auth0.com/docs/libraries/auth0-spa-js)
- [Auth0 Vanilla JS Quickstart](https://auth0.com/docs/quickstart/spa/vanillajs)
- [SDK GitHub Repository](https://github.com/auth0/auth0-spa-js)
- [EXAMPLES.md — Advanced patterns](https://github.com/auth0/auth0-spa-js/blob/main/EXAMPLES.md)
- [API Documentation](https://auth0.github.io/auth0-spa-js/)

---

# Auth0 SPA JS — API Reference & Testing

---

## Configuration Reference

### Auth0ClientOptions

Options passed to `createAuth0Client()` or `new Auth0Client()`.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `domain` | `string` | Yes | Auth0 tenant domain — hostname only, no `https://` prefix |
| `clientId` | `string` | Yes | SPA application Client ID from Auth0 Dashboard |
| `authorizationParams` | `AuthorizationParams` | No | Authorization request parameters |
| `authorizationParams.redirect_uri` | `string` | No | Where Auth0 redirects after login (default: `window.location.origin`) |
| `authorizationParams.audience` | `string` | No | API identifier (e.g., `https://api.example.com`) for access tokens |
| `authorizationParams.scope` | `string` | No | Space-separated OIDC scopes (default: `openid profile email`) |
| `authorizationParams.organization` | `string` | No | Organization ID or name for multi-tenant apps |
| `useRefreshTokens` | `boolean` | No | Enable refresh token rotation (default: `false`) |
| `useRefreshTokensFallback` | `boolean` | No | Fall back to iframe silent auth if refresh token fails (default: `false`) |
| `cacheLocation` | `'memory' \| 'localstorage'` | No | Token cache location (default: `'memory'`) |
| `cache` | `ICache` | No | Custom cache implementation |
| `useDpop` | `boolean` | No | Enable DPoP token binding (default: `false`) |
| `useMrrt` | `boolean` | No | Multi-resource refresh tokens — requires `useRefreshTokens: true` (default: `false`) |
| `leeway` | `number` | No | Clock skew tolerance in seconds (default: `60`) |
| `sessionCheckExpiryDays` | `number` | No | Days before session check cookie expires (default: `1`) |
| `httpTimeoutInSeconds` | `number` | No | HTTP request timeout (default: `10`) |
| `issuer` | `string` | No | Override expected token issuer |

### getTokenSilently Options

| Option | Type | Description |
|--------|------|-------------|
| `authorizationParams.audience` | `string` | Override audience for this token request |
| `authorizationParams.scope` | `string` | Override scopes for this token request |
| `cacheMode` | `'on' \| 'off' \| 'cache-only'` | Cache behavior (default: `'on'`) |
| `detailedResponse` | `boolean` | Return `{ access_token, token_type, id_token, expires_in }` instead of string |
| `timeoutInSeconds` | `number` | Override timeout for this call |

---

## Environment Variables

| Bundler | Domain Variable | Client ID Variable |
|---------|----------------|-------------------|
| Vite | `VITE_AUTH0_DOMAIN` | `VITE_AUTH0_CLIENT_ID` |
| Create React App | `REACT_APP_AUTH0_DOMAIN` | `REACT_APP_AUTH0_CLIENT_ID` |
| Webpack (custom) | `AUTH0_DOMAIN` | `AUTH0_CLIENT_ID` |

**Vite access:**
```js
import.meta.env.VITE_AUTH0_DOMAIN
```

**CRA access:**
```js
process.env.REACT_APP_AUTH0_DOMAIN
```

---

## Error Types

| Class | Import | When Thrown |
|-------|--------|-------------|
| `AuthenticationError` | `@auth0/auth0-spa-js` | `handleRedirectCallback` — Auth0 returned an error |
| `GenericError` | `@auth0/auth0-spa-js` | Network or Auth0 API errors; base class for all SDK errors |
| `TimeoutError` | `@auth0/auth0-spa-js` | Silent auth or network request timeout |
| `PopupTimeoutError` | `@auth0/auth0-spa-js` | `loginWithPopup` — user didn't complete in time |
| `PopupCancelledError` | `@auth0/auth0-spa-js` | `loginWithPopup` — popup was closed by the user |
| `PopupOpenError` | `@auth0/auth0-spa-js` | `loginWithPopup` — `window.open` returned null (popups blocked) |
| `MfaRequiredError` | `@auth0/auth0-spa-js` | `getTokenSilently` — MFA step required; access `error.mfa_token` |
| `MissingRefreshTokenError` | `@auth0/auth0-spa-js` | `getTokenSilently` — refresh token not available |
| `ConnectError` | `@auth0/auth0-spa-js` | `handleRedirectCallback` — error in connected accounts flow |
| `MfaListAuthenticatorsError` | `@auth0/auth0-spa-js` | `auth0.mfa.getAuthenticators()` failed |
| `MfaEnrollmentError` | `@auth0/auth0-spa-js` | `auth0.mfa.enroll()` failed |
| `MfaChallengeError` | `@auth0/auth0-spa-js` | `auth0.mfa.challenge()` failed |
| `MfaVerifyError` | `@auth0/auth0-spa-js` | `auth0.mfa.verify()` failed |

---

## Claims Reference

Claims available from `auth0.getUser()` (ID token):

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | `string` | Subject — unique user ID: `auth0\|64abc...` |
| `name` | `string` | Full name |
| `given_name` | `string` | First name |
| `family_name` | `string` | Last name |
| `nickname` | `string` | Nickname or username |
| `email` | `string` | Email address |
| `email_verified` | `boolean` | Whether email is verified |
| `picture` | `string` | Profile picture URL |
| `locale` | `string` | User locale |
| `updated_at` | `string` | Last profile update ISO timestamp |

Claims on the **access token** (from `getTokenSilently({ detailedResponse: true })`):

| Claim | Description |
|-------|-------------|
| `iss` | Issuer — your Auth0 domain URL |
| `aud` | Audience — API identifier(s) |
| `azp` | Authorized party — your Client ID |
| `scope` | Space-separated scopes granted |
| `permissions` | RBAC permissions array (requires API audience + Auth0 RBAC enabled) |
| `org_id` | Organization ID for multi-tenant apps |

---

## Testing Checklist

### Core Authentication

- [ ] Login redirect sends user to Auth0 Universal Login page
- [ ] After login, user is returned to app (no dangling `code=` params in URL)
- [ ] `auth0.isAuthenticated()` returns `true` after successful login
- [ ] `auth0.getUser()` returns profile with `sub`, `name`, `email`
- [ ] Logout clears session and redirects to `returnTo` URL
- [ ] After logout, `isAuthenticated()` returns `false`

### Token Management

- [ ] `getTokenSilently()` returns a JWT string
- [ ] Access token decoded at [jwt.io](https://jwt.io) shows correct `aud`, `iss`, `sub`
- [ ] Tokens are **not** stored in `localStorage` (DevTools → Application → Local Storage)
- [ ] Page refresh maintains authentication (silent auth via `checkSession`)
- [ ] `getTokenSilently()` works without redirecting when session is active

### Error Handling

- [ ] Navigating to app when not logged in does not throw uncaught errors
- [ ] `login_required` error on `getTokenSilently` triggers re-authentication
- [ ] Network failure in `getTokenSilently` is caught and handled gracefully

### Security

- [ ] Auth0 Dashboard: Application type is **Single Page Application**
- [ ] Auth0 Dashboard: Token Endpoint Auth Method is **None**
- [ ] Auth0 Dashboard: Allowed Web Origins includes your app origin
- [ ] No `client_secret` anywhere in source code or `.env`
- [ ] Dev `.env` file is in `.gitignore`

---

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `login_required` on `getTokenSilently` | Allowed Web Origins not configured | Add `http://localhost:5173` to Allowed Web Origins in Auth0 Dashboard |
| `invalid_client` | Wrong Client ID | Check env var matches Auth0 Dashboard Client ID |
| Callback URL mismatch error | Port mismatch between app and Dashboard | Match exactly: `http://localhost:5173` in both places |
| `Unable to open popup` | Popup not triggered by user gesture | Call `loginWithPopup` directly in a click handler, never from async init |
| Token not refreshing silently | `offline_access` scope missing | Add `scope: 'openid profile email offline_access'` with `useRefreshTokens: true` |
| `MissingRefreshTokenError` | `useRefreshTokens` false or scope missing | Enable `useRefreshTokens: true` and include `offline_access` scope |
| User logged out on page refresh | Allowed Web Origins missing or no refresh tokens | Add Allowed Web Origins; enable `useRefreshTokens: true` |
| Cross-origin iframe blocked | Browser blocks third-party cookies | Use `useRefreshTokens: true` instead of silent iframe auth |
| Domain includes protocol | `domain` option should not include `https://` | Use `your-tenant.auth0.com` not `https://your-tenant.auth0.com` |

---

## Security Considerations

### Token Storage

| Strategy | Security | Session Persistence |
|----------|----------|-------------------|
| In-memory (default) | Highest — no persistent token theft | Lost on page refresh |
| Refresh tokens (`useRefreshTokens: true`) | High — refresh token in memory | Persists across page refreshes |
| `localStorage` | Lowest — vulnerable to XSS | Persists across page refreshes |

**Recommendation:** Use `useRefreshTokens: true` with `cacheLocation: 'memory'` (the default) for the best balance of security and user experience.

### No Client Secret

SPAs run entirely in the browser and cannot protect secrets. The Auth0 SPA application type explicitly disables client secret authentication. Never add `client_secret` to a browser-based application.

### PKCE Flow

`@auth0/auth0-spa-js` always uses the Authorization Code + PKCE (Proof Key for Code Exchange) flow. This protects against authorization code interception and is the only secure OAuth 2.0 flow for browser-based applications.

### Content Security Policy

If you need to restrict iframe origins (only relevant when NOT using `useRefreshTokens`):
```
Content-Security-Policy: frame-src https://your-tenant.auth0.com;
```

### XSS Protection

Never use `cacheLocation: 'localstorage'` in production unless you have fully mitigated all XSS risks. XSS can steal tokens from `localStorage`. Instead, use the default in-memory cache: it is the safer default because it avoids persistent token theft (tokens are gone once the tab closes), though XSS running in the authenticated app context can still act on tokens held in memory during the session.

---

# Auth0 SPA JS Integration Patterns

---

## Client Initialization

### Using createAuth0Client (Recommended)

`createAuth0Client` initializes the client and automatically calls `checkSession()` to restore any existing session:

```js
import { createAuth0Client } from '@auth0/auth0-spa-js';

const auth0 = await createAuth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin
  }
});
```

### Using Auth0Client Directly

Use when you need more control over initialization order:

```js
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0 = new Auth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin
  }
});

// Manually check existing session
try {
  await auth0.getTokenSilently();
} catch (error) {
  if (error.error !== 'login_required') {
    throw error;
  }
}
```

---

## Login

### Login with Redirect

```js
// Basic redirect login
await auth0.loginWithRedirect();

// With additional parameters
await auth0.loginWithRedirect({
  authorizationParams: {
    audience: 'https://api.example.com',
    scope: 'openid profile email read:data'
  }
});
```

### Handle Redirect Callback

Call this on page load to process the redirect result after Auth0 returns the user:

```js
const query = new URLSearchParams(window.location.search);
if ((query.has('code') || query.has('error')) && query.has('state')) {
  try {
    const result = await auth0.handleRedirectCallback();
    // result.appState contains data you passed via loginWithRedirect
    console.log('App state:', result.appState);
  } catch (err) {
    console.error('Redirect callback failed:', err);
  }
  // Clean up URL after processing
  window.history.replaceState({}, document.title, window.location.pathname);
}
```

### Login with Popup

Use when you want to avoid a full-page redirect (must be triggered directly by a user click):

```js
document.getElementById('login-popup-btn').addEventListener('click', async () => {
  try {
    await auth0.loginWithPopup();
    const user = await auth0.getUser();
    console.log('Logged in:', user.name);
  } catch (err) {
    if (err.error !== 'popup_cancelled') {
      console.error('Popup login failed:', err);
    }
  }
});
```

---

## Logout

```js
// Logout and return to app origin
auth0.logout({
  logoutParams: {
    returnTo: window.location.origin
  }
});

// Logout without redirect (clear local session only)
auth0.logout({ openUrl: false });

// Logout and redirect to custom URL
auth0.logout({
  logoutParams: {
    returnTo: 'https://your-app.example.com/logged-out'
  }
});
```

---

## User Profile

```js
// Check authentication state
const isAuthenticated = await auth0.isAuthenticated();

// Get user profile (returns undefined if not authenticated)
const user = await auth0.getUser();
if (user) {
  console.log(user.sub);       // Auth0 user ID
  console.log(user.name);      // Full name
  console.log(user.email);     // Email address
  console.log(user.picture);   // Profile picture URL
  console.log(user.email_verified); // Boolean
}
```

---

## Protecting Content

Show/hide content based on authentication state:

```js
async function updateUI() {
  const isAuthenticated = await auth0.isAuthenticated();

  // Toggle login/logout buttons
  document.getElementById('btn-login').style.display = isAuthenticated ? 'none' : 'block';
  document.getElementById('btn-logout').style.display = isAuthenticated ? 'block' : 'none';

  // Show user profile section
  const profileSection = document.getElementById('profile');
  if (profileSection) {
    profileSection.style.display = isAuthenticated ? 'block' : 'none';
  }

  if (isAuthenticated) {
    const user = await auth0.getUser();
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-email').textContent = user.email;
    if (document.getElementById('user-picture')) {
      document.getElementById('user-picture').src = user.picture;
    }
  }
}

// Call on page load and after auth state changes
await updateUI();
```

---

## Calling Protected APIs

```js
// Get access token silently (uses cache first, refreshes if expired)
async function callApi(url) {
  const accessToken = await auth0.getTokenSilently();

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Usage
document.getElementById('call-api-btn').addEventListener('click', async () => {
  try {
    const data = await callApi('https://your-api.example.com/private');
    document.getElementById('result').textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error('API call failed:', err);
  }
});
```

### Get Detailed Token Response

```js
const { access_token, token_type, id_token, expires_in } = await auth0.getTokenSilently({
  detailedResponse: true
});
```

### Token for a Specific Audience

```js
const token = await auth0.getTokenSilently({
  authorizationParams: {
    audience: 'https://api.example.com',
    scope: 'read:data write:data'
  }
});
```

---

## Refresh Token Rotation

Enable to maintain sessions across page refreshes without relying on third-party cookies (recommended for modern browsers):

```js
const auth0 = await createAuth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  useRefreshTokens: true,
  authorizationParams: {
    redirect_uri: window.location.origin,
    scope: 'openid profile email offline_access'  // offline_access required
  }
});
```

> **Note:** Enable **Allow Offline Access** on your Auth0 API in the Dashboard for `offline_access` scope to work.

---

## Organizations

### Login to a Specific Organization

```js
await auth0.loginWithRedirect({
  authorizationParams: {
    organization: 'org_xxxxxxxxxxxx'  // or organization name
  }
});
```

### Initialize Client with Organization

```js
const auth0 = await createAuth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    organization: 'org_xxxxxxxxxxxx'
  }
});
```

### Switch Organizations

```js
async function switchOrganization(orgId) {
  await auth0.logout({ openUrl: false });
  await auth0.loginWithRedirect({
    authorizationParams: { organization: orgId }
  });
}
```

### Accept User Invitations

```js
const url = new URL(window.location.href);
const organization = url.searchParams.get('organization');
const invitation = url.searchParams.get('invitation');

if (organization && invitation) {
  await auth0.loginWithRedirect({
    authorizationParams: { organization, invitation }
  });
}
```

---

## MFA Handling

Handle MFA when `getTokenSilently()` requires a second factor:

```js
import { MfaRequiredError } from '@auth0/auth0-spa-js';

try {
  const token = await auth0.getTokenSilently();
} catch (error) {
  if (error instanceof MfaRequiredError) {
    // Trigger MFA challenge via popup or redirect
    await auth0.loginWithPopup({
      authorizationParams: {
        mfa_token: error.mfa_token
      }
    });
  }
}
```

---

## DPoP (Device-Bound Tokens)

Enable DPoP to bind access tokens to the client's cryptographic key pair:

```js
const auth0 = await createAuth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  useDpop: true,
  authorizationParams: {
    redirect_uri: window.location.origin
  }
});

// Use createFetcher to automatically handle DPoP proof generation
const fetcher = auth0.createFetcher({ dpopNonceId: 'my_api' });

const response = await fetcher.fetchWithAuth('https://api.example.com/data', {
  method: 'GET'
});
```

---

## Error Handling

```js
import {
  AuthenticationError,
  GenericError,
  TimeoutError,
  PopupTimeoutError,
  PopupCancelledError,
  PopupOpenError,
  MfaRequiredError,
  MissingRefreshTokenError
} from '@auth0/auth0-spa-js';

// Handle redirect callback errors
try {
  await auth0.handleRedirectCallback();
} catch (err) {
  if (err instanceof AuthenticationError) {
    // Auth0 returned an error in the callback (e.g., access_denied)
    console.error('Auth error:', err.error, err.error_description);
  } else {
    console.error('Unexpected error:', err);
  }
}

// Handle token errors
try {
  const token = await auth0.getTokenSilently();
} catch (err) {
  if (err.error === 'login_required') {
    // User needs to log in — redirect to login
    await auth0.loginWithRedirect();
  } else if (err instanceof MissingRefreshTokenError) {
    // Refresh token missing — user needs to re-authenticate
    await auth0.loginWithRedirect();
  } else if (err instanceof TimeoutError) {
    console.error('Request timed out');
  } else {
    console.error('Token error:', err);
  }
}

// Handle popup errors
try {
  await auth0.loginWithPopup();
} catch (err) {
  if (err instanceof PopupOpenError) {
    console.error('Popups are blocked. Please allow popups for this site.');
  } else if (err instanceof PopupCancelledError) {
    console.log('User closed the popup');
  } else if (err instanceof PopupTimeoutError) {
    console.error('Popup timed out');
  }
}
```

---

## Authentication Flow

```
User clicks Login
      ↓
auth0.loginWithRedirect()
      ↓
Browser redirects to Auth0 Universal Login
      ↓
User enters credentials / social login
      ↓
Auth0 redirects back to redirect_uri?code=xxx&state=xxx
      ↓
auth0.handleRedirectCallback() — exchanges code for tokens
      ↓
Tokens stored in memory (or refresh token if useRefreshTokens: true)
      ↓
auth0.isAuthenticated() → true
auth0.getUser() → user profile
auth0.getTokenSilently() → access token
```

---

## Testing Patterns

### Test Authentication State

```js
describe('Auth0 integration', () => {
  it('should show login button when not authenticated', async () => {
    const isAuthenticated = await auth0.isAuthenticated();
    expect(isAuthenticated).toBe(false);
    expect(document.getElementById('btn-login').style.display).toBe('block');
  });
});
```

### Mock Auth0 Client in Tests

```js
// Vitest / Jest
vi.mock('@auth0/auth0-spa-js', () => ({
  createAuth0Client: vi.fn().mockResolvedValue({
    isAuthenticated: vi.fn().mockResolvedValue(true),
    getUser: vi.fn().mockResolvedValue({ name: 'Test User', email: 'test@example.com' }),
    loginWithRedirect: vi.fn(),
    logout: vi.fn(),
    getTokenSilently: vi.fn().mockResolvedValue('mock-access-token'),
    handleRedirectCallback: vi.fn().mockResolvedValue({ appState: null })
  })
}));
```

---

# Auth0 SPA JS Setup Guide

Complete setup instructions with automated scripts and manual configuration options.

---

## Quick Setup (Automated)

**Never read the contents of `.env` at any point during setup.** The file may contain sensitive secrets that should not be exposed in the LLM context. If you determine you need to read the file for any reason, ask the user for explicit permission before doing so — do not proceed until the user confirms.

**Before running any part of this setup that writes to `.env`, you must ask the user for explicit confirmation.** Follow the steps below precisely.

### Step 1: Check for existing .env and confirm with user

Before writing to `.env`, check whether the file already exists:

```bash
test -f .env && echo "EXISTS" || echo "NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding — do not continue until the user confirms:

- If `.env` does **not** exist, ask:
  - Question: "This setup will create a `.env` file containing Auth0 credentials (domain and client ID). Do you want to proceed?"
  - Options: "Yes, create .env" / "No, I'll configure it manually"

- If `.env` **already exists**, ask:
  - Question: "A `.env` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env" / "No, I'll update it manually"

**Do not proceed with writing to `.env` unless the user selects the confirmation option.**

### Step 2: Run automated setup (only after confirmation)

#### Bash Script (macOS/Linux)

```bash
#!/bin/bash

# Install Auth0 CLI if needed
if ! command -v auth0 &> /dev/null; then
  echo "Installing Auth0 CLI..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0/auth0-cli/auth0
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
  else
    echo "Please install Auth0 CLI: https://github.com/auth0/auth0-cli#installation"
    exit 1
  fi
fi

# Check if logged in to Auth0
if ! auth0 tenants list &> /dev/null; then
  echo ""
  echo "======================================"
  echo "Auth0 Login Required"
  echo "======================================"
  read -p "Do you have an Auth0 account? (y/n): " HAS_ACCOUNT

  if [[ "$HAS_ACCOUNT" != "y" ]]; then
    echo ""
    echo "Create a free account at: https://auth0.com/signup"
    read -p "Press Enter when you've created your account..."
  fi

  auth0 login
  if ! auth0 tenants list &> /dev/null; then
    echo "❌ Login failed. Please try again."
    exit 1
  fi
  echo "✅ Successfully logged in to Auth0!"
fi

# Detect env var prefix from project
if grep -q '"vite"' package.json 2>/dev/null; then
  PREFIX="VITE_AUTH0"
elif grep -q '"react-scripts"' package.json 2>/dev/null; then
  PREFIX="REACT_APP_AUTH0"
else
  PREFIX="VITE_AUTH0"  # Default to Vite
fi

# List apps and prompt for selection
echo "Your Auth0 applications:"
auth0 apps list

read -p "Enter your Auth0 app ID (or press Enter to create a new one): " APP_ID

if [ -z "$APP_ID" ]; then
  echo "Creating new Auth0 SPA application..."
  APP_NAME="${PWD##*/}-spa"
  APP_ID=$(auth0 apps create \
    --name "$APP_NAME" \
    --type spa \
    --auth-method None \
    --callbacks "http://localhost:3000,http://localhost:5173" \
    --logout-urls "http://localhost:3000,http://localhost:5173" \
    --origins "http://localhost:3000,http://localhost:5173" \
    --web-origins "http://localhost:3000,http://localhost:5173" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
  echo "Created SPA app with ID: $APP_ID"
fi

# Get app details
AUTH0_DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)

# Append to .env
cat >> .env << EOF
${PREFIX}_DOMAIN=$AUTH0_DOMAIN
${PREFIX}_CLIENT_ID=$AUTH0_CLIENT_ID
EOF

echo "✅ Auth0 configuration complete!"
echo "Appended to .env:"
echo "  ${PREFIX}_DOMAIN=$AUTH0_DOMAIN"
echo "  ${PREFIX}_CLIENT_ID=$AUTH0_CLIENT_ID"
```

#### PowerShell Script (Windows)

```powershell
# Install Auth0 CLI if not present
if (!(Get-Command auth0 -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Auth0 CLI..."
  scoop install auth0
}

# Check if logged in
try {
  auth0 tenants list | Out-Null
} catch {
  Write-Host "Auth0 Login Required"
  $hasAccount = Read-Host "Do you have an Auth0 account? (y/n)"

  if ($hasAccount -ne "y") {
    Write-Host "Create a free account at: https://auth0.com/signup"
    Read-Host "Press Enter when you've created your account"
  }

  auth0 login
  Write-Host "✅ Successfully logged in to Auth0!"
}

# Detect env var prefix
$prefix = if (Select-String -Path "package.json" -Pattern '"vite"' -Quiet) { "VITE_AUTH0" }
          elseif (Select-String -Path "package.json" -Pattern '"react-scripts"' -Quiet) { "REACT_APP_AUTH0" }
          else { "VITE_AUTH0" }

# List and select app
Write-Host "Your Auth0 applications:"
auth0 apps list

$appId = Read-Host "Enter your Auth0 app ID (or press Enter to create new)"

if ([string]::IsNullOrEmpty($appId)) {
  $appName = Split-Path -Leaf (Get-Location)
  Write-Host "Creating new Auth0 SPA application..."
  $appJson = auth0 apps create --name "$appName-spa" --type spa `
    --auth-method None `
    --callbacks "http://localhost:3000,http://localhost:5173" `
    --logout-urls "http://localhost:3000,http://localhost:5173" `
    --origins "http://localhost:3000,http://localhost:5173" `
    --web-origins "http://localhost:3000,http://localhost:5173" `
    --json

  $appId = ($appJson | ConvertFrom-Json).client_id
  Write-Host "Created app with ID: $appId"
}

# Get credentials
$appDetails = auth0 apps show $appId --json | ConvertFrom-Json

@"
${prefix}_DOMAIN=$($appDetails.domain)
${prefix}_CLIENT_ID=$($appDetails.client_id)
"@ | Out-File -FilePath .env -Encoding UTF8 -Append

Write-Host "✅ Auth0 configuration complete!"
Write-Host "  ${prefix}_DOMAIN=$($appDetails.domain)"
Write-Host "  ${prefix}_CLIENT_ID=$($appDetails.client_id)"
```

---

## Manual Setup

If you prefer manual setup or the scripts don't work:

### Step 1: Install SDK

```bash
npm install @auth0/auth0-spa-js
```

### Step 2: Install Auth0 CLI

**macOS:**
```bash
brew install auth0/auth0-cli/auth0
```

**Linux:**
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh
```

**Windows:**
```powershell
scoop install auth0
```

### Step 3: Get Credentials

```bash
# Login to Auth0
auth0 login

# List your apps
auth0 apps list

# Get app details (replace <app-id>)
auth0 apps show <app-id>
```

### Step 4: Create .env File

**For Vite-based projects:**
```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

**For Create React App:**
```bash
REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
```

**For Webpack / plain HTML:**
```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
```

---

## Creating an Auth0 Application via Dashboard

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose:
   - Name: Your app name
   - Type: **Single Page Web Applications**
5. Configure in the **Settings** tab:
   - **Allowed Callback URLs**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Logout URLs**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:5173, http://localhost:3000`
   - **Allowed Origins (CORS)**: `http://localhost:5173, http://localhost:3000`
6. Click **Save Changes**
7. Copy your **Domain** and **Client ID**

> **Important:** The **Allowed Web Origins** field is required for `getTokenSilently()` (silent authentication). Without it, users will be logged out on every page refresh.

---

## Secret Management

SPAs do **not** use a `client_secret`. The Auth0 SPA application type explicitly sets the Token Endpoint Authentication Method to `None`. If you see a client secret anywhere in your code, remove it immediately.

Your `.env` file contains only:
- `AUTH0_DOMAIN` / `VITE_AUTH0_DOMAIN` — Not a secret (public)
- `AUTH0_CLIENT_ID` / `VITE_AUTH0_CLIENT_ID` — Not a secret (public)

Still, follow these practices:
- Add `.env` to `.gitignore` (to avoid accidental commits with other sensitive env vars)
- Use `.env.local` for Vite projects (auto-ignored by Vite's default `.gitignore`)
- Never commit credential files to version control

---

## Troubleshooting Setup

### Environment Variables Not Loading

**Vite:**
- Ensure variables start with `VITE_`
- Restart the dev server after creating/editing `.env`
- Use `import.meta.env.VITE_AUTH0_DOMAIN` (not `process.env`)

**Create React App:**
- Ensure variables start with `REACT_APP_`
- Restart dev server after changes

### Auth0 CLI Issues

**Browser doesn't open for login:**
```bash
auth0 login --no-browser
```

**"Not logged in" error:**
```bash
auth0 login --force
```

---

## Next Steps

After setup is complete:
1. Return to the main skill guide for integration steps
