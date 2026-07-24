# Auth0 Expo — reference hub

Add authentication to Expo (React Native) applications using `react-native-auth0` with the Expo Config Plugin.

## Prerequisites

- Expo SDK 53 or higher (react-native-auth0 v5.x requires Expo 53+)
- React 19 and React Native 0.78.0 or higher
- Auth0 account with a **Native** application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- **Not compatible with Expo Go** — requires custom development client or EAS Build

## When NOT to Use

| Use Case | Use Instead |
|----------|------------------|
| Bare React Native CLI project (no Expo) | the Auth0 integration workflow for React Native |
| React web SPA (Vite/CRA) | the Auth0 integration workflow for React |
| Next.js application | the Auth0 integration workflow for Next.js |
| Vue.js SPA | the Auth0 integration workflow for Vue.js |
| Angular SPA | the Auth0 integration workflow for Angular |
| Express.js backend | the Auth0 integration workflow for Express.js |
| Native Android (Kotlin/Java) | the Auth0 integration workflow for Android |
| Backend API (JWT validation) | the Auth0 integration workflow for Fastify or Express.js |

## Quick start

### Step 1 — Configure Auth0

**For automated setup with Auth0 CLI**, follow this group's integration guide (Auth0 Configuration section) for complete scripts.

**For manual setup**, configure a **Native** application in the [Auth0 Dashboard](https://manage.auth0.com/) and note your Domain and Client ID.

### Step 2 — Verify Expo Dev Client

> **Agent instruction:** Before installing the Auth0 SDK, check if the project has `expo-dev-client` installed. Read the project's `package.json` and look for `expo-dev-client` in `dependencies` or `devDependencies`.
>
> - **If `expo-dev-client` is found:** Proceed to step 3.
> - **If `expo-dev-client` is NOT found:** Use `AskUserQuestion` with the following message:
>
>   "The `react-native-auth0` SDK requires a custom Expo development client — it does **not** work with Expo Go. Your project does not have `expo-dev-client` installed.
>
>   How would you like to proceed?
>   1. **Install it for me** — I'll run `npx expo install expo-dev-client` and continue setup
>   2. **I'll set it up myself** — skip this step and continue to Auth0 SDK installation"
>
>   If the user picks option 1, run:
>   ```bash
>   npx expo install expo-dev-client
>   ```
>   Then proceed to step 3. If option 2, proceed to step 3 directly.

### Step 3 — Install SDK

```bash
npx expo install react-native-auth0
```

### Step 4 — Configure Expo Config Plugin

Add the react-native-auth0 plugin to `app.json` (or `app.config.js`) with your Auth0 domain and a custom scheme. Also ensure `bundleIdentifier` (iOS) and `package` (Android) are set:

```json
{
  "expo": {
    "ios": { "bundleIdentifier": "com.yourcompany.yourapp" },
    "android": { "package": "com.yourcompany.yourapp" },
    "plugins": [
      ["react-native-auth0", {
        "domain": "YOUR_AUTH0_DOMAIN",
        "customScheme": "YOUR_CUSTOM_SCHEME"
      }]
    ]
  }
}
```

The `customScheme` must be all lowercase with no special characters (e.g., `auth0sample`). For HTTPS callbacks, multiple domains, EAS Build, and secret management, follow this group's integration guide (Setup section).

### Step 5 — Configure Callback URLs

Add to **Allowed Callback URLs** and **Allowed Logout URLs** in the [Auth0 Dashboard](https://manage.auth0.com/):

```text
YOUR_CUSTOM_SCHEME://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_ID/callback,
YOUR_CUSTOM_SCHEME://YOUR_AUTH0_DOMAIN/android/YOUR_PACKAGE/callback
```

All values must be **lowercase** with **no trailing slash**. For HTTPS callback URLs (App Links / Universal Links), follow this group's integration guide (Using HTTPS Callback URLs section).

### Step 6 — Add Authentication with Auth0Provider

Wrap your app with `Auth0Provider` and use the `useAuth0` hook:

> **Agent instruction:** Before adding new UI elements, search the project for existing click handlers for login, logout, sign-in, or sign-out buttons. If existing handlers are found, hook the Auth0 code into them. Only create new buttons if no existing handlers are found.

```typescript
import React from 'react';
import { Auth0Provider, useAuth0 } from 'react-native-auth0';
import { View, Button, Text, ActivityIndicator } from 'react-native';

function HomeScreen() {
  const { authorize, clearSession, user, isLoading, error } = useAuth0();

  const login = async () => {
    try {
      await authorize(
        { scope: 'openid profile email' },
        { customScheme: 'YOUR_CUSTOM_SCHEME' }
      );
    } catch (e) {
      console.error('Login error:', e);
    }
  };

  const logout = async () => {
    try {
      await clearSession({ customScheme: 'YOUR_CUSTOM_SCHEME' });
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  if (isLoading) {
    return <ActivityIndicator size="large" />;
  }

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

export default function App() {
  return (
    <Auth0Provider
      domain="YOUR_AUTH0_DOMAIN"
      clientId="YOUR_AUTH0_CLIENT_ID"
    >
      <HomeScreen />
    </Auth0Provider>
  );
}
```

### Step 7 — Build & Verify

> **Agent instruction:** After completing the integration, build the project to verify it compiles:
> ```bash
> npx expo prebuild --clean
> npx expo run:ios
> # or
> npx expo run:android
> ```
> If the build fails, analyze the error output. Common integration build failures include:
> - **"Invariant Violation: Native module cannot be null"**: Using Expo Go instead of a development build — run `npx expo run:ios` or `npx expo run:android` instead of `npx expo start`
> - **Plugin not applied**: Missing `react-native-auth0` in app.json plugins array — verify the plugin configuration
> - **Pod install fails (iOS)**: Run `npx expo prebuild --clean` to regenerate native projects
> - **Manifest merge failure (Android)**: Conflicting auth0Domain placeholder — ensure only the config plugin sets the domain
>
> Re-run the build after each fix. Track the number of build-fix iterations.
>
> **Failcheck:** If the build still fails after 5–6 fix attempts, stop and ask the user using `AskUserQuestion`:
> _"The build is still failing after several fix attempts. How would you like to proceed?"_
> - **Let the skill continue fixing iteratively**
> - **Fix it manually** — show the remaining errors
> - **Skip build verification** — proceed without a successful build

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-expo/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For setup depth (automated CLI provisioning, HTTPS callbacks, multiple domains, EAS Build, secret management), and advanced patterns (credential management, biometric auth, DPoP, organizations, error handling): `Read: references/framework-expo/integrate.md`
- Full API / configuration lookup, testing checklist, common issues, security considerations: `Read: references/framework-expo/api-reference.md`
- Any other task (guidance, debugging, Organizations, provider migration): start with `Read: references/framework-expo/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
