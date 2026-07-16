# Auth0 Swift — Integration

Complete native authentication for Apple platforms: the quickstart workflow,
Web Auth login/logout, secure Keychain storage via `CredentialsManager`,
biometric protection, organizations, error handling, the full API reference,
testing checklist, and common mistakes.

> **Prerequisites & setup:** the shared critical rules, SDK installation,
> Auth0 configuration, `Auth0.plist`, and verification steps live in this
> group's hub index (already read on the way here). The "Setup Guide"
> sections referenced below are in that hub.

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
