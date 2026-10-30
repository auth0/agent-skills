# react-native-auth0 — MFA (API-driven, Flexible Factors Grant)

**Minimum version:** 5.10.0+. The `mfa` sub-client API landed in v5.10.0; the legacy direct step-up methods `authorizeWithOTP`, `authorizeWithOOB`, `authorizeWithRecoveryCode`, and `sendMultifactorChallenge` (exposed on the hook, NOT on `mfa`) were deprecated in v5.11.0 in favour of the `mfa.*` client. Early Access — enable the MFA grant type in Dashboard → Applications → Advanced Settings → Grant Types (contact your Auth0 rep first).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference.

**Detect `mfa_required`.** Catch the `AuthError` thrown by `loginWithPasswordRealm()`. There is no dedicated class for the `mfa_required` condition on the native path — inspect the error directly. The condition is signalled by `error.code === 'mfa_required'` (or `error.json.error === 'mfa_required'`), and the `mfa_token` is at `error.json.mfa_token`:

```typescript
import { useAuth0 } from 'react-native-auth0';

const { loginWithPasswordRealm, mfa } = useAuth0();

try {
  await loginWithPasswordRealm({
    username: email,
    password,
    realm: 'Username-Password-Authentication',
    audience: 'https://api.example.com',
    scope: 'openid profile email',
  });
  // loginWithPasswordRealm persists credentials automatically before it resolves.
} catch (error: any) {
  if (error?.code === 'mfa_required' || error?.json?.error === 'mfa_required') {
    const mfaToken: string = error.json.mfa_token;
    // proceed to challenge or enroll
  }
}
```

**MFA client:** `const { mfa } = useAuth0()` (or `auth0.mfa` on the class). All MFA operations go through this sub-client.

- **List authenticators:** `mfa.getAuthenticators({ mfaToken, factorsAllowed? })` → `MfaAuthenticator[]`. Each entry: `{ id, authenticatorType, active: boolean, oobChannel? }`. If `active === true`, the factor is enrolled and ready to challenge; if none are active, proceed to enroll.
- **Challenge an enrolled authenticator:** `mfa.challenge({ mfaToken, authenticatorId })` → `{ challengeType, oobCode?, bindingMethod? }`. Always challenge before verifying an enrolled out-of-band factor — the challenge is what delivers the code.
- **Enroll a new authenticator:** `mfa.enroll({ mfaToken, factorType: 'otp' | 'sms' | 'email' | 'push', phoneNumber?, email? })` → enrollment challenge. TOTP: `{ barcodeUri, secret, recoveryCodes? }`; OOB: `{ oobCode }`.
- **Verify → `Credentials`:**
  - OTP: `mfa.verify({ mfaToken, otp })`
  - OOB: `mfa.verify({ mfaToken, oobCode, bindingCode? })`
  - Recovery code: `mfa.verify({ mfaToken, recoveryCode })`

Enrolled factor — always `challenge` before `verify`. For OOB (SMS/email/push) the challenge delivers the code to the user, so skipping it leaves nothing to submit:

```typescript
const { mfa } = useAuth0();

// 1. List enrolled authenticators
const authenticators = await mfa.getAuthenticators({ mfaToken });

const activeAuthenticator = authenticators.find(a => a.active);

if (!activeAuthenticator) {
  // No active factor — enroll first (TOTP example)
  const enrollment = await mfa.enroll({ mfaToken, factorType: 'otp' });
  // enrollment.barcodeUri is the QR code URI to render
  // enrollment.secret is the manual entry key
  // After user scans and enters their first OTP:
  const credentials = await mfa.verify({ mfaToken, otp: userEnteredCode });
} else {
  // 2. Challenge the enrolled factor
  const challenge = await mfa.challenge({
    mfaToken,
    authenticatorId: activeAuthenticator.id,
  });

  // 3. Verify with the code from the challenge
  let credentials;
  if (challenge.challengeType === 'otp') {
    credentials = await mfa.verify({ mfaToken, otp: userEnteredCode });
  } else {
    // OOB (SMS / email / push)
    credentials = await mfa.verify({
      mfaToken,
      oobCode: challenge.oobCode!,
      bindingCode: userEnteredCode,
    });
  }

  // mfa.verify() via the hook persists the returned Credentials automatically before it resolves —
  // no manual save needed. To persist explicitly (e.g. when driving the raw client), use the hook's
  // top-level saveCredentials(credentials); there is no credentialsManager on the hook.
}
```

**Security:** `oobCode` is ephemeral — keep it in component state only for the duration of the challenge/verify exchange, never persisted. The hook persists the final `Credentials` for you when you use `mfa.verify()` (or `loginWithPasswordRealm()`); if you persist explicitly, use the hook's top-level `saveCredentials()`, never local storage or AsyncStorage.

**Do NOT use** the deprecated direct step-up methods on the hook (`authorizeWithOTP`, `authorizeWithOOB`, `authorizeWithRecoveryCode`, `sendMultifactorChallenge`) — deprecated in v5.11.0 in favour of the `mfa.*` client.

**Note on `amr`/`acr`:** these claims are not exposed on the `Auth0User` object returned by the hook. They are available only in `idTokenProtocolClaims` if you need them. Do not check `user.amr` — it will be `undefined`.
