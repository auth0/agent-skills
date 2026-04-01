# Integration Patterns

Common patterns for Auth0 authentication in Expo applications.

---

## Auth0Provider Setup

Wrap your entire app with `Auth0Provider` at the root level:

```tsx
import { Auth0Provider } from 'react-native-auth0';

export default function App() {
  return (
    <Auth0Provider
      domain="YOUR_AUTH0_DOMAIN"
      clientId="YOUR_AUTH0_CLIENT_ID"
    >
      <Navigation />
    </Auth0Provider>
  );
}
```

All components using `useAuth0()` must be descendants of `Auth0Provider`.

---

## Login with Custom Scheme

When using a `customScheme` in `app.json`, you must pass it to both `authorize()` and `clearSession()`:

```tsx
import { useAuth0 } from 'react-native-auth0';

export function AuthScreen() {
  const { authorize, clearSession, user } = useAuth0();

  const login = async () => {
    await authorize(
      { scope: 'openid profile email' },
      { customScheme: 'yourappscheme' }
    );
  };

  const logout = async () => {
    await clearSession({ customScheme: 'yourappscheme' });
  };

  return user ? (
    <Button title="Log Out" onPress={logout} />
  ) : (
    <Button title="Log In" onPress={login} />
  );
}
```

---

## Protected Screen with Navigation

```tsx
import { useAuth0 } from 'react-native-auth0';
import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';

export function ProtectedScreen({ navigation }) {
  const { user, isLoading } = useAuth0();

  useEffect(() => {
    if (!isLoading && !user) {
      navigation.navigate('Login');
    }
  }, [isLoading, user, navigation]);

  if (isLoading) return <ActivityIndicator />;
  if (!user) return null;

  return (
    <View>
      <Text>Welcome, {user.name}</Text>
      <Text>User ID: {user.sub}</Text>
    </View>
  );
}
```

---

## User Profile Display

```tsx
import { useAuth0 } from 'react-native-auth0';
import { View, Text, Image } from 'react-native';

export function ProfileScreen() {
  const { user } = useAuth0();

  if (!user) return <Text>Please log in</Text>;

  return (
    <View>
      {user.picture && (
        <Image
          source={{ uri: user.picture }}
          style={{ width: 100, height: 100, borderRadius: 50 }}
        />
      )}
      <Text>Name: {user.name}</Text>
      <Text>Email: {user.email}</Text>
      <Text>Email Verified: {user.email_verified ? 'Yes' : 'No'}</Text>
    </View>
  );
}
```

---

## Calling Protected APIs

Request an `audience` during login, then use the access token:

```tsx
import { useAuth0 } from 'react-native-auth0';
import { useState } from 'react';

export function ApiScreen() {
  const { authorize, getCredentials } = useAuth0();
  const [data, setData] = useState(null);

  const loginWithApi = async () => {
    await authorize(
      {
        scope: 'openid profile email',
        audience: 'https://your-api-identifier',
      },
      { customScheme: 'yourappscheme' }
    );
  };

  const callApi = async () => {
    const credentials = await getCredentials();
    const response = await fetch('https://your-api.com/data', {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });
    setData(await response.json());
  };

  return (
    <View>
      <Button title="Login" onPress={loginWithApi} />
      <Button title="Call API" onPress={callApi} />
    </View>
  );
}
```

---

## Silent Authentication on App Launch

Check for stored credentials when the app starts:

```tsx
import { useAuth0 } from 'react-native-auth0';
import { useEffect, useState } from 'react';

export function AppWrapper({ children }) {
  const { getCredentials, user, isLoading } = useAuth0();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      if (!user) {
        try {
          await getCredentials();
        } catch {
          // Not logged in — continue to login screen
        }
      }
      setReady(true);
    };
    if (!isLoading) checkAuth();
  }, [isLoading]);

  if (!ready) return <ActivityIndicator />;
  return children;
}
```

---

## Ephemeral Sessions (iOS)

Skip the SSO consent dialog on iOS by using ephemeral sessions:

```tsx
await authorize(
  { scope: 'openid profile email' },
  { customScheme: 'yourappscheme', ephemeralSession: true }
);
```

This prevents the "App wants to use auth0.com to sign in" alert on iOS but disables SSO.

---

## Biometric Authentication

