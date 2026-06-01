# Setup Guide — Auth0 Flutter Native (iOS/Android)

## Auth0 Configuration

> **Agent instruction:** Check whether Auth0 credentials (domain and client ID) are already provided in the user's prompt.
> - **If credentials are provided:** Store them for use in the Dart code and proceed to "Post-Setup Steps".
> - **If no credentials are provided:** Run the bootstrap script below. Do NOT offer manual setup or ask the user to create an application in Auth0 Dashboard themselves — always use the CLI.

### Bootstrap Script

> **Agent instruction:** Run these checks before the script. Do NOT run `auth0 login` from the agent — it is interactive and will hang.
>
> 1. **Check Node.js**: `node --version`. If missing or below 20, install it: `brew install node`.
> 2. **Check Auth0 CLI**: `command -v auth0`. If missing, install it: `brew install auth0/auth0-cli/auth0`.
> 3. **Check Auth0 login**: `auth0 tenants list --csv --no-input 2>&1`. If it fails or returns empty:
>    - Tell the user: _"Please run `auth0 login` in your terminal and let me know when done."_
>    - Wait for confirmation, then re-run the check. Retry up to 3 times before treating as a persistent failure.
> 4. **Confirm active tenant**: Parse the `→` line from the CSV output. Tell the user: _"Your active Auth0 tenant is: `<domain>`. Is this correct?"_
>    - If no, ask the user to run `auth0 tenants use <tenant-domain>`, then re-run step 3.
>
> Once confirmed, run:
> ```bash
> cd <path-to-skill>/auth0-flutter-native/scripts
> npm install
> node bootstrap.mjs <path-to-flutter-project>
> ```
>
> If the script fails due to session expiry, ask the user to run `auth0 login` again, then re-run. Retry up to 3 times.
> Only if the script keeps failing after retries: use `AskUserQuestion` to ask the user for their Auth0 Domain and Client ID, then use those values directly in the Dart code.

The script will:
1. Detect your Flutter project structure (checks for `pubspec.yaml`, `android/`, and `ios/` directories)
2. Detect the Android package name (`applicationId`) and iOS bundle identifier
3. Create a **Native** application in Auth0 Dashboard
4. Register the Android and iOS callback URLs and logout URLs
5. Set up a database connection (Username-Password-Authentication)
6. Write the `auth0Domain` / `auth0Scheme` `manifestPlaceholders` into `android/app/build.gradle`
7. Output the domain and client ID to use in your Dart code

### Using Credentials Directly (credentials already known)

Use this only when credentials are explicitly provided by the user or obtained after bootstrap script failure.

```dart
final auth0 = Auth0('YOUR_AUTH0_DOMAIN', 'YOUR_AUTH0_CLIENT_ID');
```

There is no separate config file (like `Auth0.plist` for native Swift) — credentials are passed directly to the `Auth0` constructor in Dart code. The only platform configuration needed is the Android `manifestPlaceholders` and (for custom schemes / older iOS) the iOS `Info.plist` URL type.

---

## Post-Setup Steps

### Android Configuration (Required)

The SDK ships a `RedirectActivity` with an intent filter that consumes the `auth0Domain` and `auth0Scheme` manifest placeholders. You must declare these in `android/app/build.gradle`:

```groovy
// android/app/build.gradle
android {
    defaultConfig {
        manifestPlaceholders = [auth0Domain: "YOUR_AUTH0_DOMAIN", auth0Scheme: "https"]
    }
}
```

Kotlin DSL (`android/app/build.gradle.kts`):
```kotlin
android {
    defaultConfig {
        manifestPlaceholders["auth0Domain"] = "YOUR_AUTH0_DOMAIN"
        manifestPlaceholders["auth0Scheme"] = "https"
    }
}
```

> **Agent instruction:**
> 1. Read `android/app/build.gradle` (or `.kts`).
> 2. If `manifestPlaceholders` is missing, add it inside `defaultConfig`.
> 3. If it already exists with other entries, merge the `auth0Domain` and `auth0Scheme` keys in (use `+=` for Groovy maps).
> 4. Ensure `<uses-permission android:name="android.permission.INTERNET" />` is present in `android/app/src/main/AndroidManifest.xml`.

- **`auth0Scheme: "https"`** → uses Android App Links (recommended, no scheme to maintain).
- **Custom scheme** → set `auth0Scheme` to a lowercase string (e.g. the package name) and pass the same string to `webAuthentication(scheme: '...')` in Dart.

For biometric credential protection, `MainActivity` must extend `FlutterFragmentActivity`:

