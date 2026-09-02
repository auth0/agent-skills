# Auth0 Kotlin Multiplatform (KMP) Integration

Integrate Auth0 authentication into a Kotlin Multiplatform project that targets
**Android and iOS from shared code** using the `com.auth0.kmp` SDK. Auth logic
(login, logout, token storage) is written once in `commonMain`; the SDK provides
platform-native implementations for each target.

> **Beta SDK.** `com.auth0.kmp` is pre-1.0 (`1.0.0-beta.0` at time of writing).
> APIs may change between releases. Always confirm the current version and API
> shape against the release you are pinning (see version auto-detection below)
> and treat the snippets here as the documented shape, not a frozen contract.

## Critical rules

- **Credential privacy is IMPORTANT:** never echo Auth0 credentials (domain,
  client ID, client secret) in response text or terminal output. Redirect Auth0
  CLI output to a temp file, use the Read tool to extract values, then write them
  directly into config files with the Write or Edit tool. When confirming the
  active tenant, mask the domain (e.g. `your-te****.us.auth0.com`).
- Before writing Auth0 credentials into any file (e.g. a shared config object,
  `gradle.properties`, or `local.properties`), you MUST ask the user for explicit
  confirmation before proceeding.
- After either automatic or manual Auth0 configuration, you MUST apply the
  required per-platform changes — Android manifest placeholders (`auth0Domain`,
  `auth0Scheme`) plus the `INTERNET` permission, and the iOS
  simulator-architecture build settings — before treating the integration as
  complete. Shared code alone does not wire up the callback. (The iOS callback
  needs **no** `Info.plist` URL-scheme entry — see Step 4.)
- If the project still fails to build after several fix attempts (~5–6), stop
  and ask the user how to proceed rather than making further speculative changes.

## When NOT to use this reference

- **Native-only Android app** (`com.auth0.android:auth0`, no `commonMain`) → use
  the `android` reference instead.
- **Native-only iOS app** (Auth0.swift, `.xcodeproj`/`Package.swift` with no
  Kotlin) → use the `swift` reference instead.
- **KMP targeting JVM / desktop / web / wasm** → not supported by
  `com.auth0.kmp` (Android + iOS only). Advise the user accordingly.

## Prerequisites

- A Kotlin Multiplatform project applying `org.jetbrains.kotlin.multiplatform`,
  with `commonMain`, `androidMain`, and `iosMain` source sets.
- Toolchain that meets the SDK's floors (see **Toolchain compatibility** below):
  Kotlin 2.3.21, `compileSdk 36`, `minSdk 24`, iOS 14+.
- An Auth0 tenant. The Auth0 CLI (`auth0`) installed for automatic setup.

## Toolchain compatibility

Consuming `com.auth0.kmp` forces the build chain upward — its klibs and AAR
metadata set hard floors. These are the versions the SDK itself builds against
(`gradle/libs.versions.toml` in `auth0/auth0-kmp`); confirm current values
against the release you pin.

| Tool | Version | Why |
|------|---------|-----|
| Kotlin | 2.3.21 | SDK klibs are compiled with it; the consumer must match or exceed. |
| `compileSdk` | 36 | Required by the SDK's AAR metadata — a lower value fails the build. |
| `minSdk` | 24 | SDK floor. |
| iOS deployment target | 14.0+ | SDK floor. |
| Android Gradle Plugin | 9.x (SDK uses 9.1.1) | Works — but see the module-layout rule below. |

**AGP 9 + module layout (the real constraint).** AGP 9 removed the ability to
apply **`com.android.application`** and **`org.jetbrains.kotlin.multiplatform`**
in the *same* Gradle module — the old single-module `composeApp` layout that
older KMP wizards generated. Symptom:

```
The 'com.android.application' plugin is not compatible with the
'org.jetbrains.kotlin.multiplatform' plugin since AGP 9.
```

This is **not** a reason to downgrade AGP — the SDK builds fine on AGP 9. Fix the
*layout* instead, either:

