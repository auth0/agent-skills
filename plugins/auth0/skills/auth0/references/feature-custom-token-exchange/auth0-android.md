# Auth0.Android — Custom Token Exchange

**Minimum version:** 3.3.0 (`AuthenticationAPIClient#customTokenExchange`).

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. The call is on
`AuthenticationAPIClient`.

**Argument order trap:** the signature is `customTokenExchange(subjectTokenType, subjectToken, ...)`
— the **type first, then the token**. This is reversed from the legacy
`loginWithNativeSocialToken(token, tokenType)`. Passing `(token, type)` compiles but sends the wrong
values.

## Exchange an external token

```kotlin
authentication
    .customTokenExchange(
        subjectTokenType = "urn:acme:legacy-token", // non-reserved URI — FIRST arg
        subjectToken = "subject-token-value",        // the token — SECOND arg
    )
    .validateClaims() // required: validate the ID token claims
    .start(object : Callback<Credentials, AuthenticationException> {
        override fun onSuccess(result: Credentials) { /* store via CredentialsManager */ }
        override fun onFailure(exception: AuthenticationException) { /* handle error */ }
    })
```

Signature at 3.3.0: `customTokenExchange(subjectTokenType: String, subjectToken: String):
AuthenticationRequest`. An optional `organization` parameter was added in 3.12.0; `actorToken`
followed in 3.19.0 — `actorToken` is the delegation/impersonation path, out of scope here. Use
`.await()` for the coroutine form instead of `.start(Callback)`.

> `.validateClaims()` is marked mandatory in the KDoc. The basic snippet in the SDK's own example
> file omits it — add it anyway.

## Security

Public mobile client: **no `client_secret`**. Store the returned `Credentials` via
`CredentialsManager` / `SecureCredentialsManager`; do not persist tokens by hand and do not log or
persist the subject token. Never hand-build an HTTP POST to `/oauth/token`.

Mind the `(subjectTokenType, subjectToken)` order, and keep `.validateClaims()`. These names and the
signature are accurate for Auth0.Android 3.3.0+; do not read the SDK source to re-verify.

Example: https://github.com/auth0/Auth0.Android/blob/a32bdb97cbc5b4ca4b6a63f323e7b5a2c9afeb7c/examples/authentication-api/custom-token-exchange.md
