# @auth0/auth0-auth-js — MFA (API-driven, no redirect)

**Minimum version:** 1.8.0 (foundational enroll/list/challenge/delete landed in 1.4.0; `mfa.verify`, which completes the flow, arrived in 1.8.0).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`. This is the no-redirect flow — the app collects credentials, catches `mfa_required`, and drives the MFA client.

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

- `enrollAuthenticator({ authenticatorTypes, mfaToken, oobChannels?, phoneNumber? })` — OTP: `['otp']` → `{ secret, barcodeUri }`; OOB: `['oob']` + `oobChannels: ['sms']` + `phoneNumber`.
- `listAuthenticators({ mfaToken })` → `Authenticator[]`.
- `challengeAuthenticator({ challengeType, mfaToken, authenticatorId? })` — `'oob'` returns `{ oobCode }`.
- `verify({ mfaToken, factorType, ... })` → tokens. `factorType: 'otp'` (pass `otp`), `'oob'` (pass `oobCode`, plus `bindingCode` when `bindingMethod === 'prompt'`), `'recovery-code'` (pass `recoveryCode`; the replacement is on `tokens.recoveryCode` — show once).
- `deleteAuthenticator({ authenticatorId, mfaToken })`.

**Authorization — this SDK simplifies it.** `listAuthenticators` and `deleteAuthenticator` both send the `mfaToken` as the Bearer credential; the SDK does *not* require the separately-scoped `remove:authenticators` access token that `index.md`'s "MFA API surface" describes for the raw REST API. Pass the same `mfaToken` you used for enroll/challenge/verify — do not mint a second token. (The raw-API note in `index.md` applies to hand-rolled `DELETE /mfa/authenticators/{id}` calls, which you should not write when using this SDK.)

`verify` throws `MfaVerifyError` on a bad or expired code.

Source: https://github.com/auth0/auth0-auth-js/blob/main/packages/auth0-auth-js/examples/mfa.md
