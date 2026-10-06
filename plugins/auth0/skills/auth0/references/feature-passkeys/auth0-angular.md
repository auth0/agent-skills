# @auth0/auth0-angular — Passkeys

**Minimum version:** `2.10.0` (the `passkey` API on `AuthService`).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

`auth0-angular` is **high-level**: `AuthService.passkey.signup()` / `.login()` run the challenge, the browser ceremony, and the token exchange, then update the observable auth state. Both return `Observable<TokenEndpointResponse>`.

## Prerequisites (app-side)

Passkey login creates no session cookie, so `provideAuth0` **must** enable refresh tokens:

```ts
import { provideAuth0 } from "@auth0/auth0-angular";

bootstrapApplication(AppComponent, {
  providers: [
    provideAuth0({
      domain: "{yourCustomDomain}",   // custom domain, not *.auth0.com
      clientId: "{yourClientId}",
      authorizationParams: { redirect_uri: window.location.origin },
      useRefreshTokens: true,         // required — enable Refresh Token Rotation on the tenant
    }),
  ],
});
```

## Signup

```ts
import { AuthService } from "@auth0/auth0-angular";

constructor(private auth: AuthService) {}

signUp() {
  this.auth.passkey
    .signup({
      email: "user@example.com",
      name: "Jane Doe",
      // scope, audience, organization optionally
    })
    .subscribe((tokens) => {
      // authenticated; tokens: TokenEndpointResponse
    });
}
```

`passkey.signup(options)` returns `Observable<TokenEndpointResponse>`.

## Login

```ts
logIn() {
  this.auth.passkey
    .login({
      // realm, organization, scope, audience optional
    })
    .subscribe((tokens) => {
      // authenticated
    });
}
```

`passkey.login(options)` returns `Observable<TokenEndpointResponse>`.

## Error classes

Emitted on the observable's error channel (import from `@auth0/auth0-angular`):

- `PasskeyError` — base passkey error.
- `PasskeyRegisterError` — signup/registration ceremony failed.
- `PasskeyChallengeError` — the challenge request failed.
- `PasskeyGetTokenError` — the token exchange on the passkey grant failed.
- `MfaRequiredError` — a real, importable class: the tenant requires a second factor. Branch with `if (err instanceof MfaRequiredError)`, read `err.mfa_token`, and continue with the MFA flow (see the hub, then `feature-mfa`).

Documented `@throws`: signup → `PasskeyRegisterError`, `PasskeyGetTokenError`, `PasskeyError`; login → `PasskeyChallengeError`, `PasskeyGetTokenError`, `PasskeyError` (plus `MfaRequiredError` on step-up).

## SDK-specific gotchas

- Subscribe (or use `firstValueFrom`) — the passkey observables are cold; nothing runs until subscribed.
- `useRefreshTokens: true` is mandatory.
- The `domain` must be the verified custom domain.
