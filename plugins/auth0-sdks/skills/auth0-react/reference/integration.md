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

      const response = await fetch('https://your-api.com/data', {
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

## Next Steps

- [API Reference](api.md) - Complete SDK documentation, configuration options, hooks reference
- [Setup Guide](setup.md) - Detailed setup instructions and scripts
- [Main Skill](../SKILL.md) - Return to main skill guide
