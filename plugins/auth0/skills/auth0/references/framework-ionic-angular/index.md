
# Auth0 Ionic Angular (Capacitor) Integration

Add authentication to an Ionic Angular application using the `@auth0/auth0-angular` SDK with Capacitor plugins for native iOS and Android. This skill covers login, logout, user profile display, and secure token management using the system browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android) via Capacitor's Browser plugin.

## Critical rules

- **SECURITY — NEVER display credentials.** After obtaining Auth0 credentials (domain, client ID) from the CLI or a user-provided env file, write them directly to the config file silently. Do not print, echo, or display them in text output; instead, confirm the config file was written and tell the user where to find it.

## Prerequisites

- Node.js 20+ and npm 10+
- Ionic CLI (`npm install -g @ionic/cli`)
- Capacitor 5+ configured in the project
- Auth0 CLI (for automatic setup): `brew install auth0/auth0-cli/auth0`
- An Auth0 account (free tier works)

## When NOT to Use

| Use Case | Use Instead |
|----------|------------------|
| Ionic **React** app with Capacitor | the Auth0 integration workflow for Ionic React |
| Ionic **Vue** app with Capacitor | the Auth0 integration workflow for Ionic Vue |
| Angular SPA (browser-only, no Capacitor) | the Auth0 integration workflow for Angular (or React) |
| React Native (no Ionic) | the Auth0 integration workflow for React Native |
| Expo (React Native) | the Auth0 integration workflow for Expo |
| Native iOS (Swift) | the Auth0 integration workflow for Swift (iOS) |
| Native Android (Kotlin) | the Auth0 integration workflow for Android (Kotlin) |

## Quick Start Workflow

> **Agent instruction:** Follow these steps in order. **Always** use `AskUserQuestion` to let the developer choose between Automatic Setup and Manual Setup before proceeding — even if credentials are already provided in the prompt.
>
> **SECURITY — Never display credentials:** After obtaining Auth0 credentials (domain, client ID) via the CLI or from a file, NEVER print, echo, or display them in your text output. Write them directly to the config file (`src/environments/environment.ts`) silently. Do NOT produce output like "Domain: xxx" or "Client ID: yyy". Instead, confirm that the config file has been written and tell the user where to find it.
>
> **UI reuse:** Before creating new login/logout components, search the existing project for login/logout handlers or buttons. If found, hook Auth0 into the existing UI rather than creating duplicate components.

### Step 1: Install Dependencies

```bash
npm install @auth0/auth0-angular @capacitor/browser @capacitor/app
```

### Step 2: Configure Auth0

> **Agent instruction:** **Always** present the setup choice using `AskUserQuestion` — even if the user has already provided credentials:
>
> ```
> AskUserQuestion:
>   question: "How would you like to configure Auth0 for your Ionic Angular app?"
>   options:
>     - label: "Automatic Setup (Recommended)"
>       description: "Uses the Auth0 CLI to create a Native application, configure callback URLs, and store credentials in your project automatically."
>     - label: "Manual Setup"
>       description: "You provide an .env file with your Auth0 Domain and Client ID, and the agent reads it and writes the project configuration for you."
> ```
>
> Follow the chosen path in the Setup Guide section (below) which has the full step-by-step instructions for both options.

**Auth0 Dashboard settings (Native application type):**

| Setting | Value |
|---------|-------|
| Application Type | **Native** |
| Allowed Callback URLs | `PACKAGE_ID://YOUR_DOMAIN/capacitor/PACKAGE_ID/callback` |
| Allowed Logout URLs | `PACKAGE_ID://YOUR_DOMAIN/capacitor/PACKAGE_ID/callback` |
| Allowed Origins | `capacitor://localhost, http://localhost` |

Replace `PACKAGE_ID` with your `appId` from `capacitor.config.ts` (e.g., `com.example.myapp`) and `YOUR_DOMAIN` with your Auth0 domain.

> **Note:** For Automatic Setup, these URLs are configured automatically by the Auth0 CLI. For Manual Setup, the user must configure them in the Auth0 Dashboard.

> **Note:** For local web development (`ionic serve`), also add `http://localhost:8100` to Allowed Callback URLs, Allowed Logout URLs, and Allowed Web Origins.

### Step 3: Configure the SDK

In `src/app/app.module.ts` (NgModule) or `src/app/app.config.ts` (standalone):

