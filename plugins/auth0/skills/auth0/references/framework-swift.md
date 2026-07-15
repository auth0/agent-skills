
# Auth0 Swift Integration

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

## Quick Start Workflow

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
> **CocoaPods or Carthage:** Follow the matching installation steps in the Setup Guide — SDK Installation section (below). Do not just show the instructions — perform the file edits and run the commands.

### Step 2 — Configure Auth0

> **Agent instruction:**
> - **If an `Auth0.plist` file already exists in the project:** Read it to extract `ClientId` and `Domain`, then proceed to Step 3.
> - **If no `Auth0.plist` exists:** Ask the user via `AskUserQuestion`: _"How would you like to configure Auth0?"_
>   - **Automatic (Auth0 CLI)** — I'll create the application, set callback URLs, and configure everything using the Auth0 CLI.
>   - **Manual** — You provide a pre-configured `Auth0.plist` file and I'll add it to your project.
>
> If the user chooses **automatic**: Follow the Setup Guide — Automated Setup via Auth0 CLI section (below).
> If the user chooses **manual**: Follow the Setup Guide — Manual Setup section (below).

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
> Then follow the URL scheme registration steps in the Setup Guide section (below) to register `$(PRODUCT_BUNDLE_IDENTIFIER)` as a URL type in Xcode.

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
> Add `com.apple.developer.associated-domains` to the app's `.entitlements` file with both `applinks:` and `webcredentials:` entries for the Auth0 domain. See the Setup Guide — Associated Domains section (below) for the complete entitlements XML, Xcode capability steps, and build settings verification.
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

For complete SwiftUI app lifecycle wiring, see the Integration Patterns — SwiftUI App Lifecycle section (below).

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

> **Note — SFSafariViewController only:** If the app uses `.provider(WebAuthentication.safariProvider())` instead of the default `ASWebAuthenticationSession`, add `WebAuthentication.resume(with: url)` to `AppDelegate.application(_:open:url:options:)` and `SceneDelegate.scene(_:openURLContexts:)`. See the Integration Patterns — UIKit App Lifecycle section (below) for the exact code.

### Step 5 — Verify Build

> **Agent instruction:** Run a build to verify the integration compiles without errors:
> ```bash
> xcodebuild build -scheme YOUR_SCHEME -destination "platform=iOS Simulator,name=iPhone 16"
> ```
> If the build fails, review error messages and fix up to 5 times before asking the user.

## Detailed Documentation

- **Setup Guide** (see the Setup Guide section below) — Auth0 CLI configuration, Auth0.plist, URL scheme registration, Associated Domains, CocoaPods/SPM/Carthage install
- **Integration Patterns** (see the Integration Patterns section below) — Web Auth login/logout, CredentialsManager, biometric protection, MFA, organizations, error handling, SwiftUI/UIKit patterns
- **API Reference & Testing** (see the API Reference & Testing section below) — Full API reference, configuration options, claims reference, testing checklist, troubleshooting

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

## Related Capabilities

- Auth0 setup — if Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Manage Auth0 resources from the terminal with the Auth0 CLI (`tooling-cli`)


## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [iOS/macOS Quickstart](https://auth0.com/docs/quickstart/native/ios-swift)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)
- [Auth0 Dashboard](https://manage.auth0.com)
- [EXAMPLES.md](https://github.com/auth0/Auth0.swift/blob/master/EXAMPLES.md)

---

# API Reference & Testing — Auth0 Swift

## Configuration Reference

### Auth0.plist Keys

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `ClientId` | String | Yes | Your Auth0 application Client ID |
| `Domain` | String | Yes | Your Auth0 tenant domain (e.g., `tenant.auth0.com`) |

### Programmatic Initialization

Use when you cannot use `Auth0.plist` (e.g., reading credentials from environment):

```swift
// Web Auth with explicit credentials
Auth0
    .webAuth(clientId: "YOUR_CLIENT_ID", domain: "YOUR_DOMAIN")
    .start()

// Authentication API with explicit credentials
Auth0
    .authentication(clientId: "YOUR_CLIENT_ID", domain: "YOUR_DOMAIN")
    .login(usernameOrEmail: "user@example.com", password: "password",
           realmOrConnection: "Username-Password-Authentication",
           scope: "openid profile email")

// CredentialsManager with explicit credentials
let authentication = Auth0.authentication(clientId: "YOUR_CLIENT_ID", domain: "YOUR_DOMAIN")
let credentialsManager = CredentialsManager(authentication: authentication)
```

### WebAuth Builder Options

| Method | Type | Description |
|--------|------|-------------|
| `.useHTTPS()` | — | Use Universal Links (HTTPS) for callback — recommended |
| `.scope(_ scope: String)` | `String` | Space-separated OAuth scopes. Default: `"openid profile email"`. Add `"offline_access"` for refresh tokens |
| `.audience(_ audience: String)` | `String` | API audience (resource identifier). Required for API access tokens |
| `.parameters(_ params: [String: String])` | `[String: String]` | Additional authorize parameters (e.g., `["screen_hint": "signup"]`) |
| `.organization(_ organization: String)` | `String` | Auth0 Organization ID or name |
| `.invitationURL(_ url: URL)` | `URL` | Accept an organization invitation |
| `.redirectURL(_ url: URL)` | `URL` | Override the callback URL |
| `.provider(_ provider: WebAuthProvider)` | — | Use SFSafariViewController or custom provider |
| `.ephemeralSession()` | — | Do not persist session cookies (no SSO) |
| `.nonce(_ nonce: String)` | `String` | Override the auto-generated nonce |
| `.maxAge(_ maxAge: Int)` | `Int` | Maximum age (seconds) of allowed authentication |
| `.leeway(_ leeway: Int)` | `Int` | Clock skew tolerance in seconds for ID token validation |

### CredentialsManager Options

| Method | Type | Description |
|--------|------|-------------|
| `CredentialsManager(authentication:)` | — | Standard initialization |
| `CredentialsManager(authentication:maxRetries:)` | `Int` | Set retry attempts on transient errors |
| `CredentialsManager(authentication:storeKey:)` | `String` | Custom Keychain key for multi-account support |
| `.store(credentials:)` | `Bool` | Store credentials; returns `false` if Keychain write fails |
| `.credentials()` | `Credentials` (async) | Retrieve valid credentials; auto-renews if expired |
| `.credentials(minTTL:)` | `Credentials` (async) | Retrieve with minimum remaining TTL |
| `.canRenew()` | `Bool` | Returns `true` if a refresh token is available |
| `.hasValid(minTTL:)` | `Bool` | Returns `true` if access token is valid for at least `minTTL` seconds |
| `.clear()` | `Bool` | Remove credentials from Keychain |
| `.revoke(headers:)` | `Void` (async) | Revoke refresh token and clear credentials |
| `.enableBiometrics(withTitle:)` | — | Prompt biometric authentication when retrieving credentials |
| `.enableBiometrics(withTitle:policy:)` | — | Biometrics with custom `LAPolicy` |
| `.clearBiometricSession()` | — | Clear cached biometric session |
| `.isBiometricSessionValid()` | `Bool` | Check if biometric session is still valid |

### Biometric Policy Options

| Policy | Description |
|--------|-------------|
| `.default` | System manages prompts; allows reuse within a short window |
| `.always` | Fresh biometric prompt every time credentials are retrieved |
| `.session(timeoutInSeconds:)` | Reuse biometric auth for specified seconds (default 300) |
| `.appLifecycle(timeoutInSeconds:)` | Reuse for app lifecycle (default 3600 seconds / 1 hour) |

### Credentials Object

| Property | Type | Description |
|----------|------|-------------|
| `accessToken` | `String` | JWT access token for API calls |
| `tokenType` | `String` | Token type, usually `"Bearer"` |
| `idToken` | `String` | JWT ID token with user identity claims |
| `refreshToken` | `String?` | Refresh token (requires `offline_access` scope) |
| `expiresIn` | `Date` | Access token expiration date |
| `scope` | `String?` | Granted scopes |

---

## Claims Reference

### Standard OIDC Claims (from ID Token)

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | String | User ID (e.g., `"auth0|64abc123"`) |
| `name` | String | Full display name |
| `given_name` | String | First name |
| `family_name` | String | Last name |
| `email` | String | Email address |
| `email_verified` | Bool | Whether email is verified |
| `picture` | String | Profile picture URL |
| `updated_at` | Date | Last profile update timestamp |
| `iss` | String | Issuer — your Auth0 domain |
| `aud` | String | Audience — your Client ID |
| `exp` | Date | Expiration time |
| `iat` | Date | Issued at time |

### Auth0-Specific Claims

| Claim | Type | Description |
|-------|------|-------------|
| `https://example.com/permissions` | `[String]` | User permissions (added via Auth0 Actions) |
| `https://example.com/roles` | `[String]` | User roles (added via Auth0 Actions) |
| `org_id` | String | Organization ID |
| `org_name` | String | Organization name |

### Decoding Claims

```swift
import Auth0

// Decode ID token claims
if let claims = try? IDTokenClaimsValidation().validate(credentials.idToken) {
    print("User ID: \(claims.subject)")
    print("Email: \(claims.email ?? "none")")
}

// Or decode manually with JWT libraries
// The ID token is a standard JWT — decode payload with any JWT library
```

---

## Testing Checklist

> **Physical device note:** Web Auth (ASWebAuthenticationSession) works in the iOS Simulator, but biometric authentication (Face ID / Touch ID) requires a real device. Test biometric flows on a physical device before shipping. Simulator has limitations for camera-based Face ID and some Keychain access control scenarios.

- [ ] `Auth0.plist` is present in the Xcode project and added to the app target
- [ ] Both `https://` Universal Link and `{bundle}://` custom scheme URLs are in Auth0 Dashboard Callback URLs
- [ ] App builds without errors: `xcodebuild build -scheme SCHEME -destination "platform=iOS Simulator,name=iPhone 16"`
- [ ] Login opens system browser (ASWebAuthenticationSession) and redirects back to app
- [ ] `credentialsManager.store(credentials:)` returns `true` after login
- [ ] `credentialsManager.canRenew()` returns `true` after storing credentials with `offline_access`
- [ ] `credentialsManager.credentials()` returns valid access token without re-login (token auto-refresh)
- [ ] Logout clears session cookie (subsequent login shows login prompt, not silent SSO)
- [ ] `credentialsManager.clear()` returns `true` after logout
- [ ] Error cases are handled: `userCancelled`, `noCredentialsAvailable`, `failedToRenewCredentials`
- [ ] Biometric prompt appears (if enabled) before credentials are returned
- [ ] App state persists across launches (credentials survive app restart)

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Auth0.plist not found` | File not added to target | Right-click `Auth0.plist` → Add Files → check app target |
| `No such module 'Auth0'` | Package not installed or wrong target | Verify SPM package in Xcode → Package Dependencies; re-resolve |
| `Redirect to app fails` | Callback URL mismatch | Ensure URL in Auth0 Dashboard matches bundle ID exactly |
| `Cannot open URL` (iOS) | Missing URL scheme | Add `$(PRODUCT_BUNDLE_IDENTIFIER)` to URL Schemes in Info tab |
| Login shows blank screen | Universal Links not configured | Use `.useHTTPS()` only if Universal Links are configured, else omit it |
| Token not renewable | Missing `offline_access` scope | Add `"offline_access"` to `.scope()` call |
| `biometricsFailed` error | No biometric enrolled or cancelled | Fall back to re-login |
| `cannotAccessKeychainItem` | Keychain entitlements missing | Verify app has Keychain Sharing capability or correct entitlements |
| Crash on macOS | Missing network entitlement | Add "Outgoing Connections (Client)" capability in Signing & Capabilities |
| Build fails on Swift 6 | Concurrency issues | Ensure callbacks are dispatched on `@MainActor` for UI updates |

---

## Security Considerations

- **No client secret**: Native apps use PKCE (Proof Key for Code Exchange) — no client secret is required or used. Do not add a client secret to `Auth0.plist`.
- **Keychain storage**: Always use `CredentialsManager` for token storage. Never use `UserDefaults` or plain files. Tokens in `UserDefaults` are readable by other apps on jailbroken devices.
- **Universal Links vs custom scheme**: Universal Links (`https://`) are recommended for production as they cannot be intercepted by malicious apps. Custom schemes (`{bundle}://`) are acceptable but less secure.
- **Scope minimization**: Request only the scopes your app needs. Avoid requesting permissions you do not use.
- **Refresh token rotation**: Enable Refresh Token Rotation in Auth0 Dashboard (Applications → Advanced Settings → OAuth) to detect token theft.
- **Biometric storage**: When using `enableBiometrics()`, the Keychain entry uses `kSecAccessControlBiometryCurrentSet` which invalidates the entry if new biometrics are enrolled — protecting against biometric spoofing.
- **Certificate pinning**: For extra security, use a custom `URLSession` with certificate pinning when calling your API with the access token.
- **App Transport Security**: Ensure `NSAllowsArbitraryLoads` is not set to `true` in production builds.

---

## Related Capabilities

- Auth0 authentication for Android/Kotlin apps — the Auth0 integration workflow for Android
- Cross-platform iOS + Android authentication with Flutter — the Auth0 integration workflow for Flutter
- Cross-platform iOS + Android authentication with React Native — the Auth0 integration workflow for React Native
- Auth0 setup — if Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Multi-factor authentication — ask for MFA (feature:mfa)

---

# Integration Patterns — Auth0 Swift

## Authentication Flow

```text
User taps "Log In"
    ↓
Auth0.webAuth().start()
    ↓
ASWebAuthenticationSession opens Auth0 Universal Login
    ↓ (user authenticates)
Auth0 redirects to {bundle}:// or https:// callback
    ↓
SDK exchanges code for tokens (PKCE)
    ↓
Credentials returned (accessToken, idToken, refreshToken)
    ↓
credentialsManager.store(credentials:) → Keychain
```

---

## Web Auth Login & Logout

### Basic Login (Async/Await)

```swift
import Auth0

func login() async throws -> Credentials {
    return try await Auth0
        .webAuth()
        .useHTTPS()                              // Use Universal Links callback
        .scope("openid profile email offline_access")
        .start()
}
```

### Basic Login (Completion Handler)

```swift
Auth0
    .webAuth()
    .useHTTPS()
    .scope("openid profile email offline_access")
    .start { result in
        switch result {
        case .success(let credentials):
            // Access token available at credentials.accessToken
            credentialsManager.store(credentials: credentials)
        case .failure(let error):
            print("Login failed: \(error)")
        }
    }
```

### Logout

```swift
// Step 1: Clear the Auth0 session cookie (prevents silent re-login)
try await Auth0
    .webAuth()
    .useHTTPS()
    .clearSession()

// Step 2: Clear locally stored credentials
let credentialsManager = CredentialsManager(authentication: Auth0.authentication())
_ = credentialsManager.clear()
```

### Sign Up (Direct to Registration Screen)

```swift
try await Auth0
    .webAuth()
    .useHTTPS()
    .parameters(["screen_hint": "signup"])
    .start()
```

### Custom Scopes and Audience

```swift
// Request an access token for your API
try await Auth0
    .webAuth()
    .useHTTPS()
    .audience("https://your-api.example.com")
    .scope("openid profile email offline_access read:data")
    .start()
```

### Ephemeral Session (No SSO, No Cookie Persistence)

```swift
// Each login shows the login page — no session cookie stored
try await Auth0
    .webAuth()
    .useHTTPS()
    .ephemeralSession()
    .start()
```

---

## CredentialsManager

`CredentialsManager` handles secure Keychain storage and automatic token refresh.

### Basic Setup

```swift
// Initialize once (e.g., as a property on your auth service)
let credentialsManager = CredentialsManager(authentication: Auth0.authentication())
```

### Store After Login

```swift
let credentials = try await Auth0.webAuth().start()
guard credentialsManager.store(credentials: credentials) else {
    throw AuthError.keychainWriteFailed
}
```

### Retrieve (Auto-Refreshes Expired Tokens)

```swift
do {
    let credentials = try await credentialsManager.credentials()
    callAPI(with: credentials.accessToken)
} catch CredentialsManagerError.noCredentialsAvailable {
    // No credentials stored — show login screen
    await showLogin()
} catch CredentialsManagerError.failedToRenewCredentials(let error) {
    // Refresh token expired or revoked — force re-login
    _ = credentialsManager.clear()
    await showLogin()
}
```

### Check Authentication State on Launch

```swift
func checkSession() -> Bool {
    // Returns true if a valid refresh token is stored
    return credentialsManager.canRenew()
}

// Check if access token is still valid without auto-refresh
func hasValidToken(minTTL: Int = 60) -> Bool {
    return credentialsManager.hasValid(minTTL: minTTL)
}
```

### Force Token Renewal

```swift
do {
    let credentials = try await credentialsManager.renew()
    // Renewed token available at credentials.accessToken
    _ = credentialsManager.store(credentials: credentials)
} catch {
    print("Renewal failed: \(error)")
}
```

### Revoke Refresh Token

```swift
// Revokes the refresh token on Auth0 and clears local credentials
try await credentialsManager.revoke()
```

---

## Biometric Protection

Protect credential retrieval with Face ID / Touch ID.

> **Physical device note:** Biometric authentication (Face ID / Touch ID) requires a real device. The iOS Simulator supports simulated biometrics but physical device testing is required before shipping to verify actual hardware behavior.

### Enable Biometrics

```swift
let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

// Basic — system-managed prompt reuse
credentialsManager.enableBiometrics(withTitle: "Authenticate to access your account")

// With session timeout (reuse for 5 minutes)
credentialsManager.enableBiometrics(
    withTitle: "Authenticate to access your account",
    policy: .session(timeoutInSeconds: 300)
)

// Require fresh biometric every time
credentialsManager.enableBiometrics(
    withTitle: "Authenticate to access your account",
    policy: .always
)

// App lifecycle (reset on app background/foreground)
credentialsManager.enableBiometrics(
    withTitle: "Authenticate to access your account",
    policy: .appLifecycle(timeoutInSeconds: 3600)
)
```

### Handle Biometric Errors

```swift
do {
    let credentials = try await credentialsManager.credentials()
    useCredentials(credentials)
} catch CredentialsManagerError.biometricsFailed {
    // Biometric auth failed — ask user to log in again
    _ = credentialsManager.clear()
    await login()
} catch CredentialsManagerError.noCredentialsAvailable {
    await login()
}
```

### Info.plist Permission (Required)

Add to your app's `Info.plist`:
```xml
<key>NSFaceIDUsageDescription</key>
<string>Authenticate to access your account securely.</string>
```

---

## Error Handling

### Web Auth Errors

```swift
do {
    let credentials = try await Auth0.webAuth().start()
} catch WebAuthError.userCancelled {
    // User tapped Cancel — no action needed, just return to UI
} catch WebAuthError.noCredentialsAvailable {
    print("No credentials available — unexpected after login")
} catch WebAuthError.pkceNotAllowed {
    print("PKCE not enabled — check Auth0 Dashboard → Application → Advanced Settings → OAuth")
} catch {
    // Other error (network, configuration)
    print("Web Auth error: \(error)")
}
```

### CredentialsManager Errors

```swift
do {
    let credentials = try await credentialsManager.credentials()
} catch CredentialsManagerError.noCredentialsAvailable {
    // First launch or after logout
    await showLoginScreen()
} catch CredentialsManagerError.failedToRenewCredentials(let renewalError) {
    // Refresh token expired — must re-authenticate
    _ = credentialsManager.clear()
    await showLoginScreen()
} catch CredentialsManagerError.biometricsFailed {
    // Face ID / Touch ID failed
    await showBiometricFailureMessage()
} catch CredentialsManagerError.cannotAccessKeychainItem {
    // Keychain access denied (e.g., device locked, missing entitlements)
    print("Keychain error: \(error)")
}
```

### Authentication API Errors

```swift
Auth0
    .authentication()
    .login(usernameOrEmail: "user@example.com",
           password: "password",
           realmOrConnection: "Username-Password-Authentication",
           scope: "openid profile email offline_access")
    .start { result in
        switch result {
        case .success(let credentials):
            // Access token available at credentials.accessToken
            credentialsManager.store(credentials: credentials)
        case .failure(let error) where error.isMultifactorRequired:
            // Extract MFA token for MFA challenge flow
            if let mfaPayload = error.mfaRequiredErrorPayload {
                startMFAChallenge(mfaToken: mfaPayload.mfaToken)
            }
        case .failure(let error) where error.isNetworkError:
            showNetworkError()
        case .failure(let error):
            print("Auth error code: \(error.code), description: \(error.localizedDescription)")
        }
    }
```

---

## MFA (Multi-Factor Authentication)

### Handling MFA Required Error

```swift
// When login returns isMultifactorRequired = true, challenge with OTP
func verifyMFA(mfaToken: String, otp: String) async throws -> Credentials {
    return try await Auth0
        .authentication()
        .multifactorChallenge(mfaToken: mfaToken, types: ["otp"])
        .start()
}
```

---

## Organizations

### Login to a Specific Organization

```swift
try await Auth0
    .webAuth()
    .useHTTPS()
    .organization("YOUR_ORG_ID")
    .start()
```

### Accept Organization Invitation

```swift
// Handle invitation URL from deep link
func handleInvitation(url: URL) async {
    try? await Auth0
        .webAuth()
        .useHTTPS()
        .invitationURL(url)
        .start()
}
```

---

## Platform-Specific Patterns

### SwiftUI App Lifecycle (Recommended)

```swift
// MyApp.swift
import SwiftUI
import Auth0

@main
struct MyApp: App {
    @StateObject private var auth = AuthenticationService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(auth)
        }
    }
}

// ContentView.swift
struct ContentView: View {
    @EnvironmentObject var auth: AuthenticationService

    var body: some View {
        Group {
            if auth.isAuthenticated {
                HomeView()
            } else {
                LoginView()
            }
        }
        .onAppear {
            auth.checkSession()
        }
    }
}
```

### UIKit App Lifecycle

```swift
// AppDelegate.swift
import UIKit
import Auth0

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ app: UIApplication,
                     open url: URL,
                     options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Required for SFSafariViewController or custom URL scheme
        return WebAuthentication.resume(with: url)
    }
}

// SceneDelegate.swift (if using scenes)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        WebAuthentication.resume(with: url)
    }
}
```

### Using SFSafariViewController (Instead of ASWebAuthenticationSession)

```swift
// For apps that cannot use ASWebAuthenticationSession
Auth0
    .webAuth()
    .provider(WebAuthentication.safariProvider())
    .start { result in
        switch result {
        case .success(let credentials):
            print("Login success")
        case .failure(let error):
            print("Login failed: \(error)")
        }
    }
```

> **Note:** SFSafariViewController requires `WebAuthentication.resume(with:)` to be called from `AppDelegate` or `SceneDelegate` (see UIKit pattern above).

---

## App Groups (Shared Keychain Access)

To share credentials between your app and extensions (widgets, share extensions):

```swift
// Use a custom storeKey to write to a shared Keychain group
let credentialsManager = CredentialsManager(
    authentication: Auth0.authentication(),
    storeKey: "com.yourcompany.sharedCredentials"
)

// Configure Keychain sharing in Xcode:
// Target → Signing & Capabilities → + Capability → Keychain Sharing
// Add a shared Keychain group name
```

---

## Calling Your API with the Access Token

```swift
func fetchData() async throws -> [Item] {
    let credentials = try await credentialsManager.credentials()

    var request = URLRequest(url: URL(string: "https://your-api.example.com/items")!)
    request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")

    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode([Item].self, from: data)
}
```

---

# Setup Guide — Auth0 Swift

## Auth0 Configuration

> **Agent instruction:** Check whether an `Auth0.plist` already exists in the project directory.
> - **If `Auth0.plist` exists:** Read it to extract `ClientId` and `Domain`, then proceed to "Post-Setup Steps".
> - **If no `Auth0.plist` exists:** Ask the user via `AskUserQuestion` which setup path they prefer:
>   - **Automatic (Auth0 CLI)** — creates the application, callback URLs, and database connection via the CLI.
>   - **Manual** — the user provides a pre-configured `Auth0.plist` file from the Auth0 Dashboard.
>
> If the user chooses **manual**, follow [Manual Setup](#manual-setup-user-provided-auth0plist).
> If the user chooses **automatic**, follow the section below.

### Automated Setup via Auth0 CLI

> **Agent instruction:** Run these pre-flight checks. Do NOT run `auth0 login` from the agent — it is interactive and will hang.
>
> **Credential privacy (see Critical rules at the top):** Never echo Auth0 credentials (domain, client ID, client secret) in your response text or terminal output. Write them directly into config files using the Write or Edit tool. When running Auth0 CLI commands, redirect output to a private temporary file (created with `mktemp` under a restrictive umask) rather than a predictable path:
>
> ```bash
> umask 077
> OUT=$(mktemp -t auth0-output)
> auth0 <command> --json --no-input > "$OUT" 2>&1
> echo "$OUT"   # note the path; do NOT print the file contents
> ```
>
> Then use the Read tool to extract values from that path and write them directly into `Auth0.plist` or other config files — never echo them in response text or terminal. Delete the file with `rm -f "$OUT"` once you have finished reading it. When confirming the active tenant with the user, mask the domain (e.g., `your-te****.us.auth0.com`).
>
> **Pre-flight checks:**
>
> 1. **Check Auth0 CLI**: `command -v auth0`. If missing, install it: `brew install auth0/auth0-cli/auth0`.
> 2. **Check Auth0 login**: `auth0 tenants list --csv --no-input > /tmp/auth0-tenants.txt 2>&1`. Read the file to check the result. If it fails or returns empty:
>    - Tell the user: _"Please run `auth0 login` in your terminal and let me know when done."_
>    - Wait for confirmation, then re-run the check. Retry up to 3 times before treating as a persistent failure.
> 3. **Confirm active tenant**: Redirect tenant list output to a file and read it. Parse the `→` line to extract the domain. Tell the user using a masked format: _"Your active Auth0 tenant is: `your-te****.us.auth0.com`. Is this correct? (Recommend using a development/test tenant rather than production.)"_ — mask all but the first 7 characters of the subdomain.
>    - If no, ask the user to run `auth0 tenants use <tenant-domain>`, then re-run step 2.
>
> **Detect project settings:**
>
> 4. **Extract bundle identifier** from `project.pbxproj`: search for `PRODUCT_BUNDLE_IDENTIFIER`, skip values containing `$(` or `Tests` or `NO`.
> 5. **Extract Team ID** (optional): search for `DEVELOPMENT_TEAM` in `project.pbxproj` — a 10-character alphanumeric value (e.g. `ABC12DE34F`). If not found, proceed without it (will prompt later if needed for Universal Links).
>
> **Create the Auth0 application:**
>
> 6. **Create a Native application** with both HTTPS and custom scheme callback URLs:
>    ```bash
>    auth0 apps create \
>      --name "BUNDLE_ID-ios" \
>      --type native \
>      --auth-method none \
>      --callbacks "https://DOMAIN/ios/BUNDLE_ID/callback,BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback" \
>      --logout-urls "https://DOMAIN/ios/BUNDLE_ID/callback,BUNDLE_ID://DOMAIN/ios/BUNDLE_ID/callback" \
>      --json \
>      --no-input > /tmp/auth0-app-created.json 2>&1
>    ```
>    Read `/tmp/auth0-app-created.json` to extract `client_id`. Do not display the file contents in the terminal.
>
> 7. **Set up database connection**: Check if `Username-Password-Authentication` already exists and has the new client enabled:
>    ```bash
>    auth0 api get connections --no-input > /tmp/auth0-connections.json 2>&1
>    ```
>    Read `/tmp/auth0-connections.json` to check existing connections.
>    - If the connection does not exist, create it:
>      ```bash
>      auth0 api post connections \
>        --data '{"strategy":"auth0","name":"Username-Password-Authentication","enabled_clients":["CLIENT_ID"]}' \
>        --no-input > /dev/null 2>&1
>      ```
>    - If it exists but the client is not in `enabled_clients`, update it:
>      ```bash
>      auth0 api patch connections/CONNECTION_ID \
>        --data '{"enabled_clients":["EXISTING_CLIENT_1","EXISTING_CLIENT_2","CLIENT_ID"]}' \
>        --no-input > /dev/null 2>&1
>      ```
>    - If it exists and already includes the client, skip this step.
>
> 8. **Configure Device Settings** (for Universal Links — Auth0 hosts `apple-app-site-association`):
>    If Team ID was detected in step 5:
>    ```bash
>    auth0 api patch applications/CLIENT_ID \
>      --data '{"mobile":{"ios":{"team_id":"TEAM_ID","app_bundle_identifier":"BUNDLE_ID"}}}' \
>      --no-input > /dev/null 2>&1
>    ```
>    If Team ID was not detected, inform the user: _"Set your Apple Team ID in Auth0 Dashboard → App Settings → Advanced → Device Settings, or provide it now."_
>
> 9. **Write `Auth0.plist`** to the project directory (see template below).
>
> 10. **Write or merge entitlements file** — see [Associated Domains Setup](#associated-domains-setup-https-universal-links) below.
>
> 11. **Inform user of remaining manual Xcode steps:**
>     - Add `Auth0.plist` to the app target in Xcode (File Inspector → Target Membership).
>     - Register URL scheme: target → Info tab → URL Types → add `$(PRODUCT_BUNDLE_IDENTIFIER)`.
>     - If a new entitlements file was created, set `CODE_SIGN_ENTITLEMENTS` in Build Settings.
>
> If any CLI command fails due to session expiry, ask the user to run `auth0 login` again, then retry. Retry up to 3 times.
> Only if the CLI keeps failing after retries: fall back to the [Manual Setup](#manual-setup-user-provided-auth0plist) path — ask the user to provide their `Auth0.plist` file.

### Manual Setup (User-Provided Auth0.plist)

> **Agent instruction:** Do NOT ask the user to type or paste credentials (domain, client ID) into the terminal. Instead:
>
> 1. Ask the user via `AskUserQuestion`: _"Please place your `Auth0.plist` file (containing your ClientId and Domain) in the project root directory and let me know when it's ready. You can download it from Auth0 Dashboard → Applications → your app → Settings → scroll to bottom → 'Download Auth0.plist'."_
> 2. Once the user confirms, verify the file exists in the project directory. If not found, search common locations (`~/Downloads/Auth0.plist`, project root).
> 3. Read the file to validate it contains both `ClientId` and `Domain` keys. If malformed, ask the user to re-download it.
> 4. If the file is not already in the correct location (alongside the `.xcodeproj`), copy it there.
> 5. Inform the user to add it to the Xcode target: _"Add Auth0.plist to your app target in Xcode: select the file in Navigator → File Inspector → check your app target under Target Membership."_
> 6. Proceed to "Post-Setup Steps".

Expected `Auth0.plist` format:

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

---

## Post-Setup Steps

### Register URL Scheme (Required for Custom Scheme Callbacks)

In Xcode, select your app target → **Info** tab → expand **URL Types** → click **+**:
- **Identifier**: `auth0`
- **URL Schemes**: `$(PRODUCT_BUNDLE_IDENTIFIER)`

This allows the Auth0 browser to redirect back to your app using the `{bundle}://` scheme.

### Associated Domains Setup (HTTPS Universal Links)

> **Agent instruction:** Only follow this section if the user chose HTTPS Universal Links as their callback scheme. If they chose a custom scheme (`{bundle}://`), skip this section entirely.
>
> **Prerequisites:** Before configuring Xcode, Auth0 must be told your Apple Team ID and Bundle ID so it can host the `apple-app-site-association` file. Without this, Universal Links will not work even if the entitlements are correct.

#### Step 1 — Configure Device Settings via Auth0 CLI

> **Agent instruction:**
> Extract `DEVELOPMENT_TEAM` from `project.pbxproj` (10-character value, e.g. `ABC12DE34F`). If not found, ask via `AskUserQuestion`: _"What is your Apple Team ID? (developer.apple.com → Account → Membership Details)"_
>
> ```bash
> auth0 api patch applications/CLIENT_ID \
>   --data '{"mobile":{"ios":{"team_id":"TEAM_ID","app_bundle_identifier":"BUNDLE_ID"}}}' \
>   --no-input > /dev/null 2>&1
> ```
>
> Auth0 will now automatically host the Apple App Site Association file at:
> `https://YOUR_AUTH0_DOMAIN/.well-known/apple-app-site-association`
>
> Verify it lists your app by opening that URL — the response should contain `applinks` with your `appID` in the format `TEAMID.com.example.myapp`.
>
> Reference: [Enable Universal Links Support in Apple Xcode](https://auth0.com/docs/get-started/applications/enable-universal-links-support-in-apple-xcode)

#### Step 2 — Add Associated Domains Entitlement in Xcode

> **Agent instruction:**
> 1. Find the app's `.entitlements` file (commonly `<AppName>.entitlements`). Search for `*.entitlements` in the project directory.
> 2. If the file exists, add `com.apple.developer.associated-domains` to it. If it does not exist, create it at the project root alongside the `.xcodeproj`.
> 3. Add both entries using the actual Auth0 domain:

```xml
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:YOUR_AUTH0_DOMAIN</string>
    <string>webcredentials:YOUR_AUTH0_DOMAIN</string>
</array>
```

> - `applinks:` — routes the Universal Link callback back to your app after login
> - `webcredentials:` — enables Password AutoFill and credential handoff with Auth0
>
> 4. If `com.apple.developer.associated-domains` already exists in the file, append the two `<string>` entries to the existing array rather than replacing it.
> 5. If the file was newly created, check that `CODE_SIGN_ENTITLEMENTS` in the target's build settings points to it. If not, inform the user to set it in Xcode under target → Build Settings → Code Signing Entitlements.
> 6. Ensure `.useHTTPS()` is called on the `webAuth()` builder:
>    ```swift
>    Auth0.webAuth().useHTTPS()
>    ```

### Verify Auth0.plist Target Membership

In Xcode Project Navigator:
1. Click `Auth0.plist`
2. Open File Inspector (right panel, first tab)
3. Under **Target Membership**, ensure your app target checkbox is checked

### macOS Additional Steps

For macOS targets, also:
1. Select your app target → **Signing & Capabilities** tab
2. Click **+ Capability** → add **Outgoing Connections (Client)**
3. Register macOS callback URLs in Auth0 Dashboard:
   ```text
   https://YOUR_DOMAIN/macos/YOUR_BUNDLE_ID/callback,
   YOUR_BUNDLE_ID://YOUR_DOMAIN/macos/YOUR_BUNDLE_ID/callback
   ```

---

## SDK Installation

> **Agent instruction:** Before proceeding, check the project directory for signs of an existing package manager:
> - `Podfile` present → use **CocoaPods**
> - `Cartfile` present → use **Carthage**
> - `Package.swift` present → use **Swift Package Manager**
>
> If none are found, ask the user via `AskUserQuestion`: _"Which dependency manager does your project use — Swift Package Manager, CocoaPods, or Carthage?"_ Then follow only the matching section below.

### Swift Package Manager (Recommended)

#### Package.swift project

Run in the project root:

```bash
swift package add-dependency https://github.com/auth0/Auth0.swift --from 2.18.0
```

Then add `"Auth0"` to the target's `dependencies` array in `Package.swift`:

```swift
.target(
    name: "YourTarget",
    dependencies: ["Auth0"]
)
```

#### Xcode project (`.xcodeproj`, no `Package.swift`)

The `swift package add-dependency` command does not apply to Xcode projects. Add the package via the Xcode GUI:

1. **File → Add Package Dependencies**
2. Enter package URL: `https://github.com/auth0/Auth0.swift`
3. Select **Up to Next Major Version** starting from `2.18.0`
4. Click **Add Package**
5. In the package product list, ensure **Auth0** is added to your app target

### CocoaPods

```ruby
# Podfile
target 'YourApp' do
  use_frameworks!
  pod 'Auth0', '~> 2.18'
end
```

```bash
pod install
# IMPORTANT: Always open .xcworkspace after pod install
open YourApp.xcworkspace
```

### Carthage

```text
# Cartfile
github "auth0/Auth0.swift" ~> 2.18
```

```bash
# Build frameworks
carthage update --use-xcframeworks --platform iOS

# Then in Xcode: Target → General → "Frameworks, Libraries, and Embedded Content"
# Drag in Carthage/Build/iOS/Auth0.xcframework
```

---

## Secret Management

Auth0.swift **does not use a client secret**. Native apps use PKCE (Proof Key for Code Exchange), which is secure without a secret.

- `ClientId` and `Domain` in `Auth0.plist` are **not secrets** — they are safe to commit to source control
- Access tokens and refresh tokens are stored in the iOS/macOS **Keychain** by `CredentialsManager` — never in `UserDefaults` or plain files
- No environment variables or `.env` files are needed for the Auth0 configuration

---

## Verification

After completing setup, verify:

```bash
# 1. Build the project
xcodebuild build -scheme YOUR_SCHEME -destination "platform=iOS Simulator,name=iPhone 16"

# 2. Verify Auth0.plist is bundled
# Run app in Simulator and check Xcode console for Auth0 initialization
```

- [ ] `Auth0.plist` is in the project and in the app target
- [ ] URL scheme `$(PRODUCT_BUNDLE_IDENTIFIER)` is registered in Info tab
- [ ] Callback URLs are saved in Auth0 Dashboard
- [ ] App builds without errors
- [ ] `import Auth0` resolves without errors in Swift files

---


---

## Major Version Migration


# Auth0.swift v3 Migration

Migrates an existing Auth0.swift v2 integration to v3. Every code change is gated on a search that confirms the project actually calls the affected API — if the project never uses `CredentialsManager`, no `CredentialsManager` code is touched. Changes follow the project's existing architecture and Apple platform conventions.

## When NOT to Use

- **New Auth0 integration** (no existing Auth0.swift): Use the Auth0 integration workflow for Swift
- **Minor/patch update** (e.g., 2.17 → 2.18): Run `pod update Auth0` or update SPM — no migration needed
- **Android apps**: Use the Auth0 integration workflow for Android
- **React Native / Expo**: Use the Auth0 integration workflow for React Native or Expo

## Prerequisites

- Existing Auth0.swift v2 integration
- Xcode installed; project builds cleanly on the current version
- Project under git version control with a clean working tree

---

## Migration Workflow

> **Agent instruction:** Execute every step in order. The goal is a green build with the smallest correct changeset. Each code-change step is gated by the Step 4 file-reading audit — if the API was not found in the project's source files, skip the entire step for that area. Never add code the project doesn't already call.

---

### Step 1 — Pre-flight & Safety Backup

```bash
# 1a. Verify clean working tree — stop if there are uncommitted changes
git status --porcelain
```

If the output is non-empty, ask the user:
> *"You have uncommitted changes. Should I stash them before proceeding (`git stash`), or would you like to commit first?"*

```bash
# 1b. Create a safety branch the user can reset to at any time
git checkout -b auth0-v3-migration-backup
git checkout -
```

```bash
# 1c. Pick an available simulator, then confirm the project builds before touching anything
SIM=$(xcrun simctl list devices available -j \
  | python3 -c "import sys,json; d=json.load(sys.stdin); \
    phones=[dev for devs in d['devices'].values() for dev in devs \
            if 'iPhone' in dev.get('name','') and dev.get('isAvailable')]; \
    print(phones[0]['name'] if phones else 'iPhone 16')")
xcodebuild build \
  -scheme <SCHEME> \
  -destination "platform=iOS Simulator,name=${SIM}" \
  2>&1 | tail -5
```

If the build fails, stop. Ask the user to fix the existing issues first.

---

### Step 2 — Detect Current & Target Versions

Detect the current Auth0.swift version from the project's dependency files:

```bash
# Check Package.resolved first (most reliable)
find . -name "Package.resolved" | xargs grep -A3 '"auth0/Auth0.swift"\|Auth0.swift"' 2>/dev/null | grep '"version"'

# Fallback: Podfile.lock
grep "^  - Auth0 " Podfile.lock 2>/dev/null

# Fallback: Cartfile.resolved
grep "auth0/Auth0.swift" Cartfile.resolved 2>/dev/null

# Fallback: Package.swift
grep -A2 'auth0/Auth0.swift' Package.swift 2>/dev/null
```

**Resolve the target version.** There are two paths:

**Path A — the user passed a target version argument (`$ARGUMENTS`):**

Validate it against the published releases before using it. It must pass **all three** checks:

```bash
# List all published Auth0.swift v3 release tags
curl -s https://api.github.com/repos/auth0/Auth0.swift/releases | python3 -c "
import sys, json
releases = json.load(sys.stdin)
v3 = [r for r in releases if r['tag_name'].startswith('3') and not r['draft']]
for r in v3:
    print(r['tag_name'])
"
```

1. **Exists** — the requested tag appears in the published release list above.
2. **Correct major** — the tag is within the **v3** major line (starts with `3`). A `2.x` or any other major is not valid; reject it.
3. **Not a downgrade** — the tag is newer than the version detected in the project.

> **On any check failing, STOP and ask the user.** Do not silently fall back. For example:
> - *"`3.9.9` isn't a published Auth0.swift release. Published v3 releases are: `3.0.0-beta.2`, … . Please pass a valid v3 tag, or omit the argument to auto-resolve the latest v3 release."*
> - *"`2.10.0` is a v2 release, not v3. This skill migrates to v3. Pass a v3 tag (e.g. `3.0.0-beta.2`) or omit the argument."*
> - *"`3.0.0-beta.1` is older than the `3.0.0-beta.2` already in your project — that's a downgrade. Pass a newer v3 tag or omit the argument."*

**Path B — no argument: auto-resolve the latest v3 release (including pre-releases):**

```bash
# Newest v3.x release tag (stable or pre-release), most recent first
curl -s https://api.github.com/repos/auth0/Auth0.swift/releases | python3 -c "
import sys, json
releases = json.load(sys.stdin)
v3 = [r for r in releases if r['tag_name'].startswith('3') and not r['draft']]
if v3:
    print(v3[0]['tag_name'])
else:
    print('')
"
```

Record the result as `<TARGET_TAG>` and use it in every subsequent step.

> **If `<TARGET_TAG>` is a pre-release** (contains `-beta`, `-rc`, etc.), inform the user before continuing:
> *"The latest v3 release is `<TARGET_TAG>` (a pre-release). I'll migrate to that. You can pin a different tag by passing it as an argument: `auth0-swift-major-migration <tag>`."*
>
> **If no v3 release exists** (the resolver returns empty), stop and tell the user there is no published v3 release to migrate to.


---

### Step 3 — Fetch & Read the v3 SDK Source

Fetch the actual Swift source for the target tag. The signatures here are the authoritative reference for every change made in Step 6.

```bash
TAG=<TARGET_TAG>   # the version the developer chose in Step 2, e.g. 3.0.0-beta.2

# List all public Swift files in the SDK
curl -s "https://api.github.com/repos/auth0/Auth0.swift/git/trees/${TAG}?recursive=1" \
  | python3 -c "
import sys, json
for item in json.load(sys.stdin).get('tree', []):
    if item['path'].startswith('Auth0/') and item['path'].endswith('.swift'):
        print(item['path'])
"

# Fetch core public API files
for FILE in WebAuth.swift CredentialsManager.swift Authentication.swift \
            Credentials.swift UserProfile.swift Requestable.swift \
            CredentialsStorage.swift CredentialsManagerError.swift WebAuthError.swift; do
    URL="https://raw.githubusercontent.com/auth0/Auth0.swift/${TAG}/Auth0/${FILE}"
    CONTENT=$(curl -sf "$URL")
    [ -n "$CONTENT" ] && echo "=== $FILE ===" && echo "$CONTENT"
done

# MFA files live in a subdirectory
for FILE in MFA/MFAClient.swift MFA/MFAErrors.swift; do
    URL="https://raw.githubusercontent.com/auth0/Auth0.swift/${TAG}/Auth0/${FILE}"
    CONTENT=$(curl -sf "$URL")
    [ -n "$CONTENT" ] && echo "=== $FILE ===" && echo "$CONTENT"
done
```

Read the fetched source and note:
- Every public method signature that changed (return type, parameters, `throws` added)
- Types that were renamed or removed
- Protocol requirements that changed
- Default parameter values that changed

This is the ground truth. Every change in Step 6 must match a real signature in these files.

---

### Step 4 — Audit Which Auth0 APIs the Project Uses

**Find all Swift files that import Auth0 — these are the scope of the migration:**
```bash
grep -rl "import Auth0" --include="*.swift" .
```

**Read every file from that list.** Do not grep for specific API patterns — read the full source so you can see exactly how `Auth0`, `webAuth`, `authentication`, `credentialsManager`, and any Auth0 types are used, including calls with domain/clientId parameters, chained builder calls, and any custom conformances.

For each file, identify:

| What to look for | Why it matters |
|---|---|
| Any call to `webAuth()`, `webAuth(domain:)`, `webAuth(domain:clientId:)` | §6.1 – `clearSession` rename; §6.14 – default scope |
| Any call to `.clearSession(` | §6.1 — rename to `logout` |
| Switch/catch on `WebAuthError` with explicit case names | §6.2 — removed and new cases |
| `DispatchQueue.main.async` or `MainActor.run` wrapping an Auth0 callback | §6.3 — removable in v3 |
| Any stored `Request<…>` type annotation (not just chained `.start(…)`) | §6.4 — type changed to `Requestable` |
| Test mocks conforming to `Authentication`, `MFAClient`, or `Requestable` | §6.4 — return type + `@MainActor` update |
| Any call to `credentialsManager.store(` | §6.5 — Bool → throws |
| Any call to `credentialsManager.clear()` or `credentialsManager.clear(forAudience:` | §6.6 — Bool → throws (both overloads) |
| Any access to `credentialsManager.user` (property, not method) | §6.7 — replaced by `userProfile()` method |
| Any call to `credentialsManager.revoke(` | §6.8 — new error paths |
| Any type annotation or declaration using `UserInfo` | §6.9 — renamed to `UserProfile` |
| Any access to `.expiresIn` on a `Credentials`-like object | §6.10 — renamed to `expiresAt` |
| Any type conforming to `CredentialsStorage` | §6.11 — method signatures changed |
| Any call to `Auth0.users(` or `Auth0.users(token:` | §6.12 — Management client removed |
| `login(withOTP:`, `login(withOOBCode:`, `login(withRecoveryCode:`, `multifactorChallenge(` | §6.13 — MFA methods removed |
| Any call to `webAuth()` that does **not** chain `.scope(` | §6.14 — default scope changed |
| Any call to `credentialsManager.credentials(` without explicit `minTTL:` parameter | §6.15 — default minTTL changed from 0 to 60 seconds |

Build a checklist: **"This project uses: [list]"** and **"This project does NOT use: [list]"**. Only work through the §6.x sections that appear in the "uses" list. Skip the rest entirely.

---

### Step 5 — Update the SDK Dependency

Apply only the matching package manager.

Use the `<TARGET_TAG>` chosen in Step 2. For stable releases (`3.x.y` with no suffix), use a range specifier. For pre-releases (`3.x.y-beta.z`), pin the exact tag — package managers treat pre-release versions as out-of-range for `~>` / `from:` rules.

**Swift Package Manager (Package.swift):**
```swift
// Stable v3 — range specifier picks up all 3.x.y patches
.package(url: "https://github.com/auth0/Auth0.swift", from: "3.0.0")

// Pre-release / specific beta — exact tag required
.package(url: "https://github.com/auth0/Auth0.swift", exact: "3.0.0-beta.2")
```

Then resolve:
```bash
swift package resolve
```

**CocoaPods (Podfile):**
```ruby
# Stable v3
pod 'Auth0', '~> 3.0'

# Pre-release / specific beta — pin the exact version
pod 'Auth0', '3.0.0-beta.2'
```

Then:
```bash
pod update Auth0
```

**Carthage (Cartfile):**
```plaintext
# Stable v3
github "auth0/Auth0.swift" ~> 3.0

# Pre-release / specific beta — pin the exact tag
github "auth0/Auth0.swift" "3.0.0-beta.2"
```

Then:
```bash
carthage update Auth0.swift --use-xcframeworks
```

**Xcode-managed SPM** (no `Package.swift` at root):
- *Stable:* File → Packages → Update to Latest Package Versions, then verify the version rule is *Up to Next Major* from 3.0.0.
- *Pre-release / specific beta:* File → Packages → Update to Latest Package Versions won't resolve a beta unless the dependency already pins an exact version. Tell the user to change the version rule to *Exact Version* and enter `3.0.0-beta.2` (or the chosen tag).

Do **not** build yet — apply all known code changes first.

---

### Step 6 — Apply Breaking Changes

> **Agent instruction:** Work through only the §6.x sections that matched during the Step 4 file-reading audit. Skip every section whose API the project does not use — do not touch those files.
>
> Apply each change exactly as shown. Do not alter surrounding code, rename variables, reformat, or modernise code that isn't being migrated. Match the project's existing style: completion handler → completion handler, async/await → async/await, Combine → Combine.

---

#### 6.1 — `WebAuth.clearSession()` → `WebAuth.logout()`

**Applies if:** Step 4 found any call to `.clearSession(` in the project's source files.

The `clearSession(federated:)` method was renamed to `logout(federated:)`. The parameter and its default value are unchanged.

**Completion handler:**
```swift
// v2
Auth0.webAuth().clearSession { result in
    switch result {
    case .success: handleLogoutSuccess()
    case .failure(let error): handleError(error)
    }
}

// v3
Auth0.webAuth().logout { result in
    switch result {
    case .success: handleLogoutSuccess()
    case .failure(let error): handleError(error)
    }
}
```

**async/await:**
```swift
// v2
try await Auth0.webAuth().clearSession()

// v3
try await Auth0.webAuth().logout()
```

**Combine:**
```swift
// v2
Auth0.webAuth().clearSession()
    .sink(receiveCompletion: { ... }, receiveValue: { ... })
    .store(in: &cancellables)

// v3
Auth0.webAuth().logout()
    .sink(receiveCompletion: { ... }, receiveValue: { ... })
    .store(in: &cancellables)
```

**With `federated: true`:** The parameter name is the same — just rename the method:
```swift
// v2
try await Auth0.webAuth().clearSession(federated: true)

// v3
try await Auth0.webAuth().logout(federated: true)
```

---

#### 6.2 — `WebAuthError` — removed and new cases in exhaustive `switch` statements

**Applies if:** Step 4 found any `switch` or `catch` on `WebAuthError` with explicit case names in the project's source files.

Two `WebAuthError` cases were **removed** in v3. If the project has an exhaustive `switch` over `WebAuthError` (or explicitly matches these cases), the build will fail.

Three **new** cases were added to surface previously hidden failures.

**Removed cases (will no longer compile if matched):**

| v2 case | v3 behaviour |
|---|---|
| `.invalidInvitationURL` | Removed — now surfaces as `.unknown` |
| `.pkceNotAllowed` | Removed — now surfaces as `.unknown` |

**New cases (can now appear in `catch`/`switch` blocks):**

| v3 case | When it fires |
|---|---|
| `.authenticationFailed` | Server-side failure: wrong password, MFA required, account locked, etc. |
| `.codeExchangeFailed` | Token exchange failed: network issue, invalid grant, backend error |
| `.credentialsManagerError` | Credentials manager failed to store or clear credentials after login/logout; access the underlying error via `.cause` |

**Migration — remove the deleted cases from switch statements:**
```swift
// v2 — exhaustive switch including cases that no longer exist
Auth0.webAuth().start { result in
    switch result {
    case .success(let credentials):
        handle(credentials)
    case .failure(let error):
        switch error {
        case .userCancelled:
            break  // user dismissed — no action needed
        case .pkceNotAllowed:
            // ❌ compile error in v3 — remove this case
            showConfigError("PKCE not allowed")
        default:
            showError(error)
        }
    }
}

// v3 — remove the deleted cases; handle the new ones where appropriate
Auth0.webAuth().start { result in
    switch result {
    case .success(let credentials):
        handle(credentials)
    case .failure(let error):
        switch error {
        case .userCancelled:
            break  // user dismissed — no action needed
        case .authenticationFailed:
            // server rejected the login — show an appropriate message
            showError("Login failed. Please check your credentials.")
        case .codeExchangeFailed:
            // token exchange failed — network or server issue
            showError("Something went wrong. Please try again.")
        case .credentialsManagerError:
            // login succeeded but credentials could not be stored
            // the user is authenticated in memory but will need to log in again next launch
            // access the underlying error via error.cause (WebAuthError.cause: Error?)
            reportToMonitoring(error.cause)
            showError("Could not save your session.")
        default:
            showError(error)
        }
    }
}
```

**If the project uses async/await and catches specific cases:**
```swift
// v2
do {
    let credentials = try await Auth0.webAuth().start()
    handle(credentials)
} catch WebAuthError.userCancelled {
    break
} catch WebAuthError.pkceNotAllowed {
    // ❌ compile error in v3 — remove this catch
    showConfigError()
} catch {
    showError(error)
}

// v3 — remove deleted cases; add new ones if the project should handle them
do {
    let credentials = try await Auth0.webAuth().start()
    handle(credentials)
} catch WebAuthError.userCancelled {
    break
} catch WebAuthError.authenticationFailed {
    showError("Login failed. Please check your credentials.")
} catch WebAuthError.codeExchangeFailed {
    showError("Something went wrong. Please try again.")
} catch {
    showError(error)
}
```

> The new cases `.authenticationFailed` and `.codeExchangeFailed` are not required to be handled explicitly — a `default:` branch already catches them. Only add explicit cases if the project wants to show different UI or telemetry for those failures.

---

#### 6.3 — Remove redundant main-thread dispatch around WebAuth and CredentialsManager callbacks

**Applies if:** Step 4 found `DispatchQueue.main.async` or `MainActor.run` wrapping an Auth0 callback body.

In v3, all completion-handler callbacks, Combine publishers, and async/await methods deliver results on the main thread (they are `@MainActor`). Wrapping callback bodies in `DispatchQueue.main.async { }` or `await MainActor.run { }` is no longer necessary and can be removed.

**Completion handler callback — remove the dispatch wrapper:**
```swift
// v2 — dispatch to main manually
credentialsManager.credentials { result in
    DispatchQueue.main.async {
        switch result {
        case .success(let credentials):
            self.accessToken = credentials.accessToken
            self.isAuthenticated = true
        case .failure(let error):
            self.authError = error
        }
    }
}

// v3 — callback already arrives on main thread
credentialsManager.credentials { result in
    switch result {
    case .success(let credentials):
        self.accessToken = credentials.accessToken
        self.isAuthenticated = true
    case .failure(let error):
        self.authError = error
    }
}
```

**async/await — remove the MainActor.run wrapper:**
```swift
// v2
let credentials = try await Auth0.webAuth().start()
await MainActor.run {
    self.isAuthenticated = true
}

// v3 — start() is @MainActor; already on main thread after the await
let credentials = try await Auth0.webAuth().start()
self.isAuthenticated = true
```

> Only remove dispatch wrappers that are **solely** protecting Auth0 callback bodies. If a `DispatchQueue.main.async` block also dispatches unrelated UI work, remove only what's attributable to the Auth0 callback.

---

#### 6.4 — `Authentication` / `MFAClient` methods return `Requestable` instead of `Request` — app code and test mocks

**Applies if:** Step 4 found either (a) a stored `Request<…>` type annotation in app code, or (b) test/mock files with types conforming to `Authentication`, `MFAClient`, or `Requestable`.

In v3, all `Authentication` and `MFAClient` methods return protocol types rather than the concrete `Request` struct:

- **Credential-returning methods** (login, codeExchange, renew, ssoExchange, etc.) now return `any TokenRequestable<T, E>`
- **All other methods** (signup, resetPassword, userInfo, jwks, etc.) now return `any Requestable<T, E>`

**Impact on app code:** Call sites that chain directly to `.start(_:)` — the overwhelming majority — compile without any change. The only app code that breaks is a stored `Request<>` type annotation:

```swift
// v2 — storing the request in a typed variable
let request: Request<Credentials, AuthenticationError> = Auth0
    .authentication()
    .login(usernameOrEmail: email, password: password,
           realmOrConnection: "Username-Password-Authentication",
           audience: audience, scope: scope)
request.start { result in ... }

// v3 — update the type annotation to the protocol type
// For credential-returning methods:
let request: any TokenRequestable<Credentials, AuthenticationError> = Auth0
    .authentication()
    .login(usernameOrEmail: email, password: password,
           realmOrConnection: "Username-Password-Authentication",
           audience: audience, scope: scope)
request.start { result in ... }

// For non-credential methods (signup, resetPassword, userInfo, jwks):
let request: any Requestable<DatabaseUser, AuthenticationError> = Auth0
    .authentication()
    .signup(email: email, password: password, connection: connection)
request.start { result in ... }

// Most common pattern — chaining directly, no annotation needed, no change required:
Auth0.authentication()
    .login(usernameOrEmail: email, password: password,
           realmOrConnection: "Username-Password-Authentication",
           audience: audience, scope: scope)
    .start { result in ... }  // ✅ unchanged
```

**Credential-returning methods that now return `any TokenRequestable` (full list):**
- `login(email:code:audience:scope:)`
- `login(phoneNumber:code:audience:scope:)`
- `login(usernameOrEmail:password:realmOrConnection:audience:scope:)`
- `loginDefaultDirectory(withUsername:password:audience:scope:)`
- `login(appleAuthorizationCode:fullName:profile:audience:scope:)`
- `login(facebookSessionAccessToken:profile:audience:scope:)`
- `login(passkey:challenge:connection:audience:scope:organization:)` — two overloads (sign in + sign up with passkey)
- `codeExchange(withCode:codeVerifier:redirectURI:)`
- `renew(withRefreshToken:audience:scope:)`
- `ssoExchange(withRefreshToken:)`
- `customTokenExchange(subjectToken:subjectTokenType:audience:scope:organization:parameters:)`
- `MFAClient.verify(otp:mfaToken:)`, `verify(oobCode:bindingCode:mfaToken:)`, `verify(recoveryCode:mfaToken:)`

**Impact on test targets — custom `Authentication` mocks:**

If the project's test target has a mock or stub conforming to the `Authentication` or `MFAClient` protocol, two changes are required:

1. **Return type:** Change `Request<T, E>` to `any TokenRequestable<T, E>` (credential methods) or `any Requestable<T, E>` (other methods)
2. **`start(_:)` callback:** Add `@MainActor` to match the updated `Requestable` protocol requirement

```swift
// v2 — mock Authentication conformance in tests
class MockAuthentication: Authentication {
    var credentialsResult: Result<Credentials, AuthenticationError> = .failure(.init(info: [:], statusCode: 0))

    func login(usernameOrEmail username: String,
               password: String,
               realmOrConnection realm: String,
               audience: String?,
               scope: String) -> Request<Credentials, AuthenticationError> {
        // ❌ compile error in v3 — Request is no longer the return type
        return Request(session: URLSession.shared, ...) // v2 internal — no longer works
    }
}

// v2 — mock Requestable used as stub
struct MockRequest<T, E: Auth0Error>: Requestable {
    let result: Result<T, E>
    func start(_ callback: @escaping (Result<T, E>) -> Void) {
        // ❌ @MainActor missing — does not conform to v3 Requestable
        callback(result)
    }
}

// v3 — updated mock
struct MockRequest<T, E: Auth0Error>: Requestable {
    let result: Result<T, E>
    // ✅ Add @MainActor to match the protocol; dispatch via Task to satisfy @MainActor isolation
    func start(_ callback: @escaping @MainActor (Result<T, E>) -> Void) {
        Task { @MainActor in callback(result) }
    }
}

// v3 — updated Authentication mock returning the correct protocol type
class MockAuthentication: Authentication {
    var credentialsResult: Result<Credentials, AuthenticationError> = .failure(.init(info: [:], statusCode: 0))

    func login(usernameOrEmail username: String,
               password: String,
               realmOrConnection realm: String,
               audience: String?,
               scope: String) -> any TokenRequestable<Credentials, AuthenticationError> {
        // ✅ Return MockTokenRequest, not Request
        return MockTokenRequest(result: credentialsResult)
    }
}

// v3 — TokenRequestable mock (for credential-returning methods)
struct MockTokenRequest<T, E: Auth0Error>: TokenRequestable {
    typealias ResultType = T
    typealias ErrorType = E

    let result: Result<T, E>

    func start(_ callback: @escaping @MainActor (Result<T, E>) -> Void) {
        Task { @MainActor in callback(result) }
    }

    // TokenRequestable adds these claim-validation builder methods — return self
    func validateClaims() -> any TokenRequestable<T, E> { self }
    func withLeeway(_ leeway: Int) -> any TokenRequestable<T, E> { self }
    func withIssuer(_ issuer: String) -> any TokenRequestable<T, E> { self }
    func withNonce(_ nonce: String?) -> any TokenRequestable<T, E> { self }
    func withMaxAge(_ maxAge: Int?) -> any TokenRequestable<T, E> { self }
    func withOrganization(_ organization: String?) -> any TokenRequestable<T, E> { self }
}
```

> The `MockTokenRequest` stub above stubs out all `TokenRequestable` builder methods by returning `self`. In most tests, `validateClaims()` and the `with*` modifiers are never called, so returning `self` is correct. If a specific test verifies claim validation behaviour, implement those methods properly.

---

#### 6.5 — `CredentialsManager.store(credentials:)` — Bool return → throws

**Applies if:** Step 4 found any call to `credentialsManager.store(credentials:` in the project's source files.

`store(credentials:)` previously returned `Bool`. In v3 it throws on failure and returns `Void` on success.

**If the project checked the return value:**
```swift
// v2
if credentialsManager.store(credentials: credentials) {
    print("Stored successfully")
} else {
    print("Store failed")
}

// v3 — use do-catch; map the error into the project's existing error handler
do {
    try credentialsManager.store(credentials: credentials)
} catch {
    // replace with whatever logging/error handling the project already uses
    handleError(error)
}
```

**If the project discarded the return value:**
```swift
// v2 — silently discarded
_ = credentialsManager.store(credentials: credentials)

// v3 — try? discards the error the same way; use if the project didn't handle failures before
try? credentialsManager.store(credentials: credentials)
```

> Prefer `do-catch` over `try?` when the project has an error-handling pattern to route into. Use `try?` only to preserve intentional silent-discard behaviour.

---

#### 6.6 — `CredentialsManager.clear()` and `clear(forAudience:scope:)` — Bool return → throws

**Applies if:** Step 4 found any call to `credentialsManager.clear()` or `credentialsManager.clear(forAudience:` in the project's source files.

Both overloads previously returned `Bool`. In v3 both throw:
- `clear() throws` — clears the main stored credentials
- `clear(forAudience:scope:) throws` — clears API credentials for a specific audience

```swift
// v2
_ = credentialsManager.clear()
_ = credentialsManager.clear(forAudience: "https://api.example.com")

// v3
try? credentialsManager.clear()
try? credentialsManager.clear(forAudience: "https://api.example.com")
// or, if the project handles errors:
do {
    try credentialsManager.clear()
} catch {
    handleError(error)
}
```

---

#### 6.7 — `CredentialsManager.user` property → `userProfile()` throwing method

**Applies if:** Step 4 found any access to `credentialsManager.user` as a property (not a method call) in the project's source files.

The `user: UserInfo?` computed property was replaced by `userProfile() throws -> UserProfile?` (see also §6.9 for the type rename).

```swift
// v2 — property access, returns UserInfo?
func currentUser() -> UserInfo? {
    return credentialsManager.user
}

// v3 — method call that throws, returns UserProfile?
func currentUser() -> UserProfile? {
    return try? credentialsManager.userProfile()
}

// v3 — if the project needs to surface errors:
func loadUser() throws {
    let profile = try credentialsManager.userProfile()
    self.userProfile = profile
}
```

---

#### 6.8 — `CredentialsManager` async methods — new error paths from throwing storage

**Applies if:** Step 4 found any call to `credentialsManager.revoke(` in the project's source files.

Because `CredentialsManager` storage methods now throw, several async methods gain new failure paths that were previously silently swallowed. The most significant is `revoke()`. Only update error-handling code that the project actually writes — call sites that already use a `default:` branch need no change.

**New errors that can now surface from `revoke()`:**

| New error | When it fires | What to do |
|---|---|---|
| `.noCredentials` | `getEntry` threw — no credentials in storage, nothing to revoke | Treat as already logged out; navigate to login |
| `.revokeFailed` | Network call to revoke the refresh token failed | The token may still be active on the server; show an error |
| `.clearFailed` | Revocation succeeded but Keychain delete failed | Treat as logged out — the token is no longer valid server-side |

```swift
// v2 — only .revokeFailed was possible; missing credentials returned .success silently
credentialsManager.revoke { result in
    switch result {
    case .success:
        navigateToLogin()
    case .failure(let error):
        showError(error)  // only .revokeFailed reached here
    }
}

// v3 — new cases surface; update the switch if the project checks specific cases
credentialsManager.revoke { result in
    switch result {
    case .success:
        navigateToLogin()
    case .failure(let error):
        switch error {
        case .noCredentials:
            // nothing was stored — already effectively logged out
            navigateToLogin()
        case .revokeFailed:
            // server revocation failed — refresh token may still be active
            showError("Could not revoke your session. Please try again.")
        case .clearFailed:
            // token revoked server-side but Keychain delete failed
            // treat as logged out — token is no longer valid
            navigateToLogin()
        default:
            showError(error)
        }
    }
}
```

**New errors that can now surface from `credentials()`, `renew()`, `apiCredentials()`, `ssoCredentials()`:**

| New error | When it fires |
|---|---|
| `.noCredentials` | `getEntry` throws (e.g., Keychain item not found) — previously swallowed by `try?` |
| `.renewFailed` | Refresh token renewal request failed — network error, invalid/expired refresh token |
| `.storeFailed` | Keychain write fails when saving renewed credentials |

These only matter if the project's existing `catch`/`failure` handler needs to distinguish these cases. If it uses a generic fallback, no change is needed.

```swift
// v3 — if the project wants to distinguish storage failures from network failures:
credentialsManager.credentials { result in
    switch result {
    case .success(let credentials):
        use(credentials)
    case .failure(let error):
        switch error {
        case .noCredentials, .renewFailed:
            // credentials missing or refresh failed — force re-login
            navigateToLogin()
        case .storeFailed:
            // renewed successfully but couldn't save — credentials valid in memory this session
            // user will be asked to log in again on next launch
            reportToMonitoring(error)
            use(/* last known credentials if available */)
        default:
            showError(error)
        }
    }
}
```

> Only add these new `case` branches if the project currently has a `switch` on `CredentialsManagerError` that would benefit from handling them differently. A `default:` branch already handles them correctly without any change.

---

#### 6.9 — `UserInfo` → `UserProfile` type rename

**Applies if:** Step 4 found any type annotation, function signature, or variable declaration referencing `UserInfo` in the project's source files.

The `UserInfo` type was renamed to `UserProfile`. Update every type annotation, function signature, and variable declaration that references `UserInfo`.

```swift
// v2
var currentUser: UserInfo?
func showProfile(_ profile: UserInfo) { ... }
func fetchUser() -> UserInfo? { ... }

// v3
var currentUser: UserProfile?
func showProfile(_ profile: UserProfile) { ... }
func fetchUser() -> UserProfile? { ... }
```

If the project calls `Auth0.authentication().userInfo(withAccessToken:)`, the method name is unchanged but the return type changed:
```swift
// v2 — returns Request<UserInfo, AuthenticationError>
Auth0.authentication()
    .userInfo(withAccessToken: accessToken)
    .start { (result: Result<UserInfo, AuthenticationError>) in ... }

// v3 — returns Request<UserProfile, AuthenticationError>
Auth0.authentication()
    .userInfo(withAccessToken: accessToken)
    .start { (result: Result<UserProfile, AuthenticationError>) in ... }
```

---

#### 6.10 — `Credentials.expiresIn` → `Credentials.expiresAt`

**Applies if:** Step 4 found any access to `.expiresIn` on a `Credentials`, `APICredentials`, or `SSOCredentials` object.

The `expiresIn: Date` property on `Credentials`, `APICredentials`, and `SSOCredentials` was renamed to `expiresAt: Date`. The underlying JSON key is unchanged; only the Swift property name changed.

```swift
// v2
let expiry: Date = credentials.expiresIn

// v3
let expiry: Date = credentials.expiresAt
```

---

#### 6.11 — `CredentialsStorage` custom implementation — methods now throw

**Applies if:** Step 4 found a type conforming to `CredentialsStorage` in the project's source files. Skip if the project only passes a `SimpleKeychain` instance — the default storage needs no change.

Only applies if the project provides a **custom** `CredentialsStorage` implementation (i.e., a type conforming to the protocol — not just using the default `SimpleKeychain`). Skip if the project only passes a `SimpleKeychain` instance.

The protocol changed from Bool/Data? returns to throwing methods, and added a new required `deleteAllEntries()`.

```swift
// v2 — protocol conformance
final class AppKeychain: CredentialsStorage {
    func getEntry(forKey key: String) -> Data? {
        return Keychain.shared.read(key: key)
    }

    func setEntry(_ data: Data, forKey key: String) -> Bool {
        return Keychain.shared.write(data, forKey: key)
    }

    func deleteEntry(forKey key: String) -> Bool {
        return Keychain.shared.delete(key: key)
    }
}

// v3 — methods throw; deleteAllEntries() required
final class AppKeychain: CredentialsStorage {
    func getEntry(forKey key: String) throws -> Data {
        guard let data = Keychain.shared.read(key: key) else {
            throw CredentialsManagerError.noCredentials
        }
        return data
    }

    func setEntry(_ data: Data, forKey key: String) throws {
        guard Keychain.shared.write(data, forKey: key) else {
            throw CredentialsManagerError.storeFailed
        }
    }

    func deleteEntry(forKey key: String) throws {
        guard Keychain.shared.delete(key: key) else {
            throw CredentialsManagerError.revokeFailed
        }
    }

    func deleteAllEntries() throws {
        Keychain.shared.deleteAll()
    }
}
```

> The `CredentialsStorage` protocol declares its methods as `throws` with no specific error type — you can throw any `Error`. The example above uses `CredentialsManagerError` cases for illustration only; your implementation should throw an error type that makes sense for your storage backend. Verify the `CredentialsManagerError` case names in the SDK source fetched in Step 3 if you choose to reuse them.

---

#### 6.12 — Management client removed

**Applies if:** Step 4 found any call to `Auth0.users(` or `Auth0.users(token:` in the project's source files.

`Auth0.users(token:)` and the entire `Users` management client were removed from the SDK in v3. Do **not** silently delete any call sites — add a `TODO` comment and surface this in the migration summary.

```swift
// v2 — direct Management API call in the app
Auth0
    .users(token: managementToken)
    .patch(userId, userPatch: UserPatchAttributes(name: newName))
    .start { result in
        switch result {
        case .success: print("Updated")
        case .failure(let error): print(error)
        }
    }

// v3 — Management client removed; add TODO and preserve intent
// TODO: Auth0.swift v3 removed the Management client.
// Replace this with a call to your own backend endpoint, which
// calls the Auth0 Management API using a machine-to-machine token.
// NEVER embed a Management API token in the client app.
// See: https://auth0.com/docs/secure/tokens/access-tokens/management-api-access-tokens
```

This **requires backend work** — record it in the Step 9 summary.

---

#### 6.13 — MFA methods removed from `Authentication` → migrate to `MFAClient`

**Applies if:** Step 4 found any call to `login(withOTP:`, `login(withOOBCode:`, `login(withRecoveryCode:`, or `multifactorChallenge(` — or test mocks conforming to `MFAClient` — in the project's source files.

The four MFA methods on the `Authentication` protocol were removed in v3. They are replaced by the dedicated `MFAClient` protocol, accessible via `Auth0.mfa()`:

| v2 (`Authentication`) | v3 (`MFAClient`) |
|---|---|
| `authentication().login(withOTP: otp, mfaToken: token)` | `mfa().verify(otp: otp, mfaToken: token)` |
| `authentication().login(withOOBCode: code, mfaToken: token, bindingCode: binding)` | `mfa().verify(oobCode: code, bindingCode: binding, mfaToken: token)` |
| `authentication().login(withRecoveryCode: code, mfaToken: token)` | `mfa().verify(recoveryCode: code, mfaToken: token)` |
| `authentication().multifactorChallenge(mfaToken: token, types: types, authenticatorId: id)` | `mfa().challenge(with: id, mfaToken: token)` |

**The `mfaToken` itself** still comes from the same place — an `AuthenticationError` where `error.isMultifactorRequired == true` returns the token via `error.mfaRequiredErrorPayload?.mfaToken`.

---

**OTP (TOTP authenticator app):**
```swift
// v2
Auth0.authentication()
    .login(withOTP: otpCode, mfaToken: mfaToken)
    .start { result in
        switch result {
        case .success(let credentials): storeCredentials(credentials)
        case .failure(let error): showError(error)
        }
    }

// v3 — verify returns any TokenRequestable<Credentials, MFAVerifyError>
Auth0.mfa()
    .verify(otp: otpCode, mfaToken: mfaToken)
    .start { result in
        switch result {
        case .success(let credentials): storeCredentials(credentials)
        case .failure(let error): showError(error)
        }
    }

// async/await
let credentials = try await Auth0.mfa().verify(otp: otpCode, mfaToken: mfaToken).start()
```

---

**OOB (SMS / email code):**
```swift
// v2
Auth0.authentication()
    .login(withOOBCode: oobCode, mfaToken: mfaToken, bindingCode: bindingCode)
    .start { result in ... }

// v3 — parameter order changed: oobCode first, bindingCode second
Auth0.mfa()
    .verify(oobCode: oobCode, bindingCode: bindingCode, mfaToken: mfaToken)
    .start { result in ... }
```

---

**Recovery code:**
```swift
// v2
Auth0.authentication()
    .login(withRecoveryCode: recoveryCode, mfaToken: mfaToken)
    .start { result in ... }

// v3
Auth0.mfa()
    .verify(recoveryCode: recoveryCode, mfaToken: mfaToken)
    .start { result in ... }
```

---

**MFA challenge (request an OOB code to be sent):**
```swift
// v2
Auth0.authentication()
    .multifactorChallenge(mfaToken: mfaToken,
                          types: ["oob"],
                          authenticatorId: authenticatorId)
    .start { result in ... }

// v3 — types parameter removed; pass authenticatorId directly
Auth0.mfa()
    .challenge(with: authenticatorId, mfaToken: mfaToken)
    .start { result in ... }
```

---

**Handling the MFA required error to obtain the mfaToken (unchanged between v2 and v3):**
```swift
Auth0.authentication()
    .login(usernameOrEmail: email,
           password: password,
           realmOrConnection: "Username-Password-Authentication",
           audience: audience,
           scope: scope)
    .start { result in
        switch result {
        case .success(let credentials):
            storeCredentials(credentials)
        case .failure(let error) where error.isMultifactorRequired:
            // mfaToken extracted the same way in both v2 and v3
            if let mfaToken = error.mfaRequiredErrorPayload?.mfaToken {
                presentMFAChallenge(mfaToken: mfaToken)
            }
        case .failure(let error):
            showError(error)
        }
    }
```

---

**Error type changed: `AuthenticationError` → `MFAVerifyError`**

The verify methods on `MFAClient` return `any TokenRequestable<Credentials, MFAVerifyError>`. If the project previously matched specific `AuthenticationError` cases in MFA failure handlers, map them onto `MFAVerifyError`:

```swift
// v2 — MFA failures came as AuthenticationError
Auth0.authentication()
    .login(withOTP: otp, mfaToken: mfaToken)
    .start { result in
        switch result {
        case .success(let credentials): storeCredentials(credentials)
        case .failure(let error as AuthenticationError):
            if error.isMultifactorCodeInvalid {
                showError("Invalid code. Please try again.")
            } else {
                showError(error.debugDescription)
            }
        }
    }

// v3 — failures come as MFAVerifyError; fetch MFAErrors.swift for all cases
Auth0.mfa()
    .verify(otp: otp, mfaToken: mfaToken)
    .start { result in
        switch result {
        case .success(let credentials): storeCredentials(credentials)
        case .failure(let error):
            // Check the MFAVerifyError cases in Auth0/MFA/MFAErrors.swift
            // for the exact case names available in the target SDK version
            showError(error.debugDescription)
        }
    }
```

> Fetch `Auth0/MFA/MFAErrors.swift` from the target tag (Step 3) and read the `MFAVerifyError` cases to map any specific error handling the project currently does. Do not guess error case names — read them from the source.

---

**Test mocks for `MFAClient`:**

If the project's test target has a mock conforming to `MFAClient`, update method return types and add `@MainActor` to `start(_:)` (same pattern as §6.4 for `Authentication` mocks):

```swift
// v3 — mock MFAClient in tests
struct MockMFAClient: MFAClient {
    var verifyResult: Result<Credentials, MFAVerifyError>

    func verify(otp: String,
                mfaToken: String) -> any TokenRequestable<Credentials, MFAVerifyError> {
        return MockTokenRequest(result: verifyResult)
    }

    func verify(oobCode: String,
                bindingCode: String?,
                mfaToken: String) -> any TokenRequestable<Credentials, MFAVerifyError> {
        return MockTokenRequest(result: verifyResult)
    }

    func verify(recoveryCode: String,
                mfaToken: String) -> any TokenRequestable<Credentials, MFAVerifyError> {
        return MockTokenRequest(result: verifyResult)
    }

    func challenge(with authenticatorId: String,
                   mfaToken: String) -> any Requestable<MFAChallenge, MfaChallengeError> {
        // Fetch MFAClient.swift from the target tag to find MFAChallenge's initializer,
        // then construct a real fixture or return .failure for tests that don't exercise this path
        return MockRequest(result: .failure(/* MfaChallengeError case from MFAErrors.swift */))
    }
    // implement remaining MFAClient requirements using the same pattern
}
```

> Use the `MockTokenRequest` and `MockRequest` structs from §6.4. The `MFAClient` protocol also requires `getAuthenticators`, `enroll(mfaToken:phoneNumber:)`, `enroll(mfaToken:)`, and `enroll(mfaToken:email:)` — stub them the same way, using the return types from `MFAClient.swift`.

List all migrated MFA flows in the Step 9 summary and ask the user to **re-test every MFA flow end-to-end** (OTP, OOB, recovery code, challenge request) against their tenant configuration.

---

#### 6.14 — Default scope now includes `offline_access`

**Applies if:** Step 4 found any call to `webAuth()`, `webAuth(domain:)`, or `webAuth(domain:clientId:)` — but only for call chains that do **not** already have a `.scope(…)` modifier. Read the actual call site in the file to confirm whether `.scope(` is present; do not grep — the call chain may span multiple lines.

In v3, the default scope changed from `"openid profile email"` to `"openid profile email offline_access"`. Apps that relied on the default and do **not** want a refresh token should add an explicit `.scope()` call:

```swift
// v2 — default scope: "openid profile email" (no refresh token)
Auth0.webAuth()
    .audience("https://api.example.com")
    .start { result in ... }

// v3 — default scope includes offline_access (refresh token returned)
// If you want to keep the v2 behaviour (no refresh token), add .scope() explicitly:
Auth0.webAuth()
    .audience("https://api.example.com")
    .scope("openid profile email")  // explicit — no offline_access
    .start { result in ... }

// If refresh tokens are welcome (recommended — enables silent renewal):
// No change needed; the new default is intentional.
```

Surface this as a **behavioural change** in the Step 9 summary regardless of which path is chosen — the Auth0 tenant must permit offline access for this app if refresh tokens are to be issued.

---

#### 6.15 — `CredentialsManager.credentials()` — default `minTTL` changed from 0 to 60 seconds

**Applies if:** Step 4 found any call to `credentialsManager.credentials(` without an explicit `minTTL:` parameter.

In v3, `CredentialsManager.credentials(withScope:minTTL:parameters:headers:callback:)` defaults `minTTL` to `60` instead of `0`. This means the credentials manager will now consider tokens expired — and trigger a silent refresh — 60 seconds before their actual expiry, rather than only when they are already expired.

This is a **silent behavioural change**: the app still compiles without changes, but token renewal now happens earlier than before.

```swift
// v2 — credentials() triggers renewal only when token is actually expired (minTTL default: 0)
credentialsManager.credentials { result in
    switch result {
    case .success(let credentials): use(credentials)
    case .failure(let error): handleError(error)
    }
}

// v3 — credentials() triggers renewal 60 seconds before expiry (minTTL default: 60)
// No code change needed if this behaviour is acceptable (recommended for most apps).
// To restore the v2 behaviour explicitly:
credentialsManager.credentials(minTTL: 0) { result in
    switch result {
    case .success(let credentials): use(credentials)
    case .failure(let error): handleError(error)
    }
}
```

For most apps the new default is preferable — renewing tokens slightly before expiry avoids races where an in-flight request uses an access token that expires mid-request. Only set `minTTL: 0` explicitly if the app has a specific reason to renew only at exact expiry.

Surface this as a **behavioural note** in the Step 9 summary.

---

### Step 7 — Update the Dependency & Build

```bash
# Attempt a build — expect errors for any remaining call sites
xcodebuild build \
  -scheme <SCHEME> \
  -destination "platform=iOS Simulator,name=${SIM}" \
  2>&1
```

For each error:

1. Read the error and locate the source line
2. Match it to one of the API changes in Step 6
3. Verify the fix matches the actual SDK signature fetched in Step 3
4. Apply the fix in keeping with the project's existing style
5. Rebuild

**Common error → cause mapping:**

| Xcode error | Likely cause |
|---|---|
| `has no member 'clearSession'` | §6.1 — rename to `logout` |
| `error enum element 'pkceNotAllowed' not found in type` or `'invalidInvitationURL' not found` | §6.2 — remove deleted `WebAuthError` cases from switch |
| `cannot convert return expression of type 'Request<...>'` in mock | §6.4 — update mock return type to `any TokenRequestable<T,E>` or `any Requestable<T,E>` |
| `does not conform to protocol 'Requestable'` (missing `@MainActor` on `start`) | §6.4 — add `@MainActor` to `start(_:)` callback in mock |
| `has no member 'user'` on CredentialsManager | §6.7 — change to `userProfile()` |
| `cannot find type 'UserInfo'` | §6.9 — rename to `UserProfile` |
| `has no member 'expiresIn'` | §6.10 — rename to `expiresAt` |
| `cannot convert value of type 'Bool'` on store/clear | §6.5/§6.6 — add do-catch or try? |
| `does not conform to protocol 'CredentialsStorage'` | §6.11 — update protocol methods + add deleteAllEntries |
| `call can throw, but is not marked with 'try'` | wrap in do-catch or add try? |
| `sending '...' risks causing data races` | only appears when the project uses Swift 6 language mode or `SWIFT_STRICT_CONCURRENCY=complete`; resolve within the existing actor model — not a migration error |

**Limit:** Up to **10 build-fix cycles**. If the build still fails after 10 attempts, stop and show the remaining errors to the user with context — do not guess.

---

### Step 8 — Run Tests & Verify

```bash
# Run the test suite if one exists (reuse $SIM from Step 1)
xcodebuild test \
  -scheme <SCHEME> \
  -destination "platform=iOS Simulator,name=${SIM}" \
  2>&1 | tail -30
```

Test failures caused by the same API changes (wrong type name, missing method) should be fixed using the same rules as Step 7. Test failures that require logic changes beyond API updates should be flagged for the user.

```bash
# Summarise the diff
git diff --stat
```

---

### Step 9 — Migration Summary

Present a concise summary covering:

**1. Changes applied** (grouped by API area; list files touched per area)

**2. Needs manual review**
- Every error-handling change — confirm the new error types are routed correctly
- Every `try?` used to discard errors where the project previously discarded a `Bool` — ask if explicit error handling is wanted
- The `offline_access` default scope change — confirm the tenant is configured to allow it, or confirm the explicit scope call is correct

**3. Backend / configuration follow-up** (only if triggered)
- **WebAuthError cases changed (§6.2):** List which removed cases were deleted from switch statements and which new cases were added. Note that `.authenticationFailed` and `.codeExchangeFailed` may benefit from user-facing copy changes.
- **`Request` → `Requestable` in mocks (§6.4):** List which test mock files were updated. Note any `TokenRequestable` builder methods that were stubbed with `return self` — confirm this is correct for the tests involved.
- **New error paths (§6.8):** List which CredentialsManager async methods the project calls and note the new errors that can now surface:
  - `revoke()` — `.noCredentials` (nothing to revoke), `.revokeFailed` (server revocation failed), `.clearFailed` (token revoked but Keychain delete failed)
  - `credentials()` / `renew()` / `apiCredentials()` / `ssoCredentials()` — `.noCredentials` (Keychain item not found), `.renewFailed` (refresh token renewal failed), `.storeFailed` (renewed credentials could not be saved)
  - Confirm the failure handling for each case navigates or surfaces errors correctly.
- **Management client removed (§6.12):** List the specific operations that were stubbed with `TODO`. Describe what the user must implement on a secure backend.
- **MFA methods removed (§6.13):** List which MFA flows need updating to `MFAClient`. Ask the user to re-test MFA end-to-end.
- **Default scope change (§6.14):** Note whether `.scope()` was added explicitly or the new `offline_access` default was accepted. Confirm the tenant is configured to allow offline access.
- **Default minTTL change (§6.15):** Note that `credentialsManager.credentials()` now renews tokens 60 seconds before expiry instead of at exact expiry. Confirm this is acceptable or that `minTTL: 0` was set explicitly.

**4. Optional improvements not applied** (list briefly; never auto-apply)
- New `clearAll()` method on `CredentialsManager` — clears all credentials in one call
- New `MFAClient` API — if the project uses MFA and the old methods were already removed
- DPoP (Demonstrating Proof of Possession) support — if the API requires sender-constrained tokens
- Passkey login/signup APIs (iOS 16.6+, macOS 13.5+)
- `ssoCredentials()` — if SSO credential exchange is needed

**5. Ask the user** if they'd like to commit the migration changes, explore any optional improvement, or step through specific files together.

**Security reminder:** Never include tokens, secrets, client credentials, or Keychain values in the summary output.

---

## Detailed References

- **Migration Process** (see the Migration Process section below) — Multi-version jumps, rollback, CocoaPods/Carthage edge cases, Swift version compatibility
- **Security Checklist** (see the Security Checklist section below) — Invariants that must hold before and after migration

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| Applying a §6.x section when Step 4 didn't find that API in the project | Step 4 file-reading is the gate. Not found = skip the section entirely |
| Using grep alone to decide if an API is used | Grep misses multi-line call chains, calls with `domain:clientId:` params, and variable aliases. Read the actual files |
| Touching `CredentialsManager` when the project doesn't use it | Only migrate what the project actually calls |
| Removing `DispatchQueue.main` wrappers around non-Auth0 code | Only remove dispatch wrappers that are solely inside an Auth0 callback body |
| Silently deleting Management API call sites | Add `// TODO:` and surface in the summary — removing the call breaks functionality |
| Silently deleting old MFA call sites | Same as above — add `TODO` and note in the summary |
| Applying changes based on assumed knowledge, not the fetched SDK source | Every fix must trace to a signature in the files fetched in Step 3 |
| Pinning `from: "3.0.0"` when the developer chose a beta tag | Stable range specifiers won't resolve betas; use `exact: "<TAG>"` for pre-releases |
| Starting migration on a dirty working tree | Always verify `git status --porcelain` is empty first |
| Skipping straight to build without applying known changes first | Apply all known changes first, then build to catch remainders |
| Continuing past 10 failed build cycles | Stop and show the user the remaining errors |
| Skipping the migration summary | Always produce the full summary — the user needs it |

## Related Capabilities

- New Auth0.swift integration from scratch — the Auth0 integration workflow for Swift
- Android native authentication — the Auth0 integration workflow for Android

---

## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [Auth0.swift Releases](https://github.com/auth0/Auth0.swift/releases)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)

> **Security:** Never echo tokens, client secrets, or credentials in build logs or terminal output. Never commit secrets to version control.