- use AGP 9's KMP library plugin (`com.android.kotlin.multiplatform.library`) for
  the shared module, or
- split into a `shared` **library** module (KMP) plus a separate `androidApp`
  **application** module.

Pinning AGP to the latest 8.x (e.g. 8.13.0 with Gradle 8.13) is a fallback only
if you must keep a single-module app.

## Quick Start Workflow

### Step 1 — Install the SDK

> **Agent instruction:** Before providing setup instructions, fetch the latest
> release version (including pre-releases) so the dependency line is current:
> ```
> gh api repos/auth0/auth0-kmp/releases --jq '.[0].tag_name'
> ```
> Strip a leading `v` from the returned tag before using it in the
> `implementation` line. If the result is empty, report an error and tell the
> user to check the repo's Releases page and pin the latest tag manually. If
> the CLI is unavailable, direct the user to the Releases page.

Add the SDK to the shared module's `commonMain` dependencies. The umbrella
`auth0` artifact pulls in the sub-modules (`auth0-core`, `auth0-authentication`,
`auth0-webauth`, `auth0-credentials`); depend on individual modules only if you
need a narrower surface.

```kotlin
// shared/build.gradle.kts
kotlin {
    sourceSets {
        commonMain.dependencies {
            implementation("com.auth0.kmp:auth0:<LATEST_VERSION>")
        }
    }
}
```

### Step 2 — Configure Auth0

> **Agent instruction:** Check whether the user prompt already includes both an
> Auth0 **Client ID** and **Domain**.
> - If both are provided, proceed to **Manual setup** below using those values.
> - If either is missing, you MUST ask the user BEFORE writing any code or files:
>   - Question: "How would you like to configure Auth0 for this project?"
>   - Options: "Automatic setup (Recommended) — the Auth0 CLI creates a Native
>     app, sets callback/logout URLs, and returns credentials" / "Manual setup —
>     I'll provide my Client ID and Domain".
>
> Then follow the chosen path below.

**Automatic setup (Auth0 CLI).** KMP apps use the Auth0 **Native** application
type. Create the app and capture credentials without printing them:

```bash
# Requires: auth0 login (run once, interactive)
auth0 apps create \
  --name "My KMP App" \
  --type native \
  --callbacks "<CALLBACK_URLS>" \
  --logout-urls "<LOGOUT_URLS>" \
  --json > /tmp/auth0_app.json
```

Read `/tmp/auth0_app.json` with the Read tool to extract `client_id` — do not
echo it. The app resource does **not** include the tenant domain; fetch it
separately:

```bash
auth0 tenants list --json | jq -r '.[0].domain'
```

Write both `client_id` and the tenant domain into the project (see Step 3).

See the `tooling-cli` reference for the full CLI workflow and callback-URL
formatting; the required URL shapes for KMP are in Step 4 below.

**Manual setup.** In the Auth0 Dashboard create (or open) a **Native**
application, and note its Client ID and your tenant Domain. Set the Allowed
Callback URLs and Allowed Logout URLs per Step 4.

### Step 3 — Initialize the client in shared code

Construct the account and client once in `commonMain`. Supply the domain and
client ID from your configured values (inject them; do not hardcode secrets into
source that ships).

```kotlin
// commonMain
import com.auth0.kmp.Auth0
import com.auth0.kmp.core.Auth0Account

val account = Auth0Account(
    clientId = "<CLIENT_ID>",
    domain = "<TENANT_DOMAIN>", // e.g. your-tenant.us.auth0.com
)
val auth0 = Auth0(account)
```

**Injecting credentials (keeping them out of source).** One clean pattern: put
the values in gitignored `local.properties`, then generate a config object at
build time so `commonMain` reads constants, not literals:

```properties
# local.properties (gitignored)
auth0.domain=YOUR_TENANT.REGION.auth0.com
auth0.clientId=YOUR_CLIENT_ID
```

