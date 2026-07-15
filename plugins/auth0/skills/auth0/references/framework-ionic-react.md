
# Auth0 Ionic React (Capacitor) Integration

Add Auth0 authentication to Ionic React applications using Capacitor. This skill covers native mobile authentication using the `@auth0/auth0-react` SDK combined with `@capacitor/browser` and `@capacitor/app` plugins for deep link handling on iOS and Android.

## Prerequisites

- Node.js 18+
- Ionic CLI (`npm install -g @ionic/cli`)
- An existing Ionic React application with Capacitor configured
- Auth0 account and tenant
- For iOS: Xcode 14+ and CocoaPods
- For Android: Android Studio with API level 21+
- Auth0 CLI — `brew install auth0/auth0-cli/auth0`

## When NOT to Use

| Use Case | Use instead |
|----------|------------------|
| React SPA (no Capacitor/Ionic) | the Auth0 integration workflow for React |
| React Native (bare CLI) | the Auth0 integration workflow for React Native |
| Expo (React Native) | the Auth0 integration workflow for Expo |
| Ionic + Angular + Capacitor | the Auth0 integration workflow for Ionic Angular |
| Ionic + Vue + Capacitor | the Auth0 integration workflow for Ionic Vue |
| Next.js (server-side) | the Auth0 integration workflow for Next.js |
| iOS native (Swift) | the Auth0 integration workflow for iOS (Swift) |
| Android native (Kotlin) | the Auth0 integration workflow for Android (Kotlin) |

## Quick Start Workflow

### Step 1: Configure Auth0

**For automated setup with Auth0 CLI**, see the Setup Guide section (below) for complete scripts.

**For manual setup**, configure a **Native** application in the [Auth0 Dashboard](https://manage.auth0.com/) and note your Domain and Client ID.

### Step 2: Install Dependencies

```bash
npm install @auth0/auth0-react @capacitor/browser @capacitor/app
npx cap sync
```

### Step 3: Set Up Auth0Provider

Wrap the app root with `Auth0Provider`, configuring it for Capacitor. In `src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const packageId = import.meta.env.VITE_AUTH0_PACKAGE_ID; // e.g., com.example.myapp

const redirectUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      useRefreshTokens={true}
      useRefreshTokensFallback={false}
      authorizationParams={{
        redirect_uri: redirectUri
      }}
    >
      <App />
    </Auth0Provider>
  </React.StrictMode>
);
```

### Step 4: Implement Login with Capacitor Browser

```tsx
import { useAuth0 } from '@auth0/auth0-react';
import { Browser } from '@capacitor/browser';

const { loginWithRedirect } = useAuth0();

const login = async () => {
  await loginWithRedirect({
    async openUrl(url) {
      await Browser.open({ url, windowName: "_self" });
    }
  });
};
```

### Step 5: Handle Callback via Deep Link

```tsx
import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useAuth0 } from '@auth0/auth0-react';

const { handleRedirectCallback } = useAuth0();

useEffect(() => {
  const listener = CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
      await handleRedirectCallback(url);
    }
    await Browser.close();
  });

  return () => {
    listener.then(l => l.remove());
  };
}, [handleRedirectCallback]);
```

### Step 6: Implement Logout

```tsx
const doLogout = async () => {
  await logout({
    logoutParams: {
      returnTo: `${packageId}://${domain}/capacitor/${packageId}/callback`
    },
    async openUrl(url) {
      await Browser.open({ url, windowName: "_self" });
    }
  });
};
```

### Step 7: Build and Test

> **Agent instruction:** After integration, verify the build:
> ```bash
> ionic build
> npx cap sync
> ```
> For iOS: `npx cap open ios` then build in Xcode.
> For Android: `npx cap open android` then build in Android Studio.
> If the build fails, iterate up to 5-6 times to fix issues. If still failing, use `AskUserQuestion` to request help.

## Detailed Documentation

- **Setup Guide** (see below) — Auth0 CLI configuration, Capacitor URL scheme registration, secret management
- **Integration Patterns** (see below) — Login/logout with Capacitor Browser, deep link callback handling, user profile, protected routes, token access, error handling
- **Testing & Reference** (see below) — Full API reference for Auth0Provider props, useAuth0 hook, Capacitor plugin configuration, testing checklist, common issues

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| App type not set to **Native** in Auth0 Dashboard | Change application type to "Native" in Dashboard settings |
| Missing or incorrect callback URL format | Use `YOUR_PACKAGE_ID://YOUR_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback` — must match exactly |
| Not enabling refresh tokens | Set `useRefreshTokens={true}` and `useRefreshTokensFallback={false}` on Auth0Provider |
| Missing `@capacitor/browser` or `@capacitor/app` | Install both: `npm install @capacitor/browser @capacitor/app && npx cap sync` |
| Not handling deep link callback | Add `CapApp.addListener('appUrlOpen', ...)` to process Auth0 redirect |
| Forgetting `npx cap sync` after install | Always run `npx cap sync` after installing Capacitor plugins |
| Using `window.location.origin` as redirect URI | Use the custom URL scheme (`packageId://domain/...`), not `http://localhost` |
| Missing Allowed Origins in Dashboard | Add `capacitor://localhost, http://localhost` to Allowed Origins |
| localStorage treated as persistent on mobile | Use refresh tokens (`useRefreshTokens={true}`) for reliable token persistence |
| iOS SSO not working | SFSafariViewController doesn't share cookies with Safari on iOS 11+; this is expected |
| Not testing on physical device | Always test auth flows on a physical device; simulators may not handle deep links correctly |