The `provideAuth0()` function (or `AuthModule.forRoot()`) is the Angular equivalent of `Auth0Provider` — it acts as the **provider/wrapper** that wraps the app and makes `AuthService` available everywhere. For local web development with `ionic serve`, the callback URL is `http://localhost:8100`.

**Standalone (Angular 17+):**
```typescript
import { ApplicationConfig } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';

// Replace with your capacitor.config.ts appId and Auth0 domain
const appId = 'com.example.myapp';
const domain = 'YOUR_AUTH0_DOMAIN';
const callbackUri = `${appId}://${domain}/capacitor/${appId}/callback`;

export const appConfig: ApplicationConfig = {
  providers: [
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

**NgModule (Angular 16 and earlier):**
```typescript
import { AuthModule } from '@auth0/auth0-angular';

const appId = 'com.example.myapp';
const domain = 'YOUR_AUTH0_DOMAIN';
const callbackUri = `${appId}://${domain}/capacitor/${appId}/callback`;

@NgModule({
  imports: [
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
})
export class AppModule {}
```

### Step 4: Handle Deep Link Callbacks (AppComponent)

Register the `appUrlOpen` listener at the app root so it persists across navigation:

```typescript
import { Component, NgZone, OnInit } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { mergeMap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  template: `<ion-app><ion-router-outlet></ion-router-outlet></ion-app>`,
})
export class AppComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    CapApp.addListener('appUrlOpen', ({ url }) => {
      this.ngZone.run(() => {
        if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
          this.auth
            .handleRedirectCallback(url)
            .pipe(mergeMap(() => Browser.close()))
            .subscribe();
        }
      });
    });
  }
}
```

### Step 5: Implement Login

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-login',
  template: `<ion-button (click)="login()">Log In</ion-button>`,
})
export class LoginPage {
  constructor(public auth: AuthService) {}

  login() {
    this.auth
      .loginWithRedirect({
        async openUrl(url: string) {
          await Browser.open({ url, windowName: '_self' });
        },
      })
      .subscribe();
  }
}
```

### Step 6: Implement Logout

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-logout-button',
  template: `<ion-button (click)="logout()">Log Out</ion-button>`,
})
export class LogoutButtonComponent {
  constructor(public auth: AuthService) {}

  logout() {
    this.auth
      .logout({
        logoutParams: {
          returnTo: `YOUR_PACKAGE_ID://YOUR_AUTH0_DOMAIN/capacitor/YOUR_PACKAGE_ID/callback`,
        },
        async openUrl(url: string) {
          await Browser.open({ url, windowName: '_self' });
        },
      })
      .subscribe();
  }
}
```

### Step 7: Display User Profile

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-profile',
  template: `
    <div *ngIf="auth.user$ | async as user">
      <img [src]="user.picture" [alt]="user.name" />
      <h2>{{ user.name }}</h2>
      <p>{{ user.email }}</p>
    </div>
  `,
})
export class ProfileComponent {
  constructor(public auth: AuthService) {}
}
```

### Step 8: Build and Test

> **Agent instruction:** After writing all code, verify the build succeeds:
> ```bash
> npm run build
> npx cap sync
> ```
> If the build fails, investigate errors and fix (up to 5-6 iterations). If still failing, use `AskUserQuestion` to ask the user for help.

## Detailed Documentation

- **Setup Guide** (see below) — Auth0 configuration, Auth0 CLI setup, Capacitor platform setup, deep linking
- **Integration Patterns** (see below) — Login/logout flows, token management, user profile, error handling, Capacitor lifecycle
- **API Reference & Testing** (see below) — AuthService API, configuration options, claims reference, testing checklist

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Auth0 app type set to **SPA** instead of **Native** | Change to **Native** in Auth0 Dashboard → Application Settings |
| Missing callback URL in Auth0 Dashboard | Add `PACKAGE_ID://{domain}/capacitor/PACKAGE_ID/callback` to Allowed Callback URLs AND Allowed Logout URLs |
| Not wrapping `handleRedirectCallback` in `ngZone.run()` | Angular won't detect auth state changes — always wrap in `ngZone.run()` |
| Using `window.location.href` for login redirect | Must use `Browser.open()` from `@capacitor/browser` for system browser |
| `useRefreshTokens` not set to `true` | Required for mobile — localStorage is unreliable on native platforms |
| `useRefreshTokensFallback` not set to `false` | Must be `false` to avoid falling back to iframe-based token refresh (unsupported on mobile) |
| Missing `@capacitor/app` listener for deep links | The `appUrlOpen` listener is required to handle the callback from the system browser |
| Using `loginWithPopup` on mobile | Popups don't work on native — use `loginWithRedirect` with `Browser.open` |
| Callback URL mismatch (scheme vs package ID) | The URL scheme must match the `appId` in `capacitor.config.ts` exactly |

