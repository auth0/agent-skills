
# Auth0 React Integration

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

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-react
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see the Setup Guide section below for complete scripts.

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
- Protected routes → see the Protected Routes section below
- API calls with tokens → see the Calling APIs section below
- Error handling → see the Error Handling section below
- MFA handling → see the MFA Handling section below

## References

- [Auth0 React SDK Documentation](https://auth0.com/docs/libraries/auth0-react)
- [Auth0 React SDK GitHub](https://github.com/auth0/auth0-react)
- [Auth0 React Quickstart](https://auth0.com/docs/quickstart/spa/react)
- [useAuth0 Hook API](https://auth0.github.io/auth0-react/interfaces/Auth0ContextInterface.html)
- [Auth0 React API Reference](https://auth0.github.io/auth0-react/)
- [Auth0 Universal Login](https://auth0.com/docs/universal-login)
- [PKCE Flow](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-proof-key-for-code-exchange-pkce)

---

# Auth0 React SDK API Reference

Complete API documentation for @auth0/auth0-react SDK.

---

## Auth0Provider Configuration

### Complete Configuration Options

```tsx
import { Auth0Provider } from '@auth0/auth0-react';

<Auth0Provider
  // Required
  domain="your-tenant.auth0.com"
  clientId="your-client-id"

  // Authorization parameters
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: 'https://your-api-identifier', // For API calls
    scope: 'openid profile email', // Default scopes
    connection: 'google-oauth2', // Force specific connection
    prompt: 'login', // Force login prompt
    ui_locales: 'en', // Localization
    screen_hint: 'signup', // Show signup page by default
  }}

  // Token management
  cacheLocation="localstorage" // or "memory" for stricter security (default: "memory")
  useRefreshTokens={true} // Enable refresh tokens (default: false)
  useRefreshTokensFallback={false} // Fall back to iframe if refresh token exchange fails (default: false)
  useMrrt={false} // Enable Multi-Refresh-Token for multi-tenant apps (default: false)

  // MFA / Step-up
  interactiveErrorHandler="popup" // Automatically handle MFA via popup (requires useRefreshTokens)

  // Advanced options
  skipRedirectCallback={false} // Skip automatic callback handling
  context={Auth0Context} // Custom React context

  // Callbacks
  onRedirectCallback={(appState) => {
    // Handle redirect after login
    // appState receives the custom state passed to loginWithRedirect()
    // Example: if login was called with appState: { targetUrl: '/dashboard' }
    // then appState.targetUrl will be '/dashboard' here
    window.location.replace(appState?.returnTo || '/');
  }}
>
  <App />
</Auth0Provider>
```

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `domain` | string | **Required** | Your Auth0 tenant domain |
| `clientId` | string | **Required** | Your Auth0 application client ID |
| `authorizationParams` | object | `{}` | Authorization parameters (see below) |
| `cacheLocation` | `'memory' \| 'localstorage'` | `'memory'` | Where to store tokens |
| `useRefreshTokens` | boolean | `false` | Enable refresh token rotation |
| `useRefreshTokensFallback` | boolean | `false` | Fall back to iframe if refresh token exchange fails |
| `useMrrt` | boolean | `false` | Enable Multi-Refresh-Token support for multi-tenant apps. Requires `useRefreshTokens` and `useRefreshTokensFallback` to be `true` |
| `workerUrl` | string | - | Custom worker script URL for token calls. Useful for CSP compliance when using `useRefreshTokens: true` with `cacheLocation: 'memory'` |
| `context` | React.Context | - | Custom React context for nested Auth0Providers. Allows multiple Auth0Providers in same app |
| `interactiveErrorHandler` | `'popup'` | - | Automatically handle MFA via popup when `getAccessTokenSilently` encounters `mfa_required`. Requires `useRefreshTokens={true}` |
| `skipRedirectCallback` | boolean | `false` | Skip automatic callback handling |
| `onRedirectCallback` | function | - | Callback after successful login |

### Authorization Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `redirect_uri` | string | URL to redirect after authentication |
| `audience` | string | API audience identifier |
| `scope` | string | Requested scopes (space-separated) |
| `connection` | string | Force specific connection |
| `prompt` | string | `'none'`, `'login'`, `'consent'`, or `'select_account'` |
| `ui_locales` | string | Language code (e.g., `'en'`, `'es'`) |
| `screen_hint` | string | `'signup'` to show signup by default |
| `max_age` | number | Maximum authentication age in seconds |
| `organization` | string | Organization ID for B2B |
| `invitation` | string | Invitation ID for organization invites |

---

## useAuth0 Hook

### Hook Interface

```typescript
const {
  // Authentication state
  isLoading,
  isAuthenticated,
  error,
  user,

  // Methods
  loginWithRedirect,
  loginWithPopup,
  logout,
  getAccessTokenSilently,
  getAccessTokenWithPopup,
  getIdTokenClaims,
  handleRedirectCallback,

  // MFA API
  mfa,
} = useAuth0();
```

### Authentication State

| Property | Type | Description |
|----------|------|-------------|
| `isLoading` | boolean | True while Auth0 is initializing |
| `isAuthenticated` | boolean | True if user is logged in |
| `error` | Error \| undefined | Authentication error if any |
| `user` | User \| undefined | User profile information |

### User Object

```typescript
interface User {
  sub: string;          // User ID
  name: string;         // Display name
  email: string;        // Email address
  email_verified: boolean;
  picture: string;      // Avatar URL
  updated_at: string;   // Last update timestamp
  // Custom claims...
}
```

### Methods

#### loginWithRedirect

```typescript
await loginWithRedirect(options?: RedirectLoginOptions);
```

Redirects to Auth0 Universal Login page.

**Options:**
```typescript
interface RedirectLoginOptions {
  authorizationParams?: {
    redirect_uri?: string;
    audience?: string;
    scope?: string;
    connection?: string;
    prompt?: 'none' | 'login' | 'consent' | 'select_account';
    max_age?: number;
    ui_locales?: string;
    screen_hint?: 'signup' | 'login';
  };
  appState?: any; // Custom state to preserve
  fragment?: string; // URL fragment
}
```

**Example:**
```tsx
// Basic login
await loginWithRedirect();

// Login with specific connection
await loginWithRedirect({
  authorizationParams: {
    connection: 'google-oauth2'
  }
});

// Login with custom state (preserved through redirect)
await loginWithRedirect({
  appState: { targetUrl: '/dashboard' }
});
// After login, onRedirectCallback receives appState.targetUrl = '/dashboard'
```

#### loginWithPopup

```typescript
await loginWithPopup(options?: PopupLoginOptions);
```

Opens Auth0 login in popup window (better UX, but may be blocked).

**Options:**
```typescript
interface PopupLoginOptions {
  authorizationParams?: AuthorizationParams;
  config?: PopupConfigOptions; // Popup window configuration
}
```

**Example:**
```tsx
try {
  await loginWithPopup();
} catch (error) {
  // Handle popup blocked or closed
  console.error('Popup login failed:', error);
}
```

#### logout

```typescript
logout(options?: LogoutOptions);
```

Logs out the user and optionally redirects.

**Options:**
```typescript
interface LogoutOptions {
  logoutParams?: {
    returnTo?: string; // URL to redirect after logout
    federated?: boolean; // Logout from identity provider too
    client_id?: string; // Client ID (if different from current)
  };
  openUrl?: (url: string) => void; // Custom URL opener
}
```

**Example:**
```tsx
// Basic logout
logout();

// Logout with redirect
logout({
  logoutParams: {
    returnTo: window.location.origin
  }
});

// Federated logout (logout from Google/Facebook too)
logout({
  logoutParams: {
    returnTo: window.location.origin,
    federated: true
  }
});
```

#### getAccessTokenSilently

```typescript
const token = await getAccessTokenSilently(options?: GetTokenSilentlyOptions);
```

Gets access token without user interaction (uses refresh token or iframe).

**Options:**
```typescript
interface GetTokenSilentlyOptions {
  authorizationParams?: {
    audience?: string;
    scope?: string;
    ignoreCache?: boolean; // Force new token
    timeoutInSeconds?: number; // Request timeout
    detailedResponse?: boolean; // Return full response with expiry
  };
}
```

**Example:**
```tsx
// Basic usage
const token = await getAccessTokenSilently();

// With specific audience
const token = await getAccessTokenSilently({
  authorizationParams: {
    audience: 'https://api.example.com'
  }
});

// Force fresh token
const token = await getAccessTokenSilently({
  authorizationParams: {
    ignoreCache: true
  }
});

// Get detailed response with expiry
const { access_token, expires_in } = await getAccessTokenSilently({
  authorizationParams: {
    detailedResponse: true
  }
});
```

#### getAccessTokenWithPopup

```typescript
const token = await getAccessTokenWithPopup(options?: GetTokenWithPopupOptions);
```

Gets access token via popup window. Useful as fallback when `getAccessTokenSilently` fails (e.g., third-party cookies blocked).

**Options:**
```typescript
interface GetTokenWithPopupOptions {
  authorizationParams?: {
    audience?: string;
    scope?: string;
  };
  config?: PopupConfigOptions; // Popup window configuration
}
```

**Example:**
```tsx
// Try silent auth, fall back to popup
try {
  const token = await getAccessTokenSilently();
} catch (error) {
  // Fallback to popup if silent auth fails
  const token = await getAccessTokenWithPopup();
}

// Direct popup usage with specific audience
const token = await getAccessTokenWithPopup({
  authorizationParams: {
    audience: 'https://api.example.com'
  }
});
```

#### getIdTokenClaims

```typescript
const claims = await getIdTokenClaims();
```

Returns ID token claims.

**Example:**
```tsx
const claims = await getIdTokenClaims();
console.log(claims.sub); // User ID
console.log(claims.email);
console.log(claims.custom_claim);
```

#### handleRedirectCallback

```typescript
const result = await handleRedirectCallback(url?: string);
```

Manually handle redirect callback (when `skipRedirectCallback` is true).

**Returns:**
```typescript
interface RedirectLoginResult {
  appState: any; // Custom state from login
}
```

#### mfa

The `mfa` property provides access to the MFA API client for in-app Multi-Factor Authentication flows.

**Methods:**

| Method | Description |
|--------|-------------|
| `mfa.getAuthenticators(mfaToken)` | List enrolled authenticators for the user |
| `mfa.getEnrollmentFactors(mfaToken)` | Get available enrollment factors (when user needs to enroll) |
| `mfa.enroll(params)` | Enroll a new authenticator (OTP, SMS, Email, Voice, Push) |
| `mfa.challenge(params)` | Initiate an MFA challenge for an enrolled authenticator |
| `mfa.verify(params)` | Verify an MFA challenge and complete authentication |

**Enroll params:**

```typescript
// OTP enrollment
await mfa.enroll({ mfaToken, factorType: 'otp' });
// Returns: { barcodeUri, recoveryCodes, ... }

// SMS enrollment
await mfa.enroll({ mfaToken, factorType: 'sms', phoneNumber: '+12025551234' });

// Email enrollment
await mfa.enroll({ mfaToken, factorType: 'email', email: 'user@example.com' });

// Voice enrollment
await mfa.enroll({ mfaToken, factorType: 'voice', phoneNumber: '+12025551234' });

// Push enrollment
await mfa.enroll({ mfaToken, factorType: 'push' });
```

**Challenge params:**

```typescript
// OTP challenge (optional — code is already in authenticator app)
await mfa.challenge({ mfaToken, challengeType: 'otp', authenticatorId });

// SMS/Voice/Email/Push challenge (required — sends code to user)
await mfa.challenge({ mfaToken, challengeType: 'oob', authenticatorId });
// Returns: { oobCode }
```

**Verify params:**

```typescript
// Verify with OTP code
const tokens = await mfa.verify({ mfaToken, otp: '123456' });

// Verify with OOB code (SMS/Voice/Email)
const tokens = await mfa.verify({ mfaToken, oobCode, bindingCode: '123456' });

// Verify with recovery code
const tokens = await mfa.verify({ mfaToken, recoveryCode: 'recovery-code-here' });
```

---

### MFA Error Types

All MFA error types are importable from `@auth0/auth0-react`.

| Error | When thrown | Key properties |
|-------|-----------|----------------|
| `MfaRequiredError` | `getAccessTokenSilently()` encounters an MFA requirement | `mfa_token`, `mfa_requirements` |
| `MfaEnrollmentError` | `mfa.enroll()` fails | `error_description` |
| `MfaChallengeError` | `mfa.challenge()` fails | `error_description` |
| `MfaVerifyError` | `mfa.verify()` fails (e.g., invalid OTP code) | `error_description` |
| `MfaListAuthenticatorsError` | `mfa.getAuthenticators()` fails | `error_description` |
| `MfaEnrollmentFactorsError` | `mfa.getEnrollmentFactors()` fails | `error_description` |

**MfaRequiredError properties:**
- `mfa_token` — Token used for all subsequent MFA operations
- `mfa_requirements.enroll` — Array of factor types the user can enroll in (present when user needs to set up MFA)
- `mfa_requirements.challenge` — Array of factor types the user can challenge (present when user has enrolled authenticators)

**Import:**

```typescript
import {
  MfaRequiredError,
  MfaEnrollmentError,
  MfaChallengeError,
  MfaVerifyError,
} from '@auth0/auth0-react';
```

---

## Custom Hooks

### withAuth0

Higher-order component for class components:

```tsx
import { withAuth0 } from '@auth0/auth0-react';

class Profile extends React.Component {
  render() {
    const { auth0, isLoading, isAuthenticated, user } = this.props;
    // Use auth0 methods and state
  }
}

export default withAuth0(Profile);
```

### withAuthenticationRequired

HOC to protect components requiring authentication:

```tsx
import { withAuthenticationRequired } from '@auth0/auth0-react';

const ProtectedComponent = () => {
  return <div>Protected content</div>;
};

export default withAuthenticationRequired(ProtectedComponent, {
  onRedirecting: () => <div>Loading...</div>,
  returnTo: '/profile', // Where to return after login
  loginOptions: {
    authorizationParams: {
      connection: 'google-oauth2'
    }
  }
});
```

---

## Testing

### Testing with React Testing Library

```tsx
import { render, screen } from '@testing-library/react';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

// Mock Auth0
jest.mock('@auth0/auth0-react', () => ({
  ...jest.requireActual('@auth0/auth0-react'),
  Auth0Provider: ({ children }) => children,
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: {
      name: 'Test User',
      email: 'test@example.com'
    },
    loginWithRedirect: jest.fn(),
    logout: jest.fn(),
  }),
}));

test('renders authenticated app', () => {
  render(<App />);
  expect(screen.getByText('Test User')).toBeInTheDocument();
});
```

### Testing with Custom Mock

```tsx
// testUtils.tsx
import { Auth0Provider } from '@auth0/auth0-react';

export const mockAuth0User = {
  name: 'Test User',
  email: 'test@example.com',
  picture: 'https://example.com/avatar.jpg',
};

export function renderWithAuth0(ui: React.ReactElement, isAuthenticated = true) {
  return render(
    <Auth0Provider
      domain="test.auth0.com"
      clientId="test-client-id"
      authorizationParams={{
        redirect_uri: window.location.origin
      }}
    >
      {ui}
    </Auth0Provider>
  );
}
```

---

## TypeScript Types

### Import Types

```typescript
import type {
  Auth0ContextInterface,
  User,
  RedirectLoginOptions,
  PopupLoginOptions,
  LogoutOptions,
  GetTokenSilentlyOptions,
  MfaApiClient,
  Authenticator,
  EnrollParams,
  ChallengeResponse,
  VerifyParams,
  EnrollmentFactor,
} from '@auth0/auth0-react';

// MFA error types (value imports, not type-only)
import {
  MfaRequiredError,
  MfaEnrollmentError,
  MfaChallengeError,
  MfaVerifyError,
} from '@auth0/auth0-react';
```

### Type User Profile

```typescript
interface CustomUser extends User {
  app_metadata?: {
    roles?: string[];
  };
  user_metadata?: {
    preferences?: any;
  };
}

const { user } = useAuth0<CustomUser>();
console.log(user?.app_metadata?.roles);
```

---

# Auth0 React Integration Patterns

Practical implementation patterns and examples for common use cases.

---

## Protected Routes

### Basic Protected Route Component

```tsx
import { useAuth0 } from '@auth0/auth0-react';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  return <>{children}</>;
}
```

### Usage with React Router

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## User Profile

### Display User Information

```tsx
import { useAuth0 } from '@auth0/auth0-react';

export function Profile() {
  const { user, isAuthenticated } = useAuth0();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <img src={user?.picture} alt={user?.name} />
      <h2>{user?.name}</h2>
      <p>{user?.email}</p>
    </div>
  );
}
```

---

## Calling APIs

### Call Protected API with Access Token

```tsx
import { useAuth0 } from '@auth0/auth0-react';
import { useState } from 'react';

export function ApiTest() {
  const { getAccessTokenSilently } = useAuth0();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const callApi = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: 'https://your-api-identifier', // Your API identifier
        }
      });

      const response = await fetch('https://api.example.com/data', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <button onClick={callApi}>Call API</button>
      {error && <div>Error: {error}</div>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

### Configure Provider for API Calls

When calling APIs, add `audience` to your Auth0Provider:

```tsx
<Auth0Provider
  domain={import.meta.env.VITE_AUTH0_DOMAIN}
  clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: 'https://your-api-identifier' // Add this
  }}
>
  <App />
</Auth0Provider>
```

---

## Error Handling

### Handle Loading and Error States

```tsx
import { useAuth0 } from '@auth0/auth0-react';

export function App() {
  const { isLoading, error, isAuthenticated, user } = useAuth0();

  if (isLoading) {
    return <div>Loading authentication...</div>;
  }

  if (error) {
    return <div>Authentication error: {error.message}</div>;
  }

  return isAuthenticated ? (
    <div>
      <h1>Welcome back, {user?.name}!</h1>
      <AuthenticatedApp />
    </div>
  ) : (
    <div>
      <h1>Please log in</h1>
      <LoginButton />
    </div>
  );
}
```

---

## Silent Authentication

### Auto-login on Page Load

```tsx
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';

export function App() {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Attempt silent authentication
      getAccessTokenSilently().catch(() => {
        // User not logged in, do nothing
      });
    }
  }, [isLoading, isAuthenticated, getAccessTokenSilently]);

  // Rest of your app...
}
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid state" error | Clear browser storage and try again. Ensure `redirect_uri` matches configured callback URL |
| User stuck on loading | Check Auth0 application settings have correct callback URLs configured |
| API calls fail with 401 | Ensure `audience` is configured in Auth0Provider and matches your API identifier |
| Logout doesn't work | Include `returnTo` URL in logout options and configure in Auth0 "Allowed Logout URLs" |
| CORS errors when calling API | Add your application URL to "Allowed Web Origins" in Auth0 application settings |
| Tokens not refreshing | Enable `useRefreshTokens={true}` in Auth0Provider and ensure refresh token rotation is enabled in Auth0 |

---

## MFA Handling

The `@auth0/auth0-react` SDK provides a built-in MFA API for handling Multi-Factor Authentication entirely within your app — no redirects to Universal Login required. Access it via the `mfa` property from `useAuth0()`.

> **Note:** MFA support via SDKs is currently in Early Access. For a simpler approach that uses Universal Login to handle MFA automatically (no custom UI), see the [Step-Up via Popup](#step-up-via-popup-simpler-approach) section below.

### Catching MfaRequiredError

When `getAccessTokenSilently()` encounters an MFA requirement, it throws `MfaRequiredError`. Catch it and inspect `mfa_requirements` to determine the flow:

```tsx
import { useAuth0, MfaRequiredError } from '@auth0/auth0-react';
import { useState } from 'react';

export function ProtectedApiCall() {
  const { getAccessTokenSilently, mfa } = useAuth0();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callApi = async () => {
    try {
      const token = await getAccessTokenSilently();
      // Use token to call API...
    } catch (err) {
      if (err instanceof MfaRequiredError) {
        setMfaToken(err.mfa_token);

        // Check if enrollment or challenge is needed
        const factors = await mfa.getEnrollmentFactors(err.mfa_token);
        if (factors.length > 0) {
          // User needs to enroll — show enrollment UI
        } else {
          // User has authenticators — show challenge UI
          const authenticators = await mfa.getAuthenticators(err.mfa_token);
          // Let user pick authenticator and proceed with challenge
        }
      } else {
        setError(err.message);
      }
    }
  };

  return <button onClick={callApi}>Call Protected API</button>;
}
```

### OTP Enrollment

When the user needs to set up MFA for the first time:

```tsx
import { useAuth0, MfaEnrollmentError } from '@auth0/auth0-react';
import { useState } from 'react';

export function OtpEnrollment({ mfaToken }: { mfaToken: string }) {
  const { mfa } = useAuth0();
  const [barcodeUri, setBarcodeUri] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startEnrollment = async () => {
    try {
      const enrollment = await mfa.enroll({ mfaToken, factorType: 'otp' });
      setBarcodeUri(enrollment.barcodeUri);
      setRecoveryCodes(enrollment.recoveryCodes);
    } catch (err) {
      if (err instanceof MfaEnrollmentError) {
        setError(err.error_description);
      }
    }
  };

  return (
    <div>
      <button onClick={startEnrollment}>Set up authenticator app</button>
      {barcodeUri && (
        <div>
          <p>Scan this QR code with your authenticator app:</p>
          {/* Render barcodeUri as QR code using a library like qrcode.react */}
          <code>{barcodeUri}</code>
        </div>
      )}
      {recoveryCodes && (
        <div>
          <p>Save these recovery codes:</p>
          <ul>
            {recoveryCodes.map((code, i) => <li key={i}>{code}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### Challenge and Verify

When the user already has enrolled authenticators:

```tsx
import {
  useAuth0,
  MfaChallengeError,
  MfaVerifyError,
} from '@auth0/auth0-react';
import { useState } from 'react';

export function MfaChallenge({ mfaToken }: { mfaToken: string }) {
  const { mfa } = useAuth0();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      // For OTP authenticators, you can skip challenge() and go straight to verify()
      const tokens = await mfa.verify({ mfaToken, otp });
      // User is now authenticated — tokens are cached by the SDK
      // Access token available at tokens.access_token
    } catch (err) {
      if (err instanceof MfaVerifyError) {
        setError('Invalid code. Please try again.');
      } else if (err instanceof MfaChallengeError) {
        setError('Challenge failed: ' + err.error_description);
      }
    }
  };

  return (
    <div>
      <h3>Enter your verification code</h3>
      <input
        type="text"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="6-digit code"
        maxLength={6}
      />
      <button onClick={handleVerify}>Verify</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

### SMS/Email Challenge (Out-of-Band)

For SMS, Email, Voice, or Push authenticators, you must call `challenge()` first to send the code:

```tsx
// Initiate challenge to send code via SMS/Email
const response = await mfa.challenge({
  mfaToken,
  challengeType: 'oob',
  authenticatorId: authenticator.id,
});

// Verify with the OOB code and the binding code the user received
const tokens = await mfa.verify({
  mfaToken,
  oobCode: response.oobCode,
  bindingCode: userEnteredCode,
});
```

### Step-Up via Popup (Simpler Approach)

If you don't need a custom MFA UI, configure `interactiveErrorHandler` to let the SDK handle MFA automatically via a Universal Login popup:

```tsx
<Auth0Provider
  domain={import.meta.env.VITE_AUTH0_DOMAIN}
  clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: 'https://your-api-identifier',
  }}
  useRefreshTokens={true}
  interactiveErrorHandler="popup"
>
  <App />
</Auth0Provider>
```

With this setup, `getAccessTokenSilently()` automatically opens a popup when MFA is required. No error handling needed — the token is returned after the user completes MFA in the popup.

---

## Security Considerations

### Client-Side Security

- **Never expose client secret** - React is client-side, use only public client credentials
- **Use PKCE** - Enabled by default with @auth0/auth0-react
- **Validate tokens on backend** - Never trust client-side token validation
- **Use HTTPS in production** - Auth0 requires HTTPS for production redirect URLs
- **Implement proper CORS** - Configure allowed origins in Auth0 application settings

### Token Storage

```tsx
// Default: memory storage for highest security (tokens cleared on page refresh)
<Auth0Provider
  cacheLocation="memory"
  {...other props}
>

// Or localstorage for better UX (tokens persist across refreshes)
<Auth0Provider
  cacheLocation="localstorage"
  {...other props}
>
```

### Secure API Calls

Always validate tokens on your backend:

**Installation:**
```bash
npm install express-oauth2-jwt-bearer
```

**Backend validation example (Node.js):**
```javascript
const { auth, requiredScopes } = require('express-oauth2-jwt-bearer');

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
});

app.get('/api/private', checkJwt, (req, res) => {
  res.json({ message: 'Secured data' });
});

// With scope validation
app.get('/api/users', checkJwt, requiredScopes('read:users'), (req, res) => {
  res.json({ users: [] });
});
```

---

## Advanced Patterns

### Custom Login with Redirect Options

```tsx
const { loginWithRedirect } = useAuth0();

// Login with specific connection
await loginWithRedirect({
  authorizationParams: {
    connection: 'google-oauth2'
  }
});

// Login with prompt
await loginWithRedirect({
  authorizationParams: {
    prompt: 'login' // Force login even if user has session
  }
});

// Login with custom state
await loginWithRedirect({
  appState: { targetUrl: '/protected-page' }
});
```

### Handle Redirect Callback

```tsx
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function Callback() {
  const { handleRedirectCallback } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const result = await handleRedirectCallback();
      const targetUrl = result.appState?.targetUrl || '/';
      navigate(targetUrl);
    })();
  }, [handleRedirectCallback, navigate]);

  return <div>Processing login...</div>;
}
```

### Custom Logout

```tsx
const { logout } = useAuth0();

// Logout with custom return URL
logout({
  logoutParams: {
    returnTo: `${window.location.origin}/goodbye`
  }
});

// Logout without redirect (federated logout)
logout({
  logoutParams: {
    federated: true
  }
});
```

---

## Testing

### Manual Testing Checklist

1. **Login Flow**
   - Start dev server: `npm run dev` (Vite) or `npm start` (CRA)
   - Click "Login" button
   - Complete Auth0 Universal Login
   - Verify redirect back to your app with user authenticated
   - Check user profile displays correctly

2. **Logout Flow**
   - Click "Logout" button
   - Verify user is logged out
   - Verify redirect to correct page

3. **Protected Routes**
   - Navigate to protected route while logged out
   - Verify redirect to Auth0 login
   - After login, verify redirect back to protected route

4. **API Calls**
   - Call protected API endpoint
   - Verify access token is included in request
   - Verify API responds correctly

---

---

# Auth0 React Setup Guide

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

Run this script to automatically set up everything:

```bash
#!/bin/bash

# Detect OS and install Auth0 CLI if needed
if ! command -v auth0 &> /dev/null; then
  echo "Installing Auth0 CLI..."
  if [[ "$OSTYPE" == "darwin"* || "$OSTYPE" == "linux-gnu"* ]]; then
    if ! command -v brew &> /dev/null; then
      echo "❌ Homebrew is required to install the Auth0 CLI."
      echo "   Install Homebrew: https://brew.sh"
      echo "   Then re-run this script, or install the CLI manually:"
      echo "   https://github.com/auth0/auth0-cli#installation"
      exit 1
    fi
    brew install auth0/auth0-cli/auth0
  elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
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
  echo ""
  read -p "Do you have an Auth0 account? (y/n): " HAS_ACCOUNT

  if [[ "$HAS_ACCOUNT" != "y" ]]; then
    echo ""
    echo "Let's create your free Auth0 account!"
    echo ""
    echo "1. Visit: https://auth0.com/signup"
    echo "2. Sign up with your email or GitHub"
    echo "3. Choose a tenant domain (e.g., 'mycompany')"
    echo "4. Complete the onboarding"
    echo ""
    read -p "Press Enter when you've created your account..."
  fi

  echo ""
  echo "Logging in to Auth0..."
  echo "A browser will open for authentication."
  echo ""
  auth0 login

  if ! auth0 tenants list &> /dev/null; then
    echo "❌ Login failed. Please try again or visit https://auth0.com/docs"
    exit 1
  fi

  echo "✅ Successfully logged in to Auth0!"
fi

# Detect if Vite or CRA
if grep -q '"vite"' package.json 2>/dev/null; then
  PREFIX="VITE_AUTH0"
elif grep -q '"react-scripts"' package.json 2>/dev/null; then
  PREFIX="REACT_APP_AUTH0"
else
  echo "Detecting React project type..."
  PREFIX="VITE_AUTH0"  # Default to Vite
fi

# List apps and prompt for selection
echo "Your Auth0 applications:"
auth0 apps list

read -p "Enter your Auth0 app ID (or press Enter to create a new one): " APP_ID

if [ -z "$APP_ID" ]; then
  echo "Creating new Auth0 SPA application..."
  APP_NAME="${PWD##*/}-react-app"
  APP_ID=$(auth0 apps create \
    --name "$APP_NAME" \
    --type spa \
    --auth-method None \
    --callbacks "http://localhost:3000,http://localhost:5173" \
    --logout-urls "http://localhost:3000,http://localhost:5173" \
    --origins "http://localhost:3000,http://localhost:5173" \
    --web-origins "http://localhost:3000,http://localhost:5173" \
    --metadata "created_by=agent_skills" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
  echo "Created app with ID: $APP_ID"
fi

# Get app details and create .env file
echo "Fetching Auth0 credentials..."
AUTH0_DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)

# Append Auth0 credentials to .env
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
  Write-Host ""
  Write-Host "======================================"
  Write-Host "Auth0 Login Required"
  Write-Host "======================================"
  Write-Host ""

  $hasAccount = Read-Host "Do you have an Auth0 account? (y/n)"

  if ($hasAccount -ne "y") {
    Write-Host ""
    Write-Host "Let's create your free Auth0 account!"
    Write-Host ""
    Write-Host "1. Visit: https://auth0.com/signup"
    Write-Host "2. Sign up with your email or GitHub"
    Write-Host "3. Choose a tenant domain (e.g., 'mycompany')"
    Write-Host "4. Complete the onboarding"
    Write-Host ""
    Read-Host "Press Enter when you've created your account"
  }

  Write-Host ""
  Write-Host "Logging in to Auth0..."
  Write-Host "A browser will open for authentication."
  Write-Host ""
  auth0 login

  try {
    auth0 tenants list | Out-Null
    Write-Host "✅ Successfully logged in to Auth0!"
  } catch {
    Write-Host "❌ Login failed. Please try again or visit https://auth0.com/docs"
    exit 1
  }
}

# Detect project type
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
  $appJson = auth0 apps create --name "$appName-react-app" --type spa `
    --auth-method None `
    --callbacks "http://localhost:3000,http://localhost:5173" `
    --logout-urls "http://localhost:3000,http://localhost:5173" `
    --origins "http://localhost:3000,http://localhost:5173" `
    --web-origins "http://localhost:3000,http://localhost:5173" `
    --metadata "created_by=agent_skills" --json

  $appId = ($appJson | ConvertFrom-Json).client_id
  Write-Host "Created app with ID: $appId"
}

# Get credentials and create .env
Write-Host "Fetching Auth0 credentials..."
$appDetails = auth0 apps show $appId --json | ConvertFrom-Json

@"
${prefix}_DOMAIN=$($appDetails.domain)
${prefix}_CLIENT_ID=$($appDetails.client_id)
"@ | Out-File -FilePath .env -Encoding UTF8 -Append

Write-Host "✅ Auth0 configuration complete!"
Write-Host "Appended to .env:"
Write-Host "  ${prefix}_DOMAIN=$($appDetails.domain)"
Write-Host "  ${prefix}_CLIENT_ID=$($appDetails.client_id)"
```

---

## Manual Setup

If you prefer manual setup or the scripts don't work:

### Step 1: Install SDK

```bash
npm install @auth0/auth0-react
```

### Step 2: Install Auth0 CLI

**macOS:**
```bash
brew install auth0/auth0-cli/auth0
```

**Linux (via Homebrew):**
```bash
# Requires Homebrew on Linux: https://brew.sh
brew install auth0/auth0-cli/auth0
```

**Windows:**
```powershell
scoop install auth0
# Or: choco install auth0-cli
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

**For Vite:**
```bash
VITE_AUTH0_DOMAIN=<your-tenant>.auth0.com
VITE_AUTH0_CLIENT_ID=<your-client-id>
```

**For Create React App:**
```bash
REACT_APP_AUTH0_DOMAIN=<your-tenant>.auth0.com
REACT_APP_AUTH0_CLIENT_ID=<your-client-id>
```

---

## Creating an Auth0 Application via Dashboard

If you prefer using the Auth0 Dashboard instead of the CLI:

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose:
   - Name: Your app name
   - Type: **Single Page Web Applications**
5. Configure:
   - **Allowed Callback URLs**: `http://localhost:3000, http://localhost:5173`
   - **Allowed Logout URLs**: `http://localhost:3000, http://localhost:5173`
   - **Allowed Web Origins**: `http://localhost:3000, http://localhost:5173`
   - **Allowed Origins (CORS)**: `http://localhost:3000, http://localhost:5173`
6. Copy your **Domain** and **Client ID**
7. Create `.env` file as shown in Step 4 above

---

## Troubleshooting Setup

### CLI Installation Issues

**macOS - Homebrew not found:**
```bash
# Install Homebrew first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Windows - Scoop not found:**
```powershell
# Install Scoop first
iwr -useb get.scoop.sh | iex
```

### Login Issues

**Browser doesn't open:**
```bash
# Use device code flow
auth0 login --no-browser
```

**"Not logged in" error:**
```bash
# Force new login
auth0 login --force
```

### Environment Variable Issues

**Variables not loading (Vite):**
- Ensure variables start with `VITE_`
- Restart dev server after creating `.env`
- Check file is named exactly `.env` (not `.env.local`)

**Variables not loading (CRA):**
- Ensure variables start with `REACT_APP_`
- Restart dev server after creating `.env`
- CRA doesn't support `.env` hot reload

---

## Next Steps

After setup is complete:
1. Return to the main skill guide for integration steps
