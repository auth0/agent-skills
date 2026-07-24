
# Auth0 Angular Integration

Add authentication to Angular applications using @auth0/auth0-angular.

## Prerequisites

- Angular 13+ application
- Auth0 account and application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **AngularJS (1.x)** - This SDK requires Angular 13+, use legacy solutions for AngularJS
- **Mobile applications** - Use the Auth0 integration workflow for React Native, or native SDKs for Ionic
- **Backend APIs** - Use JWT validation middleware for your server language

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-angular
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see the Setup Guide section below for complete scripts.

**For manual setup:**

Update `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  auth0: {
    domain: 'your-tenant.auth0.com',
    clientId: 'your-client-id',
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  }
};
```

### 3. Configure Auth Module

**For standalone components (Angular 14+):**

Update `src/app/app.config.ts`:

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: environment.auth0.authorizationParams
    })
  ]
};
```

**For NgModule-based apps:**

Update `src/app/app.module.ts`:

```typescript
import { AuthModule } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

@NgModule({
  imports: [
    AuthModule.forRoot({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: environment.auth0.authorizationParams
    })
  ]
})
export class AppModule {}
```

### 4. Add Authentication UI

Update `src/app/app.component.ts`:

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  selector: 'app-root',
  template: `
    <div *ngIf="auth.isLoading$ | async; else loaded">
      <p>Loading...</p>
    </div>

    <ng-template #loaded>
      <ng-container *ngIf="auth.isAuthenticated$ | async; else loggedOut">
        <div *ngIf="auth.user$ | async as user">
          <img [src]="user.picture" [alt]="user.name" />
          <h2>Welcome, {{ user.name }}!</h2>
          <button (click)="logout()">Logout</button>
        </div>
      </ng-container>

      <ng-template #loggedOut">
        <button (click)="login()">Login</button>
      </ng-template>
    </ng-template>
  `
})
export class AppComponent {
  constructor(public auth: AuthService) {}

  login(): void {
    this.auth.loginWithRedirect();
  }

  logout(): void {
    this.auth.logout({ logoutParams: { returnTo: window.location.origin } });
  }
}
```

### 5. Test Authentication

Start your dev server and test the login flow:

```bash
ng serve
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add redirect URI in Auth0 Dashboard | Add your application URL (e.g., `http://localhost:4200`, `https://app.example.com`) to Allowed Callback URLs in Auth0 Dashboard |
| Not configuring AuthModule properly | Must call `AuthModule.forRoot()` in NgModule or `provideAuth0()` in standalone config |
| Accessing auth before initialization | Use `isLoading$` observable to wait for SDK initialization |
| Storing tokens manually | Never manually store tokens - SDK handles secure storage automatically |
| No token sent to API | Use either `authHttpInterceptorFn` for automatic token attachment, or `getAccessTokenSilently()` for manual control — see the Calling a Protected API section below |
| Route guard not protecting routes | Apply `AuthGuard` (or `authGuardFn`) to protected routes in routing config |

## Related Capabilities

- Auth0 setup — run the CLI (`auth0 login`, then `auth0 apps create`)
- Migrating from another auth provider → ask for migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Managing Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**Core Services:**
- `AuthService` - Main authentication service
- `isAuthenticated$` - Observable check if user is logged in
- `user$` - Observable user profile information
- `loginWithRedirect()` - Initiate login
- `logout()` - Log out user
- `getAccessTokenSilently()` - Get access token manually (alternative to HTTP interceptor)

**Common Use Cases:**
- Login/Logout buttons → See Step 4 above
- Protected routes with guards → see the Protected Routes section below
- Calling a protected API → see the Calling a Protected API section below
- Error handling → see the Error Handling section below

## References

