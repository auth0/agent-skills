---
name: auth0-swift
description: Use when adding Auth0 authentication to an iOS, macOS, tvOS, watchOS, or visionOS application — integrates the Auth0.swift SDK for native Apple platform authentication using Web Auth, CredentialsManager, and biometric protection.
license: Proprietary
metadata:
  author: Auth0 <support@auth0.com>
---

# Auth0 Swift Integration

Auth0.swift is the official Auth0 SDK for Apple platforms (iOS, macOS, tvOS, watchOS, visionOS). This skill adds complete native authentication to Swift apps using Web Auth (system browser redirect), secure Keychain credential storage via `CredentialsManager`, and optional biometric protection.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/Auth0.swift/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below. Current known version: `2.18.0`.

## Prerequisites

- **iOS** 14.0+ / **macOS** 11.0+ / tvOS 14.0+ / watchOS 7.0+ / visionOS 1.0+
- **Xcode** 16.x
- **Swift** 6.0+
- Auth0 account — [Sign up free](https://auth0.com/signup)
- Node.js 20+ (for bootstrap script automation)
- Auth0 CLI — `brew install auth0/auth0-cli/auth0` (for bootstrap script)

## When NOT to Use

| Use Case | Recommended Skill |
|----------|------------------|
| Android / Kotlin app | auth0-android |
| Flutter (iOS + Android cross-platform) | auth0-flutter |
| React Native app | auth0-react-native |
| React / Vue / Angular SPA | auth0-spa-js |
| Next.js / Express web app | auth0-nextjs |
| ASP.NET Core web app | auth0-aspnetcore-authentication |
| ASP.NET Core API (JWT validation only) | auth0-aspnetcore-api |
| Protecting a REST API (no login UI) | Use a BACKEND_API skill for your language |
| Auth0 Management API calls | Use Auth0 Management API skill |

## Quick Start Workflow

> **Agent instruction:** Follow these steps in order. If you encounter an error at any step, attempt to fix it up to 5 times before calling `AskUserQuestion` to ask the user for guidance. Always search existing code first — if there are existing login/logout handlers, hook into them rather than creating new ones.

### Step 1 — Install SDK

> **Agent instruction:** First check the project directory for an existing package manager file:
> - `Podfile` present → use **CocoaPods**
> - `Cartfile` present → use **Carthage**
> - `Package.swift` present → use **Swift Package Manager**
>
> If none are found, ask via `AskUserQuestion`: _"Which dependency manager does your project use — Swift Package Manager, CocoaPods, or Carthage?"_
>
> Then **execute** the steps for the chosen manager below. Do not just show the instructions — perform the file edits and run the commands.

**Swift Package Manager:**

> **Agent instruction:** Check if the project has a `Package.swift` (a Swift package). If yes, add Auth0.swift as a dependency by editing `Package.swift`:
> 1. Add to the `dependencies` array: `.package(url: "https://github.com/auth0/Auth0.swift", .upToNextMajor(from: "2.18.0"))`
> 2. Add `"Auth0"` to the target's `dependencies` array
>
> If the project is an Xcode project (`.xcodeproj`) using SPM — not a `Package.swift` manifest — SPM packages must be added via the Xcode GUI. Instruct the user:
> _"Please add the Auth0.swift package in Xcode: File → Add Package Dependencies → enter `https://github.com/auth0/Auth0.swift` → select Up to Next Major Version from `2.18.0` → click Add Package and confirm your app target is selected."_
> Then ask the user to confirm when done before continuing.

**CocoaPods:**

> **Agent instruction:**
> 1. If a `Podfile` already exists, open it and add `pod 'Auth0', '~> 2.18'` inside the correct target block. If no `Podfile` exists, create one at the project root with the correct target name.
> 2. Run `pod install` in the project directory.
> 3. From this point on, remind the user to always open the `.xcworkspace` file instead of `.xcodeproj`.

```ruby
# Podfile
target 'YourApp' do
  use_frameworks!
  pod 'Auth0', '~> 2.18'
end
```

**Carthage:**

> **Agent instruction:**
> 1. If a `Cartfile` already exists, open it and add the Auth0.swift entry. If no `Cartfile` exists, create one at the project root.
> 2. Run `carthage update --use-xcframeworks --platform iOS` (adjust `--platform` for macOS/tvOS/watchOS as needed).
> 3. After the command completes, instruct the user to link the built framework: _"In Xcode, go to your target → General → Frameworks, Libraries, and Embedded Content → click + → Add Other → Add Files → select `Carthage/Build/Auth0.xcframework`."_ Ask the user to confirm when done.

```text
github "auth0/Auth0.swift" ~> 2.18
```

### Step 2 — Configure Auth0

> **Agent instruction:** Check whether Auth0 credentials (domain and client ID) are already provided in the user's prompt. If yes, write `Auth0.plist` directly with those values and skip the options below. If no credentials are provided, ask the user using `AskUserQuestion`: _"How would you like to configure Auth0 for this project?"_
> - **Automatic setup (Recommended)** — runs a bootstrap script that creates the Auth0 app, database connection, callback URLs, and writes `Auth0.plist`
> - **Manual setup** — the user provides their Auth0 Client ID and Domain
>
> Follow the matching section in [Setup Guide](./references/setup.md) based on their choice.

**Option A — Automatic Setup (Bootstrap Script):**

> **Agent instruction:** Before running the script, do NOT run `auth0 login` — it is interactive and will hang. Instead:
> 1. Check Node.js: `node --version` (need 20+)
> 2. Check Auth0 CLI: `command -v auth0` (install via `brew install auth0/auth0-cli/auth0` if missing)
> 3. Check login status: `auth0 tenants list --csv --no-input 2>&1`. If it fails, tell the user to run `auth0 login` in their terminal and wait for confirmation before proceeding.
> 4. Confirm active tenant: parse the `→` line and ask the user _"Your active Auth0 tenant is: `<domain>`. Is this correct?"_ If not, ask them to run `auth0 tenants use <tenant-domain>` and re-check.

```bash
cd scripts && npm install && node bootstrap.mjs /path/to/your/xcode/project
```
The script detects your bundle identifier, creates a Native app in Auth0, registers callback URLs, and writes `Auth0.plist`.

**Option B — Manual Setup:**
Ask the user for their Auth0 Domain and Client ID, then create `Auth0.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>ClientId</key>
    <string>YOUR_AUTH0_CLIENT_ID</string>
    <key>Domain</key>
    <string>YOUR_AUTH0_DOMAIN</string>
</dict>
</plist>
```
Add this file to your Xcode project and confirm it is a member of your app target.

### Step 3 — Configure Callback URLs

> **Agent instruction:** Ask the user via `AskUserQuestion`: _"Which callback URL scheme would you like to use?"_
> - **Custom scheme** (`{bundle}://`) — simpler, works on all Apple platforms, no extra Xcode configuration needed
> - **HTTPS Universal Links** — recommended for production; prevents URL scheme hijacking but requires Associated Domains setup in Xcode
>
> Then follow **only** the matching path below.

#### Path A — Custom Scheme

In Auth0 Dashboard → **Applications** → your app → **Settings**, add to both **Allowed Callback URLs** and **Allowed Logout URLs**:

**iOS:** `YOUR_BUNDLE_IDENTIFIER://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_IDENTIFIER/callback`

**macOS:** `YOUR_BUNDLE_IDENTIFIER://YOUR_AUTH0_DOMAIN/macos/YOUR_BUNDLE_IDENTIFIER/callback`

#### Path B — HTTPS Universal Links

**Step B1 — Register HTTPS URLs in Auth0 Dashboard:**

In Auth0 Dashboard → **Applications** → your app → **Settings**, add to both **Allowed Callback URLs** and **Allowed Logout URLs**:

**iOS:** `https://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_IDENTIFIER/callback`

**macOS:** `https://YOUR_AUTH0_DOMAIN/macos/YOUR_BUNDLE_IDENTIFIER/callback`

**Step B2 — Add Associated Domains to the entitlements file:**

> **Agent instruction:** You MUST complete this step — without Associated Domains, the HTTPS callback redirect will not work and the app will not return from the browser after login.
>
> 1. Find the app's `.entitlements` file in the project directory (commonly named `<AppName>.entitlements` or `<AppName>Debug.entitlements`). Search for files matching `*.entitlements`.
> 2. If the file exists, add `com.apple.developer.associated-domains` to it. If it does not exist, create it at the project root alongside the `.xcodeproj`.
> 3. Write the following entries using the actual Auth0 domain (e.g. `example.us.auth0.com`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>webcredentials:YOUR_AUTH0_DOMAIN</string>
        <string>applinks:YOUR_AUTH0_DOMAIN</string>
    </array>
</dict>
</plist>
```

> 4. If the `.entitlements` file already contains a `com.apple.developer.associated-domains` array, append the two `<string>` entries to the existing array rather than replacing it.
> 5. If the `.entitlements` file was newly created, verify it is referenced in the Xcode project by checking that the target's build settings have `CODE_SIGN_ENTITLEMENTS` pointing to this file. If not set, inform the user: _"A new entitlements file was created at `<path>`. Please set it in Xcode under your target → Build Settings → Code Signing Entitlements."_
>
> **Note:** Auth0 automatically hosts the Apple App Site Association file at `https://YOUR_AUTH0_DOMAIN/.well-known/apple-app-site-association` — no manual hosting needed. The `webcredentials` entry enables Password AutoFill and credential handoff; `applinks` routes the Universal Link callback back to your app.

**Step B3 — Use `.useHTTPS()` in the SDK:**

Ensure `.useHTTPS()` is called on the `webAuth()` builder so the SDK sends the `https://` callback URL:
```swift
Auth0.webAuth().useHTTPS()
```

### Step 4 — Implement Authentication

```swift
import Auth0

class AuthenticationService: ObservableObject {
    @Published var isAuthenticated = false
    private let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

    func login() async {
        do {
            let credentials = try await Auth0
                .webAuth()
                .useHTTPS()
                .scope("openid profile email offline_access")
                .start()
            _ = credentialsManager.store(credentials: credentials)
            await MainActor.run { isAuthenticated = true }
        } catch {
            print("Login failed: \(error)")
        }
    }

    func logout() async {
        do {
            try await Auth0
                .webAuth()
                .useHTTPS()
                .clearSession()
            _ = credentialsManager.clear()
            await MainActor.run { isAuthenticated = false }
        } catch {
            print("Logout failed: \(error)")
        }
    }

    func checkSession() {
        isAuthenticated = credentialsManager.canRenew()
    }
}
```

### Step 5 — Verify Build

> **Agent instruction:** Run a build to verify the integration compiles without errors:
> ```bash
> xcodebuild build -scheme YOUR_SCHEME -destination "platform=iOS Simulator,name=iPhone 16"
> ```
> If the build fails, review error messages and fix up to 5 times before asking the user.

## Detailed Documentation

- **[Setup Guide](./references/setup.md)** — Auth0 Dashboard configuration, bootstrap script, manual setup, URL scheme registration, CocoaPods/SPM/Carthage install
- **[Integration Patterns](./references/integration.md)** — Web Auth login/logout, CredentialsManager, biometric protection, MFA, organizations, error handling, SwiftUI/UIKit patterns
- **[API Reference & Testing](./references/api.md)** — Full API reference, configuration options, claims reference, testing checklist, troubleshooting

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Auth0 app type not set to **Native** | In Auth0 Dashboard, select "Native" when creating the application |
| Missing callback URL in Auth0 Dashboard | Add both `https://` Universal Link and `{bundle}://` custom scheme to Allowed Callback URLs and Logout URLs |
| `Auth0.plist` not added to Xcode target | Right-click file in Navigator → "Add Files to Target" → check your app target |
| Missing `offline_access` scope | Add `"offline_access"` to scope string to receive a refresh token for silent renewal |
| Tokens stored in `UserDefaults` | Always use `CredentialsManager` — it stores tokens in Keychain with access control |
| Calling `credentialsManager.credentials()` before `store()` | Store credentials from login result before attempting to retrieve |
| Opening `.xcodeproj` instead of `.xcworkspace` (CocoaPods) | Always open the `.xcworkspace` file after `pod install` |
| Not calling `clearSession()` on logout | Always call `clearSession()` to remove the Auth0 session cookie from the browser |
| Build error "No such module 'Auth0'" | Verify the package is added to the correct target; for CocoaPods, open `.xcworkspace` |

## Related Skills

- **[auth0-android](/auth0-android)** — NATIVE_MOBILE for Android/Kotlin
- **[auth0-flutter](/auth0-flutter)** — Cross-platform iOS + Android with Dart
- **[auth0-aspnetcore-authentication](/auth0-aspnetcore-authentication)** — WEB_REGULAR for ASP.NET Core

## Quick Reference

### Core Classes & Methods

| Class / Method | Returns | Purpose |
|----------------|---------|---------|
| `Auth0.webAuth()` | `WebAuth` | Web Auth builder for login/logout |
| `.useHTTPS()` | `WebAuth` | Use Universal Links (HTTPS) callback |
| `.scope(_ scope: String)` | `WebAuth` | Set requested scopes |
| `.audience(_ audience: String)` | `WebAuth` | Set API audience |
| `.start()` | `Credentials` (async) | Initiate login flow |
| `.clearSession()` | `Void` (async) | Clear Auth0 session cookie |
| `CredentialsManager(authentication:)` | — | Keychain credential storage |
| `.store(credentials:)` | `Bool` | Save credentials to Keychain |
| `.credentials()` | `Credentials` (async) | Retrieve / auto-refresh credentials |
| `.clear()` | `Bool` | Delete all stored credentials |
| `.canRenew()` | `Bool` | Check if refresh token exists |
| `.hasValid(minTTL:)` | `Bool` | Check if access token is still valid |
| `.enableBiometrics(withTitle:)` | `Void` | Require biometric to access credentials |
| `Auth0.authentication()` | `Authentication` | Database / social auth builder |

### Error Types

| Error | Case | Description |
|-------|------|-------------|
| `WebAuthError` | `.userCancelled` | User dismissed login browser |
| `WebAuthError` | `.noCredentialsAvailable` | No credentials in storage |
| `WebAuthError` | `.pkceNotAllowed` | PKCE not enabled on the application |
| `CredentialsManagerError` | `.noCredentialsAvailable` | No stored credentials |
| `CredentialsManagerError` | `.failedToRenewCredentials(let e)` | Token refresh failed |
| `CredentialsManagerError` | `.biometricsFailed` | Biometric authentication failed |
| `CredentialsManagerError` | `.cannotAccessKeychainItem` | Keychain access error |
| `AuthenticationError` | `.isMultifactorRequired` | MFA challenge required |
| `AuthenticationError` | `.isNetworkError` | Network connectivity issue |

### Callback URL Formats

| Platform | Universal Link | Custom Scheme |
|----------|---------------|---------------|
| iOS | `https://{domain}/ios/{bundle}/callback` | `{bundle}://{domain}/ios/{bundle}/callback` |
| macOS | `https://{domain}/macos/{bundle}/callback` | `{bundle}://{domain}/macos/{bundle}/callback` |

## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [iOS/macOS Quickstart](https://auth0.com/docs/quickstart/native/ios-swift)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)
- [Auth0 Dashboard](https://manage.auth0.com)
- [EXAMPLES.md](https://github.com/auth0/Auth0.swift/blob/master/EXAMPLES.md)
