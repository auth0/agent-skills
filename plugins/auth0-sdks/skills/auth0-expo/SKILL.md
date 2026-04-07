---
name: auth0-expo
description: Use when adding authentication to Expo (React Native) mobile apps — login, logout, user sessions, protected routes, biometrics, or token management. Integrates react-native-auth0 SDK with Expo config plugin for automatic iOS/Android deep linking and callback handling. Trigger for any Expo managed workflow needing Auth0, including custom scheme setup, universal login integration, Expo Go incompatibility issues, EAS Build configuration, or mobile OAuth with PKCE. Do NOT use for React Native CLI bare workflow (use auth0-react-native instead).
---

# Auth0 Expo Integration

Add authentication to Expo mobile applications using the `react-native-auth0` SDK with the Expo config plugin for automatic native configuration.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/react-native-auth0/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below.

---

## Prerequisites

- Expo SDK 53 or higher (react-native-auth0 v5.x requires Expo 53+)
- React Native 0.78.0 or higher, React 19
- Node.js 20+ (for Auth0 CLI automation)
- Auth0 account with application configured as **Native** type
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

> **Not compatible with Expo Go.** This SDK requires custom native code. Use development builds (`npx expo run:ios` / `npx expo run:android`) or EAS Build.

## When NOT to Use

| Use Case | Recommended Skill |
|----------|------------------|
| React Native CLI (bare workflow) | `auth0-react-native` — handles Info.plist and AndroidManifest.xml directly |
| React web SPA (Vite/CRA) | `auth0-react` — browser-based Auth Code + PKCE |
| Next.js web application | `auth0-nextjs` — server-side session management |
| Angular SPA | `auth0-angular` — Angular-specific provider and guards |
| Vue SPA | `auth0-vue` — Vue composables and plugin |
| Backend API (JWT validation) | Use JWT validation for your server language |

---

## Quick Start Workflow

> **Agent instruction:** If the user's prompt already provides Auth0 credentials (domain, client ID), use them directly — skip the bootstrap script and `AskUserQuestion`. Only ask for credentials or offer automated setup when they are missing.

### 1. Install SDK

```bash
npx expo install react-native-auth0
```

### 2. Configure Expo Plugin

Update `app.json` (or `app.config.js`):

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.yourapp"
    },
    "android": {
      "package": "com.yourcompany.yourapp"
    },
    "plugins": [
      [
        "react-native-auth0",
        {
          "domain": "YOUR_AUTH0_DOMAIN",
          "customScheme": "yourappscheme"
        }
      ]
    ]
  }
}
```

> **Important:** `customScheme` must be a unique, all lowercase value with no special characters. If omitted, the SDK uses the bundle identifier as the scheme.

### 3. Configure Auth0 Dashboard

Set these in your Auth0 application's **Allowed Callback URLs** and **Allowed Logout URLs**:

```text
yourappscheme://YOUR_AUTH0_DOMAIN/ios/yourappscheme/callback,
yourappscheme://YOUR_AUTH0_DOMAIN/android/yourappscheme/callback
```

> **Agent instruction:** Replace `yourappscheme` with the actual `customScheme` value, and `YOUR_AUTH0_DOMAIN` with the tenant domain. All URLs must be **lowercase** with **no trailing slash**.

### 4. Add Auth0Provider

Wrap your app with `Auth0Provider`:

```tsx
import { Auth0Provider } from 'react-native-auth0';

export default function App() {
  return (
    <Auth0Provider
      domain="YOUR_AUTH0_DOMAIN"
      clientId="YOUR_AUTH0_CLIENT_ID"
    >
      {/* Your app content */}
    </Auth0Provider>
  );
}
```

### 5. Implement Login/Logout

```tsx
import { useAuth0 } from 'react-native-auth0';
import { View, Button, Text, ActivityIndicator } from 'react-native';