- [Auth0 Angular SDK Documentation](https://auth0.com/docs/libraries/auth0-angular)
- [Auth0 Angular Quickstart](https://auth0.com/docs/quickstart/spa/angular)
- [SDK GitHub Repository](https://github.com/auth0/auth0-angular)

---

## Common Patterns

### Protected Route with Auth Guard

Create an auth guard (`src/app/auth.guard.ts`):

```typescript
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { map, take } from 'rxjs/operators';

export const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isAuthenticated$.pipe(
    take(1),
    map(isAuthenticated => {
      if (!isAuthenticated) {
        auth.loginWithRedirect();
        return false;
      }
      return true;
    })
  );
};
```

**Configure routes** (`src/app/app.routes.ts`):

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';
import { HomeComponent } from './home/home.component';
import { ProfileComponent } from './profile/profile.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard]  // Protect this route
  }
];
```

---

### Get User Profile Component

Create `src/app/profile/profile.component.ts`:

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="auth.user$ | async as user">
      <h1>Profile</h1>
      <img [src]="user.picture" [alt]="user.name" />
      <p>Name: {{ user.name }}</p>
      <p>Email: {{ user.email }}</p>
      <p>User ID: {{ user.sub }}</p>
    </div>
  `
})
export class ProfileComponent {
  constructor(public auth: AuthService) {}
}
```

---

### Call Protected API (Manual Token Approach)

This example uses `getAccessTokenSilently()` to manually obtain and attach tokens. This is an alternative to using the built-in HTTP interceptor — see the Calling a Protected API section for both approaches.

Create `src/app/api-test/api-test.component.ts`:

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-api-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <button (click)="callApi()">Call API</button>
      <div *ngIf="error">Error: {{ error }}</div>
      <pre *ngIf="data">{{ data | json }}</pre>
    </div>
  `
})
export class ApiTestComponent {
  data: any = null;
  error: string | null = null;

  constructor(
    private auth: AuthService,
    private http: HttpClient
  ) {}

  callApi(): void {
    this.auth.getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://your-api-identifier'
      }
    }).pipe(
      switchMap(token =>
        this.http.get('https://api.example.com/data', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
      )
    ).subscribe({
      next: (response) => {
        this.data = response;
      },
      error: (err) => {
        this.error = err.message;
      }
    });
  }
}
```

**Note:** If calling APIs, add `audience` to your Auth module configuration:

```typescript
AuthModule.forRoot({
  domain: environment.auth0.domain,
  clientId: environment.auth0.clientId,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: 'https://your-api-identifier'  // Add this
  }
})
```

---

### Custom HTTP Interceptor for API Calls

This shows how to build a custom interceptor from scratch. In most cases, you should use the SDK's built-in `authHttpInterceptorFn` instead — see the Calling a Protected API section. A custom interceptor is only needed when you require logic beyond what `allowedList` provides.

Create `src/app/auth.interceptor.ts`:

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { switchMap } from 'rxjs/operators';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // Only add token to API calls
  if (req.url.startsWith('https://api.example.com')) {
    return auth.getAccessTokenSilently().pipe(
      switchMap(token => {
        const clonedReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next(clonedReq);
      })
    );
  }

  return next(req);
};
```

**Register interceptor** (`src/app/app.config.ts`):

```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth0({...}),
    provideHttpClient(
      withInterceptors([authInterceptor])
    )
  ]
};
```

---

## Configuration Options

### Complete Auth Configuration

```typescript
AuthModule.forRoot({
  domain: 'your-tenant.auth0.com',
  clientId: 'your-client-id',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: 'https://your-api-identifier',  // For API calls
    scope: 'openid profile email',  // Default scopes
  },
  cacheLocation: 'localstorage',  // or 'memory'
  useRefreshTokens: true,  // Enable refresh tokens
  skipRedirectCallback: false,  // Skip automatic callback handling
  errorPath: '/error',  // Path to redirect on auth errors (default: '/')
  httpInterceptor: {
    allowedList: [
      'https://api.example.com/*'  // Automatically add tokens to these URLs
    ]
  }
})
```

---

## Testing

1. Start your dev server: `ng serve`
2. Navigate to `http://localhost:4200`
3. Click "Login" button
4. Complete Auth0 Universal Login
5. Verify redirect back with user authenticated
6. Test protected routes
7. Click "Logout" and verify user is logged out

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid state" error | Clear browser storage. Ensure `redirect_uri` matches configured callback URL |
| User stuck on loading | Check Auth0 application has `http://localhost:4200` in callback URLs |
| API calls fail with 401 | Ensure `audience` is configured and matches your API identifier |
| Logout doesn't work | Include `returnTo` URL and configure in Auth0 "Allowed Logout URLs" |
| HTTP interceptor not working | Check `allowedList` includes your API URLs |

---

## Security Considerations

- **Never expose client secret** - Angular is client-side, use only public client credentials
- **Use PKCE** - Enabled by default with @auth0/auth0-angular
- **Validate tokens on backend** - Never trust client-side token validation
- **Use HTTPS in production** - Auth0 requires HTTPS for production redirect URLs
- **Implement proper CORS** - Configure allowed origins in Auth0 application settings

---

## Advanced Methods

### getAccessTokenWithPopup

Gets an access token via popup window. Useful when silent authentication fails (e.g., third-party cookies blocked).

