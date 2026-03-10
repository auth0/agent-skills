# Auth0 Android Setup Guide

> **Agent instruction:** Before providing version numbers, fetch the latest release:
> `gh api repos/auth0/Auth0.Android/releases/latest --jq '.tag_name'`
> Replace `{LATEST_VERSION}` in all dependency lines with the result.

## Setup Overview

To get started quickly with Auth0 Android:

1. Add SDK dependency to `build.gradle`
2. Create a Native application in Auth0 Dashboard
3. Configure `strings.xml` with credentials
4. Add manifest placeholders to `build.gradle`
5. Set callback URLs in your Auth0 application

## Auth0 Configuration

> **Agent instruction:** Ask the user using `AskUserQuestion`: _"How would you like to configure Auth0 for this project?"_
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

## Manual Setup

### Step 1: Install SDK

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

### Step 2: Create Auth0 Native Application

#### Using Auth0 CLI (Recommended)

If you have the [Auth0 CLI](https://github.com/auth0/auth0-cli) installed:

```bash
auth0 apps create \
  --name "My Android App" \
  --type native \
  --callbacks "https://YOUR_DOMAIN/android/YOUR_PACKAGE/callback" \
  --logout-urls "https://YOUR_DOMAIN/android/YOUR_PACKAGE/callback"
```

#### Manual Dashboard Setup

1. Log in to your [Auth0 Dashboard](https://manage.auth0.com)
2. Go to Applications → Create Application
3. Select **Native** application type
4. Name your application (e.g., "My Android App")
5. Go to the **Settings** tab
6. Note your **Client ID** and **Domain**
7. Configure your callback and logout URLs (see Step 5 below)
8. Save

### Step 3: Configure strings.xml

Create or update `res/values/strings.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">My Auth0 App</string>
    <string name="com_auth0_client_id">YOUR_CLIENT_ID</string>
    <string name="com_auth0_domain">YOUR_DOMAIN</string>
    <string name="com_auth0_scheme">demo</string>
</resources>
```

Replace:
- `YOUR_CLIENT_ID` with your Auth0 application's Client ID
- `YOUR_DOMAIN` with your Auth0 domain (e.g., `example.auth0.com`)

### Step 4: Configure Manifest Placeholders

Update your module's `build.gradle` to include manifest placeholders:

```gradle
android {
    defaultConfig {
        applicationId "com.example.myapp"
        minSdkVersion 21
        targetSdkVersion 34

        manifestPlaceholders = [
            auth0Domain: "@string/com_auth0_domain",
            auth0Scheme: "@string/com_auth0_scheme"
        ]
    }
}
```

The placeholders inject your Auth0 domain and scheme into the AndroidManifest.xml at build time.

### Step 5: Configure Callback URLs

In your [Auth0 Dashboard](https://manage.auth0.com):

1. Go to Applications → Your App → Settings
2. Scroll to **Allowed Callback URLs**
3. Add your callback URL:
   ```
   https://{YOUR_AUTH0_DOMAIN}/android/{YOUR_APP_PACKAGE_NAME}/callback
   ```

   For example: `https://example.auth0.com/android/com.example.myapp/callback`

4. Scroll to **Allowed Logout URLs**
5. Add your logout URL using the same format
6. Save changes

The callback URL format is: `https://{YOUR_AUTH0_DOMAIN}/android/{YOUR_APP_PACKAGE_NAME}/callback`

You can find your package name in your `build.gradle`:
```gradle
android {
    defaultConfig {
        applicationId "com.example.myapp"  // This is your package name
    }
}
```

### Step 6: Add INTERNET Permission

Update your `AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:label="@string/app_name"
        ...>
        <!-- Activities here -->
    </application>

</manifest>
```

## Android App Links (Recommended)

For the recommended `https://` scheme, Android uses App Links for deeper integration:

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
