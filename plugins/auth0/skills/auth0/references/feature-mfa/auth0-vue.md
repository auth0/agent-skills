# @auth0/auth0-vue — MFA

**Minimum version:** 2.6.0.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference.

Access everything through `useAuth0()` (Composition API) or `this.$auth0` (Options API):

```ts
import { useAuth0, MfaRequiredError } from '@auth0/auth0-vue';
const { getAccessTokenSilently, mfa, checkSession } = useAuth0();
```

Two independent flows; pick one.

## Flow 1 — popup step-up

Not `acr_values`/`max_age`. Configure the plugin with `useRefreshTokens` and `interactiveErrorHandler: 'popup'`; `getAccessTokenSilently` then opens a Universal Login popup automatically on `mfa_required` and resolves once MFA completes — you never catch `mfa_required` yourself.

```js
app.use(createAuth0({
  domain: '...', clientId: '...',
  authorizationParams: { redirect_uri: window.location.origin },
  useRefreshTokens: true,
  interactiveErrorHandler: 'popup',
}));
```

**Trigger:** the step-up fires when you request an API `audience` (plus the high-value `scope`) that a post-login Action gates behind MFA — there is no acr/max_age here. Gate the sensitive action on the token call, then proceed only after it resolves:

```ts
import { PopupCancelledError, PopupTimeoutError, PopupOpenError } from '@auth0/auth0-spa-js';

async function transferFunds() {
  try {
    // popup opens automatically if MFA is required; resolves with a stepped-up token
    await getAccessTokenSilently({
      authorizationParams: { audience: 'https://api.example.com', scope: 'transfer:funds' },
    });
  } catch (e) {
    if (e instanceof PopupCancelledError || e instanceof PopupTimeoutError || e instanceof PopupOpenError) {
      return; // user closed/blocked the popup or it timed out — abort, do not proceed
    }
    throw e;
  }
  await doTransfer(); // only reached after step-up succeeded
}
```

The `Popup*Error` classes come from `@auth0/auth0-spa-js` (auth0-vue does not re-export them as values); `@auth0/auth0-spa-js` is a direct dependency of `@auth0/auth0-vue`, so it is always installed alongside it — import from it directly, no need to add it to `package.json` or check `node_modules`. Enforce `transfer:funds` on the API server-side — the client gate is UX only.

## Flow 2 — MFA API (custom UI)

Needs `useRefreshTokens: true`. `getAccessTokenSilently` throws `MfaRequiredError` with `mfa_token` and `mfa_requirements`:

```ts
try {
  await getAccessTokenSilently({ authorizationParams: { audience: '...' } });
} catch (e) {
  if (e instanceof MfaRequiredError) {
    const mfaToken = e.mfa_token;
    const needsEnroll = e.mfa_requirements?.enroll?.length;
  }
}
```

Methods on `mfa` (each takes `mfaToken`):

- `mfa.getAuthenticators(mfaToken)` → `Authenticator[]`
  `Authenticator: { id: string, authenticatorType: 'otp'|'oob', oobChannel?: 'sms'|'voice'|'auth0'|'email', active: boolean, name?: string }`
- `mfa.getEnrollmentFactors(mfaToken)` → `EnrollmentFactor[]` — each has `{ type: string }` indicating an enrollable factor (`'otp'`, `'sms'`, `'email'`, etc.).
- `mfa.enroll({ mfaToken, factorType: 'otp' })` → `{ barcodeUri: string, secret: string, recoveryCodes?: string[] }`; `factorType: 'sms'`/`'voice'` needs `phoneNumber` (E.164) → `{ oobCode: string }`.
- `mfa.challenge({ mfaToken, challengeType: 'oob', authenticatorId })` → `{ oobCode: string }` (delivers the OOB code); not needed for OTP.
- `mfa.verify({ mfaToken, otp: string })` / `({ mfaToken, oobCode, bindingCode? })` / `({ mfaToken, recoveryCode })` → token data (cached in SDK). When `recoveryCode` is used, the return value may include a new `recovery_code` — show it to the user once.

**Critical:** `mfa.verify()` does not refresh reactive state. Always follow a successful verify with `await checkSession()` so `isAuthenticated`, `user`, and `idTokenClaims` update.

Errors: `MfaListAuthenticatorsError`, `MfaEnrollmentError`, `MfaChallengeError`, `MfaVerifyError`, `MfaEnrollmentFactorsError`.

