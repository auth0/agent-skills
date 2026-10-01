# Auth0.Android — Passkeys

**Minimum version:** `3.2.0` (passkey methods on `AuthenticationAPIClient`; base passkey support landed in `3.1.0`). Caveats: `realm` was **required** in `3.2.0` and became optional in `3.2.1`; the `organization` parameter for passkeys landed in `3.9.0` — at `3.2.0` it does not exist. Requires **Android API 28+** and a verified **Digital Asset Links** file (`assetlinks.json`) on the custom domain.

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

Auth0.Android is **high-level for the token exchange**; you drive the platform WebAuthn ceremony with AndroidX **Credential Manager** (`androidx.credentials.CredentialManager`). Pattern: **Auth0 challenge → Credential Manager ceremony → Auth0 signin/signup with the credential**.

## Signup

```kotlin
val authentication = AuthenticationAPIClient(account)

// signupWithPasskey(userData: UserData, realm: String? = null, organization: String? = null)
//   → Request<PasskeyRegistrationChallenge, AuthenticationException>
authentication
    .signupWithPasskey(userData, "{realm}")   // organization requires SDK 3.9.0+
    .start(object : Callback<PasskeyRegistrationChallenge, AuthenticationException> {
        override fun onSuccess(challenge: PasskeyRegistrationChallenge) {
            // challenge.authSession: String, challenge.authParamsPublicKey
            // Credential Manager registration ceremony:
            //   credentialManager.createCredential(context, createRequest) → PublicKeyCredentials
            authentication
                .signinWithPasskey(challenge.authSession, publicKeyCredentials, "{realm}")
                .start(/* Callback<Credentials, AuthenticationException> */)
        }
        override fun onFailure(error: AuthenticationException) { /* ... */ }
    })
```

`userData` is a `UserData` object (not a Map).

## Login

```kotlin
// passkeyChallenge(realm: String? = null, organization: String? = null)
//   → Request<PasskeyChallenge, AuthenticationException>
authentication
    .passkeyChallenge("{realm}")   // organization requires SDK 3.9.0+
    .start(object : Callback<PasskeyChallenge, AuthenticationException> {
        override fun onSuccess(challenge: PasskeyChallenge) {
            // challenge.authSession: String, challenge.authParamsPublicKey
            // Credential Manager assertion ceremony:
            //   credentialManager.getCredential(context, getRequest) → PublicKeyCredentials
            authentication
                .signinWithPasskey(challenge.authSession, publicKeyCredentials, "{realm}")
                .start(/* Callback<Credentials, AuthenticationException> */)
        }
        override fun onFailure(error: AuthenticationException) { /* ... */ }
    })
```

- `signupWithPasskey(userData, realm?, organization?)` → `Request<PasskeyRegistrationChallenge, …>`.
- `passkeyChallenge(realm?, organization?)` → `Request<PasskeyChallenge, …>`.
- `signinWithPasskey(authSession, authResponse: PublicKeyCredentials, realm?, organization?)` → `AuthenticationRequest`; `.start` delivers `Credentials`.

## SDK-specific gotchas

- The **Digital Asset Links** file must be published and verified on the custom domain, or Credential Manager refuses the ceremony.
- Use `CredentialManager.createCredential()` for signup and `getCredential()` for login — do not cross them; both yield a `PublicKeyCredentials`.
- The `organization` param name is `organization` (not `organizationId`) and needs SDK 3.9.0+.
- Persist the returned `Credentials` via `CredentialsManager`.
- `signinWithPasskey()` can fail with an MFA-required error — continue with the MFA flow (see the hub, then `feature-mfa`).
- The `account` must be configured with the verified custom domain.