## WebAuth Method

Ionic with Capacitor uses the **Web Auth** method for authentication:

1. User taps **Log In** → app calls `loginWithRedirect` with a custom `openUrl` that uses `Browser.open()`
2. Capacitor's Browser plugin opens the Auth0 Universal Login page in the system browser (SFSafariViewController / Chrome Custom Tabs)
3. User authenticates → Auth0 redirects to the custom URL scheme callback
4. OS routes the deep link to your app → `appUrlOpen` event fires
5. `handleRedirectCallback(url)` processes the auth code exchange inside `ngZone.run()`
6. `Browser.close()` dismisses the system browser
7. `auth.isAuthenticated$` emits `true`, and `auth.user$` emits the user profile

## Related Skills

- Ionic React with Capacitor → the Auth0 integration workflow for Ionic React
- Ionic Vue with Capacitor → the Auth0 integration workflow for Ionic Vue
- Angular SPA (browser-only) → the Auth0 integration workflow for Angular
- Native iOS (Swift) → the Auth0 integration workflow for Swift
- Native Android (Kotlin) → the Auth0 integration workflow for Android

## Quick Reference

| API | Description |
|-----|-------------|
| `AuthService.loginWithRedirect(options)` | Start login flow with custom `openUrl` for Capacitor |
| `AuthService.logout(options)` | Log out with custom `openUrl` and `returnTo` |
| `AuthService.handleRedirectCallback(url)` | Process the callback URL from the deep link |
| `AuthService.isAuthenticated$` | Observable boolean — whether user is logged in |
| `AuthService.user$` | Observable — current user profile (name, email, picture) |
| `AuthService.isLoading$` | Observable boolean — SDK initialization state |
| `AuthService.error$` | Observable — authentication errors |
| `AuthService.getAccessTokenSilently()` | Get access token (uses refresh tokens on mobile) |
| `Browser.open({ url })` | Open URL in system browser (Capacitor) |
| `CapApp.addListener('appUrlOpen', cb)` | Listen for deep link callbacks (Capacitor) |

## References

