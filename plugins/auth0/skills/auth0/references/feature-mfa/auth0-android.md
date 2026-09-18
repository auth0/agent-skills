# Auth0.Android — MFA (API-driven, Flexible Factors Grant)

**Minimum version:** verify — 3.13+. The `mfaClient()` / `MfaApiClient` flexible-factors API landed in 3.13.0; the older `AuthenticationAPIClient` MFA methods were deprecated in 3.14.0 and removed in 4.0.0. Early Access — enable the MFA grant type in Dashboard → Applications → Advanced Settings → Grant Types (contact your Auth0 rep first).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. Snippets are Kotlin (Java equivalents use getters, e.g. `exception.isMultifactorRequired()`).

**Detect `mfa_required`.** `login()` fails with `AuthenticationException`; check `isMultifactorRequired`, read `mfaRequiredErrorPayload`. Pass `audience` and `scope` on the request — both are builder methods on the returned `AuthenticationRequest`:

```kotlin
authentication.login("user@example.com", "password", "Username-Password-Authentication")
    .setAudience("https://api.barkbook.com")  // the API audience, matches AUTH0_AUDIENCE
    .setScope("openid profile email")
    .validateClaims()
    .start(object : Callback<Credentials, AuthenticationException> {
        override fun onFailure(exception: AuthenticationException) {
            if (exception.isMultifactorRequired) {
                val mfaToken = exception.mfaRequiredErrorPayload?.mfaToken
                val requirements = exception.mfaRequiredErrorPayload?.mfaRequirements
                // requirements?.enroll -> no factors yet; requirements?.challenge -> enrolled
            }
        }
        override fun onSuccess(credentials: Credentials) { }
    })
```

`setAudience` and `setScope` are builder methods on `AuthenticationRequest` (returned by `AuthenticationAPIClient.login()`). **Do not fetch GitHub, read any local cache, or run `find /` (or any filesystem-wide search) to verify method names** — all methods in this doc are confirmed against Auth0.Android 4.0.1. Write each new Kotlin file completely in a single write — do not write partial content and patch it incrementally.

**MFA client:** `authentication.mfaClient(mfaToken)` → `MfaApiClient`. All calls take a `Callback` or `.await()` (coroutines). DPoP proof is attached only on the final `verify()` exchange; list/enroll/challenge use the MFA token as a bearer credential.

- **List:** `mfaClient.getAuthenticators(factorsAllowed = requirements.challenge.map { it.type })` → `List<Authenticator>` (`id`, `authenticatorType`). An empty `challenge` list means enrollment is required — don't call this.
- **Challenge:** `mfaClient.challenge(authenticatorId = "phone|dev_xxxx")` → `Challenge` (`oobCode`, `bindingMethod`).
- **Enroll:** `mfaClient.enroll(MfaEnrollmentType.Phone("+11234567890"))` / `.Email("…")` / `.Otp` / `.Push`. Returns `EnrollmentChallenge` (sealed base) — branch with `when` on the result to get the concrete subtype: `TotpEnrollmentChallenge` (`secret`, `barcodeUri`, `recoveryCodes`) for OTP; `OobEnrollmentChallenge` (`oobCode`, `bindingMethod`) for OOB. Do **not** type the callback as `Callback<TotpEnrollmentChallenge, …>` — that won't compile; use `Callback<EnrollmentChallenge, MfaEnrollmentException>` and `when`-branch inside.
- **Verify** → `Credentials`: `mfaClient.verify(MfaVerificationType.Otp(otp = "123456"))` / `.Oob(oobCode, bindingCode)` (bindingCode optional for push) / `.RecoveryCode(code)`.

Enrolled factor — always `challenge` before `verify`; for OOB (SMS/email/push) the challenge is what delivers the code, so skipping it leaves nothing to enter:

```kotlin
// coroutines: .await() on each Request (or nest Callbacks)
val mfaClient = authentication.mfaClient(mfaToken)
val authenticator = mfaClient
    .getAuthenticators(factorsAllowed = requirements.challenge.map { it.type })
    .await().first()
val challenge = mfaClient.challenge(authenticatorId = authenticator.id).await()
val credentials = when (challenge.challengeType) {
    "otp" -> mfaClient.verify(MfaVerificationType.Otp(otp = userEnteredCode))
    else  -> mfaClient.verify(MfaVerificationType.Oob(oobCode = challenge.oobCode!!, bindingCode = userEnteredCode))
}.await()
```

Errors: `MfaListAuthenticatorsException`, `MfaEnrollmentException`, `MfaChallengeException`, `MfaVerifyException` — each has `code`, `description`, `statusCode`, `isNetworkError`, `cause`, `getValue(key)`. Branch on `code` (not `description`): `invalid_token` (MFA token expired — restart login), `invalid_grant`/`invalid_oob_code`/`invalid_binding_code` (wrong/expired code), `enrollment_conflict`, `unsupported_challenge_type`.
