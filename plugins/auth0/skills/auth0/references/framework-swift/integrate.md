# Auth0 Swift — Integration

Setup depth and integration patterns for native Auth0 authentication on Apple
platforms: SDK installation, Auth0 CLI configuration, Web Auth login/logout,
secure Keychain storage via `CredentialsManager`, biometric protection,
organizations, error handling, and common mistakes.

> **Prerequisites & setup:** the shared critical rules, prerequisites, and
> when-NOT-to-use notes live in this group's overview (already read on the way
> here). The quick start lives in this group's overview too — this file holds
> SDK installation, Auth0 CLI configuration, `Auth0.plist`, URL scheme
> registration, Associated Domains, integration patterns, and verification
> depth (see the Setup and Integration Patterns sections below). The
> full API/configuration reference lives in this group's API reference.

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

---

## Setup

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
> **Credential privacy (see Critical rules in the overview):** Never echo Auth0 credentials (domain, client ID, client secret) in your response text or terminal output. Write them directly into config files using the Write or Edit tool. When running Auth0 CLI commands, redirect output to a private temporary file (created with `mktemp` under a restrictive umask) rather than a predictable path:
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

## Integration Patterns

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

## Related Capabilities

- Auth0 setup — if Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Manage Auth0 resources from the terminal with the Auth0 CLI (`tooling-cli`)
- Multi-factor authentication — the step-up / second-factor challenge flow is in the MFA section above
- Major-version SDK migration (v2 → v3) — see this group's migration guide


## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [iOS/macOS Quickstart](https://auth0.com/docs/quickstart/native/ios-swift)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)
- [Auth0 Dashboard](https://manage.auth0.com)
- [EXAMPLES.md](https://github.com/auth0/Auth0.swift/blob/master/EXAMPLES.md)
