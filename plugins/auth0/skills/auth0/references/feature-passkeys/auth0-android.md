# Auth0.Android — Passkeys

**Minimum version:** `4.0.0`. Passkey methods landed on `AuthenticationAPIClient` in `3.2.0` and My Account passkey **enrollment** in `3.8.0`, but the old `PasskeyAuthProvider` / `PasskeyProvider` / `PasskeyManager` wrappers were **removed in `4.0.0`** — target `4.0.0` so the current path (`AuthenticationAPIClient` + `MyAccountAPIClient` + AndroidX CredentialManager) is unambiguous. `realm` became optional in `3.2.1`; the `organization` parameter landed in `3.9.0`. Requires **Android API 28+** and a verified **Digital Asset Links** file (`assetlinks.json`) on the custom domain.

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

Auth0.Android is **high-level for the token exchange**; you drive the platform WebAuthn ceremony with AndroidX **Credential Manager** (`androidx.credentials.CredentialManager`). Pattern: **Auth0 challenge → Credential Manager ceremony → Auth0 signin/signup/enroll with the credential**.

## Prerequisites (Gradle)

The Credential Manager classes and `Gson` used below are **not** exposed by the Auth0 SDK on the compile classpath (Gson is bundled as `implementation`, and AndroidX Credential Manager is not a dependency at all) — the passkey code will not compile without these in the **app's** `build.gradle`:

```groovy
// app/build.gradle (the Auth0 SDK, minSdk 28+, and coroutines come from the base Android setup)
implementation 'androidx.credentials:credentials:1.3.0'
implementation 'androidx.credentials:credentials-play-services-auth:1.3.0'
implementation 'com.google.code.gson:gson:2.11.0'        // app calls Gson() directly
```

`credentials-play-services-auth` routes the ceremony through Google Play services on devices that need it; passkey methods require `minSdk 28`.

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
// authenticationResponseJson is a String; signinWithPasskey's authResponse is a PublicKeyCredentials — parse it.
val authResponse = Gson().fromJson(
    (result.credential as PublicKeyCredential).authenticationResponseJson,
    PublicKeyCredentials::class.java,
)

// signinWithPasskey(authSession: String, authResponse: PublicKeyCredentials, realm?, organization?) → AuthenticationRequest
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
// registrationResponseJson is a String; parse it into the PublicKeyCredentials signinWithPasskey expects.
val regResponse = Gson().fromJson(created.registrationResponseJson, PublicKeyCredentials::class.java)

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
//    Use the suspend awaitApiCredentials (getApiCredentials is the callback variant, not awaitable).
//    Audience is the My Account API for your CUSTOM domain: https://<custom-domain>/me/ — no double scheme.
val apiCreds = credentialsManager.awaitApiCredentials(
    audience = "https://YOUR_CUSTOM_DOMAIN/me/",
    scope = "create:me:authentication_methods",
)

// 2. Build the My Account client with that token and request an enrollment challenge.
val myAccount = MyAccountAPIClient(account, apiCreds.accessToken)
val challenge = myAccount.passkeyEnrollmentChallenge().await()   // → PasskeyEnrollmentChallenge

// 3. Registration ceremony (create) — same as signup.
val createRequest = CreatePublicKeyCredentialRequest(Gson().toJson(challenge.authParamsPublicKey))
val created = credentialManager.createCredential(context, createRequest) as CreatePublicKeyCredentialResponse
val credential = Gson().fromJson(created.registrationResponseJson, PublicKeyCredentials::class.java)

// 4. Complete enrollment.
val method = myAccount.enroll(credential, challenge).await()   // → PasskeyAuthenticationMethod
```

- `signupWithPasskey(userData, realm?, organization?)` → `Request<PasskeyRegistrationChallenge, …>`.
- `passkeyChallenge(realm?, organization?)` → `Request<PasskeyChallenge, …>`.
- `signinWithPasskey(authSession, authResponse, realm?, organization?)` → `AuthenticationRequest`; `authSession` is **first**, `authResponse` second. Two overloads: `authResponse: PublicKeyCredentials` (used here) or `authResponse: String` (the raw JSON, which the SDK just `Gson`-parses into `PublicKeyCredentials` internally). Chain `.validateClaims()` before `.start`/`.await`.
- `credentialsManager.awaitApiCredentials(audience, scope)` (suspend) — or `getApiCredentials(audience, scope, callback)` (callback) — mints the `https://<custom-domain>/me/` token.
- `MyAccountAPIClient(account, accessToken)` → `passkeyEnrollmentChallenge(userIdentity?, connection?)` → `PasskeyEnrollmentChallenge`; `enroll(credentials, challenge)` → `PasskeyAuthenticationMethod`.

## SDK-specific gotchas

- **Do not use the removed `PasskeyAuthProvider` / `PasskeyProvider` / `PasskeyManager` wrappers** (gone in `4.0.0`), the Google Play Services FIDO API (`com.google.android.gms.fido`), or the server-side `auth0-java` package — the current path is `AuthenticationAPIClient` + `MyAccountAPIClient` + AndroidX CredentialManager.
- **`.validateClaims()` is mandatory** on every `signinWithPasskey` call; omitting it makes the SDK skip ID-token claim validation with only a warning.
- Enrollment must use a **My-Account-scoped token** (`create:me:authentication_methods` for the `https://<custom-domain>/me/` audience), not the plain login access token. Enrolling via `signupWithPasskey` instead creates a *new account*.
- The SDK owns the `/passkey/challenge` and `/me/v1/authentication-methods` HTTP paths — call the SDK methods, never hand-roll them.
- Use `createCredential()` for signup/enrollment and `getCredential()` for login — do not cross them. Neither yields a `PublicKeyCredentials` directly: parse the ceremony's `registrationResponseJson` / `authenticationResponseJson` with `Gson()` before handing it to the SDK.
- The **Digital Asset Links** file must be published and verified on the custom domain, or Credential Manager refuses the ceremony.
- Persist login/signup `Credentials` via `SecureCredentialsManager`/`CredentialsManager`, never by hand in `SharedPreferences`.
- Handling MFA is **optional** and only needed if the tenant layers a second factor on passkey login — most tasks don't ask for it, so don't add the branch reflexively. If you do, the error is an `AuthenticationException` whose `isMultifactorRequired` is true (code `mfa_required`); continue with the MFA flow (see the hub, then `feature-mfa`). **Do not invent an MFA error class** — Auth0.Android surfaces this on `AuthenticationException`, not a dedicated type.
