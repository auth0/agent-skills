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

Not `acr_values`/`max_age`. Configure the plugin with `useRefreshTokens` and `interactiveErrorHandler: 'popup'`; `getAccessTokenSilently` then opens a Universal Login popup automatically on `mfa_required`.

```js
app.use(createAuth0({
  domain: '...', clientId: '...',
  authorizationParams: { redirect_uri: window.location.origin },
  useRefreshTokens: true,
  interactiveErrorHandler: 'popup',
}));
```

Popup failures: `PopupOpenError`, `PopupCancelledError`, `PopupTimeoutError`.

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
