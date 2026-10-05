# react-native-auth0 — Passkeys

**Minimum version:** `5.7.0` (the passkey methods on the `useAuth0()` hook / `Auth0` client). Requires **iOS 16.6+**, **Android API 28+**, or a WebAuthn-capable browser; native platforms need Associated Domains (iOS) / Digital Asset Links (Android) on the custom domain.

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

react-native-auth0 is **low-level for the challenge**: it returns the challenge, the native module runs the WebAuthn ceremony, and `getTokenByPasskey()` exchanges the credential for `Credentials`. It also exposes passkey **enrollment** via the My Account API.

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

// --- native module runs the WebAuthn ceremony with authParamsPublicKey ---

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

## Enrollment (add a passkey — My Account API)

Requires an access token with `create:me:authentication_methods`, minted for the `https://{yourDomain}/me/` audience via `getApiCredentials(...)` (fetching a token for that different audience from the session refresh token is the MRRT mechanism — see the hub's Enrollment section):

```tsx
const { myAccount } = useAuth0();

// 1. Enrollment challenge (accessToken REQUIRED)
const challenge = await myAccount.passkeyEnrollmentChallenge({
  accessToken,        // the /me/-audience token
  // userIdentity?, connection? optional
});

// 2. Native module runs the WebAuthn registration ceremony

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

## Error classes

- `PasskeyError` extends `AuthError` with a normalized string `.type` (plus `.code`, `.message`, and a `getMfaRequiredPayload()` method). Branch on `.type` to give the user a precise retry.
- The codes live in the exported `PasskeyErrorCodes` const object. String values: `PASSKEY_NOT_AVAILABLE`, `PASSKEY_CHALLENGE_FAILED`, `PASSKEY_EXCHANGE_FAILED`, `PASSKEY_INVALID_CREDENTIAL`, `PASSKEY_UNSUPPORTED_PLATFORM`, `PASSKEY_INVALID_PARAMETER`, `PASSKEY_MFA_REQUIRED`, `PASSKEY_UNKNOWN_ERROR`.

MFA: on **web**, a step-up surfaces as the typed `PASSKEY_MFA_REQUIRED` — call `getMfaRequiredPayload()` for `mfaToken` / `mfaRequirements` and continue with the MFA flow (see the hub, then `feature-mfa`). On native it is not surfaced as this typed code.

## SDK-specific gotchas

- Native platforms need Associated Domains (iOS) / Digital Asset Links (Android) pointed at the verified custom domain.
- Carry the challenge's `authSession` into `getTokenByPasskey`.
- `authParamsPublicKey` is the WebAuthn options the native ceremony consumes (typed `Record<string, any>`) — pass it through unchanged.
- Enrollment mints its `/me/`-audience token via `getApiCredentials` off the session refresh token (the MRRT mechanism); without a refresh token that scoped token cannot be obtained.
