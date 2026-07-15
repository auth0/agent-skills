
# Auth0 Ionic Vue (Capacitor) Integration

Add Auth0 authentication to Ionic Vue applications using Capacitor. This skill covers native mobile authentication using the `@auth0/auth0-vue` SDK combined with `@capacitor/browser` and `@capacitor/app` plugins for deep link handling on iOS and Android.

## Critical rules

- **IMPORTANT — never display credentials.** After obtaining the domain, client ID, or any credential value from the CLI or user input, write them directly into config files. Do not echo, print, or display them in conversation output.

## Prerequisites

- Node.js 18+
- Ionic CLI (`npm install -g @ionic/cli`)
- An existing Ionic Vue application with Capacitor configured
- Auth0 account and tenant
- For iOS: Xcode 14+ and CocoaPods
- For Android: Android Studio with API level 21+
- Auth0 CLI — `brew install auth0/auth0-cli/auth0`

## When NOT to Use

| Use Case | Use Instead |
|----------|------------------|
| Vue SPA (no Capacitor/Ionic) | the Auth0 integration workflow for Vue |
| React SPA (no Capacitor/Ionic) | the Auth0 integration workflow for React |
| React Native (bare CLI) | the Auth0 integration workflow for React Native |
| Expo (React Native) | the Auth0 integration workflow for Expo |
| Ionic + React + Capacitor | the Auth0 integration workflow for Ionic React |
| Ionic + Angular + Capacitor | the Auth0 integration workflow for Ionic Angular |
| Next.js (server-side) | the Auth0 integration workflow for Next.js |
| Nuxt (server-side) | the Auth0 integration workflow for Nuxt |
| iOS native (Swift) | the Auth0 integration workflow for iOS (Swift) |
| Android native (Kotlin) | the Auth0 integration workflow for Android (Kotlin) |

## Quick Start Workflow

### Step 1: Configure Auth0

**For automated setup with Auth0 CLI**, see the Setup Guide section (below) for complete scripts.

**For manual setup**, configure a **Native** application in the [Auth0 Dashboard](https://manage.auth0.com/) and note your Domain and Client ID.

### Step 2: Install Dependencies

```bash
npm install @auth0/auth0-vue @capacitor/browser @capacitor/app
npx cap sync
```

### Step 3: Set Up Auth0 Plugin

> **Agent instruction:** If Step 1 already wrote `.env` and updated `src/main.ts`, verify the configuration looks correct and skip to Step 4. Only use the template below if configuring manually.

Register the Auth0 Vue plugin in your app entry point (`src/main.ts`), configuring it for Capacitor. Credentials are read from `.env` via `import.meta.env`:

```typescript
import { createApp } from 'vue';
import { createAuth0 } from '@auth0/auth0-vue';
import { IonicVue } from '@ionic/vue';
import App from './App.vue';
import router from './router';

// Agent: read appId from capacitor.config.ts and replace this value
const packageId = "YOUR_PACKAGE_ID";

const app = createApp(App);

app.use(IonicVue);
app.use(router);
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    useRefreshTokens: true,
    useRefreshTokensFallback: false,
    authorizationParams: {
      redirect_uri: `${packageId}://${import.meta.env.VITE_AUTH0_DOMAIN}/capacitor/${packageId}/callback`
    }
  })
);

router.isReady().then(() => {
  app.mount('#app');
});
```

### Step 4: Implement Login with Capacitor Browser

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { Browser } from '@capacitor/browser';
import { IonButton } from '@ionic/vue';

const { loginWithRedirect } = useAuth0();

const login = async () => {
  await loginWithRedirect({
    async openUrl(url: string) {
      await Browser.open({ url, windowName: "_self" });
    }
  });
};
</script>

<template>
  <ion-button @click="login">Log in</ion-button>
</template>
```

### Step 5: Handle Callback via Deep Link

Handle the deep link callback in your App.vue component. This must run on app initialization:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { IonApp, IonRouterOutlet } from '@ionic/vue';

const { handleRedirectCallback } = useAuth0();

let urlOpenListener: any;

onMounted(async () => {
  urlOpenListener = await CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
      await handleRedirectCallback(url);
    }
    await Browser.close();
  });
});

onUnmounted(() => {
  urlOpenListener?.remove();
});
</script>

