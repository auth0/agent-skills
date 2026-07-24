# Auth0 Android — reference hub

Add authentication to Android applications using `com.auth0.android:auth0`.

<!-- Shared prerequisites: version-fetch instruction, critical rules,
     prerequisites, and when-NOT-to-use. Read this first (hop 1), then follow
     the dispatch table below to the one leaf for your intent. (Carved from the
     original framework-android.md.) -->

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

## Quick start

1. **Install SDK**: Add the Auth0 Android SDK dependency to your `build.gradle`:
   ```gradle
   implementation 'com.auth0.android:auth0:{LATEST_VERSION}'
   ```

2. **Configure Auth0**:

   > **Agent instruction:** Check whether the user prompt already includes both Auth0 **Client ID** and **Domain**.
   > - If both are provided, proceed directly to the Manual Setup path in this group's integration guide (Setup section) using those values.
   > - If either is missing, you MUST ask the user BEFORE writing any code or files:
   >   - Question: "How would you like to configure Auth0 for this project?"
   >   - Options: "Automatic setup (Recommended) — Auth0 CLI creates the app and writes credentials to strings.xml" / "Manual setup — I'll provide my Client ID and Domain"
   >
   > Then follow the matching setup path in this group's integration guide (Setup section) for the chosen path.
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

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-android/integrate.md` |
| upgrade-sdk | `Read: references/framework-android/migration.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For setup variants (tenant setup, CLI provisioning, `strings.xml`, App Links) and advanced integration patterns (login, storage, biometrics, passwordless, Organizations, MFA handling): `Read: references/framework-android/integrate.md`
- Full API / configuration lookup, testing checklist, security considerations: `Read: references/framework-android/api-reference.md`
- Any other task (guidance, debugging, Organizations, provider migration):
  start with `Read: references/framework-android/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
