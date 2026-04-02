---
name: auth0-android
description: Use when adding authentication to Android applications (Kotlin/Java) with Web Auth, biometric-protected credentials, and MFA - integrates com.auth0.android:auth0 SDK for native Android apps
license: Proprietary
metadata:
  author: Auth0 <support@auth0.com>
---

# Auth0 Android Integration

Add authentication to Android applications using `com.auth0.android:auth0`.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```
> gh api repos/auth0/Auth0.Android/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all `implementation` dependency lines instead of any hardcoded version below. If the command fails, fall back to checking https://github.com/auth0/Auth0.Android/releases.

## Prerequisites

- Android API 21 or higher
- Kotlin or Java project
- Auth0 account with a Native application configured
- If you don't have Auth0 set up, see [auth0-quickstart](/auth0-quickstart)

## When NOT to Use

- **React Native apps**: Use [auth0-react-native](/auth0-react-native)
- **Flutter apps**: Use the native Flutter Auth0 SDK
- **Web SPAs** (React, Angular, Vue): Use [auth0-react](/auth0-react), [auth0-angular](/auth0-angular), or [auth0-vue](/auth0-vue)
- **Node.js/Express servers**: Use [auth0-express](/auth0-express)
- **iOS/macOS apps**: Use [auth0-swift](/auth0-swift)

## Quick Start Workflow

1. **Install SDK**: Add the Auth0 Android SDK dependency to your `build.gradle`:
   ```gradle
   implementation 'com.auth0.android:auth0:{LATEST_VERSION}'
   ```

2. **Configure Auth0**:

    See [**Setup Guide**](references/setup.md) for automatic/manual setup, post-setup required project changes, and callback URL configuration.

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
   > **Failcheck:** If the build still fails after 5–6 fix attempts, stop and ask the user using `AskUserQuestion`:
   > _"The build is still failing after several fix attempts. How would you like to proceed?"_
   > - **Let the skill continue fixing iteratively** — continue the build-fix loop for another 5–6 attempts
   > - **Fix it manually** — show the remaining errors and let the user resolve them
   > - **Skip build verification** — proceed without a successful build
   >
   > Repeat this check after every 5–6 iterations if errors persist. Do not leave the project in a non-compiling state without the user's explicit consent.

   The callback URL must match your Auth0 application settings: `{SCHEME}://{YOUR_AUTH0_DOMAIN}/android/{YOUR_APP_PACKAGE_NAME}/callback`

## Detailed Documentation

- [**Setup Guide**](references/setup.md) — Install SDK, configure Auth0 application, set up callback URLs, Android App Links, custom schemes, ProGuard/R8
- [**Integration Patterns**](references/integration.md) — Web Auth login/logout, credential storage, biometric authentication, database login, passwordless authentication, MFA handling, custom tabs, error handling
- [**Testing & Reference**](references/api.md) — Testing checklist, common issues, security considerations, API reference

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

## Related Skills

- [auth0-quickstart](/auth0-quickstart) — Set up an Auth0 account and application
- [auth0-mfa](/auth0-mfa) — Configure multi-factor authentication
- [auth0-swift](/auth0-swift) — iOS/macOS authentication

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

- [Log in with Web Auth](references/integration.md#web-auth-login)
- [Log out](references/integration.md#web-auth-logout)
- [Store credentials securely](references/integration.md#credential-storage)
- [Require biometric authentication](references/integration.md#biometric-protected-credentials)
- [Database login](references/integration.md#database-login)
- [Passwordless authentication](references/integration.md#passwordless-authentication)
- [Handle MFA](references/integration.md#mfa-handling)
- [Call protected APIs](references/integration.md#calling-protected-apis)

## References

- [Auth0 Android SDK Documentation](https://auth0.com/docs/libraries/auth0-android)
- [Auth0 Android GitHub Repository](https://github.com/auth0/auth0-android)
- [Android SDK Javadoc](https://auth0.com/docs/references/android)
- [Auth0 Android Quickstart](https://auth0.com/docs/quickstart/native/android)
- [Sample App](https://github.com/auth0-samples/auth0-android-sample)
