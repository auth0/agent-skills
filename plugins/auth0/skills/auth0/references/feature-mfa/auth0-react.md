# @auth0/auth0-react — MFA

**Minimum version:** 2.14.0 for the MFA API (no-redirect) flow; 2.15.0 for popup step-up. The MFA API flow requires Early Access enablement on the tenant.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md` — this file is the SDK's exact API.

This SDK offers two independent flows; pick one:

## Flow 1 — popup step-up (delegates the challenge to Universal Login)

This SDK does **not** trigger step-up with `acr_values`/`max_age`. Set `interactiveErrorHandler="popup"` (needs `useRefreshTokens`); `getAccessTokenSilently` then opens a Universal Login popup automatically on `mfa_required` and resolves the token once MFA completes.

```tsx
import { Auth0Provider } from '@auth0/auth0-react';

<Auth0Provider
  domain="YOUR_DOMAIN"
  clientId="YOUR_CLIENT_ID"
  authorizationParams={{ redirect_uri: window.location.origin, audience: 'https://api.example.com/' }}
  useRefreshTokens
  interactiveErrorHandler="popup"
>
  <App />
</Auth0Provider>
```

```tsx
const { getAccessTokenSilently } = useAuth0();
const token = await getAccessTokenSilently({
  authorizationParams: { audience: 'https://api.example.com/', scope: 'read:sensitive' },
});
```

Only `mfa_required` is intercepted; other token errors propagate. Popup failures throw `PopupOpenError`, `PopupCancelledError`, or `PopupTimeoutError` (all from `@auth0/auth0-react`).

## Flow 2 — MFA API (custom UI, no redirect)

`mfa` is destructured from `useAuth0()`. `getAccessTokenSilently` throws `MfaRequiredError` carrying `mfa_token` and `mfa_requirements`.

```tsx
import { useAuth0, MfaRequiredError } from '@auth0/auth0-react';
const { getAccessTokenSilently, mfa } = useAuth0();

try {
  await getAccessTokenSilently();
} catch (error) {
  if (error instanceof MfaRequiredError) {
    const mfaToken = error.mfa_token;
    // error.mfa_requirements.enroll → set up a factor; .challenge → user already enrolled
  }
}
```

- **Enroll:** `mfa.enroll({ mfaToken, factorType })` — `factorType` is `'otp' | 'sms' | 'email' | 'voice' | 'push'`. OTP returns `{ barcodeUri, recoveryCodes }`; `sms`/`voice` need `phoneNumber` (E.164), `email` needs `email`.
- **Challenge:** `mfa.challenge({ mfaToken, challengeType, authenticatorId })` — `challengeType` is `'otp'` or `'oob'` (all out-of-band). OTP can skip straight to verify; `oob` returns `{ oobCode }`.
- **List:** `mfa.getAuthenticators(mfaToken)`, `mfa.getEnrollmentFactors(mfaToken)`.
- **Verify:** `mfa.verify({ mfaToken, otp })`, `mfa.verify({ mfaToken, oobCode, bindingCode })`, or `mfa.verify({ mfaToken, recoveryCode })`. On success the SDK caches the tokens, so later `getAccessTokenSilently()` returns them.

Errors: `MfaEnrollmentError`, `MfaChallengeError`, `MfaVerifyError` (from `@auth0/auth0-react`).

Source: https://github.com/auth0/auth0-react/blob/main/EXAMPLES.md (Multi-Factor Authentication / Step-Up Authentication)
