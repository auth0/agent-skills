# auth0-ionic-angular — Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **Credential check (always first):**
> If the user's prompt already provides Auth0 credentials (domain and client ID), use them directly — skip the setup choice, write the config file, and proceed with integration.
>
> **When credentials are NOT in the prompt, always present the setup choice using `AskUserQuestion`:**
>
> ```
> AskUserQuestion:
>   question: "How would you like to configure Auth0 for your Ionic Angular app?"
>   options:
>     - label: "Automatic Setup (Recommended)"
>       description: "Uses the Auth0 CLI to create a Native application, configure callback URLs, and store credentials in your project automatically."
>     - label: "Manual Setup"
>       description: "You provide your Auth0 Domain and Client ID, and the agent writes the configuration file for you."
> ```
>
> ---
>
> ### Option A: Automatic Setup (Auth0 CLI)
>
> The agent executes Auth0 CLI commands to create the application, configure it, retrieve credentials, and write them to the project config file — fully hands-free.
>
> 1. **Pre-flight checks:**
>    - Verify Node.js 20+: `node --version`
>    - Verify Auth0 CLI installed: `auth0 --version`
>    - Verify logged in: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide the user to install (`brew install auth0/auth0-cli/auth0`) or login (`auth0 login`), then retry. If the user cannot resolve it, fall back to Manual Setup.
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
> 5. **Enable Username-Password-Authentication connection for the app:**
>    ```bash
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
> 6. **Write config file** — see "Write Config File" section below.
>
> 7. **Print summary** with domain, client ID, appId, and callback URL.
>
> ---
>
> ### Option B: Manual Setup
>
> The user provides their own Auth0 credentials, and the agent writes the configuration file for them.
>
> 1. Use `AskUserQuestion` to collect:
>    - Auth0 Domain (e.g., `your-tenant.auth0.com`)
>    - Client ID
> 2. Read `appId` from `capacitor.config.ts` or `capacitor.config.json`.
> 3. **Write config file** — see "Write Config File" section below.
>
> No Client Secret is needed — Native apps use PKCE.
>
> **Note:** With Manual Setup, the user is responsible for configuring Allowed Callback URLs, Allowed Logout URLs, and Allowed Origins in the Auth0 Dashboard (see "Auth0 Dashboard Configuration" section below).
>
> ---
>
> ### Write Config File (both paths)
>
> Create the `src/environments/` directory if it doesn't exist, then write `src/environments/environment.ts`:
>
> ```typescript
> export const environment = {
>   production: false,
>   auth0: {
>     domain: 'DOMAIN',
>     clientId: 'CLIENT_ID',
>     callbackUrl: 'PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback',
>     appId: 'PACKAGE_ID',
>   },
> };
> ```
>
> Replace `DOMAIN`, `CLIENT_ID`, and `PACKAGE_ID` with the actual values obtained from the chosen setup path.

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

// Replace with your capacitor.config.ts appId and Auth0 domain
const appId = 'YOUR_PACKAGE_ID';
const domain = 'YOUR_AUTH0_DOMAIN';
const callbackUri = `${appId}://${domain}/capacitor/${appId}/callback`;

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAuth0({
      domain,
      clientId: 'YOUR_AUTH0_CLIENT_ID',
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
      authorizationParams: {
        redirect_uri: callbackUri,
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

const appId = 'YOUR_PACKAGE_ID';
const domain = 'YOUR_AUTH0_DOMAIN';
const callbackUri = `${appId}://${domain}/capacitor/${appId}/callback`;

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    AuthModule.forRoot({
      domain,
      clientId: 'YOUR_AUTH0_CLIENT_ID',
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
      authorizationParams: {
        redirect_uri: callbackUri,
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

const appId = 'YOUR_PACKAGE_ID'; // from capacitor.config.ts
const callbackUri = `${appId}://${environment.auth0.domain}/capacitor/${appId}/callback`;

provideAuth0({
  domain: environment.auth0.domain,
  clientId: environment.auth0.clientId,
  useRefreshTokens: true,
  useRefreshTokensFallback: false,
  authorizationParams: {
    redirect_uri: callbackUri,
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
