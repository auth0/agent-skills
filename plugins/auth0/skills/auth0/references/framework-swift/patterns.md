# Auth0 Swift — Integration Patterns

Integration patterns for Auth0.swift: Web Auth login/logout, secure Keychain
storage via `CredentialsManager`, biometric protection, organizations, error
handling, platform-specific patterns, and API calls.

> **Prerequisites:** The shared critical rules, prerequisites, and setup steps
> live in this group's overview and setup file. This file assumes Auth0.swift
> is already installed and `Auth0.plist` is configured — see this group's setup
> file if not.

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

Clears the Auth0 session cookie from the system browser so the next login prompts for credentials.

```swift
Auth0
    .webAuth()
    .useHTTPS()
    .clearSession { result in
        switch result {
        case .success:
            print("Logged out")
        case .failure(let error):
            print("Logout failed: \(error)")
        }
    }
```

### Sign Up (Direct to Registration Screen)

```swift
Auth0
    .webAuth()
    .useHTTPS()
    .parameters(["screen_hint": "signup"])
    .start()
```

### Custom Scopes and Audience

```swift
Auth0
    .webAuth()
    .audience("https://api.example.com")    // Your API identifier
    .scope("openid profile email read:messages")
    .start()
```

### Ephemeral Session (No SSO, No Cookie Persistence)

```swift
Auth0
    .webAuth()
    .useEphemeralSession()
    .start()
```

---

## CredentialsManager

Securely stores access tokens, ID tokens, and refresh tokens in the iOS/macOS **Keychain**. Automatically renews expired access tokens using the refresh token.

### Basic Setup

```swift
import Auth0

let credentialsManager = CredentialsManager(authentication: Auth0.authentication())
```

### Store After Login

```swift
func login() async {
    do {
        let credentials = try await Auth0.webAuth().start()
        _ = credentialsManager.store(credentials: credentials)
        print("Credentials stored")
    } catch {
        print("Login failed: \(error)")
    }
}
```

### Retrieve (Auto-Refreshes Expired Tokens)

```swift
func getAccessToken() async throws -> String {
    let credentials = try await credentialsManager.credentials()
    return credentials.accessToken
}
```

> **Note:** If the access token is expired and a refresh token exists, `credentials()` automatically renews it via the Authentication API and returns fresh credentials. The new credentials are stored in the Keychain automatically — no manual `store()` call needed.

### Check Authentication State on Launch

```swift
func application(_ application: UIApplication, 
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    
    if credentialsManager.hasValid() {
        // User has valid credentials — navigate to authenticated flow
        showHomeScreen()
    } else {
        // No valid credentials — navigate to login
        showLoginScreen()
    }
    return true
}
```

### Force Token Renewal

```swift
func forceRenew() async throws -> Credentials {
    return try await credentialsManager.renew()
}
```

### Revoke Refresh Token

```swift
func logout() async throws {
    try await credentialsManager.revoke()
    // Token revoked; user must log in again
}
```

---

## Biometric Protection

Enable Touch ID / Face ID / Optic ID protection for credential retrieval.

```swift
import Auth0
import LocalAuthentication

let credentialsManager = CredentialsManager(
    authentication: Auth0.authentication(),
    secureStorage: KeychainStorage()
)

// Enable biometrics
credentialsManager.enableBiometrics(
    withTitle: "Authenticate to access your account",
    cancelTitle: "Use Password",
    fallbackTitle: "Try Again"
)

// Retrieve credentials (triggers biometric prompt)
do {
    let credentials = try await credentialsManager.credentials()
    print("Access granted")
} catch CredentialsManagerError.biometricsFailed {
    print("Biometric authentication failed")
} catch {
    print("Error: \(error)")
}
```

> **iOS Requirement:** Add `NSFaceIDUsageDescription` key to `Info.plist` if targeting Face ID:
> ```xml
> <key>NSFaceIDUsageDescription</key>
> <string>Unlock to access your account</string>
> ```

---

## Error Handling

### Web Auth Errors

```swift
Auth0.webAuth().start { result in
    switch result {
    case .success(let credentials):
        // Handle success
        break
    case .failure(let error):
        if error.isUserCancelled {
            print("User cancelled login")
        } else if error.isNetworkError {
            print("Network error: \(error.localizedDescription)")
        } else {
            print("Error: \(error)")
        }
    }
}
```

### CredentialsManager Errors

```swift
do {
    let credentials = try await credentialsManager.credentials()
} catch CredentialsManagerError.noCredentials {
    // No credentials stored — navigate to login
} catch CredentialsManagerError.noRefreshToken {
    // Stored credentials expired, no refresh token — navigate to login
} catch CredentialsManagerError.renewFailed {
    // Refresh token invalid or revoked — navigate to login
} catch CredentialsManagerError.biometricsFailed {
    // User cancelled or failed biometric prompt
} catch {
    print("Unexpected error: \(error)")
}
```

### Authentication API Errors

