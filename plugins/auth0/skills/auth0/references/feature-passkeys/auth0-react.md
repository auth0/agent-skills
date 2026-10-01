# @auth0/auth0-react — Passkeys

**Minimum version:** `2.18.0` (the `passkey` API on the `useAuth0()` hook).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

`auth0-react` is **high-level**: `passkey.signup()` / `passkey.login()` run the WebAuthn challenge, the browser ceremony, and the token exchange in one call, then update the hook's auth state.

## Prerequisites (app-side)

Passkey login creates no session cookie, so `Auth0Provider` **must** use refresh tokens or the next `getAccessTokenSilently()` fails `login_required`:

```tsx
<Auth0Provider
  domain="{yourCustomDomain}"        // custom domain, not *.auth0.com
  clientId="{yourClientId}"
  authorizationParams={{ redirect_uri: window.location.origin }}
  useRefreshTokens={true}            // required — enable Refresh Token Rotation on the tenant
>
  <App />
</Auth0Provider>
```

## Signup

```tsx
import { useAuth0 } from "@auth0/auth0-react";

const { passkey, isAuthenticated } = useAuth0();

const tokens = await passkey.signup({
  email: "user@example.com",       // identifier; matches the connection's Attributes config
  name: "Jane Doe",                // optional profile fields
  // scope, audience, organization optionally
});
// on resolve the user is authenticated; isAuthenticated flips to true
```

`passkey.signup(options)` runs the signup challenge, `navigator.credentials.create()`, and the token exchange. It resolves to a `TokenEndpointResponse` (the SDK also stores the tokens).

## Login

```tsx
const { passkey } = useAuth0();

await passkey.login({
  // realm, organization, scope, audience all optional
});
// on resolve the user is authenticated
```

`passkey.login(options)` runs the login challenge, `navigator.credentials.get()`, and the token exchange; it also resolves to a `TokenEndpointResponse`.

## Error classes

Import from `@auth0/auth0-react`:

- `PasskeyError` — base passkey error.
- `PasskeyRegisterError` — the signup/registration ceremony failed (user cancelled, no authenticator, rpId mismatch).
- `PasskeyChallengeError` — the challenge request failed.
- `PasskeyGetTokenError` — the token exchange on the passkey grant failed.
- `MfaRequiredError` — a real, importable class (not just an `mfa_required` string): the tenant requires a second factor after the passkey. Read `err.mfa_token` and continue with the MFA flow (see the hub's MFA-interplay section, then `feature-mfa`).

## SDK-specific gotchas

- `useRefreshTokens` is mandatory — without it the passkey session cannot be silently refreshed.
- The `domain` must be the verified custom domain; a `*.auth0.com` domain cannot be the WebAuthn relying party.
- `passkey.signup`/`passkey.login` throw on user cancellation — wrap in try/catch and offer a retry rather than treating cancellation as a hard failure.
