# Auth0.swift — MFA (API-driven)

**Minimum version:** verify — 3.0+. The `Auth0.mfa()` / `MfaClient` flexible-factors API is a 3.0 introduction (3.0.1/3.0.2 ship fixes to its types); the pre-3.0 MFA methods on `AuthenticationClient` were removed in 3.0.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. `Auth0`, `MfaClient`, and all MFA types ship in the single `Auth0` module — no submodule import.

```swift
import Auth0
```

**Detect `mfa_required`.** Call `Auth0.authentication().login(usernameOrEmail:password:realmOrConnection:audience:scope:)`; it fails with `AuthenticationError`. Check `isMultifactorRequired` and read the payload (`MFARequiredErrorPayload`):

```swift
Auth0.authentication()
    .login(usernameOrEmail: email, password: password,
           realmOrConnection: "Username-Password-Authentication",
           audience: "https://api.example.com", scope: "openid profile email")
    .start { result in
        guard case .failure(let error) = result, error.isMultifactorRequired,
              let payload = error.mfaRequiredErrorPayload else { return }
        let mfaToken = payload.mfaToken
        // payload.mfaRequirements.enroll / .challenge — [MFAFactor], each with .type
    }
```

**MFA client:** `Auth0.mfa()` (uses `Auth0.plist`) or `Auth0.mfa(session:)`. Returns `MfaClient`; `.domain(_:)` / `.clientId(_:)` modifiers available when not using the plist. All calls return `Request<T>` — finish with `.start { }`, `await .start()`, or the Combine publisher.

```swift
// List -> Request<[Authenticator]>
//   Authenticator: .id, .type ("otp"|"phone"|"email"…), .authenticatorType?, .oobChannel?, .active, .name?
.getAuthenticators(mfaToken: String, factorsAllowed: [String])
// Enroll: OTP -> Request<OTPMFAEnrollmentChallenge> (.secret, .barcodeUri, .recoveryCodes?)
//         phone/email -> Request<MFAEnrollmentChallenge>
.enroll(mfaToken: String)                       // OTP (separate push overload)
.enroll(mfaToken: String, phoneNumber: String)  // SMS / voice
.enroll(mfaToken: String, email: String)        // email
// Challenge an enrolled factor -> Request<MFAChallenge>
//   MFAChallenge: .challengeType, .oobCode (non-optional), .bindingMethod?
.challenge(with authenticatorId: String, mfaToken: String)
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

