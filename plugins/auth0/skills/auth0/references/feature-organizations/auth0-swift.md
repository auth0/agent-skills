# Auth0.swift — Organizations

**Minimum version:** organizations has been supported since 1.32.0; this reference documents the current 2.x/3.x API, so target 2.0.0.

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. Org
login goes through the Web Auth builder; `Auth0`, `WebAuth`, and `CredentialsManager` ship in
the single `Auth0` module.

## Org-scoped login

Chain `.organization(_:)` onto `Auth0.webAuth()` — do **not** hand-append an `organization`
query parameter to a URL:

```swift
import Auth0

Auth0
    .webAuth()
    .organization("org_barkbook_acme")
    .start { result in /* ... */ }
```

## Accepting an invitation

Pass the **inbound invitation URL as-is** to `.invitationURL(_:)`; the SDK extracts its
`organization` and `invitation` params. Do not reject an invite whose org differs from your
default:

```swift
Auth0
    .webAuth()
    .invitationURL(url) // the full universal/deep link the app was opened with
    .start { result in /* ... */ }
```

## Reading the organization back

`org_id` is a claim on the ID token. Decode `credentials.idToken` with **JWTDecode** — never
hand-split the token:

```swift
import JWTDecode

let jwt = try decode(jwt: credentials.idToken)
let orgId = jwt.claim(name: "org_id").string
```

## Security

Public mobile client: **no `client_secret`**. Let `CredentialsManager` store tokens; do not
persist access/ID/refresh tokens by hand in `UserDefaults` or the Keychain. Storing app state
such as a pending organization is fine. Keep the client ID/domain in `Auth0.plist`, not in
source.

All method names above are accurate for Auth0.swift 2.x/3.x — do not read the SDK source to
re-verify them.
