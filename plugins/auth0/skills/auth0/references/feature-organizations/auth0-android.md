# Auth0.Android — Organizations

**Minimum version:** organizations has been supported since 2.1.0; this reference documents the current 2.x–4.x API, so target 2.9.0.

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. Org
login goes through the `WebAuthProvider` builder. There is no dedicated org accessor on
`Credentials`; there is **no `useOrganization` hook** (that is the React SDK).

## Org-scoped login

Chain `.withOrganization(_)` onto `WebAuthProvider.login(account)` — do **not** hand-append an
`organization` query parameter to a URL. The removed `WebAuthProvider.init` entry point is gone;
use `.login(account)`:

```kotlin
WebAuthProvider
    .login(account)
    .withOrganization("org_barkbook_acme")
    .start(context, callback)
```

## Accepting an invitation

Pass the **inbound invitation URL as-is** to `.withInvitationUrl(_)`; the SDK extracts its
`organization` and `invitation` params. Do not reject an invite whose org differs from your
default:

```kotlin
WebAuthProvider
    .login(account)
    .withInvitationUrl(invitationUrl) // the full deep link the app was opened with
    .start(context, callback)
```

## Reading the organization back

`org_id` is a claim on the ID token. Decode `credentials.idToken` with the
`com.auth0.android:jwtdecode` library, or read it off `credentials.user.getExtraInfo()` — never
hand-split the token:

```kotlin
import com.auth0.android.jwt.JWT

val orgId = JWT(credentials.idToken).getClaim("org_id").asString()
// or: credentials.user.getExtraInfo()["org_id"]
```

## Security

Public mobile client: **no `client_secret`**. Let `SecureCredentialsManager` (or
`CredentialsManager`) store tokens; do not persist access/ID/refresh tokens by hand in plain
`SharedPreferences`. Storing app state such as a pending organization is fine. Do not add
`auth0-java` (that is a server-side SDK).

**NEVER put the Auth0 client ID or domain in a `.kt` file** - not as a string literal, a constant,
or a `BuildConfig` default. They belong in `res/values/strings.xml` (e.g.
`R.string.com_auth0_domain` / `R.string.com_auth0_client_id`) and are read from there via
`Auth0.getInstance(context)` or resource lookups.

All method names above are accurate for Auth0.Android 2.x/3.x — do not read the SDK source to
re-verify them.
