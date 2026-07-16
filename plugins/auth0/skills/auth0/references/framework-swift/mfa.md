# Auth0 Swift — MFA (Multi-Factor Authentication)

Handle a step-up / second-factor challenge when Web Auth or the Authentication
API reports that multi-factor authentication is required.

> **Context (self-contained):** The `mfaToken` comes from an
> `AuthenticationError` where `error.isMultifactorRequired == true` — read it
> via `error.mfaRequiredErrorPayload?.mfaToken`. After a successful challenge,
> store the returned `Credentials` with
> `CredentialsManager(authentication: Auth0.authentication())` via
> `store(credentials:)`, exactly as in the standard login flow.

## MFA (Multi-Factor Authentication)

### Handling MFA Required Error

```swift
// When login returns isMultifactorRequired = true, challenge with OTP
func verifyMFA(mfaToken: String, otp: String) async throws -> Credentials {
    return try await Auth0
        .authentication()
        .multifactorChallenge(mfaToken: mfaToken, types: ["otp"])
        .start()
}
```