<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>
```

### Step 6: Implement Logout

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { Browser } from '@capacitor/browser';
import { IonButton } from '@ionic/vue';

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
// Agent: read appId from capacitor.config.ts and replace this value
const packageId = "YOUR_PACKAGE_ID";)
const logoutUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

const { logout } = useAuth0();

const doLogout = async () => {
  await logout({
    logoutParams: {
      returnTo: logoutUri
    },
    async openUrl(url: string) {
      await Browser.open({ url, windowName: "_self" });
    }
  });
};
</script>

<template>
  <ion-button @click="doLogout">Log out</ion-button>
</template>
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

- **Setup Guide** (see below) — Auth0 CLI automated setup (login, app creation, credential injection), Capacitor URL scheme registration, secret management
- **Integration Patterns** (see below) — Login/logout with Capacitor Browser, deep link callback handling, user profile, protected routes, token access, error handling
- **Testing & Reference** (see below) — Full API reference for createAuth0 options, useAuth0 composable, Capacitor plugin configuration, testing checklist, common issues

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| App type not set to **Native** in Auth0 Dashboard | Change application type to "Native" in Dashboard settings |
| Missing or incorrect callback URL format | Use `YOUR_PACKAGE_ID://YOUR_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback` — must match exactly |
| Not enabling refresh tokens | Set `useRefreshTokens: true` and `useRefreshTokensFallback: false` in `createAuth0()` |
| Missing `@capacitor/browser` or `@capacitor/app` | Install both: `npm install @capacitor/browser @capacitor/app && npx cap sync` |
| Not handling deep link callback | Add `CapApp.addListener('appUrlOpen', ...)` to process Auth0 redirect |
| Forgetting `npx cap sync` after install | Always run `npx cap sync` after installing Capacitor plugins |
| Using `window.location.origin` as redirect URI | Use the custom URL scheme (`packageId://domain/...`), not `http://localhost` |
| Missing Allowed Origins in Dashboard | Add `capacitor://localhost, http://localhost` to Allowed Origins |
| Not calling `app.use(createAuth0(...))` before mount | Register Auth0 plugin before calling `app.mount('#app')` |
| Accessing `.value` incorrectly on auth refs | `useAuth0()` returns Vue refs — use `.value` in `<script>`, template unwraps automatically |
| localStorage treated as persistent on mobile | Use refresh tokens (`useRefreshTokens: true`) for reliable token persistence |

## WebAuth Method

This SDK uses Auth0's Universal Login (WebAuth) via the Capacitor Browser plugin. The `loginWithRedirect()` method opens the Auth0 authorization endpoint in a system browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android). After authentication, Auth0 redirects back to the app using a native callback URL with a custom scheme: `{packageId}://{domain}/capacitor/{packageId}/callback`. The `@capacitor/app` plugin captures this deep link, and `handleRedirectCallback(url)` processes the authorization code exchange.

Unlike standard native SDKs that use `https://{domain}/android/{packageId}/callback` or `https://{domain}/ios/{bundleId}/callback`, Ionic Capacitor apps use the Capacitor-specific callback path with the package ID as the URL scheme.

## Related Skills

All of this lives in the one `auth0` skill — just describe what you need (e.g. "add MFA", "protect my API").

## Quick Reference

| API | Description |
|-----|-------------|
| `createAuth0(options)` | Vue plugin factory — registers Auth0 with `app.use()` |
| `useAuth0()` | Composable — returns `{ isLoading, isAuthenticated, user, loginWithRedirect, logout, getAccessTokenSilently, handleRedirectCallback, error }` |
| `loginWithRedirect({ openUrl })` | Login via Universal Login — use `Browser.open()` in `openUrl` callback |
| `logout({ logoutParams, openUrl })` | Logout — use `Browser.open()` in `openUrl` callback |
| `handleRedirectCallback(url)` | Process Auth0 callback URL from deep link |
| `getAccessTokenSilently()` | Get access token (uses refresh tokens on mobile) |
| `createAuthGuard(app)` | Vue Router navigation guard factory for protected routes |
| `Browser.open({ url })` | Capacitor — opens URL in system browser (SFSafariViewController / Chrome Custom Tabs) |
| `CapApp.addListener('appUrlOpen', cb)` | Capacitor — listens for deep link events |
| `Browser.close()` | Capacitor — closes the in-app browser after callback |

## References