Require biometric authentication before retrieving stored credentials:

```tsx
import { Auth0Provider, LocalAuthenticationStrategy, LocalAuthenticationLevel } from 'react-native-auth0';

export default function App() {
  return (
    <Auth0Provider
      domain="YOUR_AUTH0_DOMAIN"
      clientId="YOUR_AUTH0_CLIENT_ID"
      localAuthenticationOptions={{
        title: 'Authenticate to continue',
        cancelTitle: 'Cancel',
        evaluationPolicy: LocalAuthenticationStrategy.deviceOwnerWithBiometrics,
        authenticationLevel: LocalAuthenticationLevel.strong,
        deviceCredentialFallback: true,
      }}
    >
      <Navigation />
    </Auth0Provider>
  );
}
```

---

## Organizations (B2B)

Log in to a specific organization:

```tsx
await authorize(
  { organization: 'org_abc123', scope: 'openid profile email' },
  { customScheme: 'yourappscheme' }
);
```

Accept organization invitations:

```tsx
import { Linking } from 'react-native';

// Handle deep link with invitation
const url = await Linking.getInitialURL();
if (url?.includes('invitation=')) {
  await authorize(
    { invitationUrl: url },
    { customScheme: 'yourappscheme' }
  );
}
```

---

## Error Handling

### WebAuth Errors

```tsx
import { WebAuthError, WebAuthErrorCodes } from 'react-native-auth0';

try {
  await authorize({}, { customScheme: 'yourappscheme' });
} catch (e) {
  if (e instanceof WebAuthError) {
    switch (e.type) {
      case WebAuthErrorCodes.USER_CANCELLED:
        console.log('User cancelled login');
        break;
      case WebAuthErrorCodes.BROWSER_NOT_AVAILABLE:
        console.log('No browser available');
        break;
      case WebAuthErrorCodes.PKCE_NOT_ALLOWED:
        console.log('Enable PKCE — set app type to Native in Auth0 Dashboard');
        break;
      default:
        console.error('Auth error:', e.message);
    }
  }
}
```

### Credentials Manager Errors

```tsx
import { CredentialsManagerError, CredentialsManagerErrorCodes } from 'react-native-auth0';

try {
  const credentials = await getCredentials();
} catch (e) {
  if (e instanceof CredentialsManagerError) {
    switch (e.type) {
      case CredentialsManagerErrorCodes.NO_CREDENTIALS:
        console.log('No stored credentials — user needs to log in');
        break;
      case CredentialsManagerErrorCodes.NO_REFRESH_TOKEN:
        console.log('Request offline_access scope during login');
        break;
      case CredentialsManagerErrorCodes.RENEW_FAILED:
        console.log('Token refresh failed — re-authenticate');
        break;
      case CredentialsManagerErrorCodes.BIOMETRICS_FAILED:
        console.log('Biometric authentication failed');
        break;
    }
  }
}
```

---

## Custom Login Options

```tsx
await authorize(
  {
    scope: 'openid profile email offline_access',
    audience: 'https://your-api-identifier',
    connection: 'google-oauth2',     // Force specific connection
    prompt: 'login',                 // Force re-authentication
    screen_hint: 'signup',           // Show signup page
    max_age: 300,                    // Re-auth if session > 5 min
  },
  { customScheme: 'yourappscheme' }
);
```

---

## DPoP (Demonstrating Proof-of-Possession)

DPoP is enabled by default in v5.x. Make API calls with DPoP headers:

```tsx
import { useAuth0 } from 'react-native-auth0';

function ApiComponent() {
  const { getCredentials, getDPoPHeaders } = useAuth0();

  const callApi = async () => {
    const credentials = await getCredentials();
    const headers = await getDPoPHeaders({
      url: 'https://api.example.com/data',
      method: 'GET',
      accessToken: credentials.accessToken,
      tokenType: credentials.tokenType,
    });

    const response = await fetch('https://api.example.com/data', {
      method: 'GET',
      headers: { ...headers, 'Content-Type': 'application/json' },
    });

    return response.json();
  };
}
```

---

## Next Steps

- [Setup Guide](setup.md) — Installation and Auth0 configuration
- [API Reference](api.md) — Complete SDK API and testing
- [Main Skill](../SKILL.md) — Quick start workflow
