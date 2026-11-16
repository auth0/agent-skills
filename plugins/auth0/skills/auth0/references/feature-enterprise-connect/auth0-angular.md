# @auth0/auth0-angular — Enterprise Connect

**Minimum version:** `2.12.0`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. There is **no
`startEnterpriseLogin`** here: discover with the standalone `isFederatedDomain`, then call
`AuthService.loginWithRedirect` with `login_hint`. Import only from `@auth0/auth0-angular`.

## Enable relay mode

Set `enterpriseConnect` in `provideAuth0` (or `AuthModule.forRoot` with the same options), with
the B2B Integration's Client ID. The flag only makes the SDK `console.warn` on `useRefreshTokens` /
`offline_access`, a static `organization`, or a logout without `federated: true`; it does not
change the login flow or throw:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth0({
      domain: environment.auth0Domain,
      clientId: environment.auth0ClientId,
      enterpriseConnect: true,
      authorizationParams: {
        redirect_uri: window.location.origin,
        scope: 'openid profile email', // no offline_access, no static organization
      },
    }),
  ],
};
```

## Discover and start login

`isFederatedDomain(auth0Domain, emailDomain)` is a function exported by the package - **not** an
`AuthService` method. It returns `Promise<boolean>`, never throws, and resolves `false` on any
failure (unmanaged domain, 429, network error), so `await` it and treat `false` as "use your
existing login". It is a routing hint, not a security control. `AuthService.loginWithRedirect`
returns a cold `Observable<void>`: nothing happens until you subscribe:

```ts
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuthService, isFederatedDomain } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form (ngSubmit)="onSubmit()">
      <input type="email" [formControl]="email" />
      <button type="submit">Continue</button>
    </form>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  email = new FormControl('', { nonNullable: true });

  async onSubmit(): Promise<void> {
    const email = this.email.value.trim();
    const parts = email.split('@');
    const emailDomain = parts.length === 2 ? parts[1] : '';

    if (emailDomain && (await isFederatedDomain(environment.auth0Domain, emailDomain))) {
      this.auth.loginWithRedirect({ authorizationParams: { login_hint: email } }).subscribe();
    } else {
      // not federated or malformed email: your existing login
    }
  }
}
```

## Read the user and `org_id`

`AuthService` processes `code`/`state` on load (no manual callback handling); read `auth.user$`
(`user.email`, `user.org_id`) after `auth.isLoading$` emits `false`. Enterprise Connect issues no
refresh token, so `getAccessTokenSilently` cannot renew an expired access token; send the user
through login again.

## Validate the organization (optional)

Reject with a **federated** logout so the IdP session ends too. This is a client-side guard;
enforce `org_id` on your server for every API call that trusts the token:

```ts
import { filter, take } from 'rxjs';

const allowedOrgs = ['org_123']; // your organization IDs

this.auth.idTokenClaims$
  .pipe(filter((claims) => !!claims), take(1))
  .subscribe((claims) => {
    if (!claims?.org_id || !allowedOrgs.includes(claims.org_id)) {
      this.auth
        .logout({ logoutParams: { federated: true, returnTo: `${window.location.origin}/login` } })
        .subscribe();
    }
  });
```

## Federated logout

```ts
this.auth
  .logout({ logoutParams: { federated: true, returnTo: `${window.location.origin}/login` } })
  .subscribe();
```

`returnTo` must be in Allowed Logout URLs; the app origin (`http://localhost:4200` in dev) must
be in Allowed Callback URLs and Allowed Web Origins.

## Security

Public client: no client secret. Tokens stay in memory - do not set `useRefreshTokens` or copy
tokens to `localStorage`. Maintained
example: https://raw.githubusercontent.com/auth0/auth0-angular/main/EXAMPLES.md#enterprise-connect

All calls above are accurate for `@auth0/auth0-angular` 2.12.0+ — do not read the SDK source to
re-verify them.
