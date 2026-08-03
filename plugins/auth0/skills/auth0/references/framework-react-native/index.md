
# Auth0 React Native Integration

Add authentication to React Native and Expo mobile applications using react-native-auth0.

## Prerequisites

- React Native or Expo application
- Auth0 account and application configured as Native type
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Expo managed workflow** - Use the Auth0 integration workflow for Expo (config plugin)
- **React web applications** - Use the Auth0 integration workflow for React SPAs (Vite/CRA)
- **React Server Components** - Use the Auth0 integration workflow for Next.js applications
- **Non-React native apps** - Use platform-specific SDKs (Swift for iOS, Kotlin for Android)
- **Backend APIs** - Use JWT validation libraries for your server language

## Quick Start Workflow

### 1. Install SDK

**Expo:**
```bash
npx expo install react-native-auth0
```

**React Native CLI:**
```bash
npm install react-native-auth0
npx pod-install  # iOS only
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see the Setup Guide section below for complete scripts.

**For manual setup:**

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
```

### 3. Configure Native Platforms

**iOS** - Update `ios/{YourApp}/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>None</string>
    <key>CFBundleURLName</key>
    <string>auth0</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>$(PRODUCT_BUNDLE_IDENTIFIER).auth0</string>
    </array>
  </dict>
</array>
```

**Android** - Update `android/app/src/main/AndroidManifest.xml`:

```xml
<activity
    android:name="com.auth0.android.provider.RedirectActivity"
    android:exported="true">
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:host="YOUR_AUTH0_DOMAIN"
            android:pathPrefix="/android/${applicationId}/callback"
            android:scheme="${applicationId}" />
    </intent-filter>
</activity>
```

**Expo** - Update `app.json`:

```json
{
  "expo": {
    "scheme": "your-app-scheme",
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp"
    },
    "android": {
      "package": "com.yourcompany.yourapp"
    }
  }
}
```

### 4. Add Authentication with Auth0Provider

Wrap your app with `Auth0Provider`:

```typescript
import React from 'react';
import { Auth0Provider } from 'react-native-auth0';
import App from './App';

export default function Root() {
  return (
    <Auth0Provider
      domain={process.env.AUTH0_DOMAIN}
      clientId={process.env.AUTH0_CLIENT_ID}
    >
      <App />
    </Auth0Provider>
  );
}
```

### 5. Use the useAuth0 Hook

```typescript
import React from 'react';
import { View, Button, Text, ActivityIndicator } from 'react-native';
import { useAuth0 } from 'react-native-auth0';

export default function App() {
  const { user, authorize, clearSession, isLoading } = useAuth0();

  const login = async () => {
    try {
      await authorize({
        scope: 'openid profile email'
      });
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      await clearSession();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoading) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      {user ? (
        <>
          <Text>Welcome, {user.name}!</Text>
          <Text>{user.email}</Text>
          <Button title="Logout" onPress={logout} />
        </>
      ) : (
        <Button title="Login" onPress={login} />
      )}
    </View>
  );
}
```

### 6. Test Authentication

**Expo:**
```bash
npx expo start
```

**React Native:**
```bash
npx react-native run-ios
# or
npx react-native run-android
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to wrap app with Auth0Provider | All components using useAuth0() must be children of Auth0Provider |
| Forgot to configure deep linking | Add URL scheme to iOS Info.plist and Android AndroidManifest.xml (see Step 3) |
| Callback URL mismatch | Ensure callback URL in Auth0 Dashboard matches your app's URL scheme (e.g., `com.yourapp.auth0://YOUR_DOMAIN/ios/com.yourapp/callback`) |
| iOS build fails after install | Run `npx pod-install` to link native dependencies |
| App created as SPA type in Auth0 | Must be Native application type for mobile apps |
| Not handling auth errors | Wrap authorize/clearSession calls in try-catch blocks |
| Deep link not working on Android | Verify `android:exported="true"` is set on RedirectActivity |

## Related Capabilities

- Auth0 setup — run the CLI: `auth0 login`, then `auth0 apps create`
- Migrate from another auth provider → ask for migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**Core Hook API:**
- `useAuth0()` - Main hook for authentication
- `authorize()` - Initiate login
- `clearSession()` - Logout
- `user` - User profile object
- `getCredentials()` - Get tokens for API calls
- `isLoading` - Loading state