export default function HomeScreen() {
  const { authorize, clearSession, user, isLoading, error } = useAuth0();

  const login = async () => {
    try {
      await authorize(
        { scope: 'openid profile email' },
        { customScheme: 'yourappscheme' }
      );
    } catch (e) {
      console.error('Login error:', e);
    }
  };

  const logout = async () => {
    try {
      await clearSession({ customScheme: 'yourappscheme' });
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  if (isLoading) return <ActivityIndicator />;

  return (
    <View>
      {user ? (
        <>
          <Text>Welcome, {user.name}!</Text>
          <Text>{user.email}</Text>
          <Button title="Log Out" onPress={logout} />
        </>
      ) : (
        <Button title="Log In" onPress={login} />
      )}
      {error && <Text>{error.message}</Text>}
    </View>
  );
}
```

### 6. Build and Test

```bash
# Regenerate native projects after plugin config changes
npx expo prebuild --clean

# Run on device/simulator
npx expo run:ios
npx expo run:android
```

> **Agent instruction:** After integration, verify:
> 1. `npx expo prebuild --clean` succeeds
> 2. App builds without errors on target platform
> 3. Login redirects to Auth0 Universal Login and returns to the app
> 4. User profile data is accessible after login
> 5. Logout clears the session
>
> If build or auth flow fails after 5-6 iterations, use `AskUserQuestion` to ask the user for help.

---

## Detailed Documentation

- **[Setup Guide](./references/setup.md)** — Auth0 CLI automation, manual setup, plugin options, env vars, EAS Build, troubleshooting
- **[Integration Patterns](./references/integration.md)** — Protected screens, API calls, biometrics, organizations, DPoP, error handling
- **[API Reference](./references/api.md)** — Complete SDK API, configuration options, testing checklist

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using Expo Go instead of dev build | SDK requires native code — use `npx expo run:ios/android` or EAS Build |
| `customScheme` mismatch | Must match exactly across `app.json` plugin, `authorize()`, `clearSession()`, and Auth0 Dashboard URLs |
| `customScheme` has uppercase or special chars | Must be all lowercase, no special characters |
| Callback URL not lowercase | Auth0 callback URLs are case-sensitive — ensure all lowercase |
| App type set to SPA in Auth0 Dashboard | Must be **Native** application type |
| Missing `npx expo prebuild --clean` after config | Always rebuild native projects after changing `app.json` plugin config |
| Not passing `customScheme` to authorize/clearSession | Required when using a custom scheme — omit only if using bundle identifier as scheme |
| Forgot to add both callback and logout URLs | Both must be set in Auth0 Dashboard for login and logout to work |

---

## Related Skills

- `auth0-quickstart` — Initial Auth0 account and application setup
- `auth0-react-native` — React Native CLI (bare workflow) integration
- `auth0-migration` — Migrate from another auth provider
- `auth0-mfa` — Add Multi-Factor Authentication

---

## Quick Reference

**Core Hook API:**
- `useAuth0()` — Main hook for authentication state and methods
- `authorize(options?, authOptions?)` — Initiate login via Universal Login
- `clearSession(options?)` — Logout and clear session
- `user` — Authenticated user profile (`null` if not logged in)
- `getCredentials()` — Retrieve stored access/refresh tokens
- `isLoading` — `true` until authentication state is determined
- `error` — Error object if authentication failed

**Expo-Specific:**
- Config plugin: `["react-native-auth0", { "domain": "...", "customScheme": "..." }]`
- Always pass `{ customScheme: "yourscheme" }` to `authorize()` and `clearSession()`
- Rebuild after config changes: `npx expo prebuild --clean`

---

## References

- [Auth0 Expo Quickstart](https://auth0.com/docs/quickstart/native/react-native-expo/interactive)
- [React Native Auth0 SDK Documentation](https://auth0.github.io/react-native-auth0/)
- [SDK GitHub Repository](https://github.com/auth0/react-native-auth0)
- [Expo Sample App](https://github.com/auth0-samples/auth0-react-native-sample/tree/master/00-Login-Expo)
- [Expo Config Plugins](https://docs.expo.dev/guides/config-plugins/)
