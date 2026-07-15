
# Auth0 Android Integration

Add authentication to Android applications using `com.auth0.android:auth0`.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```
> gh api repos/auth0/Auth0.Android/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all `implementation` dependency lines instead of any hardcoded version below. If the command fails, fall back to checking https://github.com/auth0/Auth0.Android/releases.

## Critical rules

- Before running any part of the automatic setup that writes to `strings.xml`, you MUST ask the user for explicit confirmation before proceeding.
- After either automatic or manual Auth0 configuration, you MUST apply the required Post-Setup changes to the project (manifest placeholders in `app/build.gradle` for `auth0Domain` and `auth0Scheme`, etc.) before treating the integration as complete.

## Prerequisites

- Android API 21 or higher
- Kotlin or Java project
- Auth0 account with a Native application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **React Native apps**: Use the Auth0 React Native integration
- **Flutter apps**: Use the native Flutter Auth0 SDK
- **Web SPAs** (React, Angular, Vue): Use the Auth0 React, Angular, or Vue integration
- **Node.js/Express servers**: Use the Auth0 Express integration
- **iOS/macOS apps**: Use the Auth0 Swift integration

## Quick Start Workflow

1. **Install SDK**: Add the Auth0 Android SDK dependency to your `build.gradle`:
   ```gradle
   implementation 'com.auth0.android:auth0:{LATEST_VERSION}'
   ```

2. **Configure Auth0**:

   > **Agent instruction:** Check whether the user prompt already includes both Auth0 **Client ID** and **Domain**.
   > - If both are provided, proceed directly to **Manual Setup** in the Setup Guide section below using those values.
   > - If either is missing, you MUST ask the user BEFORE writing any code or files:
   >   - Question: "How would you like to configure Auth0 for this project?"
   >   - Options: "Automatic setup (Recommended) — Auth0 CLI creates the app and writes credentials to strings.xml" / "Manual setup — I'll provide my Client ID and Domain"
   >
   > Then follow the Setup Guide section below for the chosen path.
   > **Do NOT proceed to step 3 until Auth0 credentials are confirmed.**

3. **Initialize**: Create an Auth0 account instance:
   ```kotlin
   import com.auth0.android.Auth0

   val account = Auth0.getInstance(context)
   ```

4. **Add Auth UI**: Implement login and logout with Web Auth:

   > **Agent instruction:** Before adding new UI elements, search the project for existing click handlers for login, logout, sign-in, or sign-out buttons (e.g., `loginButton`, `signInButton`, `logoutButton`, `signOutButton`, or `setOnClickListener` with auth-related naming). If existing handlers are found, hook the Auth0 code into them without modifying the existing UI. Only create new buttons if no existing handlers are found.

   **Login:**
   ```kotlin
   import com.auth0.android.Auth0
   import com.auth0.android.authentication.AuthenticationAPIClient
   import com.auth0.android.authentication.storage.SecureCredentialsManager
   import com.auth0.android.authentication.storage.SharedPreferencesStorage
   import com.auth0.android.callback.Callback
   import com.auth0.android.authentication.AuthenticationException
   import com.auth0.android.provider.WebAuthProvider
   import com.auth0.android.result.Credentials

   val account = Auth0.getInstance(context)
   val authentication = AuthenticationAPIClient(account)
   val storage = SharedPreferencesStorage(context)
   val credentialsManager = SecureCredentialsManager(context, authentication, storage)

   WebAuthProvider.login(account)
       .withScheme(getString(R.string.com_auth0_scheme))
       .withScope("openid profile email offline_access")
       .start(this, object : Callback<Credentials, AuthenticationException> {
           override fun onSuccess(result: Credentials) {
               // User authenticated
               val idToken = result.idToken
               val accessToken = result.accessToken
               // Store credentials securely
               credentialsManager.saveCredentials(result)
           }
           override fun onFailure(error: AuthenticationException) {
               // Handle authentication failure
               Log.e("Auth0", "Authentication failed", error)
           }
       })
   ```

   **Logout:**
   ```kotlin
   WebAuthProvider.logout(account)
       .withScheme(getString(R.string.com_auth0_scheme))
       .start(this, object : Callback<Void?, AuthenticationException> {
           override fun onSuccess(result: Void) {
               // User logged out
           }
           override fun onFailure(error: AuthenticationException) {
               Log.e("Auth0", "Logout failed", error)
           }
       })
   ```

5. **Build & Verify**:

   > **Agent instruction:** After completing the integration, build the project to verify it compiles successfully:
   > ```bash
   > ./gradlew assembleDebug
   > ```
   > If the build fails, analyze the error output and fix the issues. Common integration build failures include:
   > - **Unresolved reference**: Missing import statements — add the required `import com.auth0.android.*` imports
   > - **Cannot resolve symbol `R.string.com_auth0_scheme`**: `strings.xml` not updated — verify `com_auth0_scheme`, `com_auth0_client_id`, and `com_auth0_domain` entries exist
   > - **Incompatible types in callback**: Callback type parameters don't match — ensure `Callback<Credentials, AuthenticationException>` for login and `Callback<Void?, AuthenticationException>` for logout
   > - **Unresolved `lifecycleScope`**: Missing dependency — add `implementation 'androidx.lifecycle:lifecycle-runtime-ktx:2.6.+'` or move code out of coroutine scope
   > - **minSdk too low**: SDK requires API 21+ — update `minSdkVersion` to at least 21
   > - **Java version mismatch**: SDK requires Java 8 — add `compileOptions` with `JavaVersion.VERSION_1_8`
   >
   > Re-run the build after each fix. Track the number of build-fix iterations.
   >
   > **Failcheck:** If the build still fails after 5–6 fix attempts, stop and ask the user:
   > - Question: "The build is still failing after several fix attempts. How would you like to proceed?"
   > - Options: "Let the agent continue fixing iteratively" / "I'll fix it manually — show me the errors" / "Skip build verification and proceed"
   >
   > Repeat this check after every 5–6 iterations if errors persist. Do not leave the project in a non-compiling state without the user's explicit consent.

   The callback URL must match your Auth0 application settings: `{SCHEME}://{YOUR_AUTH0_DOMAIN}/android/{YOUR_APP_PACKAGE_NAME}/callback`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| App type not set to Native in Auth0 Dashboard | Create a Native application type in your Auth0 tenant. The Android SDK requires Native app configuration, not Machine-to-Machine or other types. |
| Missing callback URL in Allowed Callback URLs | Add `{SCHEME}://{YOUR_AUTH0_DOMAIN}/android/{YOUR_APP_PACKAGE_NAME}/callback` to your Auth0 application's Allowed Callback URLs setting, where `{SCHEME}` matches `com_auth0_scheme` in `strings.xml` (e.g., `demo` by default). |
| Missing `<uses-permission android:name="android.permission.INTERNET" />` | Add the INTERNET permission to `AndroidManifest.xml`. The SDK requires network access for authentication. |
| Custom scheme in lowercase | Android requires scheme names to be lowercase. Use `https` (recommended) or lowercase custom scheme like `myapp://callback`. |
| Forgetting `.validateClaims()` on direct auth calls | Always call `.validateClaims()` when using `AuthenticationAPIClient` directly (for database, passwordless, or API login). Web Auth validates automatically. |
| Storing tokens in SharedPreferences without encryption | Use `SecureCredentialsManager` to store credentials. Never store tokens manually in plain text. The manager encrypts tokens at rest. |
| Missing manifest placeholders | Add `manifestPlaceholders = [auth0Domain: "@string/com_auth0_domain", auth0Scheme: "@string/com_auth0_scheme"]` to your `build.gradle` `defaultConfig` block. |

## Related Capabilities

- Auth0 setup — set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Multi-factor authentication → ask for MFA (feature:mfa)
- iOS/macOS authentication → use the Auth0 Swift integration
- Manage Auth0 resources from the terminal → use the Auth0 CLI (`tooling-cli`)

## Quick Reference

### Core Classes

| Class | Purpose |
|-------|---------|
| `Auth0` | Entry point for SDK, holds app credentials |
| `WebAuthProvider` | OAuth 2.0 login/logout via browser |
| `AuthenticationAPIClient` | Direct API calls (database login, passwordless, MFA) |
| `SecureCredentialsManager` | Secure storage and retrieval of credentials |
| `Credentials` | User tokens and expiration |

### Common Use Cases

- Log in with Web Auth (see the Web Auth Login section below)
- Log out (see the Web Auth Logout section below)
- Store credentials securely (see the Credential Storage section below)
- Require biometric authentication (see the Biometric-Protected Credentials section below)
- Database login (see the Database Login section below)
- Passwordless authentication (see the Passwordless Authentication section below)
- Handle MFA (see the MFA Handling section below)
- Call protected APIs (see the Calling Protected APIs section below)

## References

