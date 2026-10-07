# @auth0/auth0-angular — Enterprise Connect

**Minimum version:** `2.12.0`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. There is **no
`startEnterpriseLogin`** here: discover with the standalone `isFederatedDomain`, then call
`AuthService.loginWithRedirect` with `login_hint`. Import only from `@auth0/auth0-angular`.

## Enable relay mode

Set `enterpriseConnect` in `provideAuth0` (or `AuthModule.forRoot` with the same options), with
the B2B Integration's Client ID:

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
`AuthService` method. `loginWithRedirect` returns an Observable that must be subscribed:

```ts
import { FormControl } from '@angular/forms';
import { AuthService, isFederatedDomain } from '@auth0/auth0-angular';
import { environment } from '../environments/environment';

export class LoginComponent {
  email = new FormControl('');
  constructor(private auth: AuthService) {}

  async onSubmit(): Promise<void> {
    const email = this.email.value ?? '';
    const federated = await isFederatedDomain(environment.auth0Domain, email.split('@')[1]);
    if (!federated) {
      return; // not federated: your existing login
    }
    this.auth.loginWithRedirect({ authorizationParams: { login_hint: email } }).subscribe();
  }
}
```

## Read the user and `org_id`

`AuthService` processes `code`/`state` on load; read `auth.user$` (`user.email`, `user.org_id`)
after `auth.isLoading$` emits `false`.

## Validate the organization (optional)

Reject with a **federated** logout:

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

Public client: no client secret. Tokens stay in memory - do not set `useRefreshTokens`. Maintained
example: https://raw.githubusercontent.com/auth0/auth0-angular/main/EXAMPLES.md#enterprise-connect

All calls above are accurate for `@auth0/auth0-angular` 2.12.0+ — do not read the SDK source to
re-verify them.
