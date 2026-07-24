# Auth0 Ionic Vue (Capacitor) Integration

Add Auth0 authentication to Ionic Vue applications using Capacitor. This skill covers native mobile authentication using the `@auth0/auth0-vue` SDK combined with `@capacitor/browser` and `@capacitor/app` plugins for deep link handling on iOS and Android.

> **Prerequisites & setup:** the shared critical rules, prerequisites, and
> when-NOT-to-use notes live in this group's hub index (already read on the way
> here). The quick start lives in this group's hub index too — this file holds
> setup variants (automated Auth0 CLI provisioning, manual setup, deep linking),
> plus advanced patterns (login/logout flows, token management, route guards,
> error handling, Capacitor lifecycle) at pattern depth (see the Setup and
> Integration Patterns sections below). The full API/config/claims lookup and
> testing checklist live in this group's API reference leaf.

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

---

## Setup

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

---

## Integration Patterns

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
