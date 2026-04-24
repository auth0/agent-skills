# Auth0 Ionic Vue (Capacitor) — Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **Check if credentials are already provided in the user's prompt:**
> If the prompt contains Auth0 domain and client ID, use them directly — skip to "SDK Installation" below. Do NOT call `AskUserQuestion` to re-confirm.
>
> **If credentials are NOT provided:** Create the Auth0 application using the CLI commands below. Do NOT offer manual setup or ask the user to create an application in Auth0 Dashboard themselves — always use the CLI.

### Auth0 CLI Setup

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
>   --callbacks "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
>   --logout-urls "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
>   --origins "capacitor://localhost,http://localhost" \
>   --json \
>   --no-input
> ```
> Parse the JSON output to extract `client_id` and `domain` (the tenant domain).
>
> **Step C — Use credentials in code:**
> Use the `client_id` and `domain` from Step B when configuring `createAuth0()` in the app (see [Integration Patterns](./integration.md)).
>
> If any CLI command fails due to session expiry, ask the user to run `auth0 login` again, then retry. Retry up to 3 times.
> Only if the CLI keeps failing after retries: use `AskUserQuestion` to ask the user for their Auth0 Domain and Client ID.

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

**Ionic Vue + Capacitor apps are Native applications** — they do not use a client secret.

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