```kotlin
// shared/build.gradle.kts
val localProps = java.util.Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }
        ?.inputStream()?.use { load(it) }
}

val generateAuth0ConfigTask by tasks.registering {
    val domain = localProps.getProperty("auth0.domain")
        ?.takeIf { it.isNotBlank() }
        ?: error("local.properties must define auth0.domain")
    val clientId = localProps.getProperty("auth0.clientId")
        ?.takeIf { it.isNotBlank() }
        ?: error("local.properties must define auth0.clientId")
    inputs.property("domain", domain)
    inputs.property("clientId", clientId)
    val outputDir = layout.buildDirectory.dir("generated/auth0Config/commonMain/kotlin")
    outputs.dir(outputDir)
    doLast {
        outputDir.get().asFile.also { it.mkdirs() }
            .resolve("Auth0Config.kt")
            .writeText(
                "package auth0config\n\n" +
                "object Auth0Config {\n" +
                "    const val DOMAIN = \"$domain\"\n" +
                "    const val CLIENT_ID = \"$clientId\"\n" +
                "}\n"
            )
    }
}

kotlin {
    sourceSets {
        commonMain {
            kotlin.srcDir(generateAuth0ConfigTask)
        }
    }
}
```

Then build the account from `Auth0Config.DOMAIN` / `Auth0Config.CLIENT_ID`.

### Step 4 — Configure callback and logout URLs

KMP callback/logout URLs are per-platform. Register **both** the Android and iOS
forms in the Auth0 application's Allowed Callback URLs and Allowed Logout URLs:

```
# Android — scheme is your applicationId by default
<APP_PACKAGE_NAME>://<TENANT_DOMAIN>/android/<APP_PACKAGE_NAME>/callback

# iOS — scheme is your bundle identifier
<BUNDLE_IDENTIFIER>://<TENANT_DOMAIN>/ios/<BUNDLE_IDENTIFIER>/callback
```

**Android platform config.** Declare the manifest placeholders so the SDK's
redirect `intent-filter` is generated:

```kotlin
// androidApp/build.gradle.kts (the Android application module)
android {
    defaultConfig {
        manifestPlaceholders["auth0Domain"] = "<TENANT_DOMAIN>"
        manifestPlaceholders["auth0Scheme"] = applicationId // or a custom scheme
    }
}
```

Add the `INTERNET` permission to the Android app's manifest — the SDK does not
declare it, so the consuming app must:

```xml
<!-- androidApp/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
```

**No init call is required.** The SDK captures the `Context` at launch via an
`androidx.startup` initializer merged from its manifest, and auto-declares its
`RedirectActivity`. Call `Auth0Android.init(context)` only if you have removed
the startup initializer or run from a secondary process the initializer missed.

**iOS platform config.** The SDK drives login with `ASWebAuthenticationSession`,
which is created with the callback scheme and intercepts the redirect through its
own completion handler. **No `Info.plist` `CFBundleURLTypes` / URL Types entry is
required, and no `onOpenURL` / AppDelegate / SceneDelegate resume handler is
needed** — the sample app registers none. You only register the callback URL in
the Auth0 application (Step 4). The iOS layer uses SKIE to bridge Kotlin
`suspend` functions to Swift `async/await`.

See **iOS build configuration** below for the required simulator-architecture
settings.

### iOS build configuration (Apple Silicon)

The SDK publishes only the device and Apple-Silicon-simulator variants — there is
**no** Intel-simulator (`ios_x64`) artifact. Declare exactly these iOS targets in
the shared module; do **not** add `iosX64()`:

```kotlin
kotlin {
    iosArm64()            // device
    iosSimulatorArm64()   // simulator (Apple Silicon)
}
```

Adding `iosX64()` fails dependency resolution with `No matching variant ...
ios_x64`. Then tell Xcode to build the simulator arm64-only — in the app target's
build settings, for **both** Debug and Release:

```
EXCLUDED_ARCHS[sdk=iphonesimulator*] = x86_64
```