## WebAuth Method

This SDK uses Auth0's Universal Login (WebAuth) via the Capacitor Browser plugin. The `loginWithRedirect()` method opens the Auth0 authorization endpoint in a system browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android). After authentication, Auth0 redirects back to the app using a native callback URL with a custom scheme: `{packageId}://{domain}/capacitor/{packageId}/callback`. The `@capacitor/app` plugin captures this deep link, and `handleRedirectCallback(url)` processes the authorization code exchange.

Unlike standard native SDKs that use `https://{domain}/android/{packageId}/callback` or `https://{domain}/ios/{bundleId}/callback`, Ionic Capacitor apps use the Capacitor-specific callback path with the package ID as the URL scheme.

## Related Skills

All of this lives in the one `auth0` skill — just describe what you need (e.g. "add MFA", "protect my API").

## Quick Reference

| API | Description |
|-----|-------------|
| `Auth0Provider` | Context provider — wraps app root with Auth0 config |
| `useAuth0()` | Hook — returns `{ isLoading, isAuthenticated, user, loginWithRedirect, logout, getAccessTokenSilently, handleRedirectCallback }` |
| `loginWithRedirect({ openUrl })` | Login via Universal Login — use `Browser.open()` in `openUrl` callback |
| `logout({ logoutParams, openUrl })` | Logout — use `Browser.open()` in `openUrl` callback |
| `handleRedirectCallback(url)` | Process Auth0 callback URL from deep link |
| `getAccessTokenSilently()` | Get access token (uses refresh tokens on mobile) |
| `withAuthenticationRequired(Component)` | HOC to protect routes |
| `Browser.open({ url })` | Capacitor — opens URL in system browser (SFSafariViewController / Chrome Custom Tabs) |
| `CapApp.addListener('appUrlOpen', cb)` | Capacitor — listens for deep link events |
| `Browser.close()` | Capacitor — closes the in-app browser after callback |

## References

