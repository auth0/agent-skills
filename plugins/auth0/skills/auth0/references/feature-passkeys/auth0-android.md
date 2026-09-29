# Auth0.Android — Passkeys

**Minimum version:** `4.0.0`. Passkey methods landed on `AuthenticationAPIClient` in `3.2.0` and My Account passkey **enrollment** in `3.8.0`, but the old `PasskeyAuthProvider` / `PasskeyProvider` / `PasskeyManager` wrappers were **removed in `4.0.0`** — target `4.0.0` so the current path (`AuthenticationAPIClient` + `MyAccountAPIClient` + AndroidX CredentialManager) is unambiguous. `realm` became optional in `3.2.1`; the `organization` parameter landed in `3.9.0`. Requires **Android API 28+** and a verified **Digital Asset Links** file (`assetlinks.json`) on the custom domain.

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

Auth0.Android is **high-level for the token exchange**; you drive the platform WebAuthn ceremony with AndroidX **Credential Manager** (`androidx.credentials.CredentialManager`). Pattern: **Auth0 challenge → Credential Manager ceremony → Auth0 signin/signup/enroll with the credential**.

## Login (assertion / get)

```kotlin
val authentication = AuthenticationAPIClient(account)

// passkeyChallenge(realm: String? = null, organization: String? = null)
//   → Request<PasskeyChallenge, AuthenticationException>
val challenge = authentication.passkeyChallenge("{realm}").await()

// Credential Manager assertion ceremony (get):
val option = GetPublicKeyCredentialOption(Gson().toJson(challenge.authParamsPublicKey))
val request = GetCredentialRequest(listOf(option))
val result = credentialManager.getCredential(context, request)
val authResponse = (result.credential as PublicKeyCredential).authenticationResponseJson

// signinWithPasskey(authSession, authResponse, realm?, organization?) → AuthenticationRequest
val credentials = authentication
    .signinWithPasskey(challenge.authSession, authResponse, "{realm}")
    .validateClaims()          // REQUIRED — without it ID-token claim validation is silently skipped
    .await()
secureCredentialsManager.saveCredentials(credentials)
```

## Signup (registration / create)

```kotlin
// signupWithPasskey(userData: UserData, realm?, organization?)
//   → Request<PasskeyRegistrationChallenge, AuthenticationException>
val challenge = authentication.signupWithPasskey(userData, "{realm}").await()   // userData is a UserData, not a Map

// Credential Manager registration ceremony (create):
val createRequest = CreatePublicKeyCredentialRequest(Gson().toJson(challenge.authParamsPublicKey))
val created = credentialManager.createCredential(context, createRequest) as CreatePublicKeyCredentialResponse
val regResponse = created.registrationResponseJson

val credentials = authentication
    .signinWithPasskey(challenge.authSession, regResponse, "{realm}")   // reuse the signup challenge's session
    .validateClaims()
    .await()
secureCredentialsManager.saveCredentials(credentials)
```

## Enrollment (add a passkey to a signed-in account — My Account API)

The user is already logged in. Enrollment uses the **same create ceremony as signup** but goes through `MyAccountAPIClient` with a My-Account-scoped token — it does **not** create a new account. No new `Credentials` are minted; the result is a `PasskeyAuthenticationMethod`.

```kotlin
// 1. Exchange the stored refresh token for a My-Account-audience token.
//    The audience is built from account.getDomainUrl() internally; the scope is required.
val apiCreds = credentialsManager.getApiCredentials(
    audience = "https://${account.domainUrl}/me",
    scope = "create:me:authentication_methods",
).await()

// 2. Build the My Account client with that token and request an enrollment challenge.
val myAccount = MyAccountAPIClient(account, apiCreds.accessToken)
val challenge = myAccount.passkeyEnrollmentChallenge().await()   // → PasskeyEnrollmentChallenge

// 3. Registration ceremony (create) — same as signup.
val createRequest = CreatePublicKeyCredentialRequest(Gson().toJson(challenge.authParamsPublicKey))
val created = credentialManager.createCredential(context, createRequest) as CreatePublicKeyCredentialResponse
val credential = /* parse created.registrationResponseJson into PublicKeyCredentials */

// 4. Complete enrollment.
val method = myAccount.enroll(credential, challenge).await()   // → PasskeyAuthenticationMethod
```

- `signupWithPasskey(userData, realm?, organization?)` → `Request<PasskeyRegistrationChallenge, …>`.
- `passkeyChallenge(realm?, organization?)` → `Request<PasskeyChallenge, …>`.
- `signinWithPasskey(authSession, authResponse: PublicKeyCredentials, realm?, organization?)` → `AuthenticationRequest`; chain `.validateClaims()` before `.start`/`.await`.
- `MyAccountAPIClient(account, accessToken)` → `passkeyEnrollmentChallenge(userIdentity?, connection?)` → `PasskeyEnrollmentChallenge`; `enroll(credentials, challenge)` → `PasskeyAuthenticationMethod`.

## SDK-specific gotchas

- **Do not use the removed `PasskeyAuthProvider` / `PasskeyProvider` / `PasskeyManager` wrappers** (gone in `4.0.0`), the Google Play Services FIDO API (`com.google.android.gms.fido`), or the server-side `auth0-java` package — the current path is `AuthenticationAPIClient` + `MyAccountAPIClient` + AndroidX CredentialManager.
- **`.validateClaims()` is mandatory** on every `signinWithPasskey` call; omitting it makes the SDK skip ID-token claim validation with only a warning.
- Enrollment must use a **My-Account-scoped token** (`create:me:authentication_methods` for the `https://<domain>/me` audience), not the plain login access token. Enrolling via `signupWithPasskey` instead creates a *new account*.
- The SDK owns the `/passkey/challenge` and `/me/v1/authentication-methods` HTTP paths — call the SDK methods, never hand-roll them.
- Use `createCredential()` for signup/enrollment and `getCredential()` for login — do not cross them; both yield a `PublicKeyCredentials`.
- The **Digital Asset Links** file must be published and verified on the custom domain, or Credential Manager refuses the ceremony.
- Persist login/signup `Credentials` via `SecureCredentialsManager`/`CredentialsManager`, never by hand in `SharedPreferences`.
- `signinWithPasskey()` can fail with an MFA-required error — continue with the MFA flow (see the hub, then `feature-mfa`).