```kotlin
// android/app/src/main/kotlin/.../MainActivity.kt
import io.flutter.embedding.android.FlutterFragmentActivity

class MainActivity : FlutterFragmentActivity()
```

### iOS Configuration

For the default HTTPS / Universal Link flow on **iOS 17.4+**, add the **Associated Domains** capability in Xcode:

1. Open `ios/Runner.xcworkspace` in Xcode.
2. Select the **Runner** target → **Signing & Capabilities**.
3. Add the **Associated Domains** capability.
4. Add an entry: `webcredentials:YOUR_AUTH0_DOMAIN`

For **older iOS** or when using a **custom URL scheme**, add a URL type to `ios/Runner/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleTypeRole</key>
    <string>None</string>
    <key>CFBundleURLName</key>
    <string>auth0</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    </array>
  </dict>
</array>
```

For Face ID biometric protection, add a usage description to `Info.plist`:

```xml
<key>NSFaceIDUsageDescription</key>
<string>We use Face ID to secure your session.</string>
```

### Configure Callback URLs in Auth0 Dashboard

For a Native application, register platform-specific callback and logout URLs:

| Field | Value |
|-------|-------|
| Allowed Callback URLs (Android) | `https://YOUR_DOMAIN/android/YOUR_PACKAGE_NAME/callback` |
| Allowed Callback URLs (iOS) | `https://YOUR_DOMAIN/ios/YOUR_BUNDLE_ID/callback` |
| Allowed Logout URLs (Android) | `https://YOUR_DOMAIN/android/YOUR_PACKAGE_NAME/callback` |
| Allowed Logout URLs (iOS) | `https://YOUR_DOMAIN/ios/YOUR_BUNDLE_ID/callback` |

> **Agent instruction:** Determine the Android package name from `android/app/build.gradle` (`applicationId`) and the iOS bundle identifier (`PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project / `ios/Runner.xcodeproj/project.pbxproj`). Then register both platforms in one CLI call:
> ```bash
> auth0 apps update CLIENT_ID \
>   --callbacks "https://YOUR_DOMAIN/android/ANDROID_PACKAGE_NAME/callback,https://YOUR_DOMAIN/ios/IOS_BUNDLE_ID/callback" \
>   --logout-urls "https://YOUR_DOMAIN/android/ANDROID_PACKAGE_NAME/callback,https://YOUR_DOMAIN/ios/IOS_BUNDLE_ID/callback" \
>   --no-input
> ```
>
> If using a **custom scheme** instead of HTTPS, the callback host changes to the scheme (e.g. `YOUR_PACKAGE_NAME://YOUR_DOMAIN/android/YOUR_PACKAGE_NAME/callback`).

---

## SDK Installation

> **Agent instruction:** Check the project directory for `pubspec.yaml`. If found, add the dependency:
> ```bash
> flutter pub add auth0_flutter
> ```
>
> If `pubspec.yaml` is not found, this is not a Flutter project. Ask the user for the correct project path.

### pubspec.yaml

```yaml
dependencies:
  auth0_flutter: ^2.1.0
```

After adding, run:
```bash
flutter pub get
```

---

## Secret Management

Auth0 Flutter Native **does not use a client secret**. Native applications use PKCE (Proof Key for Code Exchange) + the authorization code flow, which is secure without a secret.

- `domain` and `clientId` passed to `Auth0()` are **not secrets** — they are public identifiers safe to commit to source control.
- Access, ID, and refresh tokens are stored by the `CredentialsManager` in the platform secure storage (Android Keystore / iOS Keychain).
- No `.env` files are required for the Auth0 configuration. The Android `manifestPlaceholders` values may be committed.
- **Never** add a client secret to a mobile app.

---

## Running the App

```bash
# Run on a connected device or emulator
flutter run

# Build debug APK (Android)
flutter build apk --debug

# Build for iOS (on macOS)
flutter build ios --no-codesign
```

---

## Verification

After completing setup, verify:

- [ ] `auth0_flutter` is in `pubspec.yaml` dependencies
- [ ] `android/app/build.gradle` has `manifestPlaceholders` with `auth0Domain` and `auth0Scheme`
- [ ] iOS Associated Domains capability (or `Info.plist` URL type for custom scheme) is configured
- [ ] `Auth0` is instantiated with the correct domain and client ID
- [ ] `credentialsManager.hasValidCredentials()` is called on app startup to restore the session
- [ ] Android and iOS callback URLs are saved in Auth0 Dashboard
- [ ] App builds without errors (`flutter build apk --debug`)
- [ ] Login opens the system browser and returns to the app
