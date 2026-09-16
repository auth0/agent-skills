# @auth0/auth0-vue — MFA

**Minimum version:** 2.6.0.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`.

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

The `Popup*Error` classes come from `@auth0/auth0-spa-js` (auth0-vue does not re-export them as values). Enforce `transfer:funds` on the API server-side — the client gate is UX only.

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

- `mfa.getAuthenticators(mfaToken)` — list enrolled.
- `mfa.getEnrollmentFactors(mfaToken)` — list enrollable factor types.
- `mfa.enroll({ mfaToken, factorType: 'otp' })` → `{ barcodeUri, secret }`; `factorType: 'sms'` needs `phoneNumber` (E.164).
- `mfa.challenge({ mfaToken, challengeType, authenticatorId })` → `{ oobCode }` for OOB (SMS/email).
- `mfa.verify({ mfaToken, otp })` / `({ mfaToken, oobCode, bindingCode })` / `({ mfaToken, recoveryCode })`.

**Critical:** `mfa.verify()` does not refresh reactive state. Always follow a successful verify with `await checkSession()` so `isAuthenticated`, `user`, and `idTokenClaims` update.

Errors: `MfaListAuthenticatorsError`, `MfaEnrollmentError`, `MfaChallengeError`, `MfaVerifyError`, `MfaEnrollmentFactorsError`.

Source: https://github.com/auth0/auth0-vue/blob/main/EXAMPLES.md (Multi-Factor Authentication / Step-Up Authentication)
