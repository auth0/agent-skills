# @auth0/auth0-react — MFA

**Minimum version:** 2.14.0 for the MFA API (no-redirect) flow; 2.15.0 for popup step-up. The MFA API flow requires Early Access enablement on the tenant.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference — this file is the SDK's exact API.

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

- **List:** `mfa.getAuthenticators(mfaToken)` → `Authenticator[]`
  `Authenticator: { id: string, authenticatorType: 'otp'|'oob', oobChannel?: 'sms'|'voice'|'auth0'|'email', active: boolean, name?: string }`
- **Enrollment options:** `mfa.getEnrollmentFactors(mfaToken)` → `EnrollmentFactor[]` — each has `{ type: string }` (`'otp'`, `'sms'`, `'email'`, etc.).
- **Enroll:** `mfa.enroll({ mfaToken, factorType })` — `factorType`: `'otp'|'sms'|'email'|'voice'|'push'`. Returns:
  - OTP → `{ barcodeUri: string, secret: string, recoveryCodes?: string[] }`
  - OOB → `{ oobCode: string }` (`sms`/`voice` need `phoneNumber` E.164, `email` needs `email`)
- **Challenge:** `mfa.challenge({ mfaToken, challengeType: 'oob', authenticatorId })` → `{ oobCode: string }` (delivers the OOB code); not needed for OTP.
- **Verify:** `mfa.verify({ mfaToken, otp: string })`, `mfa.verify({ mfaToken, oobCode, bindingCode? })`, or `mfa.verify({ mfaToken, recoveryCode })` → token data (cached in SDK; later `getAccessTokenSilently()` returns them). When `recoveryCode` is used, the return value may include a new `recovery_code` — show it to the user once.

Errors: `MfaEnrollmentError`, `MfaChallengeError`, `MfaVerifyError` (from `@auth0/auth0-react`).
