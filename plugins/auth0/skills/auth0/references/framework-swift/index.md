# Auth0 Swift

Auth0.swift is the official Auth0 SDK for Apple platforms (iOS, macOS, tvOS, watchOS, visionOS). This skill adds complete native authentication to Swift apps using Web Auth (system browser redirect), secure Keychain credential storage via `CredentialsManager`, and optional biometric protection.

## Critical rules

- **Credential privacy is IMPORTANT:** never echo Auth0 credentials (domain, client ID, client secret) in response text or terminal output. Instead, redirect Auth0 CLI output to a temp file and use the Read tool to extract values, then write them directly into config files (e.g. `Auth0.plist`) with the Write or Edit tool. When confirming the active tenant, mask the domain (e.g. `your-te****.us.auth0.com`).

## When NOT to Use

- **Android apps**: Use the Auth0 integration workflow for Android
- **React Native apps**: Use the Auth0 integration workflow for React Native
- **Flutter apps**: Use the native Flutter Auth0 SDK
- **Web SPAs** (React, Angular, Vue): Use the Auth0 integration workflow for React, Angular, or Vue
- **Node.js/Express servers**: Use the Auth0 integration workflow for Express

## Prerequisites

- **iOS** 14.0+ / **macOS** 11.0+ / tvOS 14.0+ / watchOS 7.0+ / visionOS 1.0+
- **Xcode** 16.x
- **Swift** 6.0+
- Auth0 account — [Sign up free](https://auth0.com/signup)
- Auth0 CLI — `brew install auth0/auth0-cli/auth0` (for automated setup)

## Quick start

> **Agent instruction:** Follow these steps in order. If you encounter an error at any step, attempt to fix it up to 5 times before calling `AskUserQuestion` to ask the user for guidance. Always search existing code first — if there are existing login/logout handlers, hook into them rather than creating new ones.
>
> **IMPORTANT — Credential privacy:** Never echo Auth0 credentials (domain, client ID, client secret) in your response text or terminal output. Write them directly into config files using the Write or Edit tool. When running Auth0 CLI commands that produce output containing these values, redirect output to a file and read it programmatically. For example:
> ```bash
> auth0 apps create ... --json --no-input > /tmp/auth0-output.json 2>&1
> ```
> Then use the Read tool on `/tmp/auth0-output.json` to extract needed values and write them directly into `Auth0.plist` or other config files — never echo them in response text or terminal. When confirming the active tenant with the user, use a masked format (e.g., `your-te****.us.auth0.com`).

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
> **CocoaPods or Carthage:** Follow the matching installation steps in this group's setup guide (SDK Installation section). Do not just show the instructions — perform the file edits and run the commands.

### Step 2 — Configure Auth0

> **Agent instruction:**
> - **If an `Auth0.plist` file already exists in the project:** Read it to extract `ClientId` and `Domain`, then proceed to Step 3.
> - **If no `Auth0.plist` exists:** Ask the user via `AskUserQuestion`: _"How would you like to configure Auth0?"_
>   - **Automatic (Auth0 CLI)** — I'll create the application, set callback URLs, and configure everything using the Auth0 CLI.
>   - **Manual** — You provide a pre-configured `Auth0.plist` file and I'll add it to your project.
>
> If the user chooses **automatic**: Follow this group's setup guide (Automated Setup via Auth0 CLI section).
> If the user chooses **manual**: Follow this group's setup guide (Manual Setup section).
>
> **IMPORTANT — Never pass credentials in code:** Do NOT hardcode `clientId` or `domain` in Swift source, and do NOT pass them as arguments to `Auth0.webAuth()`, `Auth0.authentication()`, or any other SDK call. The SDK reads these values automatically from `Auth0.plist`. Always use the no-argument forms:
> ```swift
> Auth0.webAuth()           // ✓ reads Auth0.plist automatically
> Auth0.authentication()    // ✓ reads Auth0.plist automatically
>
> Auth0.webAuth(clientId: "...", domain: "...")        // ✗ never do this
> Auth0.authentication(clientId: "...", domain: "...") // ✗ never do this
> ```
> The explicit-credential forms are a rare escape hatch (see the API Reference below); when `Auth0.plist` is present, always prefer the no-argument forms.

### Step 3 — Configure Callback URLs

> **Agent instruction:**
> 1. Read `Auth0.plist` to obtain `ClientId` and `Domain`.
> 2. Extract the bundle identifier from `project.pbxproj`: search for `PRODUCT_BUNDLE_IDENTIFIER`, skip values containing `$(` or `Tests`.
> 3. Ask the user via `AskUserQuestion`: _"Which callback URL scheme would you like to use?"_
>    - **Custom scheme** (`{bundle}://`) — simpler, works on all Apple platforms
>    - **HTTPS Universal Links** — recommended for production; prevents URL scheme hijacking
>
> Then follow **only** the matching path below.

#### Path A — Custom Scheme

> **Agent instruction:** Register the callback URLs using the Auth0 CLI (substitute real values for `CLIENT_ID`, `BUNDLE_ID`, `DOMAIN`).
>
> First, retrieve existing callback and logout URLs to avoid overwriting them:
> ```bash
> auth0 apps show CLIENT_ID --json --no-input > /tmp/auth0-app-info.json 2>&1
> ```
> Read `/tmp/auth0-app-info.json` to extract existing `callbacks` and `allowed_logout_urls` arrays.
>
> Then include any existing URLs as a comma-separated list alongside the new ones:
> ```bash
> auth0 apps update CLIENT_ID \
>   --callbacks "EXISTING_CALLBACKS,BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback" \
>   --logout-urls "EXISTING_LOGOUT_URLS,BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback" \
>   --no-input > /dev/null 2>&1
> ```
> If there are no existing URLs, omit the `EXISTING_` prefix and use only the new URL.
>
> Then follow the URL scheme registration steps in this group's setup guide (Post-Setup Steps section) to register `$(PRODUCT_BUNDLE_IDENTIFIER)` as a URL type in Xcode.

#### Path B — HTTPS Universal Links

> **Agent instruction:** All four steps below are required — skipping any one will cause the callback redirect to fail silently after login.
>
> **Step B1 — Register callback URLs via Auth0 CLI:**
> Register both HTTPS and custom scheme so the app works in all scenarios.
>
> First, retrieve existing callback and logout URLs to avoid overwriting them:
> ```bash
> auth0 apps show CLIENT_ID --json --no-input > /tmp/auth0-app-info.json 2>&1
> ```
> Read `/tmp/auth0-app-info.json` to extract existing `callbacks` and `allowed_logout_urls` arrays.
>
> Then include any existing URLs as a comma-separated list alongside the new ones:
> ```bash
> auth0 apps update CLIENT_ID \
>   --callbacks "EXISTING_CALLBACKS,https://DOMAIN/ios/BUNDLE_ID/callback,BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback" \
>   --logout-urls "EXISTING_LOGOUT_URLS,https://DOMAIN/ios/BUNDLE_ID/callback,BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback" \
>   --no-input > /dev/null 2>&1
> ```
> If there are no existing URLs, omit the `EXISTING_` prefix and use only the new URLs.
>
> **Step B2 — Configure Device Settings via Auth0 CLI:**
> Extract `DEVELOPMENT_TEAM` from `project.pbxproj` (10-character value, e.g. `ABC12DE34F`). If not found, ask via `AskUserQuestion`: _"What is your Apple Team ID? (developer.apple.com → Account → Membership Details)"_
> ```bash
> auth0 api patch applications/CLIENT_ID \
>   --data '{"mobile":{"ios":{"team_id":"TEAM_ID","app_bundle_identifier":"BUNDLE_ID"}}}' \
>   --no-input > /dev/null 2>&1
> ```
> Auth0 will now host the `apple-app-site-association` file automatically — required for Universal Links to work on device.
>
> **Step B3 — Add Associated Domains entitlement in Xcode:**
> Add `com.apple.developer.associated-domains` to the app's `.entitlements` file with both `applinks:` and `webcredentials:` entries for the Auth0 domain. See this group's setup guide (Associated Domains Setup section) for the complete entitlements XML, Xcode capability steps, and build settings verification.
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

For complete SwiftUI app lifecycle wiring, see this group's patterns guide (SwiftUI patterns section).

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

> **Note — SFSafariViewController only:** If the app uses `.provider(WebAuthentication.safariProvider())` instead of the default `ASWebAuthenticationSession`, add `WebAuthentication.resume(with: url)` to `AppDelegate.application(_:open:url:options:)` and `SceneDelegate.scene(_:openURLContexts:)`. See this group's patterns guide (Platform-Specific Patterns section) for the exact code.

### Step 5 — Verify Build

> **Agent instruction:** Run a build to verify the integration compiles without errors:
> ```bash
> xcodebuild build -scheme YOUR_SCHEME -destination "platform=iOS Simulator,name=iPhone 16"
> ```
> If the build fails, review error messages and fix up to 5 times before asking the user.

## Choose your task

You arrived here for a specific intent. After reading the shared prerequisites
above, read the reference for your task:

| Intent | Read |
|---|---|
| setup, install | `Read: references/framework-swift/setup.md` |
| integrate, login, logout | `Read: references/framework-swift/patterns.md` |
| feature:mfa | `Read: references/framework-swift/patterns.md` |
| upgrade-sdk | `Read: references/framework-swift/migration.md` |

**Then, as needed for your task:**
- Setup variants (CocoaPods/Carthage, manual `Auth0.plist`, URL schemes, Associated Domains): `Read: references/framework-swift/setup.md`
- Integration patterns (login/logout, CredentialsManager, biometrics, Organizations, MFA, calling APIs, platform-specific lifecycle): `Read: references/framework-swift/patterns.md`
- Full API / configuration lookup (WebAuth & CredentialsManager options, claims, testing checklist, security considerations): `Read: references/framework-swift/api-reference.md`
- v2→v3 migration: `Read: references/framework-swift/migration.md`

Read only the reference (or references) your task needs — not all of them.
