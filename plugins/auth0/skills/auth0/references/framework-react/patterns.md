# Auth0 React — Integration Patterns

Integration patterns for Auth0 React SDK: custom hooks, testing, protected
routes, user profiles, calling APIs, error handling, and common issues.

> **Prerequisites:** The shared critical rules, prerequisites, and setup steps
> live in this group's overview and setup file. This file assumes Auth0 React
> SDK is already installed and configured.

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
