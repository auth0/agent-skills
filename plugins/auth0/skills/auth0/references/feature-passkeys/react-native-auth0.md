# react-native-auth0 — Passkeys

**Minimum version:** `5.7.0` (the passkey methods on the `useAuth0()` hook / `Auth0` client). Requires **iOS 16.6+**, **Android API 28+**, or a WebAuthn-capable browser; native platforms need Associated Domains (iOS) / Digital Asset Links (Android) on the custom domain.

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

react-native-auth0 is **low-level for the challenge**: it returns the challenge and `getTokenByPasskey()` exchanges the credential for `Credentials`, but **it does not run the WebAuthn ceremony itself** — you run that step with a passkey library you add yourself (native: e.g. `react-native-passkey` or a native module; web: the browser's `navigator.credentials`). See "Ceremony library + native platform setup" below. It also exposes passkey **enrollment** via the My Account API.

## Signup / Login

```tsx
import { useAuth0 } from "react-native-auth0";

const { passkeySignupChallenge, passkeyLoginChallenge, getTokenByPasskey } = useAuth0();

// Signup challenge → PasskeyChallengeResponse { authParamsPublicKey, authSession }
const signupChallenge = await passkeySignupChallenge({
  email: "user@example.com",   // ≥1 of email/phoneNumber/username
  // realm, organization optional
});

// Login challenge → PasskeyChallengeResponse { authParamsPublicKey, authSession }
const loginChallenge = await passkeyLoginChallenge({
  // realm, organization optional
});

// --- your passkey library runs the WebAuthn ceremony with authParamsPublicKey (the SDK does NOT) ---

// Token exchange → Credentials
const credentials = await getTokenByPasskey({
  authSession: signupChallenge.authSession,
  authResponse,   // the ceremony result: string (native) | PublicKeyCredential (web)
  // realm, audience, scope, organization optional
});
```

- `passkeySignupChallenge(parameters)` → `Promise<PasskeyChallengeResponse { authParamsPublicKey, authSession }>`. Signup params: `email?`, `phoneNumber?`, `username?` (≥1 required), `name?`, `givenName?`, `familyName?`, `nickname?`, `picture?`, `userMetadata?`, `realm?`, `organization?`.
- `passkeyLoginChallenge(parameters)` → `Promise<PasskeyChallengeResponse>`. Login params: `realm?`, `organization?` only.
- `getTokenByPasskey({ authSession, authResponse, realm?, audience?, scope?, organization? })` → `Promise<Credentials>`. The credential field is **`authResponse`** (`string | PublicKeyCredential`); `scope` defaults to `"openid profile email"`.

The database connection is passed as **`realm`**, not `connection`. (`connection` is only a field on the *enrollment* challenge below — easy to conflate.)

### react-native-web — one SDK, branch only the ceremony

A React Native app that also ships a web build (react-native-web) uses the **same react-native-auth0 surface on every platform** — `passkeySignupChallenge`, `passkeyLoginChallenge`, `getTokenByPasskey`, and `myAccount.passkeyEnrollmentChallenge` / `enrollPasskey`. Only the WebAuthn **ceremony** differs per platform, and you branch *just that step* (via `Platform.OS` or a `.web.ts` / `.native.ts` split):

- **native** → your passkey library / native module produces the `authResponse` string.
- **web** → the browser's `navigator.credentials.create()` / `.get()` produces a `PublicKeyCredential`.

**Do NOT swap in `@auth0/auth0-react` or `@auth0/auth0-spa-js` for the web build**, and do NOT hand-roll `fetch` calls to `/me/v1/authentication-methods`. The browser SDKs are a different session/token model; the challenge and token-exchange calls stay on react-native-auth0 on all platforms — only the ceremony is platform-specific.

## Enrollment (add a passkey — My Account API)

Requires an access token with `create:me:authentication_methods`, minted for the `https://{yourDomain}/me/` audience via `getApiCredentials(...)` (fetching a token for that different audience from the session refresh token is the MRRT mechanism — see the hub's Enrollment section):

```tsx
const { myAccount } = useAuth0();

// 1. Enrollment challenge (accessToken REQUIRED)
const challenge = await myAccount.passkeyEnrollmentChallenge({
  accessToken,        // the /me/-audience token
  // userIdentity?, connection? optional
});

// 2. Your passkey library runs the WebAuthn registration ceremony (the SDK does NOT)

// 3. Verify → PasskeyAuthenticationMethod
const method = await myAccount.enrollPasskey({
  accessToken,
  authenticationMethodId: challenge.authenticationMethodId,
  authSession: challenge.authSession,
  authResponse,       // ceremony result (string)
  authParamsPublicKey: challenge.authParamsPublicKey,
});
```

- `myAccount.passkeyEnrollmentChallenge({ accessToken, userIdentity?, connection? })` → `Promise<PasskeyEnrollmentChallengeResponse { authenticationMethodId, authSession, authParamsPublicKey }>`. `accessToken` is **required**.
- `myAccount.enrollPasskey({ accessToken, authenticationMethodId, authSession, authResponse, authParamsPublicKey })` → `Promise<PasskeyAuthenticationMethod>` — a passkey-specific shape (`id`, `type`, `keyId`, `publicKey`, `userHandle`, `credentialDeviceType`, `aaguid`, `relyingPartyId`, …), **not** the generic `AuthenticationMethod` the other `enroll*` methods return.
- `myAccount` is a **property on `useAuth0()`** whose methods each take `accessToken`. It is **not** a `myAccount({ token })` factory (that is the browser SDKs' `@auth0/auth0-react` / nextjs shape) — don't construct a client; destructure it and pass the `/me/`-audience token into each call as shown.

## Ceremony library + native platform setup (required)

The SDK issues the challenge and exchanges the credential, but **does not run the WebAuthn ceremony** — you must add the ceremony step yourself, and the flow will not work without it:

- **Native:** add a passkey library to `package.json` `dependencies` — e.g. `react-native-passkey` (or a native module calling `ASAuthorizationController` on iOS / `CredentialManager` on Android). It consumes `authParamsPublicKey` and returns the `authResponse` string you pass into `getTokenByPasskey` / `enrollPasskey`. **Declare the dependency** — don't lazily `require()` it without adding it to `package.json`.
- **Web** (react-native-web): no library — call the browser's `navigator.credentials.create()` / `.get()` and pass the resulting `PublicKeyCredential` as `authResponse`.

Native platforms also need the verified custom domain wired as a relying party. Both bindings are mandatory — the OS silently refuses the ceremony without them:

- **iOS 16.6+** — Associated Domains entitlement containing `webcredentials:<your-custom-domain>` (e.g. `webcredentials:auth.example.com`), set in the target's `.entitlements` / Signing & Capabilities.
- **Android API 28+** — an `assetlinks.json` served at `https://<your-custom-domain>/.well-known/assetlinks.json` (App Links / Digital Asset Links) listing the app's package name and signing-cert SHA-256 fingerprint.

If the scaffold's constraints block creating the `.entitlements` or `assetlinks.json` artifact, **state the required capability in a code comment or the README** rather than silently dropping it — the relying-party binding is not optional, and omitting it is the most common reason a correctly-coded flow still fails at runtime.

## Error classes

- `PasskeyError` extends `AuthError` with a normalized string `.type` (plus `.code`, `.message`, and a `getMfaRequiredPayload()` method). Branch on `.type` to give the user a precise retry.
- The codes live in the exported `PasskeyErrorCodes` const object. String values: `PASSKEY_NOT_AVAILABLE`, `PASSKEY_CHALLENGE_FAILED`, `PASSKEY_EXCHANGE_FAILED`, `PASSKEY_INVALID_CREDENTIAL`, `PASSKEY_UNSUPPORTED_PLATFORM`, `PASSKEY_INVALID_PARAMETER`, `PASSKEY_MFA_REQUIRED`, `PASSKEY_UNKNOWN_ERROR`.

MFA: on **web**, a step-up surfaces as the typed `PASSKEY_MFA_REQUIRED` — call `getMfaRequiredPayload()` for `mfaToken` / `mfaRequirements` and continue with the MFA flow (see the hub, then `feature-mfa`). On native it is not surfaced as this typed code.

## SDK-specific gotchas

- The ceremony library and the iOS/Android relying-party binding are both required — see "Ceremony library + native platform setup" above.
- Carry the challenge's `authSession` into `getTokenByPasskey`.
- `authParamsPublicKey` is the WebAuthn options the ceremony consumes (typed `Record<string, any>`) — pass it through unchanged on both native and web.
- Enrollment mints its `/me/`-audience token via `getApiCredentials` off the session refresh token (the MRRT mechanism); without a refresh token that scoped token cannot be obtained.
