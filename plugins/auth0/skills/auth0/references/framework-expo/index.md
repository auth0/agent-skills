
# Auth0 Expo Integration

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

## Quick Start Workflow

### 1. Configure Auth0

**For automated setup with Auth0 CLI**, see the Setup Guide section (below) for complete scripts.

**For manual setup**, configure a **Native** application in the [Auth0 Dashboard](https://manage.auth0.com/) and note your Domain and Client ID.

### 2. Verify Expo Dev Client

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

### 3. Install SDK

```bash
npx expo install react-native-auth0
```

### 4. Configure Expo Config Plugin

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

The `customScheme` must be all lowercase with no special characters (e.g., `auth0sample`). See the **Setup Guide** section (below) for HTTPS callbacks, multiple domains, EAS Build, and secret management.

### 5. Configure Callback URLs

Add to **Allowed Callback URLs** and **Allowed Logout URLs** in the [Auth0 Dashboard](https://manage.auth0.com/):

```text
YOUR_CUSTOM_SCHEME://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_ID/callback,
YOUR_CUSTOM_SCHEME://YOUR_AUTH0_DOMAIN/android/YOUR_PACKAGE/callback
```

All values must be **lowercase** with **no trailing slash**. For HTTPS callback URLs (App Links / Universal Links), see the Setup Guide — Using HTTPS Callback URLs section (below).

### 6. Add Authentication with Auth0Provider

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

### 7. Build & Verify

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

## Detailed Documentation

- **Setup Guide** (see the Setup Guide section below) — Dev client requirement, automated setup, Expo config plugin, callback URLs, EAS Build, secret management
- **Integration Patterns** (see the Integration Patterns section below) — Login/logout, credential management, biometric auth, token refresh, organizations, DPoP, error handling
- **API Reference & Testing** (see the API Reference & Testing section below) — Configuration options, useAuth0 hook API, testing checklist, common issues, security

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using Expo Go instead of development build | react-native-auth0 requires native code. Use `npx expo run:ios` / `npx expo run:android` or create a development build with EAS. |
| Missing `customScheme` in authorize/clearSession calls | Pass `{ customScheme: 'your-scheme' }` as the second argument to `authorize()` and `clearSession()`. Must match the value in app.json plugin config. |
| Callback URL mismatch | Ensure callback URL is all lowercase, no trailing slash, and matches Auth0 Dashboard exactly: `{customScheme}://{domain}/ios/{bundleId}/callback` |
| App type not set to Native | The Auth0 application must be type **Native** in the Dashboard, not SPA or Regular Web. |
| Missing bundleIdentifier or package in app.json | Both `expo.ios.bundleIdentifier` and `expo.android.package` must be set in app.json for callback URLs to work. |
| Forgot to wrap app with Auth0Provider | All components using `useAuth0()` must be children of `Auth0Provider`. |
| Using react-native-auth0 v5.x with Expo < 53 | Version 5.x requires Expo 53+. Use v4.x for older Expo versions. |
| Not testing on physical device | Biometric authentication (Face ID, fingerprint) only works on a physical device, not simulators. Always test the full auth flow on a real device before release. |

## Related Capabilities

- Auth0 setup — set up an account and application with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Bare React Native CLI projects → the Auth0 integration workflow for React Native
- Multi-factor authentication → ask for MFA (feature:mfa)
- Managing Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## References

- [Auth0 Expo Quickstart](https://auth0.com/docs/quickstart/native/react-native-expo/interactive)
- [react-native-auth0 GitHub Repository](https://github.com/auth0/react-native-auth0)
- [react-native-auth0 API Documentation](https://auth0.github.io/react-native-auth0/)
- [Expo Sample App](https://github.com/auth0-samples/auth0-react-native-sample/tree/master/00-Login-Expo)
- [EXAMPLES.md](https://github.com/auth0/react-native-auth0/blob/master/EXAMPLES.md)

---

# auth0-expo API Reference & Testing

## Table of Contents

- [Configuration Reference](#configuration-reference) — Auth0Provider props, authorize/clearSession/getCredentials options
- [Expo Config Plugin Reference](#expo-config-plugin-reference) — app.json plugin fields and auto-configuration
- [User Profile Claims](#user-profile-claims) — Standard OIDC claims
- [Credentials Object](#credentials-object) — Token properties
- [Testing Checklist](#testing-checklist) — Dev build, platform-specific, Auth0 config, EAS
- [Common Issues](#common-issues) — Error table with causes and solutions
- [Security Considerations](#security-considerations) — PKCE, secure storage, custom scheme, tokens, network

## Configuration Reference

### Auth0Provider Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `domain` | `string` | Yes | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `clientId` | `string` | Yes | Auth0 application Client ID |
| `localAuthenticationOptions` | `LocalAuthenticationOptions` | No | Biometric authentication configuration |
| `maxRetries` | `number` | No | Credential renewal retry count (iOS only, default: 0) |
| `useDPoP` | `boolean` | No | Enable DPoP token binding (default: true) |
| `headers` | `Record<string, string>` | No | Custom headers for all API requests |

### authorize() Options

**First argument (parameters):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `scope` | `string` | OAuth scopes (default: `openid profile email`) |
| `audience` | `string` | API identifier for access token |
| `organization` | `string` | Organization ID for enterprise login |
| `invitationUrl` | `string` | Organization invitation URL |
| `connection` | `string` | Force a specific connection (e.g., `google-oauth2`) |
| `additionalParameters` | `object` | Extra parameters for the /authorize endpoint |

**Second argument (options):**

| Option | Type | Description |
|--------|------|-------------|
| `customScheme` | `string` | **Required for Expo.** URL scheme matching app.json plugin config. |

### clearSession() Options

| Option | Type | Description |
|--------|------|-------------|
| `customScheme` | `string` | **Required for Expo.** Must match the scheme used in authorize(). |
| `federated` | `boolean` | If true, also logs out from the identity provider |

### getCredentials() Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `scope` | `string` | Minimum required scope |
| `minTtl` | `number` | Minimum time-to-live in seconds for the access token |
| `parameters` | `object` | Additional parameters |
| `forceRefresh` | `boolean` | Force token refresh even if not expired |

## Expo Config Plugin Reference

### app.json Plugin Configuration

```json
["react-native-auth0", {
  "domain": "your-tenant.auth0.com",
  "customScheme": "auth0sample"
}]
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | `string` | Yes | Auth0 tenant domain |
| `customScheme` | `string` | No | Custom URL scheme (lowercase, no special chars). If `"https"`, enables Android App Links with `autoVerify`. |

**What the plugin configures automatically:**
- **iOS**: Adds URL scheme to Info.plist (`CFBundleURLSchemes`), adds deep linking handler to AppDelegate
- **Android**: Sets `manifestPlaceholders` (`auth0Domain`, `auth0Scheme`) in build.gradle

## User Profile Claims

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | `string` | Unique user identifier |
| `name` | `string` | Full name |
| `nickname` | `string` | Display name |
| `email` | `string` | Email address |
| `email_verified` | `boolean` | Whether email is verified |
| `picture` | `string` | Profile picture URL |
| `updated_at` | `string` | Last profile update timestamp |
| `org_id` | `string` | Organization ID (if using Organizations) |

## Credentials Object

| Property | Type | Description |
|----------|------|-------------|
| `accessToken` | `string` | Access token for API calls |
| `idToken` | `string` | ID token with user claims |
| `refreshToken` | `string` | Refresh token (if `offline_access` requested) |
| `tokenType` | `string` | Token type (`Bearer` or `DPoP`) |
| `expiresAt` | `number` | Token expiration timestamp |
| `scope` | `string` | Granted scopes |

## Testing Checklist

### Development Build Testing

- [ ] Login flow: Tap login → browser opens → complete login → app shows user info
- [ ] Logout flow: Tap logout → session cleared → app shows login button
- [ ] Credential persistence: Close app → reopen → user remains logged in
- [ ] Token refresh: Wait for token expiry → `getCredentials()` returns fresh token
- [ ] Error handling: Cancel login → app handles USER_CANCELLED gracefully
- [ ] Loading state: `isLoading` is true until auth state is determined

### Platform-Specific Testing

- [ ] **iOS Simulator**: Login/logout works, URL scheme redirects correctly
- [ ] **Android Emulator**: Login/logout works, custom scheme callback received
- [ ] **Physical iOS Device**: Test on a real physical device — Face ID / Touch ID prompts work (if biometrics enabled). Note: biometric authentication is not available on simulators.
- [ ] **Physical Android Device**: Test on a real physical device — fingerprint / PIN prompts work (if biometrics enabled). Test deep link redirection from browser back to app.

### Auth0 Configuration Testing

- [ ] Callback URL matches exactly (lowercase, no trailing slash)
- [ ] Application type is **Native** in Auth0 Dashboard
- [ ] Allowed Callback URLs include both iOS and Android URLs
- [ ] Allowed Logout URLs include both iOS and Android URLs
- [ ] OIDC Conformant toggle is enabled in Advanced OAuth settings

### EAS Build Testing

- [ ] Development build: `eas build --profile development` succeeds
- [ ] Config plugin applied: Native files contain Auth0 configuration after prebuild
- [ ] Production build: `eas build --profile production` succeeds

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invariant Violation: Native module cannot be null" | Using Expo Go instead of development build | Run `npx expo run:ios` or `npx expo run:android`, or create a development build with EAS |
| App hangs after login | Callback URL mismatch | Verify callback URL is lowercase, no trailing slash, and matches Auth0 Dashboard exactly |
| Login opens but redirects fail | Missing customScheme in authorize call | Pass `{ customScheme: 'your-scheme' }` as second argument to `authorize()` |
| "PKCE not allowed" error | App type is not Native | Change application type to **Native** in Auth0 Dashboard |
| Blank screen after authentication | React Navigation interference | Ensure Auth0Provider wraps the entire navigation container |
| Android build fails with manifest errors | Conflicting auth0Domain placeholders | Remove manual manifest changes — let the Expo config plugin handle it |
| iOS build fails with pod errors | Stale native projects | Run `npx expo prebuild --clean` to regenerate native code |
| Token refresh fails silently | Missing `offline_access` scope | Include `offline_access` in the scope parameter during login |
| Biometric prompt not showing | Simulator limitation | Test biometrics on a physical device — simulators have limited biometric support |

## Security Considerations

### PKCE (Proof Key for Code Exchange)

The SDK uses PKCE by default for all Web Auth flows. PKCE protects against authorization code interception attacks. No additional configuration is needed.

### Secure Credential Storage

Credentials are stored securely:
- **iOS**: Encrypted in the Keychain
- **Android**: Encrypted in SharedPreferences via SecureCredentialsManager

Never store tokens manually in AsyncStorage, MMKV, or other unencrypted storage.

### Custom Scheme Security

Custom URL schemes can be subject to [client impersonation attacks](https://datatracker.ietf.org/doc/html/rfc8252#section-8.6). For production apps, consider using:
- **Android App Links** (`customScheme: "https"`) — requires SHA256 fingerprint configuration
- **iOS Universal Links** — requires Associated Domains and Apple Developer account

### Token Handling Best Practices

- Never log tokens to the console in production builds
- Use `getCredentials()` to access tokens — it auto-refreshes expired tokens
- Request `offline_access` scope for refresh token support
- Do not store tokens in React state — use `getCredentials()` on demand
- Enable DPoP for enhanced token security (enabled by default)

### Network Security

- All Auth0 API communication uses HTTPS
- The SDK validates ID token signatures, issuer, audience, and nonce
- Enable certificate pinning for additional security in high-security environments

## Related Capabilities

- Auth0 setup — set up an account and application with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Bare React Native CLI projects → the Auth0 integration workflow for React Native
- Multi-factor authentication → ask for MFA (feature:mfa)

## References

- [react-native-auth0 API Docs](https://auth0.github.io/react-native-auth0/)
- [Auth0 Expo Quickstart](https://auth0.com/docs/quickstart/native/react-native-expo/interactive)
- [Expo Config Plugins Guide](https://docs.expo.dev/guides/config-plugins/)
- [Auth0 Universal Login](https://auth0.com/docs/authenticate/login/auth0-universal-login)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

---

# auth0-expo Integration Patterns

## Table of Contents

- [Web Auth Login](#web-auth-login) — Basic login with hooks, Auth0 class, audience, organizations
- [Web Auth Logout](#web-auth-logout) — Hook and class-based logout
- [Credential Management](#credential-management) — Retrieve, check, auto-refresh, Auth0 class
- [Biometric Authentication](#biometric-authentication) — Auth0Provider config, policies, Auth0 class
- [DPoP](#dpop-demonstrating-proof-of-possession) — Enable, API calls, token migration
- [Multi-Resource Refresh Tokens](#multi-resource-refresh-tokens-mrrt) — Multiple API access
- [Custom Token Exchange](#custom-token-exchange-rfc-8693) — External provider tokens
- [Native to Web SSO](#native-to-web-sso) — Session transfer to web apps
- [Organization Invitations](#organization-invitations) — Deep link handling
- [Error Handling](#error-handling) — WebAuth errors, Credentials Manager errors
- [Credential Renewal Retry](#credential-renewal-retry-ios) — iOS retry with backoff
- [Using Custom Headers](#using-custom-headers) — Custom API request headers

## Web Auth Login

The primary authentication method uses Auth0 Universal Login via the system browser. The `useAuth0` hook provides the `authorize` method.

### Basic Login with Hooks

```typescript
import { useAuth0 } from 'react-native-auth0';

function LoginScreen() {
  const { authorize, user, isLoading, error } = useAuth0();

  const login = async () => {
    try {
      await authorize(
        { scope: 'openid profile email' },
        { customScheme: 'auth0sample' }
      );
    } catch (e) {
      console.error('Login error:', e);
    }
  };

  if (isLoading) return <ActivityIndicator />;

  return (
    <View>
      {!user && <Button title="Log In" onPress={login} />}
      {user && <Text>Welcome, {user.name}!</Text>}
      {error && <Text style={{ color: 'red' }}>{error.message}</Text>}
    </View>
  );
}
```

### Login with Auth0 Class (Non-Hook)

```typescript
import Auth0 from 'react-native-auth0';

const auth0 = new Auth0({
  domain: 'YOUR_AUTH0_DOMAIN',
  clientId: 'YOUR_AUTH0_CLIENT_ID',
});

const credentials = await auth0.webAuth.authorize(
  { scope: 'openid profile email' },
  { customScheme: 'auth0sample' }
);
// Access token available at credentials.accessToken
```

### Login with Audience (API Access)

To get an access token for a specific API:

```typescript
await authorize(
  {
    scope: 'openid profile email offline_access',
    audience: 'https://your-api.example.com',
  },
  { customScheme: 'auth0sample' }
);
```

### Login with Organization

```typescript
await authorize(
  {
    scope: 'openid profile email',
    organization: 'org_abc123',
  },
  { customScheme: 'auth0sample' }
);
```

## Web Auth Logout

```typescript
import { useAuth0 } from 'react-native-auth0';

function LogoutButton() {
  const { clearSession } = useAuth0();

  const logout = async () => {
    try {
      await clearSession({ customScheme: 'auth0sample' });
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  return <Button title="Log Out" onPress={logout} />;
}
```

### Logout with Auth0 Class

```typescript
await auth0.webAuth.clearSession({}, { customScheme: 'auth0sample' });
await auth0.credentialsManager.clearCredentials();
```

## Credential Management

The `Auth0Provider` automatically stores and manages credentials. When using hooks, credentials are saved after login and cleared after logout automatically.

### Retrieve Stored Credentials

```typescript
const { getCredentials } = useAuth0();

const fetchData = async () => {
  try {
    const credentials = await getCredentials();
    const response = await fetch('https://your-api.example.com/data', {
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
      },
    });
    const data = await response.json();
  } catch (e) {
    console.error('Failed to get credentials:', e);
  }
};
```

### Check for Valid Credentials

```typescript
const { hasValidCredentials } = useAuth0();

useEffect(() => {
  const checkAuth = async () => {
    const isLoggedIn = await hasValidCredentials();
    if (isLoggedIn) {
      // User has valid stored credentials
      navigation.navigate('Home');
    } else {
      navigation.navigate('Login');
    }
  };
  checkAuth();
}, []);
```

### Credential Auto-Refresh

The credentials manager automatically refreshes expired access tokens using the refresh token. Ensure you request the `offline_access` scope during login:

```typescript
await authorize(
  { scope: 'openid profile email offline_access' },
  { customScheme: 'auth0sample' }
);
```

### Credentials with Auth0 Class

```typescript
// Check for credentials
const isLoggedIn = await auth0.credentialsManager.hasValidCredentials();

// Get credentials (auto-refreshes if expired)
const credentials = await auth0.credentialsManager.getCredentials();

// Save credentials manually (not needed with hooks — auto-managed)
await auth0.credentialsManager.saveCredentials(credentials);

// Clear credentials
await auth0.credentialsManager.clearCredentials();
```

## Biometric Authentication

Protect credential access with biometric authentication (Face ID, Touch ID, fingerprint).

### With Auth0Provider (Hooks)

```typescript
import {
  Auth0Provider,
  BiometricPolicy,
  LocalAuthenticationStrategy,
  LocalAuthenticationLevel,
} from 'react-native-auth0';

export default function App() {
  return (
    <Auth0Provider
      domain="YOUR_AUTH0_DOMAIN"
      clientId="YOUR_AUTH0_CLIENT_ID"
      localAuthenticationOptions={{
        title: 'Authenticate to access credentials',
        subtitle: 'Please verify your identity',
        cancelTitle: 'Cancel',
        evaluationPolicy: LocalAuthenticationStrategy.deviceOwnerWithBiometrics,
        fallbackTitle: 'Use Passcode',
        authenticationLevel: LocalAuthenticationLevel.strong,
        deviceCredentialFallback: true,
        biometricPolicy: BiometricPolicy.session,
        biometricTimeout: 300, // 5 minutes
      }}
    >
      <HomeScreen />
    </Auth0Provider>
  );
}
```

### Biometric Policy Types

| Policy | Behavior |
|--------|----------|
| `BiometricPolicy.default` | System-managed. May skip prompt if recently authenticated. |
| `BiometricPolicy.always` | Always prompts for biometric on every credential access. |
| `BiometricPolicy.session` | Prompts once per session; reuses for the specified timeout. |
| `BiometricPolicy.appLifecycle` | Prompts once until app restarts or credentials are cleared. |

### With Auth0 Class

```typescript
import Auth0, {
  BiometricPolicy,
  LocalAuthenticationStrategy,
  LocalAuthenticationLevel,
} from 'react-native-auth0';

const auth0 = new Auth0({
  domain: 'YOUR_AUTH0_DOMAIN',
  clientId: 'YOUR_AUTH0_CLIENT_ID',
  localAuthenticationOptions: {
    title: 'Authenticate to access credentials',
    evaluationPolicy: LocalAuthenticationStrategy.deviceOwnerWithBiometrics,
    authenticationLevel: LocalAuthenticationLevel.strong,
    biometricPolicy: BiometricPolicy.always,
  },
});
```

## DPoP (Demonstrating Proof-of-Possession)

DPoP cryptographically binds tokens to a client-specific key pair, preventing token theft.

### Enable DPoP

DPoP is enabled by default in react-native-auth0:

```typescript
<Auth0Provider
  domain="YOUR_AUTH0_DOMAIN"
  clientId="YOUR_AUTH0_CLIENT_ID"
  // DPoP is enabled by default (useDPoP: true)
>
  <App />
</Auth0Provider>
```

### Make API Calls with DPoP

```typescript
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
};
```

### Handle DPoP Token Migration

```typescript
const { getCredentials, clearSession, authorize } = useAuth0();

const ensureDPoP = async () => {
  const credentials = await getCredentials();
  if (credentials.tokenType !== 'DPoP') {
    await clearSession({ customScheme: 'auth0sample' });
    await authorize(
      { scope: 'openid profile email' },
      { customScheme: 'auth0sample' }
    );
  }
};
```

## Multi-Resource Refresh Tokens (MRRT)

Access tokens for multiple APIs using a single refresh token:

```typescript
const { authorize, getApiCredentials, clearApiCredentials } = useAuth0();

// Login with offline_access
await authorize(
  {
    scope: 'openid profile email offline_access',
    audience: 'https://primary-api.example.com',
  },
  { customScheme: 'auth0sample' }
);

// Get token for a different API
const apiCredentials = await getApiCredentials(
  'https://second-api.example.com',
  'read:data write:data'
);
// Access token available at apiCredentials.accessToken
```

## Custom Token Exchange (RFC 8693)

Exchange external provider tokens for Auth0 tokens:

```typescript
import { useAuth0, AuthenticationException, AuthenticationErrorCodes } from 'react-native-auth0';

const { customTokenExchange } = useAuth0();

try {
  const credentials = await customTokenExchange({
    subjectToken: 'token-from-external-provider',
    subjectTokenType: 'urn:acme:legacy-system-token',
    scope: 'openid profile email',
  });
} catch (e) {
  if (e instanceof AuthenticationException) {
    if (e.type === AuthenticationErrorCodes.INVALID_SUBJECT_TOKEN) {
      console.error('External token is invalid or expired');
    }
  }
}
```

## Native to Web SSO

Transfer authenticated sessions from the Expo app to a web application:

```typescript
import { useAuth0 } from 'react-native-auth0';
import { Linking } from 'react-native';

const { getSSOCredentials } = useAuth0();

const openWebApp = async () => {
  const ssoCredentials = await getSSOCredentials();
  const webAppUrl = `https://webapp.example.com/login?session_transfer_token=${ssoCredentials.sessionTransferToken}`;
  await Linking.openURL(webAppUrl);
};
```

## Organization Invitations

Handle organization invitation links:

```typescript
import { Linking } from 'react-native';

const handleInvitation = async (url: string) => {
  await auth0.webAuth.authorize(
    { invitationUrl: url },
    { customScheme: 'auth0sample' }
  );
};

// Listen for deep links
Linking.addEventListener('url', ({ url }) => {
  if (url.includes('invitation=')) {
    handleInvitation(url);
  }
});
```

## Error Handling

### WebAuth Errors

```typescript
import { WebAuthError, WebAuthErrorCodes } from 'react-native-auth0';

try {
  await authorize(
    { scope: 'openid profile email' },
    { customScheme: 'auth0sample' }
  );
} catch (e) {
  if (e instanceof WebAuthError) {
    switch (e.type) {
      case WebAuthErrorCodes.USER_CANCELLED:
        console.log('User cancelled login');
        break;
      case WebAuthErrorCodes.BROWSER_NOT_AVAILABLE:
        console.log('No browser available on device');
        break;
      case WebAuthErrorCodes.PKCE_NOT_ALLOWED:
        console.log('PKCE not enabled — set app type to Native in Auth0 Dashboard');
        break;
      case WebAuthErrorCodes.NETWORK_ERROR:
        console.log('Network error — check connectivity');
        break;
      default:
        console.error('Auth error:', e.message);
    }
  }
}
```

### Credentials Manager Errors

```typescript
import {
  CredentialsManagerError,
  CredentialsManagerErrorCodes,
} from 'react-native-auth0';

try {
  const credentials = await getCredentials();
} catch (e) {
  if (e instanceof CredentialsManagerError) {
    switch (e.type) {
      case CredentialsManagerErrorCodes.NO_CREDENTIALS:
        console.log('No credentials stored — user needs to log in');
        break;
      case CredentialsManagerErrorCodes.NO_REFRESH_TOKEN:
        console.log('No refresh token — request offline_access scope');
        break;
      case CredentialsManagerErrorCodes.RENEW_FAILED:
        console.log('Token refresh failed — re-authentication required');
        break;
      case CredentialsManagerErrorCodes.BIOMETRICS_FAILED:
        console.log('Biometric authentication failed');
        break;
      default:
        console.error('Credentials error:', e.message);
    }
  }
}
```

## Credential Renewal Retry (iOS)

For unstable network conditions, configure automatic retry for credential renewal:

```typescript
<Auth0Provider
  domain="YOUR_AUTH0_DOMAIN"
  clientId="YOUR_AUTH0_CLIENT_ID"
  maxRetries={2}
>
  <App />
</Auth0Provider>
```

This retries on network errors, HTTP 429, and HTTP 5xx responses with exponential backoff. iOS only — the parameter is ignored on Android.

If using refresh token rotation, configure a token overlap period of at least **180 seconds** in your Auth0 tenant settings.

## Using Custom Headers

```typescript
<Auth0Provider
  domain="YOUR_AUTH0_DOMAIN"
  clientId="YOUR_AUTH0_CLIENT_ID"
  headers={{
    'Accept-Language': 'fr-CA',
    'X-App-Version': '1.0.0',
  }}
>
  <App />
</Auth0Provider>
```

---

# auth0-expo Setup Guide

## Table of Contents

- [Auth0 Configuration](#auth0-configuration) — Credential check, automatic vs manual setup
- [Expo Dev Client Requirement](#expo-dev-client-requirement) — Why Expo Go doesn't work, install steps
- [Post-Setup Steps](#post-setup-steps) — Verify plugin config, callback URLs, regenerate native projects
- [SDK Installation](#sdk-installation) — Version compatibility
- [Using HTTPS Callback URLs](#using-https-callback-urls-android-app-links) — Android App Links
- [Multiple Domain Support](#multiple-domain-support) — Staging/production configs
- [Secret Management](#secret-management) — What to store, what not to store, dynamic config
- [EAS Build Configuration](#eas-build-configuration) — Development and production builds
- [Verification](#verification) — Plugin, build, and auth flow checks

## Auth0 Configuration

> **Agent instruction:**
>
> **Important:** Never echo Auth0 credentials (domain, client ID) in your response text. Write them directly into config files using the Write or Edit tool.
>
> **Credential check (always first):**
> If the user's prompt already provides Auth0 credentials (domain, client ID), use them directly — do NOT call `AskUserQuestion` to re-confirm. Go straight to writing the app.json config and proceeding with integration.
>
> **If credentials are NOT provided**, use `AskUserQuestion` to ask:
> "How would you like to configure Auth0 for this Expo project?"
> - Option A: "Automatic setup (recommended)" — uses the Auth0 CLI to create your app
> - Option B: "Manual setup" — provide Auth0 credentials manually
>
> **If Automatic Setup (Option A):**
>
> 1. **Pre-flight checks:**
>    - Verify Auth0 CLI is installed: `command -v auth0`
>    - Verify logged in: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide user to install/login, or fall back to manual setup
>
> 2. **Read the project's app.json** to extract:
>    - `expo.name` (for the Auth0 app name)
>    - `expo.scheme` (custom scheme — if missing, derive one from app name, lowercase, no special chars)
>    - `expo.ios.bundleIdentifier` (for iOS callback URL)
>    - `expo.android.package` (for Android callback URL)
>
> 3. **Create the Auth0 Native application:**
>    ```bash
>    auth0 apps create \
>      --name "APP_NAME-expo" \
>      --type native \
>      --auth-method none \
>      --callbacks "SCHEME://DOMAIN/ios/BUNDLE_ID/callback,SCHEME://DOMAIN/android/PACKAGE/callback" \
>      --logout-urls "SCHEME://DOMAIN/ios/BUNDLE_ID/callback,SCHEME://DOMAIN/android/PACKAGE/callback" \
>      --json --no-input
>    ```
>    Parse the JSON output to extract `client_id` and `domain`.
>
> 4. **Enable database connection** for the new client:
>    ```bash
>    auth0 api get "connections" --query "name=Username-Password-Authentication" --no-input
>    ```
>    Parse the response to extract the connection `id` and its current `enabled_clients` array. Append the new client_id to the existing array and patch:
>    ```bash
>    auth0 api patch "connections/CONNECTION_ID" --data '{"enabled_clients":["EXISTING_IDS...", "NEW_CLIENT_ID"]}' --no-input
>    ```
>    If it doesn't exist, create it:
>    ```bash
>    auth0 api post "connections" --data '{"strategy":"auth0","name":"Username-Password-Authentication","enabled_clients":["CLIENT_ID"]}' --no-input
>    ```
>
> 5. **Write the plugin config to app.json** using the Edit tool — add `react-native-auth0` to the plugins array with the domain and custom scheme. Do not echo credentials in your response.
>
> **If Manual Setup (Option B):**
>
> Ask the user for their Auth0 credentials:
> - Auth0 Domain (e.g., `your-tenant.auth0.com`)
> - Client ID (32-character alphanumeric string)
>
> Then write the configuration to app.json using the Edit tool and proceed with integration.

## Expo Dev Client Requirement

The `react-native-auth0` SDK uses native modules and **does not work with Expo Go**. A custom Expo development client is required.

> **Agent instruction:** Before proceeding with Auth0 SDK installation, check the project's `package.json` for `expo-dev-client` in `dependencies` or `devDependencies`. If not found, ask the user how they'd like to proceed (install automatically or set it up themselves). See SKILL.md step 1 for the full agent instruction.

### Check for expo-dev-client

```bash
# Check if expo-dev-client is in the project
cat package.json | grep expo-dev-client
```

### Install expo-dev-client (if missing)

```bash
npx expo install expo-dev-client
```

After installing, the development workflow changes from `npx expo start` (Expo Go) to:

```bash
npx expo run:ios
# or
npx expo run:android
```

For cloud builds, use EAS Build with a development profile:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Post-Setup Steps

After Auth0 is configured (via automatic or manual setup), complete these steps:

### 1. Verify app.json Plugin Configuration

Ensure `app.json` contains the react-native-auth0 plugin:

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
          "domain": "your-tenant.auth0.com",
          "customScheme": "auth0sample"
        }
      ]
    ]
  }
}
```

The `customScheme` must be:
- All lowercase
- No special characters
- Unique to your application
- Passed to `authorize()` and `clearSession()` calls

### 2. Configure Callback URLs in Auth0 Dashboard

Go to [Auth0 Dashboard > Applications](https://manage.auth0.com/#/applications), select your application, and add the following:

**Allowed Callback URLs:**
```text
auth0sample://your-tenant.auth0.com/ios/com.yourcompany.yourapp/callback,
auth0sample://your-tenant.auth0.com/android/com.yourcompany.yourapp/callback
```

**Allowed Logout URLs:**
```text
auth0sample://your-tenant.auth0.com/ios/com.yourcompany.yourapp/callback,
auth0sample://your-tenant.auth0.com/android/com.yourcompany.yourapp/callback
```

Replace `auth0sample` with your `customScheme`, `your-tenant.auth0.com` with your domain, and `com.yourcompany.yourapp` with your bundle ID / package name.

All values must be **lowercase** with **no trailing slash**.

### 3. Regenerate Native Projects

After modifying app.json, regenerate the native projects:

```bash
npx expo prebuild --clean
```

This applies the Auth0 config plugin, which configures:
- **iOS**: URL scheme in Info.plist and AppDelegate linking handler
- **Android**: manifest placeholders for auth0Domain and auth0Scheme in build.gradle

## SDK Installation

```bash
npx expo install react-native-auth0
```

This installs the SDK with the correct version for your Expo SDK.

For older Expo versions:
- Expo 53+: Use react-native-auth0 v5.x
- Expo < 53: Use react-native-auth0 v4.x (`npx expo install react-native-auth0@4`)

## Using HTTPS Callback URLs (Android App Links)

For enhanced security, you can use HTTPS callback URLs with Android App Links:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-auth0",
        {
          "domain": "your-tenant.auth0.com",
          "customScheme": "https"
        }
      ]
    ]
  }
}
```

When using `customScheme: "https"`, the plugin automatically adds `android:autoVerify="true"` to the Android manifest intent-filter.

You must also configure Android App Links in the Auth0 Dashboard:
1. Go to **Applications > your app > Show Advanced Settings > Device Settings**
2. Add your Android Package Name and SHA256 fingerprint

## Multiple Domain Support

To support multiple Auth0 domains (e.g., for staging/production), pass an array to the plugin:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-auth0",
        [
          {
            "domain": "staging.auth0.com",
            "customScheme": "auth0staging"
          },
          {
            "domain": "production.auth0.com",
            "customScheme": "auth0prod"
          }
        ]
      ]
    ]
  }
}
```

## Secret Management

Expo / React Native mobile apps do **not** use a Client Secret. The Auth0 Native application type uses PKCE (Proof Key for Code Exchange) for secure authentication without exposing secrets.

**What to store in code / config:**
- Auth0 Domain — in `app.json` plugin config and `Auth0Provider` props
- Auth0 Client ID — in `Auth0Provider` props only (not in app.json)
- Custom Scheme — in `app.json` plugin config and `authorize`/`clearSession` options

**What NOT to store:**
- Never include Client Secret in mobile apps
- Never commit sensitive tokens to source control

For environment-specific configuration, use `app.config.js` (dynamic config):

```javascript
export default ({ config }) => ({
  ...config,
  plugins: [
    [
      'react-native-auth0',
      {
        domain: process.env.AUTH0_DOMAIN || 'dev.auth0.com',
        customScheme: process.env.AUTH0_SCHEME || 'auth0dev',
      },
    ],
  ],
});
```

## EAS Build Configuration

For production builds with EAS:

```bash
npm install -g eas-cli
eas build --platform all
```

Create `eas.json` if it doesn't exist:

```json
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

For development builds (used instead of Expo Go):

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Verification

After setup, verify the integration:

1. **Plugin applied correctly:**
   ```bash
   npx expo prebuild --clean
   ```
   Check that `ios/{AppName}/Info.plist` contains the URL scheme and `android/app/build.gradle` contains `manifestPlaceholders`.

2. **Build succeeds:**
   ```bash
   npx expo run:ios
   # or
   npx expo run:android
   ```

3. **Auth flow works:**
   - Tap Login — browser opens with Auth0 Universal Login
   - Complete login — app receives credentials and shows user info
   - Tap Logout — session is cleared