- [Auth0 Ionic Vue Quickstart](https://auth0.com/docs/quickstart/native/ionic-vue/interactive)
- [Auth0 Vue SDK GitHub](https://github.com/auth0/auth0-vue)
- [Auth0 Vue SDK API Reference](https://auth0.github.io/auth0-vue/)
- [Ionic Vue Capacitor Sample App](https://github.com/auth0-samples/auth0-ionic-samples/tree/main/vue)
- [Capacitor Browser Plugin](https://capacitorjs.com/docs/apis/browser)
- [Capacitor App Plugin](https://capacitorjs.com/docs/apis/app)
- [Auth0 Dashboard](https://manage.auth0.com/)

---

# Auth0 Ionic Vue (Capacitor) — API Reference & Testing

## createAuth0 Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `domain` | `string` | Yes | — | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `clientId` | `string` | Yes | — | Auth0 application Client ID |
| `useRefreshTokens` | `boolean` | Yes (for Capacitor) | `false` | Must be `true` for native mobile — uses refresh tokens instead of iframe |
| `useRefreshTokensFallback` | `boolean` | Yes (for Capacitor) | `true` | Must be `false` for native mobile — disables iframe fallback |
| `authorizationParams.redirect_uri` | `string` | Yes | — | Custom scheme callback URL: `{packageId}://{domain}/capacitor/{packageId}/callback` |
| `authorizationParams.audience` | `string` | No | — | API identifier for access token audience |
| `authorizationParams.scope` | `string` | No | `openid profile email` | OAuth scopes to request |
| `cacheLocation` | `string` | No | `memory` | Token cache location: `memory` or `localstorage` |

### Capacitor-Specific Configuration

```typescript
app.use(
  createAuth0({
    domain: "your-tenant.auth0.com",
    clientId: "your-client-id",
    useRefreshTokens: true,
    useRefreshTokensFallback: false,
    authorizationParams: {
      redirect_uri: "com.example.myapp://your-tenant.auth0.com/capacitor/com.example.myapp/callback"
    }
  })
);
```

## useAuth0() Composable

```typescript
const {
  isLoading,              // Ref<boolean> — true while SDK initializes
  isAuthenticated,        // Ref<boolean> — true if user has valid session
  user,                   // Ref<User | undefined> — authenticated user profile
  error,                  // Ref<Error | undefined> — last authentication error
  loginWithRedirect,      // (options?) => Promise<void>
  logout,                 // (options?) => Promise<void>
  getAccessTokenSilently, // (options?) => Promise<string>
  getAccessTokenWithPopup, // (options?) => Promise<string> (not for Capacitor)
  handleRedirectCallback, // (url?) => Promise<RedirectLoginResult>
  idTokenClaims,          // Ref<IdToken | undefined> — raw ID token claims
  checkSession,           // () => Promise<void> — refresh authentication state
} = useAuth0();
```

**Note:** All reactive properties (`isLoading`, `isAuthenticated`, `user`, `error`, `idTokenClaims`) are Vue `Ref` objects. Access their values with `.value` in `<script>` blocks; templates unwrap refs automatically.

## loginWithRedirect Options (Capacitor)

```typescript
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

```typescript
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

```typescript
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

## createAuthGuard

Factory function that creates a Vue Router navigation guard for protected routes:

```typescript
import { createAuthGuard } from '@auth0/auth0-vue';
import type { App } from 'vue';

// In router setup (needs app instance)
export function setupRouter(app: App) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      {
        path: '/profile',
        component: () => import('../views/Profile.vue'),
        beforeEnter: createAuthGuard(app)
      }
    ]
  });
  return router;
}
```

## Claims Reference

| Claim | Source | Description |
|-------|--------|-------------|
| `sub` | ID Token | User identifier (e.g., `auth0\|abc123`) |
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
  webDir: 'dist',  // Ionic Vue with Vite uses 'dist'
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

### iOS: URL Scheme Registration

Add a custom URL scheme to `ios/App/App/Info.plist` so iOS can route the Auth0 callback deep link back to the app:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>YOUR_PACKAGE_ID</string>
    </array>
  </dict>
</array>
```

Replace `YOUR_PACKAGE_ID` with the `appId` from `capacitor.config.ts` (e.g., `com.example.myapp`).

### Android: URL Scheme Registration

Add an intent filter to `android/app/src/main/AndroidManifest.xml` inside the main `<activity>` to handle the custom scheme callback:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="YOUR_PACKAGE_ID" />
</intent-filter>
```

Replace `YOUR_PACKAGE_ID` with the `appId` from `capacitor.config.ts`. Ensure the `appId` matches the `applicationId` in `android/app/build.gradle`.

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

- [ ] Auth0 plugin registered with `app.use(createAuth0({...}))` with correct domain and clientId
- [ ] `useRefreshTokens: true` and `useRefreshTokensFallback: false` are set
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
- [ ] Vue refs are accessed with `.value` in script, template unwraps automatically

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Login opens but never returns to app | Callback URL mismatch or missing deep link handler | Verify callback URL in Dashboard matches `redirect_uri`; ensure `appUrlOpen` listener is registered |
| `handleRedirectCallback` not called | Deep link listener not set up or URL check is wrong | Verify `CapApp.addListener('appUrlOpen', ...)` runs in `onMounted` |
| Token refresh fails silently | `useRefreshTokens` not enabled | Set `useRefreshTokens: true` in `createAuth0()` |
| iframe fallback error on mobile | `useRefreshTokensFallback` not disabled | Set `useRefreshTokensFallback: false` in `createAuth0()` |
| `Browser.open` does nothing | `@capacitor/browser` not installed or synced | Run `npm install @capacitor/browser && npx cap sync` |
| App crashes on deep link | Missing `@capacitor/app` plugin | Run `npm install @capacitor/app && npx cap sync` |
| CORS error during token exchange | Missing Allowed Origins in Auth0 Dashboard | Add `capacitor://localhost, http://localhost` to Allowed Origins |
| `user` is `undefined` after login | Callback not processed before reading user | Wait for `isLoading.value === false` before accessing `user.value` |
| SSO not working on iOS | SFSafariViewController doesn't share Safari cookies (iOS 11+) | Expected limitation — SSO across apps is not supported on iOS |
| Auth plugin not found | `createAuth0()` not registered before mount | Call `app.use(createAuth0({...}))` before `app.mount('#app')` |
| Composable returns undefined | `useAuth0()` called outside setup or before plugin registration | Ensure `useAuth0()` is called inside `<script setup>` or `setup()` of a component |

## Security Considerations

- **No client secret**: Native applications must not include a client secret. Use PKCE (Auth Code + PKCE) flow, which is the default.
- **Refresh tokens**: Always enable `useRefreshTokens: true` for Capacitor apps. localStorage is transient on mobile.
- **Token storage**: The SDK stores tokens in memory by default. On mobile, refresh tokens are the reliable mechanism for session persistence.
- **Custom scheme validation**: The callback URL scheme must match the app's package/bundle ID exactly.
- **HTTPS**: Capacitor uses HTTPS for Android by default (`androidScheme: 'https'` in config). Do not change this.

---

# Integration Patterns

## Authentication Flow

The Ionic Vue + Capacitor authentication flow:

1. User taps "Login" button
2. `loginWithRedirect()` is called with a custom `openUrl` that uses `Browser.open()`
3. Capacitor Browser opens Auth0 Universal Login in a system browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android)
4. User authenticates with Auth0
5. Auth0 redirects to the custom scheme callback URL (`packageId://domain/capacitor/packageId/callback`)
6. Capacitor App plugin receives the deep link via `appUrlOpen` event
7. `handleRedirectCallback(url)` processes the authorization code
8. `Browser.close()` dismisses the system browser
9. User is now authenticated — `isAuthenticated` is `true`, `user` is populated

## Auth0 Plugin Setup

Configure the Auth0 Vue plugin at your app's entry point (`src/main.ts`):

```typescript
import { createApp } from 'vue';
import { createAuth0 } from '@auth0/auth0-vue';
import { IonicVue } from '@ionic/vue';
import App from './App.vue';
import router from './router';

const domain = "your-tenant.auth0.com";
const clientId = "your-client-id";
const packageId = "com.example.myapp";
const callbackUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

const app = createApp(App);

app.use(IonicVue);
app.use(router);
app.use(
  createAuth0({
    domain,
    clientId,
    useRefreshTokens: true,
    useRefreshTokensFallback: false,
    authorizationParams: {
      redirect_uri: callbackUri
    }
  })
);

router.isReady().then(() => {
  app.mount('#app');
});
```

### Why These Options Are Required for Capacitor

| Option | Value | Reason |
|--------|-------|--------|
| `useRefreshTokens` | `true` | Mobile apps cannot use iframe-based token renewal. Refresh tokens provide reliable session persistence. |
| `useRefreshTokensFallback` | `false` | Prevents the SDK from attempting iframe fallback, which fails on native. |
| `authorizationParams.redirect_uri` | Custom scheme URL | Native apps use a custom URL scheme, not `http://localhost`. |

## Login Implementation

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { Browser } from '@capacitor/browser';
import { IonButton } from '@ionic/vue';

const { loginWithRedirect } = useAuth0();

const login = async () => {
  await loginWithRedirect({
    async openUrl(url: string) {
      await Browser.open({
        url,
        windowName: "_self"
      });
    }
  });
};
</script>

<template>
  <ion-button @click="login">Log in</ion-button>
</template>
```

## Deep Link Callback Handling

Handle the callback in your App.vue component. This must run on app initialization:

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { IonApp, IonRouterOutlet } from '@ionic/vue';

const { handleRedirectCallback } = useAuth0();

let urlOpenListener: any;

onMounted(async () => {
  urlOpenListener = await CapApp.addListener('appUrlOpen', async ({ url }) => {
    if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
      await handleRedirectCallback(url);
    }
    await Browser.close();
  });
});

onUnmounted(() => {
  urlOpenListener?.remove();
});
</script>

<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>
```

## Logout Implementation

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { Browser } from '@capacitor/browser';
import { IonButton } from '@ionic/vue';

const domain = "your-tenant.auth0.com";
const packageId = "com.example.myapp";
const logoutUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

const { logout } = useAuth0();

const doLogout = async () => {
  await logout({
    logoutParams: {
      returnTo: logoutUri
    },
    async openUrl(url: string) {
      await Browser.open({
        url,
        windowName: "_self"
      });
    }
  });
};
</script>

<template>
  <ion-button @click="doLogout">Log out</ion-button>
</template>
```

## User Profile Display

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonAvatar,
  IonItem,
  IonLabel,
  IonSpinner
} from '@ionic/vue';

const { user, isLoading, isAuthenticated } = useAuth0();
</script>

<template>
  <ion-spinner v-if="isLoading" />

  <ion-card v-else-if="isAuthenticated && user">
    <ion-card-header>
      <ion-item lines="none">
        <ion-avatar slot="start">
          <img :src="user.picture" :alt="user.name" />
        </ion-avatar>
        <ion-label>
          <ion-card-title>{{ user.name }}</ion-card-title>
          <p>{{ user.email }}</p>
        </ion-label>
      </ion-item>
    </ion-card-header>
    <ion-card-content>
      <pre>{{ JSON.stringify(user, null, 2) }}</pre>
    </ion-card-content>
  </ion-card>
</template>
```

## Protected Routes

Use Vue Router navigation guards with `createAuthGuard` to protect Ionic pages:

```typescript
// src/router/index.ts
import { createRouter, createWebHistory } from '@ionic/vue-router';
import { createAuthGuard } from '@auth0/auth0-vue';
import type { App } from 'vue';

export function setupRouter(app: App) {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
      {
        path: '/',
        redirect: '/home'
      },
      {
        path: '/home',
        component: () => import('../views/HomePage.vue')
      },
      {
        path: '/profile',
        component: () => import('../views/ProfilePage.vue'),
        beforeEnter: createAuthGuard(app)
      }
    ]
  });

  return router;
}
```

### Alternative: Component-Level Guard

```vue
<script setup lang="ts">
import { watchEffect } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';
import { IonPage, IonContent, IonSpinner } from '@ionic/vue';

const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
import { Browser } from '@capacitor/browser';

watchEffect(() => {
  if (!isLoading.value && !isAuthenticated.value) {
    loginWithRedirect({
      async openUrl(url: string) {
        await Browser.open({ url, windowName: "_self" });
      }
    });
  }
});
</script>

<template>
  <ion-page>
    <ion-content v-if="isLoading" class="ion-text-center ion-padding">
      <ion-spinner />
    </ion-content>
    <ion-content v-else-if="isAuthenticated">
      <h1>Protected Content</h1>
    </ion-content>
  </ion-page>
</template>
```

## Accessing API Tokens

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';

const { getAccessTokenSilently } = useAuth0();
const data = ref(null);
const error = ref<string | null>(null);
const loading = ref(false);

const callApi = async () => {
  loading.value = true;
  error.value = null;

  try {
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

    data.value = await response.json();
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div>
    <ion-button @click="callApi" :disabled="loading">
      {{ loading ? 'Loading...' : 'Call API' }}
    </ion-button>
    <div v-if="error" class="error">{{ error }}</div>
    <pre v-if="data">{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>
```

To use API tokens, configure the `audience` in the Auth0 plugin:

```typescript
app.use(
  createAuth0({
    domain,
    clientId,
    useRefreshTokens: true,
    useRefreshTokensFallback: false,
    authorizationParams: {
      redirect_uri: callbackUri,
      audience: "https://api.example.com/",
    }
  })
);
```

## Conditional Login/Logout UI

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { Browser } from '@capacitor/browser';
import { IonButton } from '@ionic/vue';

const { isAuthenticated, loginWithRedirect, logout } = useAuth0();

const domain = "your-tenant.auth0.com";
const packageId = "com.example.myapp";
const callbackUri = `${packageId}://${domain}/capacitor/${packageId}/callback`;

const login = async () => {
  await loginWithRedirect({
    async openUrl(url: string) {
      await Browser.open({ url, windowName: "_self" });
    }
  });
};

const doLogout = async () => {
  await logout({
    logoutParams: { returnTo: callbackUri },
    async openUrl(url: string) {
      await Browser.open({ url, windowName: "_self" });
    }
  });
};
</script>

<template>
  <ion-button v-if="isAuthenticated" @click="doLogout">Log out</ion-button>
  <ion-button v-else @click="login">Log in</ion-button>
</template>
```

## Organizations Support

```typescript
await loginWithRedirect({
  authorizationParams: {
    organization: "org_abc123",
  },
  async openUrl(url: string) {
    await Browser.open({ url, windowName: "_self" });
  }
});
```

To accept an organization invitation:

```typescript
await loginWithRedirect({
  authorizationParams: {
    organization: "org_abc123",
    invitation: "inv_xyz789",
  },
  async openUrl(url: string) {
    await Browser.open({ url, windowName: "_self" });
  }
});
```

## Error Handling

```vue
<script setup lang="ts">
import { useAuth0 } from '@auth0/auth0-vue';
import { IonSpinner, IonCard, IonCardContent } from '@ionic/vue';

const { error, isLoading } = useAuth0();
</script>

<template>
  <ion-spinner v-if="isLoading" />

  <ion-card v-else-if="error" color="danger">
    <ion-card-content>
      <h2>Authentication Error</h2>
      <p>{{ error.message }}</p>
    </ion-card-content>
  </ion-card>

  <slot v-else />
</template>
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

# Auth0 Ionic Vue (Capacitor) — Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **Important — do not display credentials:** After obtaining credentials from the CLI or user input, write them directly into config files. Do not echo, print, or display the domain, client ID, or any credential values in conversation output.
>
> Always ask the user to choose between automatic and manual setup using `AskUserQuestion`:
> _"How would you like to configure Auth0 for this Ionic Vue project?"_
>   - **Automatic setup (Recommended)** — uses the Auth0 CLI to create a Native application, configure callback URLs, and store credentials in the project `.env` file automatically
>   - **Manual setup** — you provide an existing `.env` file or Auth0 credentials (domain, client ID) and the agent writes them to the project config
>
> **If credentials are already provided in the user's prompt:** Use them directly — skip to "SDK Installation" below. Do NOT call `AskUserQuestion` to re-confirm.

### Auth0 CLI Automated Setup

> **Agent instruction:** Execute these steps in order. Do NOT run `auth0 login` from the agent — it is interactive and will hang. All other `auth0` CLI commands below are non-interactive and safe to run.
>
> ---
>
> #### Step A — Check Auth0 CLI is installed
>
> ```bash
> command -v auth0
> ```
>
> If missing, install it:
> ```bash
> brew install auth0/auth0-cli/auth0
> ```
> On Linux: `curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh`
>
> ---
>
> #### Step B — Verify Auth0 CLI login session
>
> ```bash
> auth0 tenants list --csv --no-input 2>&1
> ```
>
> - **If the command succeeds** and returns CSV output with tenant rows: proceed to Step C.
> - **If the command fails** (exit code non-zero, or output contains "login" / "unauthorized" / is empty):
>   - Tell the user: _"You're not logged in to the Auth0 CLI. Please run `auth0 login` in your terminal and let me know when done."_
>   - Use `AskUserQuestion` to wait for confirmation.
>   - After confirmation, re-run this check. Retry up to 3 times.
>   - If still failing after 3 retries: use `AskUserQuestion` to ask the user for their Auth0 Domain and Client ID manually, then skip to Step F.
>
> ---
>
> #### Step C — Detect active Auth0 tenant domain
>
> Parse the CSV output from Step B. The active tenant line contains `→` (Unicode arrow U+2192).
>
> ```
> Example output:
>   ACTIVE,DOMAIN
>   →,dev-example.us.auth0.com
>     ,dev-other.us.auth0.com
> ```
>
> Extract the domain from the second column of the `→` line (e.g., `dev-example.us.auth0.com`).
>
> Tell the user: _"Your active Auth0 tenant is: `<domain>`. Is this correct?"_
> - If no, ask the user to run `auth0 tenants use <correct-tenant-domain>`, then re-run Step B.
>
> Store this as `AUTH0_DOMAIN`.
>
> ---
>
> #### Step D — Detect package ID from Capacitor config
>
> Read `capacitor.config.ts` (or `capacitor.config.json`) in the project root:
>
> - For `.ts`: parse `appId: 'com.example.myapp'` using regex.
> - For `.json`: parse the `appId` field from JSON.
>
> Store this as `PACKAGE_ID` (e.g., `com.example.myapp`).
>
> Also extract `appName` if available (for the Auth0 app display name). Fall back to the project name from `package.json` if not found.
>
> ---
>
> #### Step E — Create Native Auth0 application
>
> Build the callback URL: `PACKAGE_ID://AUTH0_DOMAIN/capacitor/PACKAGE_ID/callback`
>
> ```bash
> auth0 apps create \
>   --name "APP_NAME" \
>   --type native \
>   --auth-method none \
>   --callbacks "PACKAGE_ID://AUTH0_DOMAIN/capacitor/PACKAGE_ID/callback" \
>   --logout-urls "PACKAGE_ID://AUTH0_DOMAIN/capacitor/PACKAGE_ID/callback" \
>   --origins "capacitor://localhost,http://localhost" \
>   --json \
>   --no-input
> ```
>
> Replace `APP_NAME`, `PACKAGE_ID`, and `AUTH0_DOMAIN` with the actual values from Steps C and D.
>
> **Parse the JSON output** to extract `client_id`. Example response:
> ```json
> {
>   "client_id": "abc123def456...",
>   "name": "my-app",
>   "app_type": "native",
>   ...
> }
> ```
>
> Store `client_id` as `AUTH0_CLIENT_ID`.
>
> If this command fails due to session expiry, ask the user to run `auth0 login` again and retry. Retry up to 3 times.
>
> ---
>
> #### Step F — Write `.env` with real credentials
>
> Write (or update) the `.env` file in the project root with the actual values from Steps C–E:
>
> ```bash
> VITE_AUTH0_DOMAIN=AUTH0_DOMAIN
> VITE_AUTH0_CLIENT_ID=AUTH0_CLIENT_ID
> VITE_AUTH0_CALLBACK_URI=PACKAGE_ID://AUTH0_DOMAIN/capacitor/PACKAGE_ID/callback
> ```
>
> Replace `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, and `PACKAGE_ID` with the actual values.
>
> - **If `.env` already exists:** Update or add these three variables without removing other existing variables.
> - **If `.env` does not exist:** Create the file.
> - **If `.gitignore` does not include `.env`:** Add `.env` to `.gitignore`.
>
> ---
>
> #### Step G — Update `src/main.ts` to use env vars
>
> Read `src/main.ts` and wire it to read credentials from `import.meta.env`:
>
> **If `createAuth0()` already exists in the file:**
> - Replace any hardcoded `domain` value (e.g., `"YOUR_AUTH0_DOMAIN"` or a real domain string) with `import.meta.env.VITE_AUTH0_DOMAIN`.
> - Replace any hardcoded `clientId` value with `import.meta.env.VITE_AUTH0_CLIENT_ID`.
> - Replace the `redirect_uri` value with `` `${packageId}://${import.meta.env.VITE_AUTH0_DOMAIN}/capacitor/${packageId}/callback` `` (where `packageId` is read from the Capacitor config or hardcoded if it never changes).
>
> **If `createAuth0()` does NOT exist in the file:**
> 1. Add the import: `import { createAuth0 } from '@auth0/auth0-vue';`
> 2. Add the Auth0 plugin registration before `router.isReady()` or `app.mount()`:
>    ```typescript
>    const packageId = "PACKAGE_ID"; // From capacitor.config.ts appId
>
>    app.use(
>      createAuth0({
>        domain: import.meta.env.VITE_AUTH0_DOMAIN,
>        clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
>        useRefreshTokens: true,
>        useRefreshTokensFallback: false,
>        authorizationParams: {
>          redirect_uri: `${packageId}://${import.meta.env.VITE_AUTH0_DOMAIN}/capacitor/${packageId}/callback`
>        }
>      })
>    );
>    ```
>
> Replace `PACKAGE_ID` with the actual package ID from Step D.
>
> ---
>
> #### Step H — Confirm setup to user (never display credentials)
>
> After completing all steps, tell the user:
> - _"Auth0 application created and configured successfully."_
> - _"Credentials have been written to `.env` (`VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID`)."_
> - _"`src/main.ts` reads credentials from `import.meta.env`."_
>
> **Do NOT display the actual domain, client ID, or callback URL values.** Only confirm that the setup succeeded and where the credentials were saved.
>
> If the CLI keeps failing after retries, fall back to **Manual Setup** below.

### Manual Setup (User-Provided Configuration)

> **Agent instruction:** Ask the user to provide their Auth0 configuration. Accept either:
> - **An `.env` file path** — read the file to extract the Auth0 domain and client ID, then copy or reference it in the project.
> - **Direct credentials** — ask using `AskUserQuestion`: _"Please provide your Auth0 Domain and Client ID."_
>
> Once credentials are obtained, write them to the project `.env` file using `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` variable names. **Do NOT display the credentials in conversation output.**

### Callback URL Format

| Field | Value |
|-------|-------|
| **Allowed Callback URLs** | `YOUR_PACKAGE_ID://YOUR_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback` |
| **Allowed Logout URLs** | `YOUR_PACKAGE_ID://YOUR_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback` |
| **Allowed Web Origins** | `capacitor://localhost, http://localhost` |

Replace `YOUR_PACKAGE_ID` with your app's package ID (e.g., `com.example.myapp`) and `YOUR_DOMAIN` with your Auth0 domain. These are set automatically when using the CLI commands above.

## SDK Installation

```bash
npm install @auth0/auth0-vue @capacitor/browser @capacitor/app
npx cap sync
```

### Plugin purposes

| Package | Purpose |
|---------|---------|
| `@auth0/auth0-vue` | Auth0 Vue SDK — provides `createAuth0` plugin and `useAuth0` composable |
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

**Ionic Vue + Capacitor apps are Native applications** — they do not use a client secret. Instead, use PKCE (Proof Key for Code Exchange) with a custom URL scheme callback (e.g. `YOUR_PACKAGE_ID://your-tenant.auth0.com/capacitor/YOUR_PACKAGE_ID/callback`) to complete the login flow securely.

- Configuration contains only: **Domain**, **Client ID**, and **Callback URL**
- These values are not secrets and can be included in source code
- Token validation uses PKCE (Proof Key for Code Exchange) — no client secret needed
- Never include a client secret in a mobile/native application

### Environment Variables (Optional)

If you prefer environment variables for Domain and Client ID during development:

```bash
# .env (for Vite-based Ionic Vue projects)
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
```

Then reference in code:
```typescript
app.use(
  createAuth0({
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    useRefreshTokens: true,
    useRefreshTokensFallback: false,
    authorizationParams: {
      redirect_uri: `${packageId}://${import.meta.env.VITE_AUTH0_DOMAIN}/capacitor/${packageId}/callback`
    }
  })
);
```

## Verification

After setup, verify the configuration:

1. Run `ionic serve` — the app should load without Auth0 errors
2. Run `ionic build && npx cap sync` — native projects should sync cleanly
3. Open in Xcode/Android Studio and build — no missing plugin errors
4. Tap login — system browser should open Auth0 Universal Login
5. After login — app should receive the deep link callback and show the user profile