- [Auth0 Angular SDK — GitHub](https://github.com/auth0/auth0-angular)
- [Auth0 Ionic Angular Quickstart](https://auth0.com/docs/quickstart/native/ionic-angular)
- [Auth0 Angular SDK — API Reference](https://auth0.github.io/auth0-angular/)
- [Capacitor Browser Plugin](https://capacitorjs.com/docs/apis/browser)
- [Capacitor App Plugin — Deep Links](https://capacitorjs.com/docs/apis/app)
- [Ionic Framework — Angular](https://ionicframework.com/docs/angular/overview)

---

# auth0-ionic-angular — API Reference & Testing

## Configuration Options

### `provideAuth0()` / `AuthModule.forRoot()` Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `domain` | `string` | Yes | — | Auth0 tenant domain (e.g., `your-tenant.auth0.com`) |
| `clientId` | `string` | Yes | — | Auth0 application Client ID |
| `useRefreshTokens` | `boolean` | Yes (mobile) | `false` | Must be `true` for Ionic Capacitor apps |
| `useRefreshTokensFallback` | `boolean` | Yes (mobile) | `true` | Must be `false` for Ionic Capacitor apps |
| `cacheLocation` | `'memory' \| 'localstorage'` | No | `'memory'` | Where to store tokens — `'memory'` recommended for mobile |
| `authorizationParams.redirect_uri` | `string` | Yes (Capacitor) | `window.location.origin` | Must be set to custom URL scheme for Capacitor: `PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback` |
| `authorizationParams.audience` | `string` | No | — | API audience for access token scoping |
| `authorizationParams.scope` | `string` | No | `'openid profile email'` | OAuth scopes to request |
| `httpInterceptor.allowedList` | `string[] \| HttpInterceptorRouteConfig[]` | No | `[]` | API URLs to attach access tokens to |
| `errorPath` | `string` | No | — | Route to redirect to on authentication error |

### Capacitor Configuration (`capacitor.config.ts`)

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.myapp',      // Used as URL scheme
  appName: 'My Ionic App',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
};

export default config;
```

## AuthService API

### Properties (Observables)

| Property | Type | Description |
|----------|------|-------------|
| `isAuthenticated$` | `Observable<boolean>` | Emits `true` when user is authenticated |
| `isLoading$` | `Observable<boolean>` | Emits `true` while SDK is initializing |
| `user$` | `Observable<User \| null \| undefined>` | Emits user profile after authentication |
| `error$` | `Observable<Error \| undefined>` | Emits authentication errors |
| `idTokenClaims$` | `Observable<IdToken \| null \| undefined>` | Emits raw ID token claims |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `loginWithRedirect(options?)` | `Observable<void>` | Redirect to Auth0 Universal Login. Pass `openUrl` for Capacitor. |
| `logout(options?)` | `Observable<void>` | Log out and redirect. Pass `openUrl` and `logoutParams.returnTo` for Capacitor. |
| `handleRedirectCallback(url?)` | `Observable<RedirectLoginResult>` | Process callback URL from deep link. Call inside `ngZone.run()`. |
| `getAccessTokenSilently(options?)` | `Observable<string>` | Get access token using refresh token (no iframe on mobile). |
| `getAccessTokenWithPopup(options?)` | `Observable<string>` | Not supported on mobile — use `getAccessTokenSilently()`. |

### `loginWithRedirect` Options (Capacitor)

```typescript
// callbackUri = `${appId}://${domain}/capacitor/${appId}/callback`
this.auth.loginWithRedirect({
  authorizationParams: {
    audience: 'https://my-api.example.com',
    scope: 'openid profile email read:data',
    redirect_uri: callbackUri,
  },
  async openUrl(url: string) {
    await Browser.open({ url, windowName: '_self' });
  },
}).subscribe();
```

### `logout` Options (Capacitor)

```typescript
// callbackUri = `${appId}://${domain}/capacitor/${appId}/callback`
this.auth.logout({
  logoutParams: {
    returnTo: callbackUri,
  },
  async openUrl(url: string) {
    await Browser.open({ url, windowName: '_self' });
  },
}).subscribe();
```

## Claims Reference

### Standard OIDC Claims (`user$`)

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | `string` | Unique user identifier (e.g., `auth0\|abc123`) |
| `name` | `string` | Full name |
| `given_name` | `string` | First name |
| `family_name` | `string` | Last name |
| `nickname` | `string` | Casual name |
| `picture` | `string` | Profile picture URL |
| `email` | `string` | Email address |
| `email_verified` | `boolean` | Whether email is verified |
| `locale` | `string` | User locale |
| `updated_at` | `string` | Last profile update timestamp |

### Auth0-Specific Claims

| Claim | Type | Source | Description |
|-------|------|--------|-------------|
| `org_id` | `string` | Organizations | Organization identifier |
| `permissions` | `string[]` | RBAC | Granted permissions (requires API audience + RBAC enabled) |

## HTTP Interceptor for API Calls

Attach access tokens to outgoing API requests automatically:

```typescript
provideAuth0({
  domain: 'YOUR_AUTH0_DOMAIN',
  clientId: 'YOUR_AUTH0_CLIENT_ID',
  useRefreshTokens: true,
  useRefreshTokensFallback: false,
  authorizationParams: {
    audience: 'https://my-api.example.com',
  },
  httpInterceptor: {
    allowedList: [
      'https://my-api.example.com/*',
      {
        uri: 'https://my-api.example.com/admin/*',
        tokenOptions: {
          authorizationParams: {
            scope: 'admin:access',
          },
        },
      },
    ],
  },
}),
provideHttpClient(withInterceptors([authHttpInterceptorFn])),
```

## Complete Minimal Example

### `src/app/app.config.ts`
```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0, authHttpInterceptorFn } from '@auth0/auth0-angular';
import { routes } from './app.routes';

const appId = 'YOUR_PACKAGE_ID';
const domain = 'YOUR_AUTH0_DOMAIN';
const callbackUri = `${appId}://${domain}/capacitor/${appId}/callback`;

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authHttpInterceptorFn])),
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

### `src/app/app.component.ts`
```typescript
import { Component, NgZone, OnInit } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { mergeMap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    CapApp.addListener('appUrlOpen', ({ url }) => {
      this.ngZone.run(() => {
        if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
          this.auth
            .handleRedirectCallback(url)
            .pipe(mergeMap(() => Browser.close()))
            .subscribe();
        }
      });
    });
  }
}
```

## Testing Checklist

- [ ] App opens Auth0 Universal Login in system browser (not in-app WebView)
- [ ] After login, system browser closes and app receives user profile
- [ ] `auth.isAuthenticated$` emits `true` after successful login
- [ ] `auth.user$` contains name, email, and picture
- [ ] Logout opens system browser, clears session, and returns to app
- [ ] After logout, `auth.isAuthenticated$` emits `false`
- [ ] Token refresh works silently (no login prompt on app restart if session valid)
- [ ] Deep link callback URL matches Auth0 Dashboard configuration exactly
- [ ] App works on both iOS (SFSafariViewController) and Android (Chrome Custom Tabs)
- [ ] `ngZone.run()` wraps all callback handling (UI updates correctly)
- [ ] Build succeeds: `npm run build && npx cap sync`

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Login opens but never returns to app | Callback URL mismatch | Ensure `PACKAGE_ID://{domain}/capacitor/PACKAGE_ID/callback` is in Auth0 Dashboard |
| UI doesn't update after login | Missing `ngZone.run()` | Wrap `handleRedirectCallback` in `this.ngZone.run()` |
| `getAccessTokenSilently` fails | `useRefreshTokens` not `true` | Set `useRefreshTokens: true` and `useRefreshTokensFallback: false` |
| "Callback URL mismatch" error | Wrong app type in Auth0 | Change application type to **Native** (not SPA) |
| White screen after login on Android | `androidScheme` not set | Add `server: { androidScheme: 'https' }` to `capacitor.config.ts` |
| Token lost on app restart | Cache location issue | Ensure `useRefreshTokens: true` for persistent sessions |
| `Browser.open` not available | Missing Capacitor plugin | Run `npm install @capacitor/browser && npx cap sync` |

## Security Considerations

- **Never store tokens in localStorage** on mobile — use `useRefreshTokens: true` with in-memory cache
- **Never embed Client Secret** in mobile apps — Native apps use PKCE (no secret needed)
- **Always validate the callback URL** contains `state` and `code`/`error` before calling `handleRedirectCallback`
- **Use HTTPS** for any API calls made with access tokens
- **Set `useRefreshTokensFallback: false`** to prevent iframe-based token refresh attempts on mobile

---

# auth0-ionic-angular — Integration Patterns

## Authentication Flow Overview

```text
User taps Login
    → auth.loginWithRedirect({ openUrl: Browser.open })
    → System browser opens Auth0 Universal Login
    → User authenticates
    → Auth0 redirects to custom URL scheme
    → OS routes deep link to app
    → CapApp.addListener('appUrlOpen') fires
    → ngZone.run() → auth.handleRedirectCallback(url)
    → Browser.close()
    → auth.isAuthenticated$ emits true
    → auth.user$ emits user profile
```

## Deep Link Callback Handler

The callback handler must be registered early in the app lifecycle. The recommended location is `AppComponent.ngOnInit()`:

```typescript
import { Component, NgZone, OnInit } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';
import { mergeMap } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
})
export class AppComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    CapApp.addListener('appUrlOpen', ({ url }) => {
      this.ngZone.run(() => {
        if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
          this.auth
            .handleRedirectCallback(url)
            .pipe(mergeMap(() => Browser.close()))
            .subscribe();
        }
      });
    });
  }
}
```

**Why `ngZone.run()`?** Capacitor plugin callbacks execute outside Angular's zone. Without `ngZone.run()`, Angular won't detect the authentication state change and the UI won't update.

## Login

### Basic Login

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-login',
  template: `
    <ion-button (click)="login()" *ngIf="(auth.isAuthenticated$ | async) === false">
      Log In
    </ion-button>
  `,
})
export class LoginPage {
  constructor(public auth: AuthService) {}

