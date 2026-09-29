# Auth0.swift — Passkeys

**Minimum version:** passkey signup/login via the Authentication API shipped in **`2.12.0`**; `organization` support in **`2.14.0`**; optional additional signup properties (e.g. `userMetadata`) in **`2.20.0`**; My Account passkey **enrollment** in **`2.13.0`**. Requires **iOS 16.6+ / macOS 13.5+ / visionOS 1.0+** and the **Associated Domains** capability (`webcredentials:{yourCustomDomain}`).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

Auth0.swift is **high-level for the token exchange** but you drive the platform WebAuthn ceremony with Apple's `AuthenticationServices` (`ASAuthorizationPlatformPublicKeyCredentialProvider`). The pattern: **Auth0 challenge → Apple ceremony → Auth0 login with the credential**.

## Signup

```swift
import Auth0
import AuthenticationServices

// 1. Signup challenge
let challenge = try await Auth0
    .authentication()
    .passkeySignupChallenge(email: "user@example.com",
                            name: "Jane Doe",
                            connection: "Username-Password-Authentication")
// challenge: relyingPartyId, challengeData, userName, userId, authenticationSession

// 2. Apple registration ceremony
let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
    relyingPartyIdentifier: challenge.relyingPartyId)
let request = provider.createCredentialRegistrationRequest(
    challenge: challenge.challengeData,
    name: challenge.userName,
    userID: challenge.userId)
// run request via ASAuthorizationController → newPasskey credential

// 3. Exchange for Credentials
let credentials = try await Auth0
    .authentication()
    .login(passkey: newPasskey,
           challenge: challenge,
           connection: "Username-Password-Authentication",
           // audience:, organization: also available
           scope: "openid profile email offline_access")
```

## Login

```swift
// 1. Login challenge
let challenge = try await Auth0
    .authentication()
    .passkeyLoginChallenge(connection: "Username-Password-Authentication")
    // organization: optional
// challenge: relyingPartyId, challengeData, authenticationSession

// 2. Apple assertion ceremony
let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
    relyingPartyIdentifier: challenge.relyingPartyId)
let request = provider.createCredentialAssertionRequest(
    challenge: challenge.challengeData)
// run request via ASAuthorizationController → passkey assertion

// 3. Exchange for Credentials
let credentials = try await Auth0
    .authentication()
    .login(passkey: assertion,
           challenge: challenge,
           connection: "Username-Password-Authentication",
           // audience:, organization: also available
           scope: "openid profile email offline_access")
```

Both calls use `login(passkey:challenge:connection:audience:scope:organization:)` (all but `passkey` and `challenge` optional) and return `Credentials`.

## Enrollment (add a passkey to a signed-in account — My Account API)

The user is already logged in. Enrollment runs the **same Apple registration ceremony as signup** but goes through the My Account API client with a My-Account-scoped token — it does **not** mint a new `Credentials`.

```swift
import Auth0
import AuthenticationServices

// 1. Exchange the stored credentials for a My-Account-audience token.
let apiCredentials = try await credentialsManager.apiCredentials(
    forAudience: "https://\(domain)/me",
    scope: "create:me:authentication_methods")

// 2. Enrollment challenge via the My Account API client.
let myAccount = Auth0.myAccount(token: apiCredentials.accessToken)
let challenge = try await myAccount
    .authenticationMethods
    .passkeyEnrollmentChallenge()
// challenge: relyingPartyId, challengeData, userName, userId, authenticationSession

// 3. Apple registration ceremony (create) — same as signup.
let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
    relyingPartyIdentifier: challenge.relyingPartyId)
let request = provider.createCredentialRegistrationRequest(
    challenge: challenge.challengeData,
    name: challenge.userName,
    userID: challenge.userId)
// run request via ASAuthorizationController → newPasskey credential

// 4. Complete enrollment against the signed-in account.
let method = try await myAccount
    .authenticationMethods
    .enroll(passkey: newPasskey, challenge: challenge)
```

- `credentialsManager.apiCredentials(forAudience:scope:)` mints the `https://<domain>/me` token with `create:me:authentication_methods` — not the plain login access token.
- `Auth0.myAccount(token:)` → `.authenticationMethods.passkeyEnrollmentChallenge(...)` → the challenge; `.enroll(passkey:challenge:)` completes it. No new `Credentials` are returned.

## SDK-specific gotchas

- The **Associated Domains** entitlement (`webcredentials:{yourCustomDomain}`) must point at the verified custom domain; without it the OS refuses the ceremony.
- Store the returned `Credentials` via `CredentialsManager` for reuse.
- The `connection` must be a database connection with the passkey authentication method enabled.
- `login(passkey:...)` can throw when the tenant requires MFA — continue with the MFA flow (see the hub, then `feature-mfa`).