Skipping this fails the Xcode build inside the "Compile Kotlin Framework"
run-script phase with `Command PhaseScriptExecution failed with a nonzero exit
code` and `error: Unknown iOS simulator arch: 'x86_64'`.

### Step 5 — Implement authentication (shared code)

**Universal Login (recommended)** — browser-based login/logout via
`WebAuthClient`:

```kotlin
// Login
when (val result = auth0.webAuth.login(
    LoginOptions(scope = "openid profile email offline_access")
)) {
    is Result.Success -> {
        val credentials = result.data
        // credentials.accessToken, credentials.idToken, credentials.refreshToken
    }
    is Result.Failure -> { /* inspect result.error */ }
}

// Logout
auth0.webAuth.logout(LogoutOptions(federated = false))
```

**Direct login (`AuthenticationClient`)** — only when you own the login UI and
have a database/realm connection; Universal Login is preferred for security.
Before using this flow, enable the **Password** or **Password Realm** grant type
for the Native application in the Auth0 Dashboard (Applications → your app →
Settings → Advanced Settings → Grant Types) — these grants are not enabled by
default for Native apps:

```kotlin
val result = auth0.authentication.login(
    usernameOrEmail = "user@example.com",
    password = "<PASSWORD>",
    realm = "Username-Password-Authentication",
    scope = "openid profile email offline_access",
)
```

**Token storage (`CredentialsManager`)** — secure, auto-renewing storage backed
by the Android Keystore (+ DataStore) and the iOS Keychain:

```kotlin
val credentialsManager = auth0.credentials()

// Persist after a successful login
credentialsManager.saveCredentials(credentials)

// Retrieve a valid access token (auto-renews with the refresh token when needed)
when (val result = credentialsManager.getCredentials()) {
    is Result.Success -> callApi(result.data.accessToken)
    is Result.Failure -> { /* re-authenticate */ }
}

// On app launch: is there a stored, unexpired session? (checks only, no renewal)
if (credentialsManager.hasValidCredentials()) { /* skip login, go to app */ }

// Force a renewal, or clear on logout
credentialsManager.getCredentials(forceRefresh = true)
credentialsManager.clearCredentials()
```

Request the `offline_access` scope (shown above) so a refresh token is issued;
the `CredentialsManager` needs it to renew expired access tokens silently.

> **No built-in biometric gating.** Unlike the native Android/iOS SDKs, the KMP
> `CredentialsManager` does **not** prompt for Face ID / Touch ID / BiometricPrompt
> before returning credentials (there is no `LocalAuthenticationOptions`
> equivalent). If you need biometric protection, run a platform local-auth check
> in `androidMain`/`iosMain` *before* calling `getCredentials()`.

All client methods are `suspend` functions — call them from a coroutine scope.
On iOS they are bridged to Swift `async`/`await` via SKIE.

## Reading the user profile

`Credentials` does not expose the user profile. Fetch it from `/userinfo` with
the access token:

```kotlin
when (val result = auth0.authentication.userInfo(credentials.accessToken)) {
    is Result.Success -> {
        val user = result.data                 // UserInfo
        println("${user.sub} ${user.email}")
        val plan = user.customClaims["plan"]   // custom / namespaced claims
    }
    is Result.Failure -> { /* handle result.error */ }
}
```

## Sign up (database registration)

`createUser` registers a user in a database connection. It returns the created
user, **not** tokens — follow it with a `login` to authenticate.

```kotlin
val signup = auth0.authentication.createUser(
    profile = SignupProfile(email = "user@example.com", name = "Jane Doe"),
    password = "<PASSWORD>",
    connection = "Username-Password-Authentication",
)
// On Result.Success, then call auth0.webAuth.login(...) or authentication.login(...)
```

## Calling your API with the access token

The SDK returns a token but ships no HTTP client. In `commonMain`, attach the
`Authorization` header to your own Ktor client, fetching a fresh token per
request (it auto-renews) rather than caching the string:

```kotlin
when (val result = credentialsManager.getCredentials()) {
    is Result.Success -> {
        val response = httpClient.get("https://api.example.com/me") {
            header("Authorization", "Bearer ${result.data.accessToken}")
        }
        // handle response
    }
    is Result.Failure -> { /* re-authenticate or show error */ }
}
```

Pass `audience` in `LoginOptions` so the issued access token is valid for your
API; without it the token targets the `/userinfo` endpoint only.

## Handling errors

Every call returns `Result.Success` or `Result.Failure`, where `Failure.error`
is a typed `Auth0Error`. Branch on the sealed subtypes — do not string-match
messages:

```kotlin
when (val r = auth0.webAuth.login(LoginOptions(scope = "openid profile email offline_access"))) {
    is Result.Success -> credentialsManager.saveCredentials(r.data)
    is Result.Failure -> when (val e = r.error) {
        WebAuthError.UserCancelled -> { /* user closed the browser — no-op */ }
        is WebAuthError.ApiError   -> showError(e.code, e.errorDescription)
        is WebAuthError.Network    -> when (e.cause) {
            TransportError.NoInternet -> showOffline()
            TransportError.Timeout    -> retry()
            else                      -> showError()
        }
        else -> showError()
    }
}
```

Error families (all sealed `Auth0Error` subtypes):

- **`WebAuthError`** (Universal Login): `UserCancelled`, `InvalidState`,
  `TransactionActiveAlready`, `BrowserError`, `AuthorizationError`, `ApiError`,
  `Network`, `IdTokenValidation`, `DPoP`, `Unknown`.
- **`AuthenticationError`** (direct `AuthenticationClient` calls): `ApiError`
  (`code` / `errorDescription` / `statusCode`), `InvalidInput`, `Network`,
  `Unknown`, `IdTokenValidation`.
- **`CredentialsManagerError`** (storage / renewal): `NoCredentials`,
  `NoRefreshToken`, `LargeMinTtl`, `ApiError`, `Network`, `StoreFailed`,
  `CryptoFailed`, `DeserializationFailed`, `DPoPKeyMissing`, `DPoPKeyMismatch`,
  `DPoPNotConfigured`, `DPoPKeyUnavailable`, `Unknown`. Treat `NoCredentials` /
  `NoRefreshToken` as "re-authenticate".

## API quick reference

| Symbol | Purpose |
| --- | --- |
| `Auth0(account)` | Entry point; exposes `.webAuth`, `.authentication`, `.credentials()`. |
| `WebAuthClient` | `login(LoginOptions)`, `logout(LogoutOptions)`, `cancel()`. |
| `AuthenticationClient` | `login(...)`, `createUser(...)`, `userInfo(token)`, `resetPassword(...)`, `renew(refreshToken)`, `revoke(refreshToken)`. |
| `CredentialsManager` | `saveCredentials`, `getCredentials(scope, minTtl, forceRefresh, ...)`, `hasValidCredentials(minTtl)`, `clearCredentials`. |
| `Credentials` | `accessToken`, `idToken`, `tokenType`, `expiresAt`, `refreshToken?`, `scope?`. |
| `LoginOptions` | `scope`, `audience`, `connection`, `organization`, `prompt`, `ephemeral`, `redirectUri`, `scheme`, `extraParameters`. |
| `Result<D, E>` | Sealed `Success(data)` / `Failure(error)` where `E : Auth0Error`. |

## Common Mistakes

- **Treating KMP as a native SDK.** `com.auth0.kmp` is a distinct SDK from
  `com.auth0.android:auth0` and Auth0.swift — do not mix them or copy native
  init code verbatim.
- **Skipping per-platform wiring.** Shared `commonMain` code compiles but login
  will not return without the Android manifest placeholders + `INTERNET`
  permission and the iOS simulator-architecture build settings.
- **Adding an iOS `Info.plist` URL scheme.** Not needed for this SDK
  (`ASWebAuthenticationSession` handles the callback) — that's the old Auth0.swift
  pattern. Registering one does nothing.
