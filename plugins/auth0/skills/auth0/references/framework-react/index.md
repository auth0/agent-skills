# Auth0 React

Add authentication to React single-page applications using @auth0/auth0-react.

## Critical rules

- Always ask the user for explicit confirmation before running any setup step that writes to `.env`; wait for their answer before proceeding.
- Keep the contents of `.env` out of the agent context. If reading it seems necessary, ask the user for explicit permission first.

## Prerequisites

- React 16.11+ application (Vite or Create React App) - supports React 16, 17, 18, and 19
- Auth0 account and application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Next.js applications** - Use the Auth0 integration workflow for Next.js (App Router and Pages Router)
- **React Native mobile apps** - Use the Auth0 integration workflow for React Native (iOS/Android)
- **Server-side rendered React** - Use framework-specific SDK (Next.js, Remix, etc.)
- **Embedded login** - This SDK uses Auth0 Universal Login (redirect-based)
- **Backend API authentication** - Use express-openid-connect or JWT validation instead

## Quick start

### 1. Install SDK

```bash
npm install @auth0/auth0-react
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see this group's setup guide for complete scripts.

**For manual setup:**

Create `.env` file:

**Vite:**
```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

**Create React App:**
```bash
REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
```

### 3. Wrap App with Auth0Provider

Update `src/main.tsx` (Vite) or `src/index.tsx` (CRA):

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN} // or process.env.REACT_APP_AUTH0_DOMAIN
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
```

### 4. Add Authentication UI

```tsx
import { useAuth0 } from '@auth0/auth0-react';

export function LoginButton() {
  const { loginWithRedirect, logout, isAuthenticated, user, isLoading } = useAuth0();

  if (isLoading) return <div>Loading...</div>;

  if (isAuthenticated) {
    return (
      <div>
        <span>Welcome, {user?.name}</span>
        <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
          Logout
        </button>
      </div>
    );
  }

  return <button onClick={() => loginWithRedirect()}>Login</button>;
}
```

### 5. Test Authentication

Start your dev server and test the login flow:

```bash
npm run dev  # Vite
# or
npm start    # CRA
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add redirect URI in Auth0 Dashboard | Add your application URL (e.g., `http://localhost:3000`, `https://app.example.com`) to Allowed Callback URLs in Auth0 Dashboard |
| Using wrong env var prefix | Vite uses `VITE_` prefix, Create React App uses `REACT_APP_` |
| Not handling loading state | Always check `isLoading` before rendering auth-dependent UI |
| Storing tokens in localStorage | Never manually store tokens - SDK handles secure storage automatically |
| Missing Auth0Provider wrapper | Entire app must be wrapped in `<Auth0Provider>` |
| Provider not at root level | Auth0Provider must wrap all components that use auth hooks |
| Wrong import path for env vars | Vite uses `import.meta.env.VITE_*`, CRA uses `process.env.REACT_APP_*` |
| Using `acr_values` redirect for in-app MFA | Use `useAuth0().mfa` API for in-app enrollment/challenge/verify flows |
| Not catching `MfaRequiredError` | Wrap `getAccessTokenSilently` in try/catch and check `instanceof MfaRequiredError` |
| Making direct HTTP calls to MFA endpoints | Use the `mfa` property from `useAuth0()` — it handles token management automatically |
| Forgetting refresh tokens for step-up MFA | Set `useRefreshTokens={true}` on Auth0Provider when using `interactiveErrorHandler="popup"` |

## Choose your task

You arrived here for a specific intent. After reading the shared prerequisites
above, read the reference for your task:

| Intent | Read |
|---|---|
| setup, install, automated | `Read: references/framework-react/setup.md` |
| config, provider, hooks | `Read: references/framework-react/api-reference.md` |
| integrate, patterns, routes, api-calls | `Read: references/framework-react/patterns.md` |
| mfa, security, advanced | `Read: references/framework-react/advanced.md` |

**Then, as needed for your task:**
- Automated or manual setup (Auth0 CLI scripts, .env configuration, dashboard setup): `Read: references/framework-react/setup.md`
- Configuration & Hooks (Auth0Provider props, useAuth0 hook, TypeScript types): `Read: references/framework-react/api-reference.md`
- Integration patterns (Protected routes, custom hooks, testing, calling APIs, error handling): `Read: references/framework-react/patterns.md`
- Advanced features (MFA enrollment/challenge, security considerations, advanced patterns): `Read: references/framework-react/advanced.md`

Read only the reference (or references) your task needs — not all of them.
