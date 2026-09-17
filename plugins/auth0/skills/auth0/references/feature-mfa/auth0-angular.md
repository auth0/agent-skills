# @auth0/auth0-angular — MFA

**Minimum version:** 2.11.0. The MFA API flow is Early Access — confirm tenant enablement before shipping. `AuthConfig` extends `Auth0ClientOptions` from `@auth0/auth0-spa-js` (peer dep ^2.21.0 in 2.11.0), so `interactiveErrorHandler` (added in spa-js 2.16.0) is a valid `provideAuth0()` key via inheritance — it is not a direct property of `AuthConfig` but works correctly at runtime.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`.

Everything lives on `AuthService` (constructor DI). All types import from `@auth0/auth0-angular`. Calls return Observables — compose with RxJS.

```ts
import { AuthService, MfaRequiredError } from '@auth0/auth0-angular';
constructor(private auth: AuthService) {}
```

Two independent flows; pick one.

## Flow 1 — popup step-up

Not `acr_values`/`max_age`. Configure `provideAuth0` / `AuthModule.forRoot` with `useRefreshTokens: true` and `interactiveErrorHandler: 'popup'`; `getAccessTokenSilently()` then opens a Universal Login popup on `mfa_required`.

```ts
provideAuth0({
  domain: 'YOUR_DOMAIN',
  clientId: 'YOUR_CLIENT_ID',
  authorizationParams: { redirect_uri: window.location.origin, audience: 'https://api.example.com/' },
  useRefreshTokens: true,
  interactiveErrorHandler: 'popup',
})
```

Trigger the step-up from a component by requesting the high-value scope; the popup opens automatically and resolves once MFA completes:

```ts
import { firstValueFrom } from 'rxjs';
import { PopupCancelledError, PopupTimeoutError } from '@auth0/auth0-angular';

async transferFunds(): Promise<void> {
  try {
    await firstValueFrom(this.auth.getAccessTokenSilently({
      authorizationParams: { audience: 'https://api.example.com/', scope: 'transfer:funds' },
    }));
  } catch (err) {
    if (err instanceof PopupCancelledError || err instanceof PopupTimeoutError) return; // aborted
    throw err;
  }
  // reached only after step-up succeeded
}
```

Popup failures: `PopupOpenError`, `PopupCancelledError`, `PopupTimeoutError`.

## Flow 2 — MFA API (custom UI)

`getAccessTokenSilently()` emits `MfaRequiredError` with `mfa_token` and mutually-exclusive `mfa_requirements` (`.enroll[]` or `.challenge[]`):

```ts
this.auth.getAccessTokenSilently().pipe(
  catchError((error) => {
    if (error instanceof MfaRequiredError) {
      const mfaToken = error.mfa_token;
      return error.mfa_requirements?.enroll?.length
        ? this.auth.mfa.getEnrollmentFactors(mfaToken)
        : this.auth.mfa.getAuthenticators(mfaToken);
    }
    return EMPTY;
  })
).subscribe();
```

- **Enroll:** `auth.mfa.enroll({ mfaToken, factorType })` — `'otp'` (returns `barcodeUri` + `recoveryCodes`), `'sms'`/`'voice'` (need `phoneNumber`), `'email'` (needs `email`), `'push'` (returns `authenticatorId`).
- **Challenge:** `auth.mfa.challenge({ mfaToken, challengeType, authenticatorId })` — `'otp'` optional (can skip to verify); `'oob'` required, returns `{ oobCode }`.
- **Verify:** `auth.mfa.verify({ mfaToken, otp })` / `({ mfaToken, oobCode, bindingCode })` / `({ mfaToken, recoveryCode })`.

**Critical:** `verify()` does not update auth state. Chain `getAccessTokenSilently()` after a successful verify so `isAuthenticated$`/`user$` update. Recovery-code verify may return a new `recovery_code` — prompt the user to save it.

Errors: `MfaRequiredError`, `MfaVerifyError`, `MfaChallengeError`, `MfaEnrollmentError`, `MfaListAuthenticatorsError`, `MfaEnrollmentFactorsError`.

Source: https://github.com/auth0/auth0-angular/blob/main/EXAMPLES.md (Multi-Factor Authentication / Step-Up Authentication)