**Common Use Cases:**
- Login/Logout → See Step 5 above
- Secure token storage → Automatic with `Auth0Provider`
- Biometric authentication → see the Biometric Auth section below
- API calls with tokens → see the Calling APIs section below
- Token refresh → Automatic with `getCredentials()`

## References

- [Auth0 React Native SDK Documentation](https://auth0.com/docs/libraries/react-native-auth0)
- [Auth0 React Native Quickstart](https://auth0.com/docs/quickstart/native/react-native)
- [SDK GitHub Repository](https://github.com/auth0/react-native-auth0)

---

## Testing

### iOS Testing

1. Run the app: `npx react-native run-ios` or `npx expo run:ios`
2. Tap "Login" button
3. Safari opens with Auth0 Universal Login
4. Complete authentication
5. App opens via deep link with user authenticated
6. Tap "Logout" and verify session cleared

### Android Testing

1. Run the app: `npx react-native run-android` or `npx expo run:android`
2. Tap "Login" button
3. Chrome Custom Tabs opens with Auth0 login
4. Complete authentication
5. App resumes via intent filter with user authenticated
6. Tap "Logout" and verify session cleared

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Deep link not working (iOS) | Check `CFBundleURLSchemes` matches bundle identifier exactly |
| Deep link not working (Android) | Verify `android:scheme` and `android:host` in AndroidManifest.xml |
| "Invalid state" error | Clear app data and reinstall. Check callback URLs match configuration |
| Login opens but doesn't return to app | Ensure deep linking is properly configured and tested |
| Expo build fails | Run `npx expo prebuild` to generate native configuration |
| iOS builds fail after pod install | Run `cd ios && pod deintegrate && pod install` |

---

## Security Considerations

- **Use secure storage** - Credentials are stored securely using Keychain (iOS) and Keystore (Android)
- **HTTPS only** - Auth0 requires HTTPS callback URLs (except localhost for dev)
- **Validate tokens on backend** - Never trust client-side token validation
- **Use PKCE** - Enabled by default with react-native-auth0
- **Implement biometric authentication** - Use react-native-biometrics with Auth0 for enhanced security
- **Handle token expiration** - Implement refresh token logic with `getCredentials()`

---

## Related Capabilities

- Auth0 setup — run the CLI: `auth0 login`, then `auth0 apps create`
- Migrate from another auth provider → ask for migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Passkey authentication → ask for MFA/passkeys (feature:mfa)
- B2B multi-tenancy support → ask for Organizations (feature:organizations)

---

## References

- [React Native Auth0 SDK Documentation](https://auth0.com/docs/libraries/auth0-react-native)
- [React Native Auth0 SDK GitHub](https://github.com/auth0/react-native-auth0)
- [Auth0 React Native Quickstart](https://auth0.com/docs/quickstart/native/react-native)
- [React Native Deep Linking](https://reactnative.dev/docs/linking)
- [Expo Deep Linking](https://docs.expo.dev/guides/deep-linking/)

---

## Common Patterns

### Protected Screen with Navigation

```tsx
import { useAuth0 } from 'react-native-auth0';
import { useEffect } from 'react';
import { NavigationProp } from '@react-navigation/native';

export function ProtectedScreen({ navigation }: { navigation: NavigationProp<any> }) {
  const { user, isLoading } = useAuth0();

  useEffect(() => {
    if (!isLoading && !user) {
      navigation.navigate('Login');
    }
  }, [isLoading, user, navigation]);

  if (isLoading) {
    return <ActivityIndicator />;
  }

  if (!user) {
    return null;
  }

  return (
    <View>
      <Text>Protected Content</Text>
      <Text>User ID: {user.sub}</Text>
    </View>
  );
}
```

---

### Get User Profile

```tsx
import { useAuth0 } from 'react-native-auth0';
import { View, Text, Image } from 'react-native';

export function ProfileScreen() {
  const { user } = useAuth0();

  if (!user) {
    return <Text>Please log in</Text>;
  }

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
      <Text>User ID: {user.sub}</Text>
    </View>
  );
}
```

---

### Call Protected API

```tsx
import { useAuth0 } from 'react-native-auth0';
import { useState } from 'react';
import { View, Button, Text } from 'react-native';

export function ApiTestScreen() {
  const { getCredentials } = useAuth0();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const callApi = async () => {
    try {
      const credentials = await getCredentials();

      const response = await fetch('https://api.example.com/data', {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`
        }
      });

      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <View>
      <Button title="Call API" onPress={callApi} />
      {error && <Text>Error: {error}</Text>}
      {data && <Text>{JSON.stringify(data, null, 2)}</Text>}
    </View>
  );
}
```

**Note:** To call APIs, configure `audience` parameter:

```tsx
const login = async () => {
  await authorize({
    audience: 'https://your-api-identifier',
    scope: 'openid profile email'
  });
};
```

---

### Silent Authentication

```tsx
import { useAuth0 } from 'react-native-auth0';
import { useEffect } from 'react';

export function App() {
  const { getCredentials, user } = useAuth0();

  useEffect(() => {
    // Attempt silent authentication on app start
    const checkAuth = async () => {
      try {
        await getCredentials();
      } catch (e) {
        // User not logged in, do nothing
      }
    };

    if (!user) {
      checkAuth();
    }
  }, []);

  // Rest of your app...
}
```

---

### Custom Login Options

```tsx
const login = async () => {
  await authorize({
    scope: 'openid profile email offline_access',
    audience: 'https://your-api-identifier',
    connection: 'google-oauth2', // Optional: force specific connection
    prompt: 'login', // Force re-authentication
  });
};
```

---

## Configuration Options

### Complete Auth0Provider Configuration

```tsx
<Auth0Provider
  domain="your-tenant.auth0.com"
  clientId="your-client-id"
>
  <App />
</Auth0Provider>
```

### Complete authorize() Options

```tsx
await authorize({
  scope: 'openid profile email offline_access',
  audience: 'https://your-api-identifier',
  connection: 'Username-Password-Authentication', // Optional
  prompt: 'login', // or 'consent'
  screen_hint: 'signup', // Show signup instead of login
  max_age: 300, // Force re-auth if session older than 5 minutes
});
```

---

---

# Auth0 React Native Setup Guide

Setup instructions for React Native and Expo mobile applications.

---

## Quick Setup

### For Expo

```bash
# Install SDK
npx expo install react-native-auth0

# Configure app.json
# Add scheme, bundleIdentifier, and package
```

### For React Native CLI

```bash
# Install SDK
npm install react-native-auth0

# iOS: Install pods
cd ios && pod install && cd ..

# Configure iOS Info.plist and Android AndroidManifest.xml
```

---

## Manual Setup

### 1. Install SDK

**Expo:**
```bash
npx expo install react-native-auth0
```

**React Native CLI:**
```bash
npm install react-native-auth0
npx pod-install  # iOS only
```

### 2. Create Auth0 Native Application

Via CLI:
```bash
auth0 login
auth0 apps create --name "My Mobile App" --type native \
  --auth-method None \
  --callbacks "com.yourcompany.yourapp.auth0://YOUR_DOMAIN/ios/com.yourcompany.yourapp/callback,com.yourcompany.yourapp.auth0://YOUR_DOMAIN/android/com.yourcompany.yourapp/callback" \
  --logout-urls "com.yourcompany.yourapp.auth0://YOUR_DOMAIN/ios/com.yourcompany.yourapp/callback,com.yourcompany.yourapp.auth0://YOUR_DOMAIN/android/com.yourcompany.yourapp/callback" \
  --metadata "created_by=agent_skills"
```

Via Dashboard:
1. Create **Native** application type
2. Configure callback URLs with your app scheme
3. Copy domain and client ID

### 3. Configure iOS

Update `ios/{YourApp}/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>None</string>
    <key>CFBundleURLName</key>
    <string>auth0</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>$(PRODUCT_BUNDLE_IDENTIFIER).auth0</string>
    </array>
  </dict>
</array>
```

### 4. Configure Android

Update `android/app/src/main/AndroidManifest.xml`:

```xml
<activity android:name="com.auth0.android.provider.RedirectActivity" android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
      android:host="YOUR_DOMAIN"
      android:pathPrefix="/android/${applicationId}/callback"
      android:scheme="${applicationId}" />
  </intent-filter>
</activity>
```

### 5. Configure Expo

Update `app.json`:

```json
{
  "expo": {
    "scheme": "myappscheme",
    "ios": {
      "bundleIdentifier": "com.mycompany.myapp"
    },
    "android": {
      "package": "com.mycompany.myapp"
    }
  }
}
```

---

## Troubleshooting

**Callback not working:**
- Verify scheme matches bundle ID/package name
- Check Auth0 allowed callbacks include your scheme

**Build errors on iOS:**
- Run `pod install` in ios/ directory
- Clean build folder in Xcode

**Android redirect issues:**
- Ensure RedirectActivity is exported
- Check scheme matches package name

---
