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

## When NOT to Use

- **Android apps**: Use [auth0-android](/auth0-android)
- **React Native apps**: Use [auth0-react-native](/auth0-react-native)
- **Flutter apps**: Use the native Flutter Auth0 SDK
- **Web SPAs** (React, Angular, Vue): Use [auth0-react](/auth0-react), [auth0-angular](/auth0-angular), or [auth0-vue](/auth0-vue)
- **Node.js/Express servers**: Use [auth0-express](/auth0-express)

## Prerequisites

- **iOS** 14.0+ / **macOS** 11.0+ / tvOS 14.0+ / watchOS 7.0+ / visionOS 1.0+
- **Xcode** 16.x
- **Swift** 6.0+
- Auth0 account — [Sign up free](https://auth0.com/signup)
- Node.js 20+ (for bootstrap script automation)
- Auth0 CLI — `brew install auth0/auth0-cli/auth0` (for bootstrap script)

## Quick Start Workflow

> **Agent instruction:** Follow these steps in order. If you encounter an error at any step, attempt to fix it up to 5 times before calling `AskUserQuestion` to ask the user for guidance. Always search existing code first — if there are existing login/logout handlers, hook into them rather than creating new ones.

### Step 1 — Install SDK

> **Agent instruction:** Check the project directory for an existing package manager file:
> - `Podfile` present → **CocoaPods**
> - `Cartfile` present → **Carthage**
> - `Package.swift` present → **Swift Package Manager**
>
> If none are found, ask via `AskUserQuestion`: _"Which dependency manager does your project use — Swift Package Manager, CocoaPods, or Carthage?"_
>
> **Swift Package Manager — `Package.swift` project:** Run this command in the project root to add the dependency automatically, then add `"Auth0"` to the target's `dependencies` array in `Package.swift`:
> ```bash
> swift package add-dependency https://github.com/auth0/Auth0.swift --from 2.18.0
> ```
>
> **Swift Package Manager — Xcode project (`.xcodeproj`, no `Package.swift`):** The CLI command does not apply. Instruct the user to add the package via Xcode: File → Add Package Dependencies → `https://github.com/auth0/Auth0.swift` → Up to Next Major Version from `2.18.0`.
>
> **CocoaPods or Carthage:** Follow the matching installation steps in [Setup Guide](./references/setup.md#sdk-installation). Do not just show the instructions — perform the file edits and run the commands.

### Step 2 — Configure Auth0

> **Agent instruction:** Check whether Auth0 credentials (domain and client ID) are already provided in the user's prompt. If yes, write `Auth0.plist` directly with those values. If not, ask via `AskUserQuestion`: _"How would you like to configure Auth0 for this project?"_
> - **Automatic setup (Recommended)** — runs a bootstrap script that creates the Auth0 app, database connection, callback URLs, and writes `Auth0.plist`
> - **Manual setup** — the user provides their Auth0 Client ID and Domain
>
> Follow the matching section in [Setup Guide](./references/setup.md#auth0-configuration) based on their choice.

### Step 3 — Configure Callback URLs

> **Agent instruction:** Ask the user via `AskUserQuestion`: _"Which callback URL scheme would you like to use?"_
> - **Custom scheme** (`{bundle}://`) — simpler, works on all Apple platforms
> - **HTTPS Universal Links** — recommended for production; prevents URL scheme hijacking
>
> Then follow **only** the matching path below.

#### Path A — Custom Scheme

> **Agent instruction:** In Auth0 Dashboard → **Applications** → your app → **Settings**, add to both **Allowed Callback URLs** and **Allowed Logout URLs**:
> - iOS: `YOUR_BUNDLE_ID://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_ID/callback`
> - macOS: `YOUR_BUNDLE_ID://YOUR_AUTH0_DOMAIN/macos/YOUR_BUNDLE_ID/callback`
>
> Then follow the [URL scheme registration steps in Setup Guide](./references/setup.md#register-url-scheme-required-for-custom-scheme-callbacks) to register `$(PRODUCT_BUNDLE_IDENTIFIER)` as a URL type in Xcode.

#### Path B — HTTPS Universal Links

> **Agent instruction:** All four steps below are required — skipping any one will cause the callback redirect to fail silently after login.
>
> **Step B1 — Register HTTPS callback URLs in Auth0 Dashboard:**
> Dashboard → Applications → your app → Settings → add to **Allowed Callback URLs** and **Allowed Logout URLs**:
> - iOS: `https://YOUR_AUTH0_DOMAIN/ios/YOUR_BUNDLE_ID/callback`
> - macOS: `https://YOUR_AUTH0_DOMAIN/macos/YOUR_BUNDLE_ID/callback`
>
> **Step B2 — Configure Device Settings in Auth0 Dashboard:**
> Dashboard → Applications → your app → Settings → scroll to bottom → **Show Advanced Settings** → **Device Settings** tab:
> 1. Enter the user's **Apple Team ID** (found at [developer.apple.com/account](https://developer.apple.com/account) under Membership)
> 2. Enter the **App Bundle Identifier**
> 3. Save changes
>
> Auth0 will now host `https://YOUR_AUTH0_DOMAIN/.well-known/apple-app-site-association` automatically. This file must exist and list your app's Team ID + Bundle ID before Universal Links will work on device.
>
> **Step B3 — Add Associated Domains entitlement in Xcode:**
> Add `com.apple.developer.associated-domains` to the app's `.entitlements` file with both `applinks:` and `webcredentials:` entries for the Auth0 domain. See [Setup Guide — Associated Domains](./references/setup.md#associated-domains-setup-https-universal-links) for the complete entitlements XML, Xcode capability steps, and build settings verification.
>
> **Step B4 — Use `.useHTTPS()` in the SDK:**
> ```swift
> Auth0.webAuth().useHTTPS()
> ```

### Step 4 — Implement Authentication

> **Agent instruction:** Search the project for `@main struct` (SwiftUI) or `AppDelegate`/`UIViewController` (UIKit) to detect the UI framework. If ambiguous, ask via `AskUserQuestion`: _"Does your app use SwiftUI or UIKit?"_ Then follow **only** the matching path below.

#### SwiftUI

> **Agent instruction:** Create `AuthenticationService.swift` as an `ObservableObject`, then wire it into the app entry point and root view. Search for the `@main` struct and `ContentView` (or equivalent root view) and update them as shown.

```swift
// AuthenticationService.swift
import Auth0
import Combine

class AuthenticationService: ObservableObject {
    @Published var isAuthenticated = false
    private let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

    init() { isAuthenticated = credentialsManager.canRenew() }

    func login() async {
        do {
            let credentials = try await Auth0
                .webAuth()
                .useHTTPS()
                .scope("openid profile email offline_access")
                .start()
            _ = credentialsManager.store(credentials: credentials)
            await MainActor.run { isAuthenticated = true }
        } catch WebAuthError.userCancelled { }
        catch { print("Login failed: \(error)") }
    }

    func logout() async {
        do { try await Auth0.webAuth().useHTTPS().clearSession() }
        catch { print("Logout failed: \(error)") }
        _ = credentialsManager.clear()
        await MainActor.run { isAuthenticated = false }
    }
}
```

```swift
// @main App struct — inject AuthenticationService as environment object
@StateObject private var auth = AuthenticationService()
// In body: ContentView().environmentObject(auth)

// Root ContentView — branch on authentication state
@EnvironmentObject var auth: AuthenticationService
// In body: if auth.isAuthenticated { HomeView() } else { LoginView() }
```

For complete SwiftUI app lifecycle wiring, see [Integration Patterns](./references/integration.md#swiftui-app-lifecycle-recommended).

#### UIKit

> **Agent instruction:** Create `AuthenticationService.swift` as a plain class, then add login/logout calls to the relevant `UIViewController`. Also check whether the app uses `SFSafariViewController` — if so, add `WebAuthentication.resume(with:)` to `AppDelegate`/`SceneDelegate` (see note below).

```swift
// AuthenticationService.swift
import Auth0

class AuthenticationService {
    private let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

    var isAuthenticated: Bool { credentialsManager.canRenew() }

    func login() async throws {
        let credentials = try await Auth0
            .webAuth()
            .useHTTPS()
            .scope("openid profile email offline_access")
            .start()
        _ = credentialsManager.store(credentials: credentials)
    }

    func logout() async throws {
        try await Auth0.webAuth().useHTTPS().clearSession()
        _ = credentialsManager.clear()
    }
}
```

```swift
// In your UIViewController
private let auth = AuthenticationService()

@IBAction func loginTapped(_ sender: UIButton) {
    Task {
        do {
            try await auth.login()
            await MainActor.run { navigateToHome() }
        } catch WebAuthError.userCancelled { }
        catch { print("Login failed: \(error)") }
    }
}

@IBAction func logoutTapped(_ sender: UIButton) {
    Task {
        do { try await auth.logout() }
        catch { print("Logout failed: \(error)") }
        await MainActor.run { navigateToLogin() }
    }
}
```

> **Note — SFSafariViewController only:** If the app uses `.provider(WebAuthentication.safariProvider())` instead of the default `ASWebAuthenticationSession`, add `WebAuthentication.resume(with: url)` to `AppDelegate.application(_:open:url:options:)` and `SceneDelegate.scene(_:openURLContexts:)`. See [Integration Patterns](./references/integration.md#uikit-app-lifecycle) for the exact code.

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

## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [iOS/macOS Quickstart](https://auth0.com/docs/quickstart/native/ios-swift)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)
- [Auth0 Dashboard](https://manage.auth0.com)
- [EXAMPLES.md](https://github.com/auth0/Auth0.swift/blob/master/EXAMPLES.md)
