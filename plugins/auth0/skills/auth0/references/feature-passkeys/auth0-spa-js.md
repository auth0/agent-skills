# @auth0/auth0-spa-js — Passkeys

**Minimum version:** `2.21.0` for the high-level `passkey.signup()` / `passkey.login()`. The **low-level** granular methods (`passkey.getSignupChallenge`, `passkey.getLoginChallenge`, `passkey.getTokenWithPasskey`) shipped later, in **`2.24.0`** — pin `>=2.24.0` if you use the low-level path.

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

`auth0-spa-js` exposes **both** shapes, all under the `Auth0Client.passkey` namespace. Prefer the high-level `passkey.signup()`/`passkey.login()` unless you need to own the WebAuthn ceremony (e.g. a custom `navigator.credentials` UX), then use the low-level challenge + `getTokenWithPasskey()` path.

## Prerequisites (app-side)

`useRefreshTokens: true` is a **hard requirement**, not a nicety. Passkey auth is a direct `/oauth/token` WebAuthn-grant exchange with no session cookie — without refresh tokens a later `getTokenSilently()` either fails `login_required` or returns a *different user's* tokens from a stale session cookie.

```ts
import { createAuth0Client } from "@auth0/auth0-spa-js";

const auth0 = await createAuth0Client({
  domain: "{yourCustomDomain}",     // custom domain, not *.auth0.com
  clientId: "{yourClientId}",
  useRefreshTokens: true,           // required — enable Refresh Token Rotation on the tenant
  authorizationParams: { redirect_uri: window.location.origin },
});
```

## Signup / Login — high-level

```ts
// Signup: runs challenge + navigator.credentials.create() + token exchange
await auth0.passkey.signup({
  email: "user@example.com",   // at least one identifier required
  name: "Jane Doe",
  // also accepts: phoneNumber, username, givenName, familyName, nickname,
  // picture, userMetadata, realm, organization, scope, audience
});

// Login: runs challenge + navigator.credentials.get() + token exchange
await auth0.passkey.login({
  // realm, organization, scope, audience — all optional
});

// tokens are now cached; use the normal accessor
const token = await auth0.getTokenSilently();
```

Note: the signup identifier's connection is selected via **`realm`** (there is no `connection` option).

## Signup / Login — low-level (>=2.24.0)

Own the ceremony when you need custom WebAuthn handling:

```ts
// 1. Challenge — returns { authSession, publicKey }
//    (the SDK reshapes the raw authnParamsPublicKey into a browser-ready publicKey)
const { authSession, publicKey } = await auth0.passkey.getSignupChallenge({
  email: "user@example.com",
  name: "Jane Doe",          // optional
});
// login: auth0.passkey.getLoginChallenge({ realm?, organization? })

// 2. Ceremony — you run WebAuthn with the returned publicKey options
const credential = await navigator.credentials.create({ publicKey });
// login: navigator.credentials.get({ publicKey })

// 3. Token exchange
await auth0.passkey.getTokenWithPasskey({ authSession, credential });
// also accepts optional realm, organization, scope, audience
```

- `passkey.getSignupChallenge({ email, name? })` / `passkey.getLoginChallenge({ realm?, organization? })` → `Promise<{ authSession, publicKey }>`.
- `passkey.getTokenWithPasskey({ authSession, credential, realm?, organization?, scope?, audience? })` exchanges the credential on the passkey grant and caches tokens.

## Error handling

There is **no passkey-specific error class**. On user cancellation (WebAuthn returns `null`), both `signup()` and `login()` throw a plain `Error` with a descriptive message — wrap in try/catch and offer a retry. A login may surface `MfaRequiredError` (exported from `@auth0/auth0-spa-js`) when the tenant requires a second factor — continue with the MFA flow (see the hub, then `feature-mfa`).

## SDK-specific gotchas

- `useRefreshTokens: true` is mandatory — without it `getTokenSilently()` fails `login_required` or returns stale-session tokens.
- All passkey methods live under `auth0.passkey.*` — there are no top-level `getSignupChallenge`/`getTokenWithPasskey` methods.
- Use the signup challenge with `navigator.credentials.create()` and the login challenge with `.get()`; do not cross them.
- The `domain` must be the verified custom domain.
