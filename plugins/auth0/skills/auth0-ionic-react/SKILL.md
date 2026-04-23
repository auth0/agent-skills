---
name: auth0-ionic-react
description: Use when adding Auth0 authentication to an Ionic React application with Capacitor — integrates @auth0/auth0-react SDK with Capacitor Browser and App plugins for native iOS/Android deep linking, login, logout, and user profile display.
---

# Auth0 Ionic React (Capacitor) Integration

Add Auth0 authentication to Ionic React applications using Capacitor. This skill covers native mobile authentication using the `@auth0/auth0-react` SDK combined with `@capacitor/browser` and `@capacitor/app` plugins for deep link handling on iOS and Android.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/auth0-react/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below.

## Prerequisites

- Node.js 18+
- Ionic CLI (`npm install -g @ionic/cli`)
- An existing Ionic React application with Capacitor configured
- Auth0 account and tenant
- For iOS: Xcode 14+ and CocoaPods
- For Android: Android Studio with API level 21+
- Auth0 CLI — `brew install auth0/auth0-cli/auth0`

## When NOT to Use

| Use Case | Recommended Skill |
|----------|------------------|
| React SPA (no Capacitor/Ionic) | `auth0-react` |
| React Native (bare CLI) | `auth0-react-native` |
| Expo (React Native) | `auth0-expo` |
| Ionic + Angular + Capacitor | `auth0-ionic-angular` |
| Ionic + Vue + Capacitor | `auth0-ionic-vue` |
| Next.js (server-side) | `auth0-nextjs` |
| iOS native (Swift) | `auth0-swift` |
| Android native (Kotlin) | `auth0-android` |

## Quick Start Workflow

> **Agent instruction:** Follow these steps in order. If the user's prompt already provides Auth0 credentials (domain, client ID), use them directly — skip the CLI setup. When credentials are missing, always use the Auth0 CLI to create the application.

> **Agent instruction:** Check if the codebase already has an existing provider or auth wrapper. Search for existing login/logout handlers, auth buttons, or authentication-related UI to reuse. If found, integrate Auth0 into those existing components rather than creating new ones.

### Step 1: Install Dependencies

```bash
npm install @auth0/auth0-react @capacitor/browser @capacitor/app
npx cap sync
```

### Step 2: Configure Auth0

> **Agent instruction:**
> - **If Auth0 credentials (domain AND client ID) are already in the user's prompt:** Use them directly and skip to Step 3.
> - **If no credentials are provided:** Create an Auth0 application using the CLI — do NOT ask the user to create or configure an Auth0 application manually. Always use the CLI path.
>
> Follow [Setup Guide — Auth0 Configuration](./references/setup.md#auth0-configuration) for pre-flight checks and CLI commands.
>
> **Create the application and configure callback URLs via Auth0 CLI:**
>
> 1. Detect the package ID from `capacitor.config.ts` (`appId` field).
> 2. Get the Auth0 domain from the active tenant: `auth0 tenants list --csv --no-input` (parse the `→` line).
> 3. Create a Native application:
>    ```bash
>    auth0 apps create \
>      --name "APP_NAME" \
>      --type native \
>      --callbacks "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
>      --logout-urls "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
>      --origins "capacitor://localhost,http://localhost" \
>      --json \
>      --no-input
>    ```
>    Parse the JSON output to extract `client_id`.
>
> If any CLI command fails due to session expiry, ask the user to run `auth0 login` again, then retry up to 3 times.
> Only if the CLI keeps failing after retries: use `AskUserQuestion` to ask the user for their Auth0 Domain and Client ID.

### Step 3: Set Up Auth0Provider

Wrap the app root with `Auth0Provider`, configuring it for Capacitor:

```tsx
import { Auth0Provider } from '@auth0/auth0-react';

const domain = "YOUR_AUTH0_DOMAIN";
const clientId = "YOUR_AUTH0_CLIENT_ID";
const packageId = "YOUR_PACKAGE_ID"; // e.g., com.example.myapp

<Auth0Provider
  domain={domain}
  clientId={clientId}
  useRefreshTokens={true}
  useRefreshTokensFallback={false}
  authorizationParams={{
    redirect_uri: `${packageId}://${domain}/capacitor/${packageId}/callback`
  }}
>
  <App />
</Auth0Provider>
```

### Step 4: Implement Login with Capacitor Browser

```tsx
import { useAuth0 } from '@auth0/auth0-react';
import { Browser } from '@capacitor/browser';

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
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { useAuth0 } from '@auth0/auth0-react';

useEffect(() => {
  CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
      await handleRedirectCallback(url);
    }
    await Browser.close();
  });
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

- **[Setup Guide](./references/setup.md)** — Auth0 CLI configuration, Capacitor URL scheme registration, secret management
- **[Integration Patterns](./references/integration.md)** — Login/logout with Capacitor Browser, deep link callback handling, user profile, protected routes, token access, error handling
- **[Testing & Reference](./references/api.md)** — Full API reference for Auth0Provider props, useAuth0 hook, Capacitor plugin configuration, testing checklist, common issues

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

- **auth0-react** — React SPA (browser-only, no Capacitor)
- **auth0-ionic-angular** — Ionic with Angular and Capacitor
- **auth0-ionic-vue** — Ionic with Vue and Capacitor
- **auth0-react-native** — React Native (bare CLI, no Ionic/Capacitor)
- **auth0-expo** — Expo (React Native) with Auth0

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
