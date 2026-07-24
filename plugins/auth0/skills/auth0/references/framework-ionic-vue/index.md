# Auth0 Ionic Vue (Capacitor)

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

## Quick start

### Step 1: Configure Auth0

**For automated setup with Auth0 CLI**, use the CLI-automated setup path in this group's integration guide (Setup section) for complete scripts.

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

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the reference for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-ionic-vue/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For setup variants (automated Auth0 CLI provisioning, manual/Dashboard config, deep linking), and advanced framework patterns (login/logout flows, token management, route guards, error handling, Capacitor lifecycle): `Read: references/framework-ionic-vue/integrate.md`
- Full API / configuration lookup, claims reference, testing checklist, security considerations: `Read: references/framework-ionic-vue/api-reference.md`
- Any other task (guidance, debugging, Organizations): start with `Read: references/framework-ionic-vue/integrate.md`

Read only the reference (or references) your task needs — not all of them.
