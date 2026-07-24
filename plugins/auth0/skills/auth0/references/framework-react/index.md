# Auth0 React — reference hub

Add authentication to React single-page applications using @auth0/auth0-react.

<!-- Shared prerequisites: critical rules, prerequisites, and when-NOT-to-use.
     Read this first (hop 1), then follow the dispatch table below to the one
     leaf for your intent. (Carved from the original framework-react.md.) -->

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

**For automated setup with Auth0 CLI**, see this group's integration guide (Setup → Quick Setup (Automated) section) for complete scripts.

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

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-react/integrate.md` |
| feature:organizations | `Read: references/framework-react/integrate.md` |
| migrate | `Read: references/framework-react/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For tenant setup, CLI provisioning, automated `.env` scripts, and advanced framework patterns (protected routes, calling APIs, error handling, MFA handling, security): `Read: references/framework-react/integrate.md` (Setup and Integration Patterns sections).
- Full API / configuration lookup (Auth0Provider config, useAuth0 hook, MFA error types, TypeScript types): `Read: references/framework-react/api-reference.md`
- Any other task (guidance, debugging, Organizations, provider migration):
  start with `Read: references/framework-react/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
