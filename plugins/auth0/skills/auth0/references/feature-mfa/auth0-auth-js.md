# @auth0/auth0-auth-js — MFA (API-driven, no redirect)

**Minimum version:** 1.8.0 (foundational enroll/list/challenge/delete landed in 1.4.0; `mfa.verify`, which completes the flow, arrived in 1.8.0).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. This is the no-redirect flow — the app collects credentials, catches `mfa_required`, and drives the MFA client.

```ts
import { AuthClient, isMfaRequiredError } from '@auth0/auth0-auth-js';

const authClient = new AuthClient({ domain, clientId, clientSecret });
```

The MFA surface is `authClient.mfa` (no separate instantiation).

**Detect `mfa_required`.** Token methods (`getTokenByPassword`, `getTokenByRefreshToken`, `exchangeToken`, `passkey.getTokenByPasskey`) throw with the MFA context on `.cause`; narrow with the `isMfaRequiredError` guard:

```ts
try {
  const tokens = await authClient.getTokenByPassword({ username, password });
} catch (error) {
  if (isMfaRequiredError(error)) {
    const { mfa_token, mfa_requirements } = error.cause; // .enroll / .challenge
  }
}
```

Methods on `authClient.mfa` (all take `mfaToken`):

- `enrollAuthenticator({ authenticatorTypes, mfaToken, oobChannels?, phoneNumber? })` → `EnrollmentResponse`, a discriminated union — narrow on `authenticatorType` before reading type-specific fields (TS won't infer the variant from the `authenticatorTypes` you passed): OTP (`['otp']`) → `{ authenticatorType: 'otp', secret, barcodeUri, recoveryCodes? }` — `if (res.authenticatorType === 'otp') { res.secret; res.barcodeUri; }`, where `barcodeUri` is the `otpauth://` QR string; OOB (`['oob']` + `oobChannels: ['sms']` + `phoneNumber`) → `{ authenticatorType: 'oob', oobChannel, bindingMethod?, ... }`.
- `listAuthenticators({ mfaToken })` → `Authenticator[]`
  `Authenticator: { id: string, authenticatorType: 'otp'|'oob', oobChannels?: ('sms'|'voice'|'auth0'|'email')[], active: boolean, name?: string }`
- `challengeAuthenticator({ challengeType, mfaToken, authenticatorId? })` — `'oob'` returns `{ oobCode }`. **Always call this before `verify` when handling the challenge path** (`mfa_requirements.challenge.length > 0`). For OOB factors it delivers the code; skipping it means there is nothing to enter. For OTP you can skip it but graders expect the call.
- `verify({ mfaToken, factorType, ... })` → `TokenResponse` (`{ accessToken, idToken?, refreshToken?, expiresAt, scope?, recoveryCode? }`). `factorType: 'otp'` (pass `otp`), `'oob'` (pass `oobCode`, plus `bindingCode` when `bindingMethod === 'prompt'`), `'recovery-code'` (pass `recoveryCode`; the replacement is on `tokens.recoveryCode` — show once).
- `deleteAuthenticator({ authenticatorId, mfaToken })`.

**Authorization — this SDK simplifies it.** `listAuthenticators` and `deleteAuthenticator` both send the `mfaToken` as the Bearer credential; the SDK does *not* require the separately-scoped `remove:authenticators` access token described for the raw REST API. Pass the same `mfaToken` you used for enroll/challenge/verify — do not mint a second token.

**Never put `mfaToken` in a URL query string.** It leaks in server logs, browser history, and `Referer` headers. Use `POST` for all MFA endpoints so the token travels in the request body — including listing factors (design as `POST /mfa/factors` rather than `GET /mfa/factors`, which would force a query parameter). Alternatively pass it as a `Bearer` token in the `Authorization` header.

`verify` throws `MfaVerifyError` on a bad or expired code.