  login() {
    this.auth
      .loginWithRedirect({
        async openUrl(url: string) {
          await Browser.open({ url, windowName: '_self' });
        },
      })
      .subscribe();
  }
}
```

### Login with Custom Audience and Scopes

```typescript
login() {
  this.auth
    .loginWithRedirect({
      authorizationParams: {
        audience: 'https://my-api.example.com',
        scope: 'openid profile email read:data',
      },
      async openUrl(url: string) {
        await Browser.open({ url, windowName: '_self' });
      },
    })
    .subscribe();
}
```

### Login with Organization

```typescript
login() {
  this.auth
    .loginWithRedirect({
      authorizationParams: {
        organization: 'org_abc123',
      },
      async openUrl(url: string) {
        await Browser.open({ url, windowName: '_self' });
      },
    })
    .subscribe();
}
```

## Logout

### Basic Logout

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-logout-button',
  template: `
    <ion-button (click)="logout()" *ngIf="auth.isAuthenticated$ | async">
      Log Out
    </ion-button>
  `,
})
export class LogoutButtonComponent {
  constructor(public auth: AuthService) {}

  logout() {
    this.auth
      .logout({
        logoutParams: {
          returnTo: `PACKAGE_ID://YOUR_AUTH0_DOMAIN/capacitor/PACKAGE_ID/callback`,
        },
        async openUrl(url: string) {
          await Browser.open({ url, windowName: '_self' });
        },
      })
      .subscribe();
  }
}
```

### Building the Logout Return URL Dynamically

```typescript
import { Inject } from '@angular/core';
import { AuthClientConfig } from '@auth0/auth0-angular';
import { DOCUMENT } from '@angular/common';

