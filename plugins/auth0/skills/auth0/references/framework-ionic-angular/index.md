# Auth0 Ionic Angular (Capacitor) — reference hub

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

## Quick start

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
> Follow the chosen path in this group's integration guide (Setup → Auth0 Configuration section), which has the full step-by-step instructions for both options.

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

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-ionic-angular/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For tenant setup, Auth0 CLI provisioning, Dashboard config, deep linking, and advanced framework patterns (login/logout flows, token management, route guards, error handling, Capacitor lifecycle): `Read: references/framework-ionic-angular/integrate.md`
- Full API / configuration lookup, claims reference, testing checklist, security considerations: `Read: references/framework-ionic-angular/api-reference.md`
- Any other task (guidance, debugging, Organizations): start with `Read: references/framework-ionic-angular/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
