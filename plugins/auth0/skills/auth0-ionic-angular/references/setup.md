# auth0-ionic-angular — Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **Credential check (always first):**
> If the user's prompt already provides Auth0 credentials (domain and client ID), use them directly — skip the automated setup and do NOT call `AskUserQuestion`. Go straight to writing the SDK configuration and proceeding with integration.
>
> **Option A: Automatic Setup (Auth0 CLI)** — only when credentials are NOT in the prompt
>
> 1. **Pre-flight checks:**
>    - Verify Node.js 20+: `node --version`
>    - Verify Auth0 CLI: `auth0 --version`
>    - Verify logged in: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide user to install/login, or fall back to manual setup
>
> 2. **Detect project and appId:**
>    - Verify `package.json` contains `@angular/core`, `@ionic/angular`, and `@capacitor/core`
>    - Read `appId` from `capacitor.config.ts` (match `appId: 'com.example.app'`) or `capacitor.config.json`
>
> 3. **Get the active tenant domain:**
>    ```bash
>    auth0 tenants list --csv --no-input
>    ```
>    Parse the line with `→` to get the active domain.
>
> 4. **Create a Native Auth0 application:**
>    ```bash
>    auth0 apps create \
>      --name "PROJECT_NAME-ionic-angular" \
>      --type native \
>      --auth-method none \
>      --callbacks "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
>      --logout-urls "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
>      --origins "capacitor://localhost,http://localhost" \
>      --json --no-input
>    ```
>    Extract `client_id` from the JSON output.
>
> 5. **Ensure Username-Password-Authentication connection is enabled for the app:**
>    ```bash
>    # List connections to check if it exists
>    auth0 api get connections
>    ```
>    - If the connection exists but doesn't include the new `client_id` in `enabled_clients`, update it:
>      ```bash
>      auth0 api patch "connections/CONNECTION_ID" --data '{"enabled_clients":["EXISTING_IDS","NEW_CLIENT_ID"]}'
>      ```
>    - If it doesn't exist, create it:
>      ```bash
>      auth0 api post connections --data '{"strategy":"auth0","name":"Username-Password-Authentication","enabled_clients":["CLIENT_ID"]}'
>      ```
>
> 6. **Write `src/environments/environment.ts`:**
>    ```typescript
>    export const environment = {
>      production: false,
>      auth0: {
>        domain: 'DOMAIN',
>        clientId: 'CLIENT_ID',
>        callbackUrl: 'PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback',
>        appId: 'PACKAGE_ID',
>      },
>    };
>    ```
>    Create the `src/environments/` directory if it doesn't exist.
>
> 7. **Print summary** with domain, client ID, appId, and callback URL.
>
> **Option B: Manual Setup** — only when credentials are NOT in the prompt
>
> Ask the user for:
> - Auth0 Domain (e.g., `your-tenant.auth0.com`)
> - Client ID
>
> No Client Secret is needed — Native apps use PKCE.

## Auth0 Dashboard Configuration

### Create a Native Application

1. Go to **Auth0 Dashboard → Applications → Create Application**
2. Select **Native** as the application type
3. Note the **Domain** and **Client ID** from the Settings tab

### Configure URLs

Determine your `appId` from `capacitor.config.ts` (e.g., `com.example.myapp`).

| Setting | Value |
|---------|-------|
| **Allowed Callback URLs** | `PACKAGE_ID://YOUR_DOMAIN/capacitor/PACKAGE_ID/callback` |
| **Allowed Logout URLs** | `PACKAGE_ID://YOUR_DOMAIN/capacitor/PACKAGE_ID/callback` |
| **Allowed Origins** | `capacitor://localhost, http://localhost` |

Example with `appId = com.example.myapp` and domain `dev-abc123.us.auth0.com`:
```text
com.example.myapp://dev-abc123.us.auth0.com/capacitor/com.example.myapp/callback
```

## SDK Installation

```bash
npm install @auth0/auth0-angular @capacitor/browser @capacitor/app
```

If Capacitor platforms aren't added yet:
```bash
npx cap add ios
npx cap add android
```

## SDK Configuration

### Standalone Components (Angular 17+)

In `src/app/app.config.ts`:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAuth0 } from '@auth0/auth0-angular';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAuth0({
      domain: 'YOUR_AUTH0_DOMAIN',
      clientId: 'YOUR_AUTH0_CLIENT_ID',
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
      authorizationParams: {
        redirect_uri: window.location.origin,
      },
    }),
  ],
};
```

### NgModule (Angular 16 and earlier)

In `src/app/app.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { AuthModule } from '@auth0/auth0-angular';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    AuthModule.forRoot({
      domain: 'YOUR_AUTH0_DOMAIN',
      clientId: 'YOUR_AUTH0_CLIENT_ID',
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
      authorizationParams: {
        redirect_uri: window.location.origin,
      },
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

## Post-Setup: Deep Linking Configuration

### iOS

The custom URL scheme is automatically registered by Capacitor from `capacitor.config.ts`. Verify in `ios/App/App/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>PACKAGE_ID</string>
    </array>
  </dict>
</array>
```

### Android

Verify the intent filter in `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="PACKAGE_ID" />
</intent-filter>
```

## Secret Management

- **No Client Secret needed** — Ionic Capacitor apps are Native apps that use PKCE for authentication
- **Never embed secrets in client-side code** — the Auth0 Angular SDK only requires `domain` and `clientId`
- Configuration values (domain, clientId) can be hardcoded in `app.config.ts` / `app.module.ts` or loaded from `environment.ts`

### Using `environment.ts` (optional)

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  auth0: {
    domain: 'YOUR_AUTH0_DOMAIN',
    clientId: 'YOUR_AUTH0_CLIENT_ID',
  },
};
```

```typescript
// src/app/app.config.ts
import { environment } from '../environments/environment';

provideAuth0({
  domain: environment.auth0.domain,
  clientId: environment.auth0.clientId,
  useRefreshTokens: true,
  useRefreshTokensFallback: false,
  authorizationParams: {
    redirect_uri: window.location.origin,
  },
}),
```

## Verification

After setup, verify:

1. **Build succeeds:** `npm run build`
2. **Capacitor sync:** `npx cap sync`
3. **Run on device/emulator:**
   - iOS: `npx cap open ios` → Run in Xcode
   - Android: `npx cap open android` → Run in Android Studio
4. **Login opens system browser** (not in-app WebView)
5. **Callback returns to app** with user profile