export class LogoutButtonComponent {
  constructor(
    public auth: AuthService,
    private config: AuthClientConfig,
  ) {}

  logout() {
    const domain = this.config.get().domain;
    const packageId = 'com.example.myapp'; // from capacitor.config.ts
    const returnTo = `${packageId}://${domain}/capacitor/${packageId}/callback`;

    this.auth
      .logout({
        logoutParams: { returnTo },
        async openUrl(url: string) {
          await Browser.open({ url, windowName: '_self' });
        },
      })
      .subscribe();
  }
}
```

## User Profile

### Display User Info

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { AsyncPipe, NgIf } from '@angular/common';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonAvatar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [AsyncPipe, NgIf, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonAvatar],
  template: `
    <ion-card *ngIf="auth.user$ | async as user">
      <ion-card-header>
        <ion-avatar>
          <img [src]="user.picture" [alt]="user.name" />
        </ion-avatar>
        <ion-card-title>{{ user.name }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <p>{{ user.email }}</p>
      </ion-card-content>
    </ion-card>
  `,
})
export class ProfileComponent {
  constructor(public auth: AuthService) {}
}
```

### Access ID Token Claims

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-claims',
  template: `
    <pre *ngIf="auth.idTokenClaims$ | async as claims">
      {{ claims | json }}
    </pre>
  `,
})
export class ClaimsComponent {
  constructor(public auth: AuthService) {}
}
```

## Token Management

### Get Access Token

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({ ... })
export class ApiComponent {
  constructor(private auth: AuthService, private http: HttpClient) {}

  callApi() {
    this.auth.getAccessTokenSilently().subscribe(token => {
      this.http.get('https://my-api.example.com/data', {
        headers: { Authorization: `Bearer ${token}` },
      }).subscribe(data => console.log(data));
    });
  }
}
```

### Use HTTP Interceptor (Recommended)

The `authHttpInterceptorFn` automatically attaches tokens to matching requests:

```typescript
// app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAuth0, authHttpInterceptorFn } from '@auth0/auth0-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([authHttpInterceptorFn])),
    provideAuth0({
      domain: 'YOUR_AUTH0_DOMAIN',
      clientId: 'YOUR_AUTH0_CLIENT_ID',
      useRefreshTokens: true,
      useRefreshTokensFallback: false,
      authorizationParams: {
        audience: 'https://my-api.example.com',
      },
      httpInterceptor: {
        allowedList: ['https://my-api.example.com/*'],
      },
    }),
  ],
};
```

Then make HTTP calls as normal — tokens are added automatically:

```typescript
this.http.get('https://my-api.example.com/data').subscribe(data => {
  console.log(data);
});
```

## Route Guards

### Protect Routes with `authGuardFn`

```typescript
import { Routes } from '@angular/router';
import { authGuardFn } from '@auth0/auth0-angular';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'profile', component: ProfilePage, canActivate: [authGuardFn] },
  { path: 'settings', component: SettingsPage, canActivate: [authGuardFn] },
];
```

When an unauthenticated user navigates to a protected route, `authGuardFn` automatically triggers `loginWithRedirect()`.

## Error Handling

### Subscribe to Auth Errors

