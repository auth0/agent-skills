# @auth0/auth0-server-js — MFA

**Minimum version:** 1.5.0. MFA is Early Access and requires **static domain** config (not available in resolver/MCD mode).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`.

Standard `ServerClient` with `transactionStore` + `stateStore`; the MFA sub-client is `serverClient.mfa` (present only on static-domain instances):

```ts
import { ServerClient, isMfaRequiredError } from '@auth0/auth0-server-js';
const serverClient = new ServerClient({ domain, clientId, clientSecret, transactionStore, stateStore });
```

**Methods that raise `MfaRequiredError`.** This SDK has **one** entry point for MFA: `getAccessToken`. There is no `loginWithCredentials` or `getTokenByPassword` in `@auth0/auth0-server-js` — those belong to `@auth0/auth0-auth-js` (a different SDK). The user is already signed in via Universal Login; MFA is step-up triggered when the resource server signals it. Narrow the error with `isMfaRequiredError`, read `err.cause.mfa_token`:

```ts
try {
  const tokenSet = await serverClient.getAccessToken(storeOptions);
} catch (err) {
  if (isMfaRequiredError(err)) {
    const mfaToken = err.cause.mfa_token;
  }
}
```

Methods on `serverClient.mfa`:

- `listAuthenticators({ mfaToken })` → `Authenticator[]` (`id`, `authenticatorType`: `'otp'`/`'oob'`/`'recovery-code'`, `active`, `oobChannels`).
- `enrollAuthenticator({ mfaToken, authenticatorTypes, oobChannels?, phoneNumber? })` → `OtpEnrollmentResponse` (`barcodeUri`, `secret`, `recoveryCodes?: string[]`) or `OobEnrollmentResponse` (`oobCode`). First-enrollment recovery codes come from `recoveryCodes` here — render them alongside `barcodeUri` in the HTTP response; they are not returned by `verify()`. **Never store `barcodeUri`, `secret`, or `recoveryCodes` in a cookie, session, or any persistent store** — return them in the response once and discard. Only `mfaToken` (and a `returnTo` redirect target) need to be kept in a short-lived httpOnly cookie to resume the flow.
- `challengeAuthenticator({ mfaToken, challengeType, authenticatorId })` → `{ oobCode, bindingMethod }`; not needed for OTP.
- `verify(options, storeOptions?)` — `options` always includes `mfaToken`, plus one factor branch: `{ mfaToken, factorType: 'otp', otp, audience? }`, `{ mfaToken, factorType: 'oob', oobCode, bindingCode?, audience? }`, or `{ mfaToken, factorType: 'recovery-code', recoveryCode, audience? }`. Returns `MfaVerifyResponse` (`{ accessToken, idToken?, refreshToken?, tokenType, expiresAt, scope?, recoveryCode? }`); `recoveryCode` on the response is a *replacement* code set only when `factorType: 'recovery-code'`, never on OTP/OOB verifies.

`verify()` persists tokens to the session store (like `completeInteractiveLogin`), so `getSession()`/`getUser()` reflect the authenticated state afterward — no manual write. There is no dedicated `amr` accessor; decode it from the ID token in the returned token set if needed. `getAccessToken(storeOptions)` returns a `TokenSet` (`accessToken`, `idToken`, `expiresAt`, `scope`).

**`barcodeUri` is a plain `otpauth://` string** — return it in the API response exactly as-is. The client can pass it to any QR library or display it as text. **Do not install `qrcode`, `qrcode-terminal`, or any QR library on the server** — you do not need to generate a QR image server-side, and the scaffold does not include those packages.

**All type shapes and method names above are accurate for auth0-server-js 1.5.0 — do not read node_modules or @types packages to verify them.**

Errors: `isMfaRequiredError` (guard), `MfaListAuthenticatorsError`, `MfaEnrollmentError`, `MfaChallengeError`, `MfaVerifyError` — each exposes `cause.error` and `cause.error_description`.

Source: https://github.com/auth0/auth0-auth-js/blob/main/packages/auth0-server-js/MFA.md