```typescript
// Try silent, fall back to popup
this.auth.getAccessTokenSilently().subscribe({
  next: (token) => {
    // Use the token (e.g., attach to API requests)
  },
  error: () => {
    // Silent auth failed, try popup
    this.auth.getAccessTokenWithPopup().subscribe(token => {
      // Use the token (e.g., attach to API requests)
    });
  }
});
```

### connectAccountWithRedirect

Redirects to connect an additional account to the logged-in user. Allows users to link multiple identity providers.

```typescript
// Link a Google account to existing user
this.auth.connectAccountWithRedirect({
  connection: 'google-oauth2',
  scopes: ['openid', 'profile', 'email'],
  authorizationParams: {
    // additional params
  }
}).subscribe();
```

After the redirect callback, `handleRedirectCallback` will be called with the details of the connected account.

---

## Related Capabilities

- Auth0 setup — run the CLI (`auth0 login`, then `auth0 apps create`)
- Migrating from another auth provider → ask for migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- B2B multi-tenancy → ask for Organizations (feature:organizations)
- Passkey authentication → ask for MFA (feature:mfa)

---

## References

- [Auth0 Angular SDK Documentation](https://auth0.com/docs/libraries/auth0-angular)
- [Auth0 Angular SDK GitHub](https://github.com/auth0/auth0-angular)
- [Auth0 Angular Quickstart](https://auth0.com/docs/quickstart/spa/angular)
- [Angular Router Documentation](https://angular.io/guide/router)

---

# Auth0 Angular Integration Patterns

Angular-specific implementation patterns with route guards, HTTP interceptors, and RxJS.

---

## Protected Routes

### Auth Guard

Create `src/app/guards/auth.guard.ts`:

```typescript
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { map } from 'rxjs/operators';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated$.pipe(
    map(isAuthenticated => {
      if (!isAuthenticated) {
        authService.loginWithRedirect();
        return false;
      }
      return true;
    })
  );
};
```

### Apply Guard to Routes

```typescript
// app.routes.ts (standalone)
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard]
  }
];
```

---

## Calling a Protected API

There are two alternative approaches to attach access tokens to API requests. Choose the one that best fits your needs — you do not need both:

- **HTTP Interceptor (recommended)** — Automatically attaches tokens to outgoing requests matching a configured URL list. This is the simplest, most centralized approach and works well for most applications.
- **Manual token retrieval** — Call `getAccessTokenSilently()` to obtain a token and attach it to requests yourself. Use this when you need explicit, per-request control over token handling.

### Option 1: HTTP Interceptor

Configure the built-in HTTP interceptor in app config:

```typescript
// app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authHttpInterceptorFn } from '@auth0/auth0-angular';
import { environment } from '../environments/environment'; // Adjust path as needed

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        audience: 'https://your-api-identifier',
        redirect_uri: window.location.origin
      },
      httpInterceptor: {
        allowedList: [
          '/api/*',
          'https://api.example.com/*'
        ]
      }
    }),
    provideHttpClient(
      withInterceptors([authHttpInterceptorFn])
    )
  ]
};
```

With this in place, any `HttpClient` request to a URL matching `allowedList` will automatically include the access token:

```typescript
// data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class DataService {
  constructor(private http: HttpClient) {}

  getData() {
    return this.http.get('https://api.example.com/data');
    // Access token automatically added by interceptor
  }
}
```

### Option 2: Manual Token Retrieval

If you prefer explicit control instead of using the interceptor, call `getAccessTokenSilently()` to obtain a token and attach it yourself:

```typescript
import { AuthService } from '@auth0/auth0-angular';
import { HttpClient } from '@angular/common/http';
import { switchMap } from 'rxjs/operators';

constructor(private auth: AuthService, private http: HttpClient) {}

callApi() {
  this.auth.getAccessTokenSilently({
    authorizationParams: {
      audience: 'https://your-api-identifier'
    }
  }).pipe(
    switchMap(token =>
      this.http.get('https://api.example.com/data', {
        headers: { Authorization: `Bearer ${token}` }
      })
    )
  ).subscribe({
    next: (response) => console.log(response),
    error: (err) => console.error(err)
  });
}
```

---

## User Profile Component

```typescript
import { Component } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="auth.user$ | async as user">
      <img [src]="user.picture" [alt]="user.name" />
      <h2>{{ user.name }}</h2>
      <p>{{ user.email }}</p>
      <pre>{{ user | json }}</pre>
    </div>
  `
})
export class ProfileComponent {
  constructor(public auth: AuthService) {}
}
```

---

## Error Handling

### Handle Auth Errors

```typescript
import { Component, OnInit } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';

@Component({
  template: `
    <div *ngIf="error$ | async as error" class="error">
      <h3>Authentication Error</h3>
      <p>{{ error.message }}</p>
    </div>
  `
})
export class AppComponent implements OnInit {
  error$ = this.auth.error$;

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.error$.subscribe(error => {
      if (error) {
        console.error('Auth error:', error);
      }
    });
  }
}
```

---

## Common Patterns

### Login with Options

```typescript
login() {
  this.auth.loginWithRedirect({
    authorizationParams: {
      connection: 'google-oauth2',
      screen_hint: 'signup'
    }
  });
}
```

## Testing

### Mock AuthService

```typescript
// auth.service.mock.ts
import { of } from 'rxjs';

export const mockAuthService = {
  isAuthenticated$: of(true),
  user$: of({ name: 'Test User', email: 'test@example.com' }),
  loginWithRedirect: jasmine.createSpy('loginWithRedirect'),
  logout: jasmine.createSpy('logout'),
  getAccessTokenSilently: jasmine.createSpy('getAccessTokenSilently').and.returnValue(of('mock-token'))
};
```

### Use in Tests

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '@auth0/auth0-angular';
import { mockAuthService } from './auth.service.mock';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService }
      ]
    });
    fixture = TestBed.createComponent(AppComponent);
  });

  it('should display user name', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test User');
  });
});
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| CORS errors | Add URLs to "Allowed Web Origins" in Auth0 Dashboard |
| Interceptor not adding tokens | Verify `allowedList` in httpInterceptor config |
| Guard not redirecting | Ensure AuthService is provided in root |
| Observables not updating | Use `async` pipe or subscribe properly |

---

---

# Auth0 Angular Setup Guide

Complete setup instructions for Angular applications.

---

## Quick Setup (Automated)

### Bash Script

```bash
#!/bin/bash

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0/auth0-cli/auth0
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Download and review the install script before executing
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh -o /tmp/auth0-install.sh
    echo "⚠️  Review the install script at /tmp/auth0-install.sh before running"
    sh /tmp/auth0-install.sh -b /usr/local/bin
    rm /tmp/auth0-install.sh
  fi
fi

# Login to Auth0
if ! auth0 tenants list &> /dev/null; then
  echo "Auth0 Login Required"
  read -p "Do you have an Auth0 account? (y/n): " HAS_ACCOUNT
  if [[ "$HAS_ACCOUNT" != "y" ]]; then
    echo "Visit https://auth0.com/signup to create an account"
    read -p "Press Enter when ready..."
  fi
  auth0 login
fi

# Create or select app
auth0 apps list
read -p "Enter your Auth0 app ID (or press Enter to create new): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_NAME="${PWD##*/}-angular-app"
  APP_ID=$(auth0 apps create \
    --name "$APP_NAME" \
    --type spa \
    --auth-method None \
    --callbacks "http://localhost:4200" \
    --logout-urls "http://localhost:4200" \
    --origins "http://localhost:4200" \
    --web-origins "http://localhost:4200" \
    --metadata "created_by=agent_skills" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
fi

# Get credentials
AUTH0_DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
AUTH0_CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)

echo "✅ Configuration complete!"
echo "Update src/environments/environment.ts with:"
echo "  domain: '$AUTH0_DOMAIN'"
echo "  clientId: '$AUTH0_CLIENT_ID'"
```

---

## Manual Setup

### Step 1: Install SDK

```bash
npm install @auth0/auth0-angular
```

### Step 2: Configure Environment

Create or update `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  auth0: {
    domain: 'your-tenant.auth0.com',
    clientId: 'your-client-id',
    authorizationParams: {
      redirect_uri: window.location.origin
    }
  }
};
```

For production (`src/environments/environment.prod.ts`):

```typescript
export const environment = {
  production: true,
  auth0: {
    domain: 'your-tenant.auth0.com',
    clientId: 'your-client-id',
    authorizationParams: {
      redirect_uri: 'https://app.example.com'
    }
  }
};
```

### Step 3: Get Auth0 Credentials

Using Auth0 CLI:

```bash
auth0 login
auth0 apps list
auth0 apps show <app-id>
```

Or via [Auth0 Dashboard](https://manage.auth0.com):
1. Create Single Page Application
2. Configure callback URLs: `http://localhost:4200`
3. Copy domain and client ID

---

## Troubleshooting

**Module not found errors:**
- Ensure @auth0/auth0-angular is in package.json
- Run `npm install`

**CORS errors:**
- Add `http://localhost:4200` to "Allowed Web Origins" in Auth0 Dashboard

**Environment variables not working:**
- Angular uses environment files, not .env
- Rebuild app after changing environment files

---
