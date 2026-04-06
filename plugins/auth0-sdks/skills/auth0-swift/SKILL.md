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

**Swift Package Manager (recommended):**
1. In Xcode: **File → Add Package Dependencies**
2. Enter URL: `https://github.com/auth0/Auth0.swift`
3. Select **Up to Next Major Version** starting from `2.18.0`
4. Click **Add Package** and confirm your app target is selected

**CocoaPods:**
```ruby
# Podfile
pod 'Auth0', '~> 2.18'
```
Then run `pod install` and always open `.xcworkspace`.

**Carthage:**
```text
github "auth0/Auth0.swift" ~> 2.18
```
Then run `carthage update --use-xcframeworks`.

### Step 2 — Configure Auth0

> **Agent instruction:** Check whether Auth0 credentials (domain and client ID) are already provided in the user's prompt. If yes, write `Auth0.plist` directly with those values and skip the options below. If no credentials are provided, offer Option A or B.

**Option A — Automatic Setup (Bootstrap Script):**
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

### Step 3 — Register Callback URLs in Auth0 Dashboard

In Auth0 Dashboard → **Applications** → your app → **Settings**, add to both **Allowed Callback URLs** and **Allowed Logout URLs**:

**iOS:**
```text
https://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_IDENTIFIER/callback,
YOUR_BUNDLE_IDENTIFIER://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_IDENTIFIER/callback
```

**macOS:**
```text
https://YOUR_AUTH0_DOMAIN/macos/YOUR_BUNDLE_IDENTIFIER/callback,
YOUR_BUNDLE_IDENTIFIER://YOUR_AUTH0_DOMAIN/macos/YOUR_BUNDLE_IDENTIFIER/callback
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