- [Auth0 Android SDK Documentation](https://auth0.com/docs/libraries/auth0-android)
- [Auth0 Android GitHub Repository](https://github.com/auth0/auth0-android)
- [Android SDK Javadoc](https://auth0.com/docs/references/android)
- [Auth0 Android Quickstart](https://auth0.com/docs/quickstart/native/android)
- [Sample App](https://github.com/auth0-samples/auth0-android-sample)

---

# Auth0 Android Testing & Reference

## Testing Checklist

Before deploying your Auth0 Android integration, verify:

- [ ] **Emulator Testing**
  - [ ] Login flow completes end-to-end
  - [ ] Logout clears credentials
  - [ ] Credentials persist after app restart
  - [ ] Token refresh works when token expires
  - [ ] Error messages display correctly

- [ ] **Physical Device Testing**
  - [ ] Login flow works on actual device
  - [ ] Custom Tabs browser opens correctly
  - [ ] Deep link callback works (https:// or custom scheme)
  - [ ] Biometric authentication prompts appear (if implemented)
  - [ ] App Links work with https:// scheme

- [ ] **Auth0 Configuration**
  - [ ] Callback URL matches exactly in Auth0 Dashboard
  - [ ] Logout URL configured in Auth0 Dashboard
  - [ ] Application type is "Native" (not SPA or Machine-to-Machine)
  - [ ] Client ID and domain are correct

- [ ] **Security**
  - [ ] Credentials stored via SecureCredentialsManager
  - [ ] No tokens logged to console
  - [ ] INTERNET permission added to manifest
  - [ ] ProGuard rules not stripping Auth0 classes

- [ ] **Edge Cases**
  - [ ] User cancels login mid-flow
  - [ ] Network timeout during login
  - [ ] Device goes to sleep during login
  - [ ] Token refresh fails gracefully
  - [ ] MFA challenges work (if enabled)

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Deep link not working after login | Callback URL mismatch or manifest placeholders not set | Verify callback URL format: `https://{DOMAIN}/android/{PACKAGE}/callback`. Ensure `auth0Domain` and `auth0Scheme` in manifest placeholders. Rebuild and reinstall app. |
| "Invalid state" error on redirect | Authentication session timed out or was invalidated | This can happen after long delays or device sleep. Redirect user to login again. For testing, keep login window active. |
| Custom Tabs browser not opening | No browser available on device or Custom Tabs disabled | Check `error.isBrowserAppNotAvailable`. Ensure device has Chrome or compatible browser. Fallback to system browser if needed. |
| Biometric prompt not showing | Min API < 21, biometric not enrolled, or options not set | Set min SDK to 21+. Enroll fingerprint/face on device. Verify `LocalAuthenticationOptions` and `BiometricPolicy` configuration. Check `setDeviceCredentialFallback(true)` for PIN/password fallback. |
| Token refresh fails and user can't access APIs | Refresh token expired (typically after 30 days of inactivity) | Catch `CredentialsManagerException` with code `REFRESH_FAILED`. Trigger `WebAuthProvider.login()` to re-authenticate. Inform user they need to log in again. |
| ProGuard/R8 strips Auth0 classes and crashes | ProGuard rules not applied | Auth0 rules are bundled automatically. If issues occur, add `-keep class com.auth0.** { *; }` to your `proguard-rules.pro` or disable minification for testing. |
| Login works on emulator but fails on physical device | Certificate pinning or network differences | Ensure device has valid time/date. Check network connectivity. For HTTPS scheme, verify Digital Asset Links are set up for your domain. |
| Credentials lost after app update | Shared storage encrypted with device key that changed | This is expected behavior after major system updates. Gracefully handle `NO_CREDENTIALS` and redirect to login. |

## Security Considerations

### PKCE Enabled by Default

The Auth0 Android SDK automatically enables PKCE (Proof Key for Code Exchange) for all authorization flows. PKCE provides an extra layer of security for native apps and is always used by `WebAuthProvider`.

### Secure Credential Storage

Always use `SecureCredentialsManager` for token storage:

```kotlin
val authentication = AuthenticationAPIClient(account)
val storage = SharedPreferencesStorage(context)
val manager = SecureCredentialsManager(context, authentication, storage)
manager.saveCredentials(credentials)  // Encrypted at rest
```

Never store tokens in:
- Plain `SharedPreferences` — Not encrypted
- `DataStore` without encryption — Unencrypted
- App-level files — Accessible to other apps

### HTTPS Scheme Recommended

Prefer `https://` scheme over custom schemes:

```gradle
manifestPlaceholders = [
    auth0Domain: "@string/com_auth0_domain",
    auth0Scheme: "@string/com_auth0_scheme"
]
```

Benefits:
- Leverages Android App Links for secure deep linking
- Requires Digital Asset Links verification
- No prompt when opening links
- More difficult to intercept

Custom schemes are lower security but work if HTTPS is not feasible.

### Never Log Tokens

Do not log access tokens, ID tokens, or refresh tokens:

```kotlin
// BAD
Log.d("Auth0", "Token: ${credentials.accessToken}")

// GOOD
Log.d("Auth0", "Authentication successful")
```

Logs may be accessible via `adb logcat` or included in crash reports.

### Validate Tokens

Always call `.validateClaims()` when using direct API calls:

```kotlin
authentication.login(...)
    .validateClaims()  // Validates ID token claims
    .start(callback)
```

This verifies:
- Token signature
- Token expiration
- Audience (aud) claim
- Issuer (iss) claim

`WebAuthProvider` validates automatically, but direct API calls do not.

### Biometric Protection

When storing credentials with biometric protection, use strong authentication:

```kotlin
val options = LocalAuthenticationOptions.Builder()
    .setAuthenticationLevel(AuthenticationLevel.STRONG)
    .setPolicy(BiometricPolicy.Always)
    .build()
```

Avoid:
- `AuthenticationLevel.WEAK` for sensitive operations
- `BiometricPolicy.Never` when protecting credentials
- `setDeviceCredentialFallback(true)` with WEAK level

## API Reference

### Auth0

Entry point for SDK initialization:

```kotlin
// From strings.xml
val account = Auth0.getInstance(context)

// Direct
val account = Auth0.getInstance("CLIENT_ID", "DOMAIN")
```

### WebAuthProvider

Browser-based OAuth 2.0 flow:

```kotlin
WebAuthProvider.login(account)
    .withScheme(getString(R.string.com_auth0_scheme))
    .withScope("openid profile email")
    .withAudience("https://api.example.com")
    .withConnection("google-oauth2")
    .withOrganization("org_id")
    .withInvitation("invitation_id")
    .withPrompt("login")  // "login" or "none"
    .withCustomTabsOptions(customTabs)
    .start(context, callback)

WebAuthProvider.logout(account)
    .withScheme(getString(R.string.com_auth0_scheme))
    .start(context, callback)
```

### AuthenticationAPIClient

Direct API calls:

```kotlin
val authentication = AuthenticationAPIClient(account)

authentication.login(email, password, realm)
authentication.signUp(email, password, username, connection)
authentication.passwordlessWithEmail(email, type)
authentication.loginWithEmail(email, code)
authentication.mfaClient(mfaToken)
```

### SecureCredentialsManager

Secure credential storage:

```kotlin
val authentication = AuthenticationAPIClient(account)
val storage = SharedPreferencesStorage(context)
val manager = SecureCredentialsManager(context, authentication, storage)

manager.saveCredentials(credentials)
manager.hasValidCredentials(): Boolean
manager.getCredentials(callback)
manager.clearCredentials()
```

### Credentials

User tokens and metadata:

```kotlin
val accessToken = credentials.accessToken      // OAuth 2.0 access token
val idToken = credentials.idToken              // OpenID Connect ID token
val refreshToken = credentials.refreshToken    // Refresh token
val expiresAt = credentials.expiresAt          // Expiration timestamp
val scope = credentials.scope                  // Granted scopes
val type = credentials.type                    // "Bearer"

// ID token claims
val sub = credentials.claims["sub"]            // Subject (user ID)
val name = credentials.claims["name"]
val email = credentials.claims["email"]
val emailVerified = credentials.claims["email_verified"]
```

### LocalAuthenticationOptions

Biometric authentication configuration:

```kotlin
LocalAuthenticationOptions.Builder()
    .setTitle("Authenticate")
    .setDescription("Verify your identity")
    .setAuthenticationLevel(AuthenticationLevel.STRONG)
    .setNegativeButtonText("Cancel")
    .setDeviceCredentialFallback(true)
    .setPolicy(BiometricPolicy.Session(300))
    .build()
```

### Exception Handling

```kotlin
// AuthenticationException
error.isMultifactorRequired: Boolean
error.isBrowserAppNotAvailable: Boolean
error.isAuthenticationCanceled: Boolean
error.statusCode: Int
error.message: String?

// CredentialsManagerException
error.code: String  // "NO_CREDENTIALS", "CREDENTIALS_EXPIRED", "REFRESH_FAILED"
error.message: String?
```

## Related Capabilities

- Multi-factor authentication → ask for MFA (feature:mfa)
- Auth0 setup — set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- iOS/macOS authentication → use the Auth0 Swift integration
- React Native authentication → use the Auth0 React Native integration

## References

- [Auth0 Android SDK Documentation](https://auth0.com/docs/libraries/auth0-android)
- [Auth0 Android Quickstart](https://auth0.com/docs/quickstart/native/android)
- [Auth0 Android GitHub Repository](https://github.com/auth0/auth0-android)
- [Android SDK Javadoc](https://auth0.com/docs/references/android)
- [Sample App](https://github.com/auth0-samples/auth0-android-sample)
- [Android Security Best Practices](https://developer.android.com/privacy-and-security)

---

# Auth0 Android Integration Patterns

> **Agent instruction:** Before creating new UI elements (buttons, click handlers), search the user's project for existing login/logout/sign-in/sign-out click handlers. If found, hook Auth0 code into the existing handlers without modifying the UI. Only create new buttons if no existing handlers are found.

## Web Auth Login

Use the browser-based Web Auth flow for the most secure login experience:

```kotlin
import com.auth0.android.Auth0
import com.auth0.android.provider.WebAuthProvider
import com.auth0.android.callback.Callback
import com.auth0.android.result.Credentials
import com.auth0.android.authentication.AuthenticationException

val account = Auth0.getInstance(context)

WebAuthProvider.login(account)
    .withScheme(getString(R.string.com_auth0_scheme))
    .withScope("openid profile email offline_access")
    .withAudience("https://api.example.com")  // Optional: your API audience
    .withOrganization("org_abc123")  // Optional: for organization login
    .start(context, object : Callback<Credentials, AuthenticationException> {
        override fun onSuccess(result: Credentials) {
            // User authenticated successfully
            val idToken = result.idToken
            val accessToken = result.accessToken
            val refreshToken = result.refreshToken
            val expiresAt = result.expiresAt

            // Store credentials securely (see Credential Storage section)
        }

        override fun onFailure(error: AuthenticationException) {
            // Handle authentication failure
            when {
                error.isBrowserAppNotAvailable -> {
                    // No browser available on device
                }
                error.isAuthenticationCanceled -> {
                    // User canceled the login
                }
                else -> {
                    // Other authentication error
                    Log.e("Auth0", error.message.orEmpty())
                }
            }
        }
    })
```

**Options**:
- `.withScheme()` — URL scheme matching `com_auth0_scheme` in strings.xml (required)
- `.withScope()` — Requested scopes (space-separated)
- `.withAudience()` — Your API identifier for the access token
- `.withOrganization()` — Organization ID or name for SSO
- `.withConnection()` — Force a specific connection (e.g., "google-oauth2")
- `.withPrompt()` — Force login prompt: `"login"` or `"none"`

## Web Auth Logout

Log out the user and clear their session:

```kotlin
WebAuthProvider.logout(account)
    .withScheme(getString(R.string.com_auth0_scheme))  // Match your configured scheme
    .start(this, object : Callback<Void?, AuthenticationException> {
        override fun onSuccess(result: Void) {
            // User logged out successfully
            // Clear your app's local state
        }

        override fun onFailure(error: AuthenticationException) {
            // Logout failed
            Log.e("Auth0", "Logout error: ${error.message}")
        }
    })
```

After logout, clear stored credentials:

```kotlin
val authentication = AuthenticationAPIClient(account)
val storage = SharedPreferencesStorage(this)
val manager = SecureCredentialsManager(this, authentication, storage)
manager.clearCredentials()
```

## Credential Storage

Store and retrieve credentials securely using `SecureCredentialsManager`:

```kotlin
import com.auth0.android.authentication.AuthenticationAPIClient
import com.auth0.android.authentication.storage.CredentialsManagerException
import com.auth0.android.authentication.storage.SecureCredentialsManager
import com.auth0.android.authentication.storage.SharedPreferencesStorage
import com.auth0.android.callback.Callback
import com.auth0.android.result.Credentials

val authentication = AuthenticationAPIClient(account)
val storage = SharedPreferencesStorage(context)
val manager = SecureCredentialsManager(context, authentication, storage)

// Save credentials after login
manager.saveCredentials(credentials)

// Check if valid credentials exist
if (manager.hasValidCredentials()) {
    // Valid credentials stored
}

// Retrieve credentials (auto-refreshes if needed)
manager.getCredentials(object : Callback<Credentials, CredentialsManagerException> {
    override fun onSuccess(result: Credentials) {
        val accessToken = result.accessToken
        val idToken = result.idToken
        // Use tokens for API calls
    }

    override fun onFailure(error: CredentialsManagerException) {
        when (error.code) {
            "NO_CREDENTIALS" -> {
                // No credentials stored
            }
            "CREDENTIALS_EXPIRED" -> {
                // Credentials expired, user needs to login again
            }
            "REFRESH_FAILED" -> {
                // Refresh token expired, trigger re-authentication
            }
            else -> Log.e("CredentialsManager", error.message.orEmpty())
        }
    }
})

// Clear credentials (logout)
manager.clearCredentials()
```

**Key Features**:
- Credentials are encrypted at rest
- Automatic token refresh when credentials expire
- Handles refresh token expiration gracefully

## Biometric-Protected Credentials

Protect stored credentials with biometric authentication:

```kotlin
import com.auth0.android.authentication.AuthenticationAPIClient
import com.auth0.android.authentication.storage.SecureCredentialsManager
import com.auth0.android.authentication.storage.SharedPreferencesStorage
import com.auth0.android.authentication.storage.LocalAuthenticationOptions
import com.auth0.android.authentication.storage.AuthenticationLevel
import com.auth0.android.authentication.storage.BiometricPolicy
import androidx.fragment.app.FragmentActivity

val localAuthOptions = LocalAuthenticationOptions.Builder()
    .setTitle("Authenticate")
    .setDescription("Verify your fingerprint to access your account")
    .setAuthenticationLevel(AuthenticationLevel.STRONG)  // Fingerprint or face recognition
    .setNegativeButtonText("Cancel")
    .setDeviceCredentialFallback(true)  // Allow PIN/password fallback
    .setPolicy(BiometricPolicy.Session(300))  // Require biometric every 5 minutes
    .build()

val fragmentActivity: FragmentActivity = this  // Your Activity
val authentication = AuthenticationAPIClient(account)
val storage = SharedPreferencesStorage(context)
val manager = SecureCredentialsManager(
    context,
    authentication,
    storage,
    fragmentActivity,
    localAuthOptions
)

// Credentials are now biometric-protected
manager.saveCredentials(credentials)

// User must authenticate with biometric/device credential to retrieve
manager.getCredentials(callback)
```

**Authentication Levels**:
- `AuthenticationLevel.STRONG` — Biometric authentication required
- `AuthenticationLevel.WEAK` — Biometric or device credential (PIN/password)
- `AuthenticationLevel.DEVICE_CREDENTIAL` — PIN/password only

**Biometric Policies**:
- `BiometricPolicy.Never` — Never require biometric for retrieval
- `BiometricPolicy.Always` — Always require biometric
- `BiometricPolicy.Session(seconds)` — Require biometric every N seconds
- `BiometricPolicy.AppLifecycle` — Require biometric on app resume

## Database Login

Authenticate using username and password (requires `.validateClaims()`):

```kotlin
import com.auth0.android.authentication.AuthenticationAPIClient
import com.auth0.android.callback.Callback
import com.auth0.android.authentication.AuthenticationException
import com.auth0.android.result.Credentials

val authentication = AuthenticationAPIClient(account)

authentication.login(
    email = "user@example.com",
    password = "securePassword123",
    realm = "Username-Password-Authentication"
)
    .validateClaims()  // Critical: validate ID token claims
    .setScope("openid profile email offline_access")
    .start(object : Callback<Credentials, AuthenticationException> {
        override fun onSuccess(result: Credentials) {
            // User authenticated
            manager.saveCredentials(result)
        }

        override fun onFailure(error: AuthenticationException) {
            when {
                error.isMultifactorRequired -> {
                    // MFA required - see MFA Handling section
                }
                error.statusCode == 403 -> {
                    // Invalid credentials
                }
                else -> Log.e("Auth0", error.message.orEmpty())
            }
        }
    })
```

**Important**: Always call `.validateClaims()` when using `AuthenticationAPIClient` directly.

## Passwordless Authentication

Two-step passwordless flow using email codes:

### Step 1: Request Passwordless Code

```kotlin
import com.auth0.android.authentication.AuthenticationAPIClient
import com.auth0.android.authentication.PasswordlessType
import com.auth0.android.callback.Callback
import com.auth0.android.authentication.AuthenticationException

val authentication = AuthenticationAPIClient(account)

authentication.passwordlessWithEmail(
    email = "user@example.com",
    type = PasswordlessType.CODE
)
    .start(object : Callback<Void?, AuthenticationException> {
        override fun onSuccess(result: Void?) {
            // Code sent to email - show user a screen to enter code
        }

        override fun onFailure(error: AuthenticationException) {
            Log.e("Auth0", error.message.orEmpty())
        }
    })
```

### Step 2: Log In with Code

```kotlin
authentication.loginWithEmail(
    email = "user@example.com",
    code = "123456"  // Code from email
)
    .validateClaims()
    .start(object : Callback<Credentials, AuthenticationException> {
        override fun onSuccess(result: Credentials) {
            // User authenticated
            manager.saveCredentials(result)
        }

        override fun onFailure(error: AuthenticationException) {
            // Invalid or expired code
            Log.e("Auth0", error.message.orEmpty())
        }
    })
```

## Sign Up

Create a new account using the database connection:

```kotlin
val authentication = AuthenticationAPIClient(account)

authentication.signUp(
    email = "newuser@example.com",
    password = "securePassword123",
    username = "newuser",
    connection = "Username-Password-Authentication"
)
    .start(object : Callback<Void?, AuthenticationException> {
        override fun onSuccess(result: Void?) {
            // Account created successfully - user should now log in
        }

        override fun onFailure(error: AuthenticationException) {
            when {
                error.statusCode == 400 -> {
                    // User already exists or validation error
                }
                else -> Log.e("Auth0", error.message.orEmpty())
            }
        }
    })
```

After successful sign up, direct the user to log in using the database login flow.

## Calling Protected APIs

Attach the access token to your API requests:

```kotlin
import com.auth0.android.authentication.AuthenticationAPIClient
import com.auth0.android.authentication.storage.CredentialsManagerException
import com.auth0.android.authentication.storage.SecureCredentialsManager
import com.auth0.android.authentication.storage.SharedPreferencesStorage
import com.auth0.android.callback.Callback
import com.auth0.android.result.Credentials
import okhttp3.OkHttpClient
import okhttp3.Interceptor

val authentication = AuthenticationAPIClient(account)
val storage = SharedPreferencesStorage(context)
val manager = SecureCredentialsManager(context, authentication, storage)

manager.getCredentials(object : Callback<Credentials, CredentialsManagerException> {
    override fun onSuccess(result: Credentials) {
        val accessToken = result.accessToken

        // Use with OkHttp
        val httpClient = OkHttpClient.Builder()
            .addInterceptor(Interceptor { chain ->
                val request = chain.request().newBuilder()
                    .header("Authorization", "Bearer $accessToken")
                    .build()
                chain.proceed(request)
            })
            .build()

        // Or manually for other HTTP libraries
        val headers = mapOf("Authorization" to "Bearer $accessToken")
        // Use headers in your API request
    }

    override fun onFailure(error: CredentialsManagerException) {
        // Handle error - may need to re-authenticate
    }
})
```

If the API returns 401 Unauthorized, refresh the credentials and retry:

```kotlin
manager.getCredentials(object : Callback<Credentials, CredentialsManagerException> {
    override fun onSuccess(result: Credentials) {
        // Credentials were auto-refreshed by the manager
        val newAccessToken = result.accessToken
        retryApiCall(newAccessToken)
    }

    override fun onFailure(error: CredentialsManagerException) {
        if (error.code == "REFRESH_FAILED") {
            // Refresh token expired - trigger login again
        }
    }
})
```

## MFA Handling

Handle multi-factor authentication challenges:

### Detect MFA Required

```kotlin
authentication.login(...)
    .validateClaims()
    .start(object : Callback<Credentials, AuthenticationException> {
        override fun onFailure(error: AuthenticationException) {
            if (error.isMultifactorRequired) {
                val mfaToken = error.mfaRequiredErrorPayload?.mfaToken
                // Proceed to enrollment or challenge screen
            }
        }
    })
```

### Enroll in MFA

```kotlin
val mfaToken = error.mfaRequiredErrorPayload?.mfaToken ?: return
val mfaClient = authentication.mfaClient(mfaToken)

// Enroll in OTP
mfaClient.enroll(MfaEnrollmentType.Otp)
    .start(object : Callback<MfaEnrollment, AuthenticationException> {
        override fun onSuccess(enrollment: MfaEnrollment) {
            val recoveryCode = enrollment.recoveryCode
            val secret = enrollment.secret  // For OTP app
            // Show QR code to user
        }

        override fun onFailure(error: AuthenticationException) {
            Log.e("MFA", error.message.orEmpty())
        }
    })
```

### Challenge MFA

```kotlin
mfaClient.challenge(
    authenticatorId = "dev_abc123",  // From enrollments list
    challengeType = MfaChallengeType.OTP
)
    .start(object : Callback<MfaChallenge, AuthenticationException> {
        override fun onSuccess(challenge: MfaChallenge) {
            val challengeId = challenge.challengeId
            // Show user OTP input screen
        }

        override fun onFailure(error: AuthenticationException) {
            Log.e("MFA", error.message.orEmpty())
        }
    })
```

### Verify Challenge

```kotlin
mfaClient.verifyChallenge(
    challengeId = "Fe26...session_id",
    otp = "123456"  // User's one-time password
)
    .validateClaims()
    .start(object : Callback<Credentials, AuthenticationException> {
        override fun onSuccess(result: Credentials) {
            // MFA verified - user now authenticated
            manager.saveCredentials(result)
        }

        override fun onFailure(error: AuthenticationException) {
            // Invalid OTP or expired challenge
            Log.e("MFA", error.message.orEmpty())
        }
    })
```

## Organizations

Use Organizations for enterprise SSO and multi-tenancy:

```kotlin
// Log in with organization
WebAuthProvider.login(account)
    .withScheme(getString(R.string.com_auth0_scheme))
    .withOrganization("org_abc123")  // Organization ID
    .withScope("openid profile email")
    .start(this, object : Callback<Credentials, AuthenticationException> {
        override fun onSuccess(result: Credentials) {
            // User authenticated to organization
            val orgId = result.claims["org_id"]
        }

        override fun onFailure(error: AuthenticationException) {
            // Handle error
        }
    })

// Handle organization invitation link
val uri = intent.data  // From deep link
val organizationId = uri?.getQueryParameter("organization")
val invitation = uri?.getQueryParameter("invitation")

if (invitation != null) {
    WebAuthProvider.login(account)
        .withScheme(getString(R.string.com_auth0_scheme))
        .withInvitation(invitation)
        .start(this, callback)
}
```

## Error Handling

Handle authentication errors gracefully:

```kotlin
authentication.login(...)
    .start(object : Callback<Credentials, AuthenticationException> {
        override fun onFailure(error: AuthenticationException) {
            when {
                error.isMultifactorRequired -> {
                    // MFA enrollment or challenge required
                }
                error.isBrowserAppNotAvailable -> {
                    // No browser available
                    // Fallback to in-app WebView (not recommended)
                }
                error.isAuthenticationCanceled -> {
                    // User canceled the login flow
                }
                error.statusCode == 429 -> {
                    // Rate limited - too many login attempts
                }
                error.statusCode == 403 -> {
                    // Invalid credentials or user blocked
                }
                error.statusCode == 500 -> {
                    // Server error - retry later
                }
                else -> {
                    // Generic error
                    Log.e("Auth0", "Error: ${error.message}")
                }
            }
        }
    })
```

**CredentialsManagerException codes**:
- `NO_CREDENTIALS` — No credentials stored
- `CREDENTIALS_EXPIRED` — Stored credentials expired
- `REFRESH_FAILED` — Refresh token expired or invalid
- `INVALID_SECURITY` — Biometric authentication failed

## Custom Tabs

Customize the browser appearance:

```kotlin
import com.auth0.android.provider.CustomTabsOptions
import com.auth0.android.provider.WebAuthProvider

val customTabs = CustomTabsOptions.newBuilder()
    .withToolbarColor(R.color.toolbar_blue)
    .withShowTitle(true)
    .build()

WebAuthProvider.login(account)
    .withScheme(getString(R.string.com_auth0_scheme))
    .withCustomTabsOptions(customTabs)
    .start(this, callback)
```

**Options**:
- `.withToolbarColor()` — Toolbar color resource
- `.withShowTitle()` — Show the page title
- `.withStartAnimations()` — Entrance animation
- `.withExitAnimations()` — Exit animation

## Common Issues

| Issue | Solution |
|-------|----------|
| Deep link callback not working | Verify callback URL matches exactly: `https://{DOMAIN}/android/{PACKAGE}/callback`. Check manifest placeholders in `build.gradle`. |
| "Invalid state" error on callback | The auth session timed out or was invalidated. This can happen if the device went to sleep. Redirect user to login again. |
| Custom Tabs not opening | User may have disabled Custom Tabs. The SDK falls back to Chrome or system browser. If no browser available, `isBrowserAppNotAvailable` is true. |
| Biometric prompt not showing | Min SDK must be 21+ for biometric. Device must have fingerprint/face sensor registered. `setDeviceCredentialFallback(true)` allows PIN/password. |
| Token refresh fails | Refresh token may have expired (typically after 30 days). Trigger re-authentication with `WebAuthProvider.login()`. |
| ProGuard obfuscation breaks Auth0 | Auth0 rules are included automatically. If issues occur, add `-keep class com.auth0.** { *; }` to your `proguard-rules.pro`. |

---

# Auth0 Android Setup Guide

> **Agent instruction:** Before providing version numbers, fetch the latest release:
> `gh api repos/auth0/Auth0.Android/releases/latest --jq '.tag_name'`
> Replace `{LATEST_VERSION}` in all dependency lines with the result.

## Setup Overview

1. Add SDK dependency to `build.gradle`
2. Configure Auth0 (automatic inline script or manual credentials)
3. Add manifest placeholders and INTERNET permission (post-setup)

## Auth0 Configuration

> **Agent instruction:** First, check whether the user prompt already includes both Auth0 **Client ID** and **Domain**.
> - If both are provided, skip the setup-choice question and proceed directly to **Manual Setup (User-Provided Credentials)** using those values.
> - If either value is missing, ask the user:
>   - Question: "How would you like to configure Auth0 for this project?"
>   - Options: "Automatic setup (Recommended) — Auth0 CLI creates the app and writes credentials to strings.xml" / "Manual setup — I'll provide my Client ID and Domain"
>
> Follow the matching section below based on their choice.

### Automatic Setup

Below automates the setup. Inform the user that Auth0 credentials will be written to `strings.xml`.

**Before running any part of this setup that writes to `strings.xml`, you must ask the user for explicit confirmation.** Follow the steps below precisely.

#### Step 1: Check for existing strings.xml and confirm with user

Before writing credentials, check whether a `strings.xml` already exists:

```bash
test -f app/src/main/res/values/strings.xml && echo "STRINGS_EXISTS" || echo "STRINGS_NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding — do not continue until the user confirms:

- If `strings.xml` exists, ask:
  - Question: "A `strings.xml` file already exists. This setup will add or update the Auth0 credential entries (`com_auth0_client_id`, `com_auth0_domain`, `com_auth0_scheme`) without modifying other entries. Do you want to proceed?"
  - Options: "Yes, update existing strings.xml" / "No, I'll update it manually"

- If `strings.xml` does **not** exist, ask:
  - Question: "This setup will create `app/src/main/res/values/strings.xml` with Auth0 credentials (`com_auth0_client_id`, `com_auth0_domain`, `com_auth0_scheme`). Do you want to proceed?"
  - Options: "Yes, create strings.xml" / "No, I'll configure it manually"

**Do not proceed with writing to strings.xml unless the user selects the confirmation option.**

#### Step 2: Run automated setup (only after confirmation)

```bash
#!/bin/bash

PROJECT_PATH="${1:-$PWD}"
SCHEME="demo"

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  [[ "$OSTYPE" == "darwin"* ]] && brew install auth0/auth0-cli/auth0 || \
  curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
fi

# Login
auth0 login 2>/dev/null || auth0 login

# Find build.gradle / build.gradle.kts
if [ -f "$PROJECT_PATH/app/build.gradle" ]; then
  GRADLE_FILE="$PROJECT_PATH/app/build.gradle"
elif [ -f "$PROJECT_PATH/app/build.gradle.kts" ]; then
  GRADLE_FILE="$PROJECT_PATH/app/build.gradle.kts"
else
  echo "❌ No app/build.gradle or app/build.gradle.kts found in $PROJECT_PATH"
  exit 1
fi

# Extract applicationId
PACKAGE_NAME=$(grep -E 'applicationId\s*=?\s*"[^"]*"' "$GRADLE_FILE" | grep -oE '"[^"]*"' | tr -d '"' | head -1)
if [ -z "$PACKAGE_NAME" ]; then
  echo "❌ Could not find applicationId in $GRADLE_FILE"
  exit 1
fi

# List existing apps and prompt to pick or create
auth0 apps list
read -p "Enter app ID (or press Enter to create a new one): " APP_ID

if [ -z "$APP_ID" ]; then
  DOMAIN=$(auth0 tenants list --csv --no-input 2>/dev/null | grep '→' | cut -d',' -f2 | tr -d ' ')
  CALLBACK_URL="${SCHEME}://${DOMAIN}/android/${PACKAGE_NAME}/callback"
  CLIENT_JSON=$(auth0 apps create \
    --name "${PACKAGE_NAME}-android" \
    --type native \
    --auth-method none \
    --callbacks "$CALLBACK_URL" \
    --logout-urls "$CALLBACK_URL" \
    --json \
    --no-input)
  CLIENT_ID=$(echo "$CLIENT_JSON" | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
else
  CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
  DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
  CALLBACK_URL="${SCHEME}://${DOMAIN}/android/${PACKAGE_NAME}/callback"
fi

# Check / create database connection
CONNECTIONS_JSON=$(auth0 api get connections --no-input 2>/dev/null || echo "[]")
CONNECTION_ID=$(echo "$CONNECTIONS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data:
    if c.get('name') == 'Username-Password-Authentication':
        print(c['id'])
        break
" 2>/dev/null)
ENABLED_CLIENTS=$(echo "$CONNECTIONS_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for c in data:
    if c.get('name') == 'Username-Password-Authentication':
        print(json.dumps(c.get('enabled_clients', [])))
        break
" 2>/dev/null)

if [ -z "$CONNECTION_ID" ]; then
  auth0 api post connections \
    --data "{\"strategy\":\"auth0\",\"name\":\"Username-Password-Authentication\",\"enabled_clients\":[\"$CLIENT_ID\"]}" \
    --no-input > /dev/null
else
  UPDATED_CLIENTS=$(echo "$ENABLED_CLIENTS" | python3 -c "
import sys, json
clients = json.load(sys.stdin)
if '$CLIENT_ID' not in clients:
    clients.append('$CLIENT_ID')
print(json.dumps(clients))
")
  auth0 api patch "connections/$CONNECTION_ID" \
    --data "{\"enabled_clients\":$UPDATED_CLIENTS}" \
    --no-input > /dev/null
fi

# Write / update strings.xml
STRINGS_FILE="$PROJECT_PATH/app/src/main/res/values/strings.xml"
mkdir -p "$(dirname "$STRINGS_FILE")"

python3 << PYEOF
import re, os

path = "$STRINGS_FILE"
entries = {
    'com_auth0_client_id': '$CLIENT_ID',
    'com_auth0_domain': '$DOMAIN',
    'com_auth0_scheme': '$SCHEME',
}

content = open(path).read() if os.path.exists(path) else ''

if '<resources' in content:
    for key, value in entries.items():
        pattern = re.compile(r'<string\s+name="' + re.escape(key) + r'"[^>]*>[\s\S]*?</string>')
        replacement = f'<string name="{key}">{value}</string>'
        if pattern.search(content):
            content = pattern.sub(replacement, content)
        else:
            content = content.replace('</resources>', f'    <string name="{key}">{value}</string>\n</resources>')
else:
    lines = ['    <string name="app_name">My App</string>']
    lines += [f'    <string name="{k}">{v}</string>' for k, v in entries.items()]
    content = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' + '\n'.join(lines) + '\n</resources>\n'

with open(path, 'w') as f:
    f.write(content)
PYEOF

echo "✅ Auth0 credentials written to $STRINGS_FILE"
echo "   Domain:       $DOMAIN"
echo "   Client ID:    $CLIENT_ID"
echo "   Package:      $PACKAGE_NAME"
echo "   Callback URL: $CALLBACK_URL"
```

After the script runs, proceed to **Post-Setup Steps** below.

### Manual Setup (User-Provided Credentials)

> **Agent instruction:** Ask the user for their Auth0 **Client ID** and **Domain**. Then update `strings.xml` with the values they provide:
> ```xml
> <string name="com_auth0_client_id">USER_PROVIDED_CLIENT_ID</string>
> <string name="com_auth0_domain">USER_PROVIDED_DOMAIN</string>
> <string name="com_auth0_scheme">demo</string>
> ```
> Remind the user to configure callback URLs in the Auth0 Dashboard:
> `demo://{DOMAIN}/android/{APPLICATION_ID}/callback`
> (add to both **Allowed Callback URLs** and **Allowed Logout URLs**).
>
> After updating strings.xml, proceed to **Post-Setup Steps** below.

### Post-Setup Steps (Required for Both Paths)

> **Agent instruction:** After either automatic or manual Auth0 configuration, the agent must apply the following changes to the project:
>
> 1. **Add manifest placeholders** to `app/build.gradle` (or `app/build.gradle.kts`) inside the `defaultConfig` block, if not already present:
>    - Groovy (`build.gradle`):
>      ```gradle
>      manifestPlaceholders = [
>          auth0Domain: "@string/com_auth0_domain",
>          auth0Scheme: "@string/com_auth0_scheme"
>      ]
>      ```
>    - Kotlin DSL (`build.gradle.kts`):
>      ```kotlin
>      manifestPlaceholders += mapOf(
>          "auth0Domain" to "@string/com_auth0_domain",
>          "auth0Scheme" to "@string/com_auth0_scheme"
>      )
>      ```
>
> 2. **Add INTERNET permission** to `AndroidManifest.xml` if not already present:
>    ```xml
>    <uses-permission android:name="android.permission.INTERNET" />
>    ```
>
> 3. **Build the project** to confirm everything compiles:
>    ```bash
>    ./gradlew assembleDebug
>    ```

## SDK Installation

Add the dependency to your module's `build.gradle`:

```gradle
dependencies {
    implementation 'com.auth0.android:auth0:{LATEST_VERSION}'
}
```

Ensure Java 8 compatibility in your `build.gradle`:

```gradle
android {
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = '1.8'
    }
}
```

## Android App Links (Recommended for Production)

> **Note:** The automatic setup script and manual setup default to a custom scheme (`demo://`) for simplicity. App Links with `https://` are recommended for production apps. To switch, update `com_auth0_scheme` to `https` in `strings.xml` and update your callback URL in the Auth0 Dashboard to `https://YOUR_AUTH0_DOMAIN/android/YOUR_APP_PACKAGE_NAME/callback`.

For the `https://` scheme, Android uses App Links for deeper integration:

1. **Digital Asset Links**: Create a `assetlinks.json` file on your Auth0 domain
   - Auth0 manages this automatically for you
   - Enables deep link routing without user prompts

2. **Auto-Verify**: Add to `build.gradle`:
   ```gradle
   android {
       defaultConfig {
           // The android:autoVerify attribute is added automatically for https schemes
       }
   }
   ```

The SDK automatically uses App Links when `com_auth0_scheme` is set to `https` in `strings.xml`.

## Custom Scheme (Alternative)

If you need a custom scheme instead of `https://`:

1. Update `strings.xml` with your custom scheme:
   ```xml
   <string name="com_auth0_scheme">myapp</string>
   ```

   The manifest placeholder already references this via `@string/com_auth0_scheme`.

2. Update callback URL in Auth0 Dashboard:
   ```
   myapp://YOUR_AUTH0_DOMAIN/android/YOUR_APP_PACKAGE_NAME/callback
   ```

3. In your code when logging out, use the same scheme:
   ```kotlin
   WebAuthProvider.logout(account)
       .withScheme(getString(R.string.com_auth0_scheme))
       .start(this, callback)
   ```

**Important**: Android requires scheme names to be lowercase.

## ProGuard/R8

The Auth0 Android SDK includes ProGuard/R8 rules automatically. You don't need to add any manual configuration. The library's `proguard-rules.pro` is included in the AAR file and will be merged into your app's build.

If you encounter obfuscation issues:

1. Disable obfuscation for Auth0 classes (in `proguard-rules.pro`):
   ```
   -keep class com.auth0.** { *; }
   ```

2. Or rebuild with debugging enabled temporarily:
   ```gradle
   buildTypes {
       debug {
           debuggable true
           minifyEnabled false
       }
   }
   ```

---


---

## Major Version Migration


# Auth0.Android v4 Migration

Migrates an existing Auth0.Android (`com.auth0.android:auth0`) v3 integration to v4. Every code change is gated on a search that confirms the project actually calls the affected API — if the project never uses `SecureCredentialsManager`, no `SecureCredentialsManager` code is touched. Changes follow the project's existing architecture (Kotlin or Java, callback or coroutine) and Android conventions.

## Target version is argument-based

This skill accepts an optional target version argument:

- **`/auth0-android-major-migration 4.0.0`** — migrate to the exact tag `4.0.0` (validated before use).
- **`/auth0-android-major-migration`** (no argument) — auto-resolve the **latest release within the next major (v4.x)**, including pre-releases.

`$ARGUMENTS`, when present, is the requested target tag. Step 2 validates it and resolves the final `<TARGET_TAG>` used for the rest of the migration.

## When NOT to Use

- **New Auth0 integration** (no existing Auth0.Android SDK): Use the Auth0 Android integration workflow (above)
- **Minor/patch update** (e.g., 3.18 → 3.19): Bump the `com.auth0.android:auth0` version in Gradle — no migration needed
- **iOS / macOS apps**: Use the Auth0 Swift major-version migration
- **React Native / Expo**: Use the Auth0 React Native or Expo integration
- **Flutter**: Use the native Flutter Auth0 SDK

## Prerequisites

- Existing Auth0.Android v3 integration (`com.auth0.android:auth0:3.x`)
- Android SDK / Gradle toolchain installed; project builds cleanly on the current version
- Project under git version control with a clean working tree

---

## Migration Workflow

> **Agent instruction:** Execute every step in order. The goal is a green build with the smallest correct changeset. Each code-change step is gated by the Step 5 file-reading audit — if the API was not found in the project's source files, skip the entire step for that area. Never add code the project doesn't already call. v4 also raises platform requirements (Step 3) that can **block** the migration until satisfied — handle those before touching any Auth0 API call site.

---

### Step 1 — Pre-flight & Safety Backup

```bash
# 1a. Verify clean working tree — stop if there are uncommitted changes
git status --porcelain
```

If the output is non-empty, ask the user:
> *"You have uncommitted changes. Should I stash them before proceeding (`git stash`), or would you like to commit first?"*

```bash
# 1b. Create a safety branch the user can reset to at any time
git checkout -b auth0-v4-migration-backup
git checkout -
```

```bash
# 1c. Confirm the project builds on the current version before touching anything
./gradlew assembleDebug 2>&1 | tail -15
```

If the build fails, stop. Ask the user to fix the existing issues first — do not migrate a project that does not build.

---

### Step 2 — Detect Current & Resolve Target Version

**Detect the current Auth0.Android version** (check each location that applies):

```bash
# Inline dependency in a module build file (Groovy or Kotlin DSL)
grep -rEn "com\.auth0\.android:auth0:[0-9]" --include=build.gradle --include=build.gradle.kts .

# Gradle version catalog
grep -rEn "auth0" --include=libs.versions.toml .

# Resolved lockfile (most reliable if present)
grep -rEn "com\.auth0\.android:auth0:[0-9]" --include=gradle.lockfile .
```

**Resolve the target version.** There are two paths:

**Path A — the user passed a target version argument (`$ARGUMENTS`):**

Validate it against the published releases before using it. It must pass **all three** checks:

```bash
# List all published Auth0.Android release tags
gh api repos/auth0/Auth0.Android/releases --paginate \
  --jq '.[] | select(.draft==false) | .tag_name'
```

1. **Exists** — the requested tag appears in the published release list above.
2. **Next major** — the tag is within the **v4** major line (`tag_name` starts with `4`). A `3.x` or lower tag is *not* the next major; reject it.
3. **Not a downgrade** — the tag is newer than the version detected in the project.

> **On any check failing, STOP and ask the user.** Do not silently fall back. For example:
> - *"`4.9.9` isn't a published Auth0.Android release. Published v4 releases are: `4.0.0-beta.1`, … . Please pass a valid v4 tag, or omit the argument to auto-resolve the latest v4 release."*
> - *"`3.19.0` is a v3 release, not the next major. This skill migrates to v4. Pass a v4 tag (e.g. `4.0.0`) or omit the argument."*
> - *"`4.0.0-beta.0` is older than the `4.0.0-beta.1` already in your project — that's a downgrade. Pass a newer v4 tag or omit the argument."*

**Path B — no argument: auto-resolve the latest v4 release (including pre-releases):**

```bash
# Newest v4.x release tag (stable or pre-release), most recent first
gh api repos/auth0/Auth0.Android/releases --paginate \
  --jq '[.[] | select(.draft==false) | select(.tag_name|startswith("4"))] | .[0].tag_name'
```

Record the result as `<TARGET_TAG>` and use it in every subsequent step.

> **If `<TARGET_TAG>` is a pre-release** (contains `-beta`, `-rc`, etc.), tell the user before continuing:
> *"v4 is not yet generally available — the latest v4 release is `<TARGET_TAG>` (a pre-release). I'll migrate to that. You can pin a different tag by passing it as an argument."*
>
> **If no v4 release exists yet** (the resolver returns empty), stop and tell the user there is no published v4 release to migrate to.

---

### Step 3 — Prerequisite Gate (Requirements Changes)

v4 raises the build toolchain and platform floor. Check each requirement **before** migrating any API. If a requirement is unmet, prompt the user and apply the build-file change (or block until they confirm) — a project that doesn't meet these will not build against v4 regardless of API changes.

> Confirm the exact required versions for `<TARGET_TAG>` from the SDK's own `build.gradle` / `gradle-wrapper.properties` fetched in Step 4 if they differ from the values below (these reflect the v4 baseline).

| Requirement | v3 | v4 | Where to check / change |
|---|---|---|---|
| **minSdk** | 21 | **26** (Android 8.0) | `android { defaultConfig { minSdk } }` |
| **Java** | 8+ | **17** | `compileOptions { sourceCompatibility/targetCompatibility }`, `kotlinOptions { jvmTarget }` |
| **Gradle** | — | **8.11.1+** | `gradle/wrapper/gradle-wrapper.properties` (`distributionUrl`) |
| **AGP** | — | **8.10.1+** | root `build.gradle` `com.android.tools.build:gradle` classpath / `plugins` block |
| **Kotlin** | — | **2.0.21** | `ext.kotlin_version` / version catalog (only if the project uses Kotlin) |

```bash
# Inspect current values
grep -rEn "minSdk(Version)?\s*[ =]" --include=build.gradle --include=build.gradle.kts .
grep -rEn "sourceCompatibility|targetCompatibility|jvmTarget" --include=build.gradle --include=build.gradle.kts .
grep -En "distributionUrl" gradle/wrapper/gradle-wrapper.properties
grep -rEn "com\.android\.tools\.build:gradle|kotlin_version|kotlin(\"|-)" --include=build.gradle --include=build.gradle.kts --include=libs.versions.toml .
```

**`minSdk` below 26 is a hard block.** If the project targets API 25 or lower, tell the user this raises the minimum supported Android version (devices on Android 7.1 and below will no longer be supported) and ask them to confirm before bumping `minSdk` to 26 — or to stay on v3.

Apply the required bumps (example shapes — match the project's DSL):

```groovy
android {
    defaultConfig { minSdk 26 }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = '17' }
}
```

See the Migration Process section below for Kotlin DSL, version-catalog, and Gradle/AGP wrapper edge cases.

---

### Step 4 — Fetch & Read the v4 SDK Source

Fetch the actual Kotlin source for `<TARGET_TAG>`. The signatures here are the authoritative reference for every change made in Step 7. **Do not migrate from memory or from the guide alone — confirm each signature in the fetched source.**

```bash
TAG=<TARGET_TAG>   # the version resolved in Step 2, e.g. 4.0.0-beta.1
BASE="https://raw.githubusercontent.com/auth0/Auth0.Android/${TAG}/auth0/src/main/java/com/auth0/android"

# List all public Kotlin files in the SDK (confirm paths for this tag)
gh api "repos/auth0/Auth0.Android/git/trees/${TAG}?recursive=1" \
  --jq '.tree[].path | select(startswith("auth0/src/main/") and endswith(".kt"))'

# Fetch the files that back the breaking changes
for FILE in \
  provider/WebAuthProvider.kt \
  authentication/AuthenticationAPIClient.kt \
  authentication/mfa/MfaApiClient.kt \
  authentication/storage/SecureCredentialsManager.kt \
  authentication/storage/CredentialsManager.kt \
  authentication/storage/BaseCredentialsManager.kt \
  authentication/storage/Storage.kt \
  dpop/DPoPException.kt \
  result/SSOCredentials.kt \
  request/DefaultClient.kt ; do
    CONTENT=$(curl -sf "${BASE}/${FILE}")
    [ -n "$CONTENT" ] && echo "=== ${FILE} ===" && echo "$CONTENT"
done
```

> **If a release tag has no source yet** (e.g. during the v4 development phase, before the first tag carries the full tree), fall back to the `v4_development` branch for signature confirmation: replace `${TAG}` with `v4_development` in the URLs above. Always prefer the chosen tag when it has source.

Read the fetched source and note, for each file:
- Public method signatures that changed (parameters, return type, `@Throws`)
- Constructors that were removed
- Types/classes that were removed or renamed
- Default parameter values that changed (e.g. `minTtl`)

This is the ground truth. Every change in Step 7 must match a real signature in these files.

---

### Step 5 — Audit Which Auth0 APIs the Project Uses

**Find all source files that import the Auth0 SDK — these are the scope of the migration:**

```bash
grep -rlE "import com\.auth0\.android" --include="*.kt" --include="*.java" .
```

**Read every file from that list.** Do not grep for individual API patterns and stop there — read the full source so you can see exactly how `Auth0`, `WebAuthProvider`, `AuthenticationAPIClient`, `SecureCredentialsManager`/`CredentialsManager`, and any Auth0 types are used, including multi-line builder chains and any custom `Storage` conformances.

For each file, identify:

| What to look for | Section |
|---|---|
| `PasskeyAuthProvider` usage | §7.1 — class removed |
| `UsersAPIClient`, `ManagementException`, `ManagementCallback` | §7.2 — Management API removed |
| `loginWithOTP(`, `loginWithOOB(`, `loginWithRecoveryCode(`, `multifactorChallenge(` on `AuthenticationAPIClient` | §7.3 — deprecated MFA methods removed |
| `WebAuthProvider.useDPoP(` called on the object *before* `.login(` | §7.4 — `useDPoP` moved to the login builder |
| `DPoPException.UNSUPPORTED_ERROR` | §7.5 — constant removed |
| `.expiresIn` accessed on an `SSOCredentials` value | §7.6 — renamed to `expiresAt` (now a `Date`) |
| `SecureCredentialsManager(` with an `Auth0` instance as the first argument | §7.7 — `Auth0`-based constructors removed |
| `getCredentials(` / `awaitCredentials(` without an explicit `minTtl`, or `hasValidCredentials()` | §9.1 — default `minTtl` 0 → 60s (behavioral) |
| `clearCredentials(` | §9.3 — now clears **all** storage |
| A class implementing the `Storage` interface | §9.4 — new `removeAll()` (default impl provided) |

Build a checklist: **"This project uses: [list]"** and **"This project does NOT use: [list]"**. Only work through the §7.x / §9.x sections that appear in the "uses" list. Skip the rest entirely.

---

### Step 6 — Update the SDK Dependency

Apply the matching declaration style. Use `<TARGET_TAG>` from Step 2.

**Inline — Groovy DSL (`build.gradle`):**

```groovy
implementation 'com.auth0.android:auth0:<TARGET_TAG>'
```

**Inline — Kotlin DSL (`build.gradle.kts`):**

```kotlin
implementation("com.auth0.android:auth0:<TARGET_TAG>")
```

**Version catalog (`gradle/libs.versions.toml`):**

```toml
[versions]
auth0 = "<TARGET_TAG>"
```

> **Pre-release tags** (e.g. `4.0.0-beta.1`) must be pinned **exactly** — do not use a dynamic range like `4.+` or `[4.0,5.0)`, which Gradle may resolve to a different artifact. For stable v4 releases an exact version is still recommended for reproducibility.

Do **not** build yet — apply all known code changes first (Step 7), then build (Step 8) to surface any remainders.

---

### Step 7 — Apply Breaking Changes

> **Agent instruction:** Work through only the §7.x sections that matched during the Step 5 audit. Skip every section whose API the project does not use — do not touch those files. Apply each change exactly as shown, confirmed against the source fetched in Step 4. Do not rename variables, reformat, or modernise code that isn't being migrated. Match the project's existing style: callback → callback, coroutine `await` → coroutine `await`, Kotlin → Kotlin, Java → Java.

---

#### 7.1 — `PasskeyAuthProvider` removed

**Applies if:** Step 5 found `PasskeyAuthProvider` in the project's source files.

The `com.auth0.android.provider.PasskeyAuthProvider` class was removed. Passkey operations now live on `AuthenticationAPIClient`: `passkeyChallenge()`, `signupWithPasskey()`, and `signinWithPasskey()`. Confirm the exact signatures in the `AuthenticationAPIClient.kt` fetched in Step 4, then migrate each call site to the corresponding client method. If a passkey flow cannot be migrated confidently from the source, add a `// TODO:` and list it in the Step 10 summary rather than guessing.

---

#### 7.2 — Management API removed (`UsersAPIClient`)

**Applies if:** Step 5 found `UsersAPIClient`, `ManagementException`, or `ManagementCallback` in the project's source files.

The entire Management API client was removed from the SDK in v4. Calling the Management API directly from a mobile app was never recommended — it requires a privileged token on the device. **Do not silently delete the call sites.** Add a `// TODO:` that preserves the intent and surface this in the Step 10 summary as required backend work.

```kotlin
// v3 — direct Management API call from the app (e.g. updating user_metadata)
val users = UsersAPIClient(account, accessToken)
users.updateMetadata(userId, metadata)
    .start(object : Callback<UserProfile, ManagementException> { /* ... */ })

// v4 — Management client removed; preserve intent, move to a backend
// TODO: Auth0.Android v4 removed the Management API client (UsersAPIClient).
// Expose an endpoint on your own backend (e.g. PATCH /me/metadata) that performs
// this operation. Call it from the app with the user's access token as a Bearer
// token. On the backend, obtain a machine-to-machine token via Client Credentials
// and call the Management API with the minimum required scopes.
// NEVER embed a Management API token in the app.
// See: https://auth0.com/docs/manage-users/user-accounts/manage-user-metadata
```

This **requires backend work** — record it in the Step 10 summary.

---

#### 7.3 — Deprecated MFA methods removed from `AuthenticationAPIClient` → `MfaApiClient`

**Applies if:** Step 5 found `loginWithOTP(`, `loginWithOOB(`, `loginWithRecoveryCode(`, or `multifactorChallenge(` called on an `AuthenticationAPIClient` in the project's source files.

These four methods were deprecated in v3 and removed in v4. Obtain an `MfaApiClient` via `AuthenticationAPIClient.mfaClient(mfaToken)` and use its APIs. Confirm the exact `MfaApiClient` method signatures in the `MfaApiClient.kt` fetched in Step 4 before applying changes.

```kotlin
// v3 — removed methods on AuthenticationAPIClient
authentication
    .loginWithOTP(mfaToken, otp)
    .start(object : Callback<Credentials, AuthenticationException> { /* ... */ })

// v4 — obtain an MfaApiClient and use its verify API (confirm signature in MfaApiClient.kt)
val mfaClient = authentication.mfaClient(mfaToken)
// e.g. mfaClient.verifyWithOTP(otp) — use the exact method/parameters from the fetched source
```

The `mfaToken` still comes from the same place — an `AuthenticationException` where the challenge is required. List every migrated MFA flow in the Step 10 summary and ask the user to **re-test each MFA flow end-to-end** against their tenant. See the Migration Process section below (MFA migration) for the full method map.

---

#### 7.4 — `WebAuthProvider.useDPoP(context)` moved to the login builder

**Applies if:** Step 5 found `WebAuthProvider.useDPoP(` called on the `WebAuthProvider` object **before** `.login(`. Read the actual call chain — it may span multiple lines.

In v4, `useDPoP(context)` is configured per-request on the login builder rather than globally on the `WebAuthProvider` object. Move the `.useDPoP(context)` call so it chains **after** `.login(account)`.

```kotlin
// v3 — global configuration (no longer compiles)
WebAuthProvider
    .useDPoP(context)
    .login(account)
    .start(context, callback)

// v4 — builder-based, per-request
WebAuthProvider
    .login(account)
    .useDPoP(context)
    .start(context, callback)
```

---

#### 7.5 — `DPoPException.UNSUPPORTED_ERROR` removed

**Applies if:** Step 5 found `DPoPException.UNSUPPORTED_ERROR` in the project's source files.

With the minimum SDK raised to API 26, DPoP is supported on every API level v4 targets, so this constant was removed. Remove any reference to it — for example, a `when`/`if` branch or comparison that checked for `UNSUPPORTED_ERROR`. No replacement is needed; the unsupported-version case can no longer occur.

```kotlin
// v3 — guarding against the unsupported case
if (error == DPoPException.UNSUPPORTED_ERROR) {   // ❌ no longer exists in v4
    showDeviceUnsupported()
} else {
    handle(error)
}

// v4 — the guard is no longer applicable; handle the remaining cases
handle(error)
```

---

#### 7.6 — `SSOCredentials.expiresIn` → `expiresAt` (`Int` → `Date`)

**Applies if:** Step 5 found `.expiresIn` accessed on an `SSOCredentials` value in the project's source files.

`SSOCredentials.expiresIn` (raw seconds, `Int`) was renamed to `expiresAt` and is now an absolute `Date` (computed during deserialization, consistent with `Credentials.expiresAt`). Rename the property **and** update any arithmetic that assumed a duration in seconds.

> The JSON wire format is unchanged — the field is still `@field:SerializedName("expires_in")` in the SDK. Only the Kotlin property name and type changed (`expiresIn: Int` → `expiresAt: Date`); don't expect a renamed `expires_at` key if you grep the raw JSON.

```kotlin
// v3 — seconds until expiry (Int)
val secondsUntilExpiry: Int = ssoCredentials.expiresIn

// v4 — absolute expiration Date
val expirationDate: Date = ssoCredentials.expiresAt
// If you previously did `now + expiresIn` to get an absolute time, use expiresAt directly.
```

---

#### 7.7 — `SecureCredentialsManager` `Auth0`-based constructors removed

**Applies if:** Step 5 found `SecureCredentialsManager(` constructed with an `Auth0` instance as the first argument in the project's source files.

The two constructors that accepted an `Auth0` instance were removed. Both remaining constructors take an `AuthenticationAPIClient` first. Build the client from the `Auth0` account, then pass the **same** client into `SecureCredentialsManager`.

```kotlin
// v3 — Auth0-based constructors (removed in v4)
val manager = SecureCredentialsManager(auth0, context, storage)
val manager = SecureCredentialsManager(auth0, context, storage, fragmentActivity, localAuthenticationOptions)

// v4 — build an AuthenticationAPIClient first, pass it in
val apiClient = AuthenticationAPIClient(auth0)
val manager = SecureCredentialsManager(apiClient, context, storage)

// v4 — biometric variant
val apiClient = AuthenticationAPIClient(auth0)
val manager = SecureCredentialsManager(
    apiClient,
    context,
    storage,
    fragmentActivity,
    localAuthenticationOptions
)
```

```java
// Java — same change; there is no Java-specific overload
AuthenticationAPIClient apiClient = new AuthenticationAPIClient(auth0);
SecureCredentialsManager manager = new SecureCredentialsManager(apiClient, context, storage);
```

> If the project enables DPoP, configure it on the client before passing it in: `AuthenticationAPIClient(auth0).useDPoP(context)`. Confirm the constructor signatures in the `SecureCredentialsManager.kt` fetched in Step 4.

---

### Step 8 — Build Until Green

```bash
./gradlew assembleDebug 2>&1 | tail -40
```

For each error: read it, locate the source line, match it to a Step 7 section, verify the fix against the signature fetched in Step 4, apply it in the project's existing style, then rebuild.

**Common error → cause mapping:**

| Build error | Likely cause |
|---|---|
| `unresolved reference: PasskeyAuthProvider` | §7.1 — class removed; use `AuthenticationAPIClient` passkey APIs |
| `unresolved reference: UsersAPIClient` / `ManagementException` / `ManagementCallback` | §7.2 — Management API removed; add `// TODO:` + backend follow-up |
| `unresolved reference: loginWithOTP` / `loginWithOOB` / `loginWithRecoveryCode` / `multifactorChallenge` | §7.3 — use `mfaClient(mfaToken)` / `MfaApiClient` |
| `unresolved reference: useDPoP` on `WebAuthProvider` | §7.4 — move `.useDPoP(context)` after `.login(account)` |
| `unresolved reference: UNSUPPORTED_ERROR` | §7.5 — remove the reference |
| `unresolved reference: expiresIn` on `SSOCredentials`, or `Int`/`Date` type mismatch | §7.6 — rename to `expiresAt` (now a `Date`) |
| `none of the following functions can be called` / `too many arguments` on `SecureCredentialsManager(` | §7.7 — build `AuthenticationAPIClient(auth0)` first, pass it in |
| `class … must override removeAll` (custom `Storage`) | §9.4 — the interface has a default impl; override only if needed |

**Limit:** Up to **10 build-fix cycles**. If the build still fails after 10 attempts, stop and show the remaining errors with context — do not guess.

---

### Step 9 — Behavior & Default-Value Changes (Review, Usually No Code Change)

These changes compile without edits but alter runtime behavior. Surface each in the Step 10 summary. Only change code if the project depends on the old behavior.

#### 9.1 — Credentials Manager default `minTtl` 0 → 60s

**Applies if:** the project calls `getCredentials(...)` / `awaitCredentials(...)` without an explicit `minTtl`, or calls `hasValidCredentials()`.

v4 renews credentials that expire within 60 seconds instead of only when already expired. This is the recommended behavior (avoids handing out tokens that expire mid-request). To restore v3 behavior explicitly, pass `minTtl = 0`:

```kotlin
// v4 — restore v3 behavior explicitly if required
credentialsManager.getCredentials(scope = null, minTtl = 0, callback = callback)
```

#### 9.2 — `CredentialsManager` now uses the global executor

Runtime-only. Renewals across managers backed by the same `Auth0` object are now serialized, eliminating duplicate refresh-token exchanges. **No code change required.**

#### 9.3 — `clearCredentials()` now clears all storage

**Applies if:** the project calls `clearCredentials()`.

v4 calls `Storage.removeAll()`, clearing **all** values in the storage — including API credentials stored for specific audiences. If the project needs to preserve other data in the same `Storage`, recommend a separate `Storage` instance for API credentials, or consider the new `clearAll()` (Step 10 optional improvements).

#### 9.4 — `Storage` interface gains `removeAll()`

**Applies if:** the project has a class implementing the `Storage` interface.

`removeAll()` ships with a default empty implementation, so existing custom `Storage` implementations still compile. **Override `removeAll()`** to actually clear storage if that custom storage is used with `clearCredentials()` — otherwise `clearCredentials()` becomes a no-op for it.

---

### Step 10 — Migration Summary

Present a concise summary covering:

**1. Prerequisites changed** — `minSdk` / Java / Gradle / AGP / Kotlin bumps applied, and that `minSdk 26` drops support for Android 7.1 and below.

**2. Changes applied** — grouped by API area (§7.x), with the files touched per area.

**3. Needs manual review**
- §7.1 Passkey / §7.3 MFA flows migrated to the new clients — **re-test end-to-end** against the tenant.
- Any `// TODO:` left for §7.2 (Management API) — backend work required.

**4. Behavioral changes (no code change, verify acceptable)**
- §9.1 `minTtl` now defaults to 60s — tokens renew 60s before expiry.
- §9.3 `clearCredentials()` now clears **all** storage (including API credentials).
- §9.2 `CredentialsManager` now uses the global executor (renewals serialized).

**5. Backend / configuration follow-up**
- §7.2 Management API removal — list the operations stubbed with `TODO` and what must move to a secure backend (M2M token, never on-device).

**6. Optional improvements not applied** (list briefly; never auto-apply)
- `clearAll()` — full credential **and** cryptographic key cleanup on logout/account removal.
- `WebAuthProvider.registerCallbacks()` in `onCreate()` — prevents lost callbacks / memory leaks on configuration change or process death during authentication.
- `DefaultClient.Builder` — the constructor is deprecated (not removed); the builder adds write/call timeouts, custom interceptors, and loggers.
- Gson 2.8.9 → 2.11.0 (transitive) — stricter `TypeToken` / type coercion; see the Migration Process section below (Gson transitive dependency).

**7. Ask the user** whether to commit the migration, explore an optional improvement, or step through specific files together.

> **Security reminder:** Never include tokens, secrets, client credentials, or stored credential values in the summary or any build log.

---

## Detailed References

- **Migration Process** (see below) — version-argument validation, prerequisite/toolchain handling, build-system edge cases (Groovy DSL, Kotlin DSL, version catalogs), MFA method map, Management-API backend pattern, Gson transitive notes, rollback, and "deprecated ≠ removed" guidance.
- **Security Checklist** (see below) — invariants that must hold before and after migration.

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| Applying a §7.x section when Step 5 didn't find that API in the project | Step 5 file-reading is the gate. Not found = skip the section entirely |
| Using grep alone to decide if an API is used | Grep misses multi-line builder chains (e.g. `useDPoP` before `login`) and aliased variables. Read the actual files |
| Migrating API call sites before meeting the Step 3 prerequisites | A project below `minSdk 26` / Java 17 won't build against v4. Handle prerequisites first |
| Accepting a target-version argument without validating it | Validate exists / next-major / not-a-downgrade, then **stop and ask** on failure |
| Using a dynamic range (`4.+`) for a pre-release tag | Pin pre-releases exactly — ranges may resolve to a different artifact |
| Silently deleting Management API or removed-MFA call sites | Add `// TODO:` and surface in the summary — deletion breaks functionality |
| Applying changes from the migration guide without confirming the SDK source | Every fix must trace to a signature in the files fetched in Step 4 |
| Treating `DefaultClient(...)` constructor as a breaking change | It is **deprecated, not removed** — leave it; note the Builder as optional |
| Starting on a dirty working tree | Always verify `git status --porcelain` is empty first |
| Continuing past 10 failed build cycles | Stop and show the user the remaining errors |
| Skipping the migration summary | Always produce the full summary — the user needs it |

## Related Capabilities

- New Auth0.Android integration from scratch → use the Auth0 Android integration workflow (above)
- Auth0.swift major version upgrades → use the Auth0 Swift major-version migration
- Multi-factor authentication → ask for MFA (feature:mfa)

---

## References

- [Auth0.Android GitHub](https://github.com/auth0/Auth0.Android)
- [Auth0.Android Releases](https://github.com/auth0/Auth0.Android/releases)
- [V4 Migration Guide](https://github.com/auth0/Auth0.Android/blob/v4_development/V4_MIGRATION_GUIDE.md)
- [Auth0 Android SDK Documentation](https://auth0.com/docs/libraries/auth0-android)

> **Security:** Never echo tokens, client secrets, or credentials in build logs or terminal output. Never commit secrets to version control.
