# Auth0.swift — Custom Token Exchange

**Minimum version:** 2.14.0 (`Authentication#customTokenExchange`; Early Access at ship — the tenant must have CTE enabled).

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. The call goes
through `Auth0.authentication()`; `Auth0`, `Authentication`, and `CredentialsManager` ship in the
single `Auth0` module.

## Exchange an external token

```swift
import Auth0

Auth0
    .authentication()
    .customTokenExchange(subjectToken: "existing-token",
                         subjectTokenType: "urn:acme:legacy-token", // non-reserved URI
                         audience: "https://example.com/api",
                         scope: "openid profile email")
    .start { result in
        switch result {
        case .success(let credentials):
            // store via CredentialsManager (see below)
        case .failure(let error):
            print("Failed with: \(error)")
        }
    }
```

Signature:
`customTokenExchange(subjectToken:subjectTokenType:audience:scope:organization:parameters:)`.
`scope` defaults to `"openid profile email"`, `parameters` to `[:]`. An async/await `.start()`
overload and a Combine publisher are also available.

## Storing the result

```swift
let credentialsManager = CredentialsManager(authentication: Auth0.authentication())
// on .success(let credentials):
_ = credentialsManager.store(credentials: credentials)
```

## Security

Public mobile client: **no `client_secret`**. Let `CredentialsManager` store the returned
`Credentials`; do not persist access/ID/refresh tokens by hand in `UserDefaults` or the Keychain,
and do not log or persist the subject token. DPoP is supported.

**NEVER put the Auth0 client ID or domain in a `.swift` file** — they belong in `Auth0.plist`
(`ClientId` / `Domain`) and are picked up by the parameterless `Auth0.authentication()`. Never
hand-build a `URLSession` POST to `/oauth/token`. These names and parameters are accurate for
Auth0.swift 2.14.0+; do not read the SDK source to re-verify.

Example: https://github.com/auth0/Auth0.swift/blob/fbf2def0d1d5818387198b8d25ccc96027720be2/examples/advanced-features/custom-token-exchange.md