```swift
Auth0.authentication()
    .userInfo(withAccessToken: accessToken)
    .start { result in
        switch result {
        case .success(let profile):
            print("User email: \(profile.email ?? "N/A")")
        case .failure(let error):
            switch error {
            case .invalidCredentials:
                print("Access token invalid or expired")
            case .networkError(let cause):
                print("Network issue: \(cause.localizedDescription)")
            default:
                print("Error: \(error)")
            }
        }
    }
```

---

## Organizations

Auth0 Organizations allow you to group users by company, department, or project and apply custom login experiences, branding, and roles per organization.

### Login with Organization ID

```swift
Auth0
    .webAuth()
    .organization("org_abc123")
    .start { result in
        // ...
    }
```

### Login with Organization Name (User Input)

```swift
let orgName = "acme"  // from user input or app config

Auth0
    .webAuth()
    .organization(orgName)
    .start { result in
        // ...
    }
```

### Verify Organization Claim in ID Token

```swift
let credentials = try await Auth0.webAuth().start()
if let orgId = credentials.idToken["org"] as? String {
    print("User belongs to organization: \(orgId)")
} else {
    print("No organization claim found")
}
```

---

## Platform-Specific Patterns

### iOS — Handle Callback in SceneDelegate

For apps using `UISceneDelegate` (iOS 13+), handle the Universal Link or custom scheme callback:

```swift
import Auth0

func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    WebAuthentication.resume(with: url)
}
```

### iOS — Handle Callback in AppDelegate (Pre-iOS 13)

```swift
import Auth0

func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any]) -> Bool {
    return WebAuthentication.resume(with: url)
}
```

### macOS — Handle Callback

Register callback in `AppDelegate`:

```swift
import Auth0

func application(_ application: NSApplication, open urls: [URL]) {
    guard let url = urls.first else { return }
    WebAuthentication.resume(with: url)
}
```

### SwiftUI — Login Button

```swift
import SwiftUI
import Auth0

struct LoginView: View {
    @State private var isAuthenticated = false
    
    var body: some View {
        VStack {
            if isAuthenticated {
                Text("Welcome!")
            } else {
                Button("Log In") {
                    login()
                }
            }
        }
    }
    
    func login() {
        Auth0.webAuth()
            .useHTTPS()
            .start { result in
                switch result {
                case .success(let credentials):
                    credentialsManager.store(credentials: credentials)
                    isAuthenticated = true
                case .failure(let error):
                    print("Login failed: \(error)")
                }
            }
    }
}
```

---

## App Groups (Shared Keychain Access)

Share credentials across iOS app extensions (Today Widget, Share Extension) by enabling **App Groups** and using a shared Keychain access group.

```swift
import Auth0

let credentialsManager = CredentialsManager(
    authentication: Auth0.authentication(),
    secureStorage: KeychainStorage(
        service: "auth0-credentials",
        accessGroup: "group.com.example.myapp"  // Your App Group ID
    )
)
```

**Xcode Setup:**
1. Select app target → **Signing & Capabilities** → **+ Capability** → **App Groups**
2. Add App Group: `group.com.example.myapp`
3. Repeat for each extension target that needs access

---

## Calling Your API with the Access Token

```swift
import Auth0

func callAPI() async throws {
    let credentials = try await credentialsManager.credentials()
    
    var request = URLRequest(url: URL(string: "https://api.example.com/data")!)
    request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
    
    let (data, response) = try await URLSession.shared.data(for: request)
    
    guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
        throw NSError(domain: "APIError", code: 0, userInfo: nil)
    }
    
    let json = try JSONSerialization.jsonObject(with: data)
    print("API response: \(json)")
}
```

---

## MFA (Multi-Factor Authentication)

Auth0.swift integrates with Auth0's Guardian MFA out-of-the-box — no SDK code changes needed.

### Enable MFA for Your Tenant

1. **Auth0 Dashboard** → **Security** → **Multi-factor Auth**
2. Enable **Push Notifications via Auth0 Guardian** or **One-time Password**
3. Configure policies: Always, Never, or Adaptive
4. Users enroll via Universal Login after first sign-in

### Verify MFA in ID Token

```swift
let credentials = try await Auth0.webAuth().start()
if let amr = credentials.idToken["amr"] as? [String], amr.contains("mfa") {
    print("User authenticated with MFA")
}
```

---

## Related Capabilities

- **ID Token Claims** — See this group's API reference for `idToken` decoding
- **User Profile (UserInfo)** — See this group's API reference for `userInfo()` calls
- **Social Connections** — Configured in Auth0 Dashboard; login works identically
- **Custom Domains** — Use your custom domain in `Auth0.plist` `Domain` key
- **Silent Authentication** — Not supported on iOS; use `CredentialsManager` auto-renewal instead

---

## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)
- [Auth0 iOS Quickstart](https://auth0.com/docs/quickstart/native/ios-swift)
- [WWDC ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession)
