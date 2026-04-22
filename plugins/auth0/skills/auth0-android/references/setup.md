# Auth0 Android Setup Guide

> **Agent instruction:** Before providing version numbers, fetch the latest release:
> `gh api repos/auth0/Auth0.Android/releases/latest --jq '.tag_name'`
> Replace `{LATEST_VERSION}` in all dependency lines with the result.

## Setup Overview

1. Add SDK dependency to `build.gradle`
2. Configure Auth0 (automatic bootstrap script or manual credentials)
3. Add manifest placeholders and INTERNET permission (post-setup)

## Auth0 Configuration

> **Agent instruction:** First, check whether the user prompt already includes both Auth0 **Client ID** and **Domain**.
> - If both are provided, skip the setup-choice question and proceed directly to **Manual Setup (User-Provided Credentials)** using those values.
> - If either value is missing, ask the user using `AskUserQuestion`: _"How would you like to configure Auth0 for this project?"_
> - **Automatic setup (Recommended)** — runs a bootstrap script that creates the Auth0 app, database connection, callback URLs, and populates `strings.xml`
> - **Manual setup** — the user provides their Auth0 Client ID and Domain
>
> Follow the matching section below based on their choice.

### Automatic Setup

> **Agent instruction:** Run these quick checks before the bootstrap script. Do NOT run `auth0 login` from the agent — it is interactive and will hang.
>
> 1. **Check Node.js**: `node --version`. If missing or below 20, ask user: install (`brew install node`) or switch to manual setup.
> 2. **Check Auth0 CLI**: `command -v auth0`. If missing, ask user: install (`brew install auth0/auth0-cli/auth0`) or switch to manual setup.
> 3. **Check Auth0 login**: `auth0 tenants list --csv --no-input 2>&1`. If it fails or returns empty:
>    - Tell the user: _"Please run `auth0 login` in your terminal and let me know when done."_
>    - Wait for the user to confirm, then re-run the check to verify.
> 4. **Confirm active tenant**: Parse the `→` line from the CSV output to identify the active tenant domain. Tell the user: _"Your active Auth0 tenant is: `<domain>`. Is this the correct tenant?"_
>    - If yes, proceed.
>    - If no, ask the user to run `auth0 tenants use <tenant-domain>` in their terminal, then re-run step 3 to confirm the new active tenant.
>
> Once confirmed, run the bootstrap script:
> ```bash
> cd <path-to-skill>/auth0-android/scripts
> npm install
> node bootstrap.mjs <path-to-android-project>
> ```
>
> The script handles Auth0 app creation, database connection, callback URLs, and `strings.xml`. The agent should NOT handle client_id or domain manually.
>
> If the script fails due to session expiry, ask the user to run `auth0 login` again, then re-run the script. For other failures, fall back to **Manual Setup** below.
>
> After the script completes, proceed to **Post-Setup Steps** below.

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

> **Agent instruction:** After either automatic or manual Auth0 configuration, the agent MUST apply the following changes to the project:
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

> **Note:** The bootstrap script and manual setup default to a custom scheme (`demo://`) for simplicity. App Links with `https://` are recommended for production apps. To switch, update `com_auth0_scheme` to `https` in `strings.xml` and update your callback URL in the Auth0 Dashboard to `https://YOUR_AUTH0_DOMAIN/android/YOUR_APP_PACKAGE_NAME/callback`.

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
