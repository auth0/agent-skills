# @auth0/auth0-server-js — MFA

**Minimum version:** 1.5.0. MFA is Early Access and requires **static domain** config (not available in resolver/MCD mode).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`.

Standard `ServerClient` with `transactionStore` + `stateStore`; the MFA sub-client is `serverClient.mfa` (present only on static-domain instances):

```ts
import { ServerClient, isMfaRequiredError } from '@auth0/auth0-server-js';
const serverClient = new ServerClient({ domain, clientId, clientSecret, transactionStore, stateStore });
```

**Detect MFA.** `getAccessToken(storeOptions)` throws; narrow with `isMfaRequiredError`, read `err.cause.mfa_token`:

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
- `enrollAuthenticator({ mfaToken, authenticatorTypes, oobChannels?, phoneNumber? })` → `OtpEnrollmentResponse` (`barcodeUri`, `secret`) or `OobEnrollmentResponse` (`oobCode`).
- `challengeAuthenticator({ mfaToken, challengeType, authenticatorId })` → `{ oobCode, bindingMethod }`; not needed for OTP.
- `verify(options, storeOptions?)` — `factorType: 'otp'` (pass `otp`), `'oob'` (pass `oobCode` + `bindingCode`), `'recovery-code'` (pass `recoveryCode`); optional `audience`. Returns `{ accessToken, idToken, refreshToken, recoveryCode? }`.

`verify()` persists tokens to the session store (like `completeInteractiveLogin`), so `getSession()`/`getUser()` reflect the authenticated state afterward — no manual write. There is no dedicated `amr` accessor; decode it from the ID token in the returned token set if needed. `getAccessToken(storeOptions)` returns a `TokenSet` (`accessToken`, `idToken`, `expiresAt`, `scope`).

`barcodeUri` is an `otpauth://` string — return it or render it client-side. Don't add a QR library server-side just to display it.

Errors: `isMfaRequiredError` (guard), `MfaListAuthenticatorsError`, `MfaEnrollmentError`, `MfaChallengeError`, `MfaVerifyError` — each exposes `cause.error` and `cause.error_description`.

Source: https://github.com/auth0/auth0-auth-js/blob/main/packages/auth0-server-js/MFA.md