```typescript
import { Component, OnInit } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({ ... })
export class AppComponent implements OnInit {
  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.auth.error$.subscribe(error => {
      if (error) {
        console.error('Auth error:', error.message);
        // Show toast or navigate to error page
      }
    });
  }
}
```

### Handle Callback Errors

```typescript
CapApp.addListener('appUrlOpen', ({ url }) => {
  this.ngZone.run(() => {
    if (url.includes('state') && (url.includes('code') || url.includes('error'))) {
      this.auth.handleRedirectCallback(url).pipe(
        mergeMap(() => Browser.close()),
      ).subscribe({
        error: (err) => {
          console.error('Callback error:', err);
          Browser.close();
        },
      });
    }
  });
});
```

## Capacitor Lifecycle Considerations

### Listener Cleanup

If registering the `appUrlOpen` listener in a component that can be destroyed (not AppComponent), clean up:

```typescript
import { Component, NgZone, OnInit, OnDestroy } from '@angular/core';
import { App as CapApp } from '@capacitor/app';
import { PluginListenerHandle } from '@capacitor/core';

@Component({ ... })
export class AuthCallbackComponent implements OnInit, OnDestroy {
  private listenerHandle?: PluginListenerHandle;

  async ngOnInit() {
    this.listenerHandle = await CapApp.addListener('appUrlOpen', ({ url }) => {
      this.ngZone.run(() => {
        // handle callback...
      });
    });
  }

  async ngOnDestroy() {
    await this.listenerHandle?.remove();
  }
}
```

### App Resume / Background

The Auth0 Angular SDK handles token refresh automatically via `useRefreshTokens: true`. When the app resumes from background:
- If the refresh token is still valid, `getAccessTokenSilently()` returns a fresh access token
- If the refresh token has expired, `isAuthenticated$` will emit `false` and the user needs to log in again

## Testing Patterns

### Mock AuthService in Unit Tests

```typescript
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { of } from 'rxjs';

const mockAuthService = {
  isAuthenticated$: of(true),
  user$: of({ name: 'Test User', email: 'test@example.com', picture: 'https://example.com/pic.jpg' }),
  loginWithRedirect: jasmine.createSpy('loginWithRedirect').and.returnValue(of(void 0)),
  logout: jasmine.createSpy('logout').and.returnValue(of(void 0)),
  getAccessTokenSilently: jasmine.createSpy('getAccessTokenSilently').and.returnValue(of('mock-token')),
};

TestBed.configureTestingModule({
  providers: [
    { provide: AuthService, useValue: mockAuthService },
  ],
});
```

---

# auth0-ionic-angular — Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **SECURITY — Never display credentials:**
> After obtaining Auth0 credentials (domain, client ID) — whether from the Auth0 CLI or a user-provided env file — never print, echo, or display them in your text output. Write them directly to the config file (`src/environments/environment.ts`) silently. Do not produce output like "Domain: xxx" or "Client ID: yyy". Instead, confirm that the config file has been written and tell the user where to find it.
>
> **Always present the setup choice:**
> Regardless of whether the user has already provided credentials in their prompt, **always** use `AskUserQuestion` to let the developer choose between Automatic and Manual setup:
>
> ```
> AskUserQuestion:
>   question: "How would you like to configure Auth0 for your Ionic Angular app?"
>   options:
>     - label: "Automatic Setup (Recommended)"
>       description: "Uses the Auth0 CLI to create a Native application, configure callback URLs, and store credentials in your project automatically."
>     - label: "Manual Setup"
>       description: "You provide an .env file with your Auth0 Domain and Client ID, and the agent reads it and writes the project configuration for you."
> ```

---

### Option A: Automatic Setup (Auth0 CLI)

The agent executes Auth0 CLI commands to create the application, configure it, retrieve credentials, and write them to the project config file — fully hands-free.

#### Step A1: Pre-flight checks

Run these checks in order. If any fail, guide the user to fix the issue or fall back to Manual Setup.

```bash
# Verify Node.js 20+
node --version

# Verify Auth0 CLI is installed
auth0 --version --no-input

# Verify logged in to Auth0
auth0 tenants list --csv --no-input
```

If the Auth0 CLI is not installed, instruct the user:
```bash
# macOS
brew install auth0/auth0-cli/auth0

# Linux
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh
```

If not logged in:
```bash
auth0 login
```

#### Step A2: Detect project and appId

