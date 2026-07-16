# Auth0 React Integration

Add authentication to React single-page applications using @auth0/auth0-react.

> **Prerequisites & setup:** the shared critical rules, prerequisites, and
> when-NOT-to-use notes live in this group's hub index (already read on the way
> here). Full tenant/CLI provisioning and automated `.env` scripts live in this
> group's setup guide; advanced patterns (protected routes, calling APIs, error
> handling, MFA handling, security) live in this group's patterns guide; the
> complete SDK/config lookup lives in this group's API reference guide.

## Quick Start Workflow

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

## Related Skills

- Basic Auth0 setup → set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Migrate from another auth provider → ask for migration (migrate)
- Add Multi-Factor Authentication → ask for MFA (feature:mfa)
- Add passkey authentication → ask for passkeys (feature:mfa)
- B2B multi-tenancy support → ask for Organizations (feature:organizations)
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**Core Hooks:**
- `useAuth0()` - Main authentication hook
- `isAuthenticated` - Check if user is logged in
- `user` - User profile information
- `loginWithRedirect()` - Initiate login
- `logout()` - Log out user
- `getAccessTokenSilently()` - Get access token for API calls
- `mfa` - MFA API client for enrollment, challenge, and verification
  - `mfa.getAuthenticators(mfaToken)` - List enrolled authenticators
  - `mfa.getEnrollmentFactors(mfaToken)` - Get available enrollment factors
  - `mfa.enroll(params)` - Enroll new authenticator (OTP, SMS, Email, Voice, Push)
  - `mfa.challenge(params)` - Initiate MFA challenge
  - `mfa.verify(params)` - Verify MFA challenge and complete authentication

**MFA Error Types (import from `@auth0/auth0-react`):**
- `MfaRequiredError` - Thrown by `getAccessTokenSilently` when MFA is needed (has `mfa_token` and `mfa_requirements`)
- `MfaEnrollmentError`, `MfaChallengeError`, `MfaVerifyError` - Thrown by respective `mfa.*` methods

**Common Use Cases:**
- Login/Logout buttons → See Step 4 above
- Protected routes → see the Protected Routes section in this group's patterns guide
- API calls with tokens → see the Calling APIs section in this group's patterns guide
- Error handling → see the Error Handling section in this group's patterns guide
- MFA handling → see the MFA Handling section in this group's patterns guide

## References

- [Auth0 React SDK Documentation](https://auth0.com/docs/libraries/auth0-react)
- [Auth0 React SDK GitHub](https://github.com/auth0/auth0-react)
- [Auth0 React Quickstart](https://auth0.com/docs/quickstart/spa/react)
- [useAuth0 Hook API](https://auth0.github.io/auth0-react/interfaces/Auth0ContextInterface.html)
- [Auth0 React API Reference](https://auth0.github.io/auth0-react/)
- [Auth0 Universal Login](https://auth0.com/docs/universal-login)
- [PKCE Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-proof-key-for-code-exchange-pkce)
