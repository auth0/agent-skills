# Auth0.swift — MFA (API-driven)

**Minimum version:** verify — 3.0+. The `Auth0.mfa()` / `MfaClient` flexible-factors API is a 3.0 introduction (3.0.1/3.0.2 ship fixes to its types); the pre-3.0 MFA methods on `AuthenticationClient` were removed in 3.0.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`. `Auth0`, `MfaClient`, and all MFA types ship in the single `Auth0` module — no submodule import.

```swift
import Auth0
```

**Detect `mfa_required`.** `login(…)` fails with `AuthenticationError`; check `isMultifactorRequired`, read the payload:

```swift
case .failure(let error) where error.isMultifactorRequired:
    guard let payload = error.mfaRequiredErrorPayload else { return }
    let mfaToken = payload.mfaToken
    // payload.mfaRequirements.enroll / .challenge — [MfaRequirement], each with .type ("otp","phone","push-notification")
```

**MFA client:** `Auth0.mfa()` (uses `Auth0.plist`) or `Auth0.mfa(session:)`. Returns `MfaClient`; `.domain(_:)` / `.clientId(_:)` modifiers available when not using the plist. All calls return `Request<T>` — finish with `.start { }`, `await .start()`, or the Combine publisher.

```swift
// List
.getAuthenticators(mfaToken: String, factorsAllowed: [String]) -> Request<[MFAAuthenticator]>
// Enroll
.enroll(mfaToken: String)                       // OTP / push -> Request<MFAChallenge>
.enroll(mfaToken: String, phoneNumber: String)  // SMS
.enroll(mfaToken: String, email: String)        // email
// Challenge an enrolled factor
.challenge(with authenticatorId: String, mfaToken: String) -> Request<MFAChallenge>
//   MFAChallenge: .challengeType ("oob"|"otp"), .oobCode, .barcodeUri, .secret
// Verify -> Request<Credentials>
.verify(otp: String, mfaToken: String)
.verify(oobCode: String, bindingCode: String?, mfaToken: String)
.verify(recoveryCode: String, mfaToken: String)
```

Example (challenge an enrolled factor, callback style):

```swift
Auth0.mfa()
    .getAuthenticators(mfaToken: mfaToken, factorsAllowed: factorsAllowed)
    .start { result in
        guard case .success(let authenticators) = result, let first = authenticators.first else { return }
        Auth0.mfa().challenge(with: first.id, mfaToken: mfaToken).start { _ in /* route on challengeType */ }
    }
```

Errors (all conform to `Auth0APIError`, with `.code`, `.statusCode`, `.isNetworkError`, `.isRetryable`, `.cause`): `MfaListAuthenticatorsError`, `MfaEnrollmentError`, `MfaChallengeError`, `MFAVerifyError`. At the login stage: `isMultifactorRequired`, `isMultifactorEnrollRequired`, `isMultifactorCodeInvalid`, `isMultifactorTokenInvalid`.

Source: https://github.com/auth0/Auth0.swift/blob/master/examples/mfa-api.md