- **Registering only one callback URL.** Both the Android and iOS callback/logout
  URL forms must be added to the Auth0 app, or one platform's redirect fails.
- **Wrong application type.** KMP apps require a **Native** Auth0 application, not
  Regular Web or SPA.
- **Missing `offline_access`.** Without it, no refresh token is issued and
  `CredentialsManager` cannot renew, forcing repeated logins.
- **Hardcoding secrets.** Inject domain/client ID; never echo them or commit
  them to source that ships.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Browser opens but never returns to the app | Per-platform callback not wired | Add the Android manifest placeholders (`auth0Domain`, `auth0Scheme`) + `INTERNET` permission; on iOS no URL-scheme entry is needed (Step 4). |
| Login works on one platform, fails on the other | Only one callback/logout URL registered | Register **both** the Android and iOS URL forms in the Auth0 app. |
| `WebAuthError.InvalidState` / `TransactionActiveAlready` | Stale or overlapping login transaction | Ensure a single in-flight login; call `webAuth.cancel()` before retrying. |
| `getCredentials()` returns `NoRefreshToken` / `NoCredentials` | Missing `offline_access`, or nothing was stored | Request `offline_access` at login and `saveCredentials` after success; otherwise re-authenticate. |
| Your API rejects the access token | Missing or wrong `audience` | Pass `audience` in `LoginOptions` so the token is issued for your API. |
| `WebAuthError.UserCancelled` | User dismissed the browser | Expected — treat as a no-op, not a failure. |
| `... requires ... compile against version 36 or later` | `compileSdk` too low | Set `compileSdk = 36`. |
| `... 'com.android.application' ... not compatible with ... 'org.jetbrains.kotlin.multiplatform' ... since AGP 9` | Both plugins applied in one module | Use AGP 9's `com.android.kotlin.multiplatform.library`, or split into `shared` (library) + `androidApp` (application) modules (see Toolchain compatibility). |
| `No matching variant ... ios_x64` | `iosX64()` target declared | Remove `iosX64()`; keep only `iosArm64()` + `iosSimulatorArm64()`. |
| `PhaseScriptExecution failed` + `Unknown iOS simulator arch: 'x86_64'` | Xcode building simulator for Intel | Add `EXCLUDED_ARCHS[sdk=iphonesimulator*] = x86_64` (Debug + Release). |

## Testing Checklist

- Login opens the system browser and returns to the app on both Android and iOS.
- `credentials.accessToken` / `idToken` are non-empty after login.
- `CredentialsManager.getCredentials()` returns a valid token and renews it after
  expiry (requires `offline_access`).
- Logout clears the session and `clearCredentials()` empties stored credentials.
- Callback and logout URLs in the Auth0 app match the deployed package name /
  bundle identifier for each platform.

## Related Capabilities

- **Organizations** — supported via `LoginOptions(organization = "org_...")` for
  B2B multi-tenant login.
- **MFA** — enforced automatically through Universal Login (server-side). The KMP
  SDK has **no** native MFA challenge/verify API; do not attempt a direct MFA flow.
- **Passwordless OTP (SMS/email)** — **not** available in the KMP SDK; use
  Universal Login for these connections.
- **Passkeys (WebAuthn)** — supported via `passkeyLoginChallenge` /
  `passkeySignupChallenge` / `loginWithPasskey`; the app must run the platform
  WebAuthn ceremony between challenge and token exchange. Advanced — confirm the
  API shape against the beta.
- **Token handling** — request `offline_access` for refresh tokens and store via
  `CredentialsManager` (Android Keystore / iOS Keychain).

## Version compatibility

- SDK group/artifact: `com.auth0.kmp:auth0` (umbrella).
- Toolchain floors: Kotlin 2.3.21, `compileSdk 36`, `minSdk 24`, iOS 14.0+ (see
  **Toolchain compatibility**).
- Targets supported: Android and iOS only (`iosArm64` + `iosSimulatorArm64`; no
  `iosX64`).