- [Auth0 Ionic React Quickstart](https://auth0.com/docs/quickstart/native/ionic-react/interactive)
- [Auth0 React SDK GitHub](https://github.com/auth0/auth0-react)
- [Auth0 React SDK API Reference](https://auth0.github.io/auth0-react/)
- [Ionic React Capacitor Sample App](https://github.com/auth0-samples/auth0-ionic-samples/tree/main/react)
- [Capacitor Browser Plugin](https://capacitorjs.com/docs/apis/browser)
- [Capacitor App Plugin](https://capacitorjs.com/docs/apis/app)
- [Auth0 Dashboard](https://manage.auth0.com/)

---

# Auth0 Ionic React (Capacitor) — API Reference & Testing

## Auth0Provider Configuration

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `domain` | `string` | Yes | — | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `clientId` | `string` | Yes | — | Auth0 application Client ID |
| `useRefreshTokens` | `boolean` | Yes (for Capacitor) | `false` | Must be `true` for native mobile — uses refresh tokens instead of iframe |
| `useRefreshTokensFallback` | `boolean` | Yes (for Capacitor) | `true` | Must be `false` for native mobile — disables iframe fallback |
| `authorizationParams.redirect_uri` | `string` | Yes | — | Custom scheme callback URL: `{packageId}://{domain}/capacitor/{packageId}/callback` |
| `authorizationParams.audience` | `string` | No | — | API identifier for access token audience |
| `authorizationParams.scope` | `string` | No | `openid profile email` | OAuth scopes to request |
| `cacheLocation` | `string` | No | `memory` | Token cache location: `memory` or `localstorage` |

### Capacitor-Specific Configuration

```tsx
<Auth0Provider
  domain="your-tenant.auth0.com"
  clientId="your-client-id"
  useRefreshTokens={true}
  useRefreshTokensFallback={false}
  authorizationParams={{
    redirect_uri: "com.example.myapp://your-tenant.auth0.com/capacitor/com.example.myapp/callback"
  }}
>
  <App />
</Auth0Provider>
```

## useAuth0() Hook

```tsx
const {
  isLoading,          // boolean — true while SDK initializes
  isAuthenticated,    // boolean — true if user has valid session
  user,               // User | undefined — authenticated user profile
  error,              // Error | undefined — last authentication error
  loginWithRedirect,  // (options?) => Promise<void>
  logout,             // (options?) => Promise<void>
  getAccessTokenSilently, // (options?) => Promise<string>
  getAccessTokenWithPopup, // (options?) => Promise<string> (not for Capacitor)
  handleRedirectCallback,  // (url?) => Promise<RedirectLoginResult>
} = useAuth0();
```

## loginWithRedirect Options (Capacitor)

```tsx
await loginWithRedirect({
  // Required for Capacitor: opens URL in system browser
  async openUrl(url: string) {
    await Browser.open({ url, windowName: "_self" });
  },
  // Optional: additional authorization params
  authorizationParams: {
    audience: "https://api.example.com/",
    scope: "openid profile email read:data",
    organization: "org_abc123",
    invitation: "inv_xyz789",
  }
});
```

## logout Options (Capacitor)

```tsx
await logout({
  logoutParams: {
    returnTo: "com.example.myapp://your-tenant.auth0.com/capacitor/com.example.myapp/callback"
  },
  async openUrl(url: string) {
    await Browser.open({ url, windowName: "_self" });
  }
});
```

## getAccessTokenSilently Options

```tsx
const token = await getAccessTokenSilently({
  authorizationParams: {
    audience: "https://api.example.com/",
    scope: "read:data",
  }
});

// Use token in API calls
const response = await fetch("https://api.example.com/data", {
  headers: { Authorization: `Bearer ${token}` }
});
```

## Claims Reference

| Claim | Source | Description |
|-------|--------|-------------|
| `sub` | ID Token | User identifier (e.g., `auth0|abc123`) |
| `name` | ID Token | User's full name |
| `email` | ID Token | User's email address |
| `email_verified` | ID Token | Whether email has been verified |
| `picture` | ID Token | URL to user's profile picture |
| `nickname` | ID Token | User's nickname |
| `updated_at` | ID Token | Last profile update timestamp |
| `org_id` | ID Token | Organization ID (when using Organizations) |
| `permissions` | Access Token | RBAC permissions array (when API has RBAC enabled) |

## Capacitor Plugin Configuration

### capacitor.config.ts

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.myapp',
  appName: 'My App',
  webDir: 'dist',  // or 'build' for CRA
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

### iOS: URL Scheme Registration

No additional URL scheme registration needed for Capacitor — the deep link uses the app's bundle ID as the scheme, which Capacitor handles automatically.

### Android: URL Scheme Registration

Capacitor handles deep link registration automatically via the `appId` in `capacitor.config.ts`. Ensure the `appId` matches the `applicationId` in `android/app/build.gradle`.

## Auth0 Dashboard Configuration

### Callback URLs

```text
YOUR_PACKAGE_ID://YOUR_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback
```

Example: `com.example.myapp://your-tenant.auth0.com/capacitor/com.example.myapp/callback`

### Logout URLs

Same as callback URL:
```text
YOUR_PACKAGE_ID://YOUR_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback
```

### Allowed Origins

```text
capacitor://localhost, http://localhost
```

## Testing Checklist

- [ ] Auth0Provider wraps root component with correct domain and clientId
- [ ] `useRefreshTokens={true}` and `useRefreshTokensFallback={false}` are set
- [ ] `redirect_uri` uses custom scheme format (`packageId://domain/capacitor/packageId/callback`)
- [ ] Login opens system browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android)
- [ ] Deep link callback is handled via `CapApp.addListener('appUrlOpen', ...)`
- [ ] `handleRedirectCallback(url)` is called when URL contains `state` and `code`/`error`
- [ ] `Browser.close()` is called after handling callback
- [ ] Logout redirects back to app via custom scheme
- [ ] `getAccessTokenSilently()` works with refresh tokens
- [ ] User profile data is accessible via `useAuth0().user`
- [ ] `npx cap sync` has been run after installing Capacitor plugins
- [ ] Auth0 Dashboard has correct Callback URLs, Logout URLs, and Allowed Origins
- [ ] Application type is set to "Native" in Auth0 Dashboard

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Login opens but never returns to app | Callback URL mismatch or missing deep link handler | Verify callback URL in Dashboard matches `redirect_uri`; ensure `appUrlOpen` listener is registered |
| `handleRedirectCallback` not called | Deep link listener not set up or URL check is wrong | Verify `CapApp.addListener('appUrlOpen', ...)` runs on app mount |
| Token refresh fails silently | `useRefreshTokens` not enabled | Set `useRefreshTokens={true}` on Auth0Provider |
| iframe fallback error on mobile | `useRefreshTokensFallback` not disabled | Set `useRefreshTokensFallback={false}` on Auth0Provider |
| `Browser.open` does nothing | `@capacitor/browser` not installed or synced | Run `npm install @capacitor/browser && npx cap sync` |
| App crashes on deep link | Missing `@capacitor/app` plugin | Run `npm install @capacitor/app && npx cap sync` |
| CORS error during token exchange | Missing Allowed Origins in Auth0 Dashboard | Add `capacitor://localhost, http://localhost` to Allowed Origins |
| `user` is `undefined` after login | Callback not processed before reading user | Wait for `isLoading === false` before accessing `user` |
| SSO not working on iOS | SFSafariViewController doesn't share Safari cookies (iOS 11+) | Expected limitation — SSO across apps is not supported on iOS |

## Security Considerations

- **No client secret**: Native applications must not include a client secret. Use PKCE (Auth Code + PKCE) flow, which is the default.
- **Refresh tokens**: Always enable `useRefreshTokens={true}` for Capacitor apps. localStorage is transient on mobile.
- **Token storage**: The SDK stores tokens in memory by default. On mobile, refresh tokens are the reliable mechanism for session persistence.
- **Custom scheme validation**: The callback URL scheme must match the app's package/bundle ID exactly.
- **HTTPS**: Capacitor uses HTTPS for Android by default (`androidScheme: 'https'` in config). Do not change this.

---

# Integration Patterns

## Authentication Flow

The Ionic React + Capacitor authentication flow:

1. User taps "Login" button
2. `loginWithRedirect()` is called with a custom `openUrl` that uses `Browser.open()`
3. Capacitor Browser opens Auth0 Universal Login in a system browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android)
4. User authenticates with Auth0
5. Auth0 redirects to the custom scheme callback URL (`packageId://domain/capacitor/packageId/callback`)
6. Capacitor App plugin receives the deep link via `appUrlOpen` event
7. `handleRedirectCallback(url)` processes the authorization code
8. `Browser.close()` dismisses the system browser
9. User is now authenticated — `isAuthenticated` is `true`, `user` is populated

## Auth0Provider Setup

Configure `Auth0Provider` at your app's entry point (`src/main.tsx` or `src/index.tsx`):

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App';

const domain = "your-tenant.auth0.com";
const clientId = "your-client-id";
const packageId = "com.example.myapp";
const callbackUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

const root = createRoot(document.getElementById('root')!);

root.render(
  <Auth0Provider
    domain={domain}
    clientId={clientId}
    useRefreshTokens={true}
    useRefreshTokensFallback={false}
    authorizationParams={{
      redirect_uri: callbackUri
    }}
  >
    <App />
  </Auth0Provider>
);
```

### Why These Props Are Required for Capacitor

| Prop | Value | Reason |
|------|-------|--------|
| `useRefreshTokens` | `true` | Mobile apps cannot use iframe-based token renewal. Refresh tokens provide reliable session persistence. |
| `useRefreshTokensFallback` | `false` | Prevents the SDK from attempting iframe fallback, which fails on native. |
| `authorizationParams.redirect_uri` | Custom scheme URL | Native apps use a custom URL scheme, not `http://localhost`. |

## Login Implementation

```tsx
import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Browser } from '@capacitor/browser';
import { IonButton } from '@ionic/react';

const LoginButton: React.FC = () => {
  const { loginWithRedirect } = useAuth0();

  const login = async () => {
    await loginWithRedirect({
      async openUrl(url) {
        await Browser.open({
          url,
          windowName: "_self"
        });
      }
    });
  };

  return <IonButton onClick={login}>Log in</IonButton>;
};

export default LoginButton;
```

## Deep Link Callback Handling

Handle the callback in your main App component. This must run on app initialization:

```tsx
import React, { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

setupIonicReact();

const App: React.FC = () => {
  const { handleRedirectCallback } = useAuth0();

  useEffect(() => {
    const handleAppUrlOpen = async ({ url }: { url: string }) => {
      if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
        await handleRedirectCallback(url);
      }
      await Browser.close();
    };

    CapApp.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      CapApp.removeAllListeners();
    };
  }, [handleRedirectCallback]);

  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
          {/* Your routes */}
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
```

## Logout Implementation

```tsx
import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Browser } from '@capacitor/browser';
import { IonButton } from '@ionic/react';

const domain = "your-tenant.auth0.com";
const packageId = "com.example.myapp";
const logoutUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

const LogoutButton: React.FC = () => {
  const { logout } = useAuth0();

  const doLogout = async () => {
    await logout({
      logoutParams: {
        returnTo: logoutUri
      },
      async openUrl(url) {
        await Browser.open({
          url,
          windowName: "_self"
        });
      }
    });
  };

  return <IonButton onClick={doLogout}>Log out</IonButton>;
};

export default LogoutButton;
```

## User Profile Display

```tsx
import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonAvatar,
  IonItem,
  IonLabel,
  IonSpinner
} from '@ionic/react';

const Profile: React.FC = () => {
  const { user, isLoading, isAuthenticated } = useAuth0();

  if (isLoading) {
    return <IonSpinner />;
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <IonCard>
      <IonCardHeader>
        <IonItem lines="none">
          <IonAvatar slot="start">
            <img src={user.picture} alt={user.name} />
          </IonAvatar>
          <IonLabel>
            <IonCardTitle>{user.name}</IonCardTitle>
            <p>{user.email}</p>
          </IonLabel>
        </IonItem>
      </IonCardHeader>
      <IonCardContent>
        <pre>{JSON.stringify(user, null, 2)}</pre>
      </IonCardContent>
    </IonCard>
  );
};

export default Profile;
```

## Protected Routes

Use `withAuthenticationRequired` HOC to protect Ionic pages:

```tsx
import React from 'react';
import { withAuthenticationRequired } from '@auth0/auth0-react';
import { IonPage, IonContent, IonSpinner } from '@ionic/react';

const ProtectedPage: React.FC = () => {
  return (
    <IonPage>
      <IonContent>
        <h1>Protected Content</h1>
      </IonContent>
    </IonPage>
  );
};

export default withAuthenticationRequired(ProtectedPage, {
  onRedirecting: () => (
    <IonPage>
      <IonContent className="ion-text-center ion-padding">
        <IonSpinner />
      </IonContent>
    </IonPage>
  ),
});
```

### Route Setup with IonReactRouter

```tsx
import { Route, Redirect } from 'react-router-dom';
import { IonRouterOutlet } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

import HomePage from './pages/Home';
import ProtectedPage from './pages/Protected';

<IonReactRouter>
  <IonRouterOutlet>
    <Route exact path="/home" component={HomePage} />
    <Route exact path="/protected" component={ProtectedPage} />
    <Redirect exact from="/" to="/home" />
  </IonRouterOutlet>
</IonReactRouter>
```

## Accessing API Tokens

```tsx
import { useAuth0 } from '@auth0/auth0-react';

const ApiCaller: React.FC = () => {
  const { getAccessTokenSilently } = useAuth0();

  const callApi = async () => {
    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience: "https://api.example.com/",
        scope: "read:data",
      }
    });

    const response = await fetch("https://api.example.com/data", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return response.json();
  };

  // ...
};
```

To use API tokens, configure the `audience` in Auth0Provider:

```tsx
<Auth0Provider
  domain={domain}
  clientId={clientId}
  useRefreshTokens={true}
  useRefreshTokensFallback={false}
  authorizationParams={{
    redirect_uri: callbackUri,
    audience: "https://api.example.com/",
  }}
>
```

## Conditional Login/Logout UI

```tsx
import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Browser } from '@capacitor/browser';
import { IonButton } from '@ionic/react';

const AuthButton: React.FC = () => {
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();

  const domain = "your-tenant.auth0.com";
  const packageId = "com.example.myapp";
  const callbackUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

  if (isAuthenticated) {
    return (
      <IonButton onClick={() => logout({
        logoutParams: { returnTo: callbackUri },
        async openUrl(url) {
          await Browser.open({ url, windowName: "_self" });
        }
      })}>
        Log out
      </IonButton>
    );
  }

  return (
    <IonButton onClick={() => loginWithRedirect({
      async openUrl(url) {
        await Browser.open({ url, windowName: "_self" });
      }
    })}>
      Log in
    </IonButton>
  );
};

export default AuthButton;
```

## Organizations Support

```tsx
await loginWithRedirect({
  authorizationParams: {
    organization: "org_abc123",
  },
  async openUrl(url) {
    await Browser.open({ url, windowName: "_self" });
  }
});
```

To accept an organization invitation:

```tsx
await loginWithRedirect({
  authorizationParams: {
    organization: "org_abc123",
    invitation: "inv_xyz789",
  },
  async openUrl(url) {
    await Browser.open({ url, windowName: "_self" });
  }
});
```

## Error Handling

```tsx
import { useAuth0 } from '@auth0/auth0-react';

const App: React.FC = () => {
  const { error, isLoading } = useAuth0();

  if (isLoading) {
    return <IonSpinner />;
  }

  if (error) {
    return (
      <IonCard color="danger">
        <IonCardContent>
          <h2>Authentication Error</h2>
          <p>{error.message}</p>
        </IonCardContent>
      </IonCard>
    );
  }

  return <App />;
};
```

### Common Error Types

| Error | Cause | Resolution |
|-------|-------|------------|
| `login_required` | Session expired or not authenticated | Re-trigger `loginWithRedirect()` |
| `consent_required` | User hasn't consented to requested scopes | Re-trigger login with `prompt: 'consent'` |
| `invalid_grant` | Refresh token expired or revoked | Clear session and re-authenticate |
| `access_denied` | User denied consent or rule blocked access | Check Auth0 Actions/Rules for blocks |
| `mfa_required` | MFA is required for the user | Handle MFA enrollment flow |

## Testing Patterns

### Physical Device Testing

Always test authentication flows on a physical device. Simulators and emulators may not correctly handle deep link callbacks or system browser interactions. To test on a physical device:

```bash
ionic build
npx cap sync
npx cap open ios   # Build and run on device from Xcode
npx cap open android  # Build and run on device from Android Studio
```

### Manual Testing Flow

1. Run `ionic serve` for browser testing (limited — deep links won't work)
2. Build and deploy to a physical device:
   ```bash
   ionic build
   npx cap sync
   npx cap open ios   # or: npx cap open android
   ```
3. Build and run from Xcode/Android Studio on a physical device
4. Tap Login → should open system browser
5. Authenticate → should return to app with user data
6. Tap Logout → should clear session and redirect back

---

# Auth0 Ionic React (Capacitor) — Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **IMPORTANT — Never display credentials:** After obtaining credentials from the CLI or user input, write them directly into config files. Do NOT echo, print, or display the domain, client ID, or any credential values in conversation output.
>
> Always ask the user to choose between automatic and manual setup using `AskUserQuestion`:
> _"How would you like to configure Auth0 for this Ionic React project?"_
>   - **Automatic setup (Recommended)** — uses the Auth0 CLI to create a Native application, configure callback URLs, and store credentials in the project config files automatically
>   - **Manual setup** — you provide an existing `.env` file or Auth0 credentials (domain, client ID) and the agent writes them to the project config

### Automatic Setup (Auth0 CLI)

> **Agent instruction:** Run these pre-flight checks before creating the Auth0 application. Do NOT run `auth0 login` from the agent — it is interactive and will hang.
>
> 1. **Check Auth0 CLI**: `command -v auth0`. If missing, install it: `brew install auth0/auth0-cli/auth0`.
> 2. **Check Auth0 login**: `auth0 tenants list --csv --no-input 2>&1`. If it fails or returns empty:
>    - Tell the user: _"Please run `auth0 login` in your terminal and let me know when done."_
>    - Wait for confirmation, then re-run the check. Retry up to 3 times before treating as a persistent failure.
> 3. **Confirm active tenant**: Parse the `→` line from the CSV output. Tell the user: _"Your active Auth0 tenant is: `<domain>`. Is this correct?"_
>    - If no, ask the user to run `auth0 tenants use <tenant-domain>`, then re-run step 2.
>
> Once confirmed, run the following steps:
>
> **Step A — Detect package ID:**
> Read `capacitor.config.ts` (or `capacitor.config.json`) and extract the `appId` field (e.g., `com.example.myapp`).
>
> **Step B — Create Native application:**
> ```bash
> auth0 apps create \
>   --name "APP_NAME" \
>   --type native \
>   --auth-method None \
>   --callbacks "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
>   --logout-urls "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
>   --origins "capacitor://localhost,http://localhost" \
>   --json \
>   --no-input
> ```
> Parse the JSON output to extract `client_id` and `domain` (the tenant domain).
>
> **Step C — Write credentials to config files (never display them):**
> Write the `client_id` and `domain` from Step B directly into the project `.env` file. Detect whether the project uses Vite (`VITE_` prefix) or CRA (`REACT_APP_` prefix) and use the appropriate variable names. **Do NOT echo, print, or display the domain, client ID, or any credential values in your conversation output.** Simply confirm that the Auth0 app was created and credentials were saved, without showing the actual values.
>
> If any CLI command fails due to session expiry, ask the user to run `auth0 login` again, then retry. Retry up to 3 times.
> Only if the CLI keeps failing after retries: fall back to **Manual Setup** below.

### Manual Setup (User-Provided Configuration)

> **Agent instruction:** Ask the user to provide their Auth0 configuration. Accept either:
> - **An `.env` file path** — read the file to extract the Auth0 domain and client ID, then copy or reference it in the project.
> - **Direct credentials** — ask using `AskUserQuestion`: _"Please provide your Auth0 Domain and Client ID."_
>
> Once credentials are obtained, write them to the project `.env` file. Detect whether the project uses Vite (`VITE_` prefix) or CRA (`REACT_APP_` prefix) and use the appropriate variable names. **Do NOT display the credentials in conversation output.**

### Callback URL Format

| Field | Value |
|-------|-------|
| **Allowed Callback URLs** | `YOUR_PACKAGE_ID://YOUR_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback` |
| **Allowed Logout URLs** | `YOUR_PACKAGE_ID://YOUR_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback` |
| **Allowed Web Origins** | `capacitor://localhost, http://localhost` |

Replace `YOUR_PACKAGE_ID` with your app's package ID (e.g., `com.example.myapp`) and `YOUR_DOMAIN` with your Auth0 domain. These are set automatically when using the CLI commands above.

## SDK Installation

```bash
npm install @auth0/auth0-react @capacitor/browser @capacitor/app
npx cap sync
```

### Plugin purposes

| Package | Purpose |
|---------|---------|
| `@auth0/auth0-react` | Auth0 React SDK — provides `Auth0Provider` and `useAuth0` hook |
| `@capacitor/browser` | Opens Auth0 Universal Login in system browser (SFSafariViewController / Chrome Custom Tabs) |
| `@capacitor/app` | Handles deep link callbacks from Auth0 after login/logout |

## Post-Setup Steps

### 1. Verify Capacitor Configuration

Ensure `capacitor.config.ts` has the correct `appId`:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.myapp', // Must match YOUR_PACKAGE_ID in callback URLs
  appName: 'My App',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

### 2. Sync Native Projects

After installing plugins, always sync:

```bash
npx cap sync
```

### 3. Verify Platform Setup

**iOS:** Open the iOS project to verify:
```bash
npx cap open ios
```
Ensure the Bundle Identifier in Xcode matches `appId` in `capacitor.config.ts`.

**Android:** Open the Android project to verify:
```bash
npx cap open android
```
Ensure `applicationId` in `android/app/build.gradle` matches `appId` in `capacitor.config.ts`.

## Secret Management

**Ionic React + Capacitor apps are Native applications** — they do not use a client secret. Instead, use PKCE (Proof Key for Code Exchange) with a custom URL scheme callback (e.g. `YOUR_PACKAGE_ID://your-tenant.auth0.com/capacitor/YOUR_PACKAGE_ID/callback`) to complete the login flow securely.

- Configuration contains only: **Domain**, **Client ID**, and **Callback URL**
- These values are not secrets and can be included in source code
- Token validation uses PKCE (Proof Key for Code Exchange) — no client secret needed
- Never include a client secret in a mobile/native application

### Environment Variables (Optional)

If you prefer environment variables for Domain and Client ID during development:

```bash
# .env (for Vite-based Ionic projects)
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id

# .env (for CRA-based Ionic projects)
REACT_APP_AUTH0_DOMAIN=your-tenant.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
```

Then reference in code:
```tsx
<Auth0Provider
  domain={import.meta.env.VITE_AUTH0_DOMAIN}
  clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
  // ...
>
```

## Verification

After setup, verify the configuration:

1. Run `ionic serve` — the app should load without Auth0 errors
2. Run `ionic build && npx cap sync` — native projects should sync cleanly
3. Open in Xcode/Android Studio and build — no missing plugin errors
4. Tap login — system browser should open Auth0 Universal Login
5. After login — app should receive the deep link callback and show the user profile
