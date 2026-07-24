# Auth0 Android — Integration

Setup depth and integration patterns: login/logout with Web Auth, build
verification, common mistakes, and the quick reference.

> **Prerequisites & setup:** the shared version-fetch instruction, critical
> rules, prerequisites, and when-NOT-to-use notes live in this group's overview (already read on the way here). The quick start lives in this group's
> overview too — this file holds tenant configuration, `strings.xml`
> provisioning, and integration patterns (see the Setup and Integration
> Patterns sections below). The full API/configuration reference lives in
> this group's API reference.

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

---

## Setup

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

## Integration Patterns

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