- Verify `package.json` contains `@angular/core`, `@ionic/angular`, and `@capacitor/core`
- Read `appId` from `capacitor.config.ts` (match `appId: 'com.example.app'`) or `capacitor.config.json`
- If neither config file exists or `appId` is not found, use `com.example.app` as default and warn the user

#### Step A3: Get the active tenant domain

```bash
auth0 tenants list --csv --no-input
```

Parse the output to find the line containing `→` — the second CSV column on that line is the active domain.

#### Step A4: Create a Native Auth0 application

```bash
auth0 apps create \
  --name "PROJECT_NAME-ionic-angular" \
  --type native \
  --auth-method none \
  --callbacks "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
  --logout-urls "PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback" \
  --origins "capacitor://localhost,http://localhost" \
  --json --no-input
```

Replace `PROJECT_NAME` with the project name from `package.json`, `PACKAGE_ID` with the `appId` from Step A2, and `DOMAIN` with the tenant domain from Step A3.

Extract `client_id` from the JSON output.

#### Step A5: Enable Username-Password-Authentication connection

```bash
auth0 api get connections
```

Parse the JSON array to find the connection with `"name": "Username-Password-Authentication"`.

- **If it exists** but doesn't include the new `client_id` in `enabled_clients`, update it:
  ```bash
  auth0 api patch "connections/CONNECTION_ID" --data '{"enabled_clients":["EXISTING_ID_1","EXISTING_ID_2","NEW_CLIENT_ID"]}'
  ```
  Keep all existing `enabled_clients` and append the new one.

- **If it doesn't exist**, create it:
  ```bash
  auth0 api post connections --data '{"strategy":"auth0","name":"Username-Password-Authentication","enabled_clients":["CLIENT_ID"]}'
  ```

- **If it already includes the client_id**, skip this step.

#### Step A6: Write config file

Create `src/environments/` directory if it doesn't exist, then write `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  auth0: {
    domain: 'DOMAIN',
    clientId: 'CLIENT_ID',
    callbackUrl: 'PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback',
    appId: 'PACKAGE_ID',
  },
};
```

#### Step A7: Confirm completion

Tell the user that Auth0 has been configured and credentials have been written to `src/environments/environment.ts`. Do NOT display the domain, client ID, or any credential values in the output.

---

### Option B: Manual Setup

The developer provides an `.env` file containing their Auth0 credentials. The agent reads the file, extracts the values, and writes the project configuration.

#### Step B1: Ask for the env file path

Use `AskUserQuestion` to ask the developer for the path to their `.env` file:

```
AskUserQuestion:
  question: "Please provide the path to your .env file containing Auth0 credentials (AUTH0_DOMAIN and AUTH0_CLIENT_ID):"
```

The `.env` file should contain lines in this format:
```
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id_here
```

> **Agent instruction:** Read the file at the path the user provides. Extract the values for `AUTH0_DOMAIN` and `AUTH0_CLIENT_ID` by parsing `KEY=VALUE` lines. If the file is missing either key, use `AskUserQuestion` to ask the user to provide the missing value. Accept common variations: `DOMAIN` / `AUTH0_DOMAIN`, `CLIENT_ID` / `AUTH0_CLIENT_ID`.

#### Step B2: Detect appId

Read `appId` from `capacitor.config.ts` (match `appId: 'com.example.app'`) or `capacitor.config.json`. If not found, use `com.example.app` as default and warn the user.

#### Step B3: Write config file

Create `src/environments/` directory if it doesn't exist, then write `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  auth0: {
    domain: 'DOMAIN',
    clientId: 'CLIENT_ID',
    callbackUrl: 'PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback',
    appId: 'PACKAGE_ID',
  },
};
```

#### Step B4: Remind user to configure Auth0 Dashboard

Since credentials were provided manually, the user must also configure the Auth0 Dashboard themselves. Display these required settings:

| Setting | Value |
|---------|-------|
| **Application Type** | **Native** |
| **Allowed Callback URLs** | `PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback` |
| **Allowed Logout URLs** | `PACKAGE_ID://DOMAIN/capacitor/PACKAGE_ID/callback` |
| **Allowed Origins** | `capacitor://localhost, http://localhost` |

Also add `http://localhost:8100` to Callback URLs, Logout URLs, and Web Origins if the user will use `ionic serve` for local development.

No Client Secret is needed — Native apps use PKCE.

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
