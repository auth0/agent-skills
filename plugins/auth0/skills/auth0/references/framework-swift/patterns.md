# Integration Patterns — Auth0 Swift

The core wiring the agent writes: login/logout, CredentialsManager, error
handling, the SwiftUI/UIKit lifecycle hooks, and calling your API. Login flow:
`Auth0.webAuth().start()` opens `ASWebAuthenticationSession` on Universal Login →
Auth0 redirects to the `https://`/`{bundle}://` callback → the SDK exchanges the
code for tokens via PKCE → `credentialsManager.store(credentials:)` writes them to
the Keychain. Variants and advanced flows beyond this are in the pointer at the end.

## Web Auth Login & Logout

```swift
import Auth0

func login() async throws -> Credentials {
    return try await Auth0
        .webAuth()
        .useHTTPS()                                  // Universal Links callback
        .scope("openid profile email offline_access") // offline_access → refresh token
        .start()
}

func logout() async throws {
    // 1. Clear the Auth0 session cookie (prevents silent re-login)
    try await Auth0.webAuth().useHTTPS().clearSession()
    // 2. Clear locally stored credentials
    _ = credentialsManager.clear()
}
```

Common variants are single builder calls on `webAuth()`:
`.parameters(["screen_hint": "signup"])` (sign-up), `.audience("<api-id>")` +
extra `.scope(...)` (API access token), `.organization("<org-id>")`,
`.ephemeralSession()` (no persisted SSO cookie).

---

## CredentialsManager

Handles secure Keychain storage and automatic token refresh. Initialize once
(e.g. as a property on your auth service):

```swift
let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

// Store after login
guard credentialsManager.store(credentials: credentials) else {
    throw AuthError.keychainWriteFailed
}

// Retrieve — auto-refreshes an expired access token
do {
    let credentials = try await credentialsManager.credentials()
    callAPI(with: credentials.accessToken)
} catch CredentialsManagerError.noCredentialsAvailable {
    await showLogin()                       // first launch or after logout
} catch CredentialsManagerError.failedToRenewCredentials {
    _ = credentialsManager.clear()          // refresh token expired/revoked
    await showLogin()
}
```

Check auth state on launch without triggering a refresh: `canRenew()` (a refresh
token is stored) and `hasValid(minTTL:)` (access token still valid). `renew()`
forces a refresh and `revoke()` revokes the refresh token and clears local
credentials.

---

## Biometric Protection

Protect credential retrieval with Face ID / Touch ID. Requires a real device to
verify hardware behavior before shipping.

```swift
credentialsManager.enableBiometrics(withTitle: "Authenticate to access your account")
```

Then handle `CredentialsManagerError.biometricsFailed` from `credentials()` by
clearing and re-logging in. **Required** — add to `Info.plist`:

```xml
<key>NSFaceIDUsageDescription</key>
<string>Authenticate to access your account securely.</string>
```

Reuse policies (`.default`, `.always`, `.session(timeoutInSeconds:)`,
`.appLifecycle(timeoutInSeconds:)`) pass through `enableBiometrics(withTitle:policy:)`
— see the pointer.

---

## Error Handling

Match on typed errors from `webAuth().start()` and `credentialsManager`:

```swift
// Web Auth
catch WebAuthError.userCancelled { /* user tapped Cancel — no action */ }
catch WebAuthError.pkceNotAllowed { /* enable PKCE: Dashboard → Application → Advanced → OAuth */ }

// CredentialsManager
catch CredentialsManagerError.noCredentialsAvailable { await showLoginScreen() }
catch CredentialsManagerError.failedToRenewCredentials { _ = credentialsManager.clear(); await showLoginScreen() }
catch CredentialsManagerError.biometricsFailed { await showBiometricFailureMessage() }
catch CredentialsManagerError.cannotAccessKeychainItem { /* device locked or missing entitlements */ }
```

For direct `Auth0.authentication().login(...)` (embedded login), branch on
`error.isMultifactorRequired` (see feature:mfa) and `error.isNetworkError`.

---

## Platform-Specific Lifecycle

**SwiftUI (recommended)** — drive UI off an `@StateObject` auth service and check
the session on appear:

```swift
@main
struct MyApp: App {
    @StateObject private var auth = AuthenticationService()
    var body: some Scene {
        WindowGroup { ContentView().environmentObject(auth) }
    }
}

struct ContentView: View {
    @EnvironmentObject var auth: AuthenticationService
    var body: some View {
        Group { if auth.isAuthenticated { HomeView() } else { LoginView() } }
            .onAppear { auth.checkSession() }
    }
}
```

**UIKit** — resume the web-auth session from the URL callback:

```swift
// AppDelegate
func application(_ app: UIApplication, open url: URL,
                 options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return WebAuthentication.resume(with: url)
}
// SceneDelegate (if using scenes)
func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    WebAuthentication.resume(with: url)
}
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

> **Full reference:** completion-handler variants, the full biometric policy set,
> Organizations (login + invitation URLs), `SFSafariViewController`
> (`WebAuthentication.safariProvider()`), and App Groups / shared-Keychain
> (`storeKey:`) setup live in the installed package's docs (`README` /
> `EXAMPLES.md`). Source of truth if not installed: github.com/auth0/Auth0.swift
> (EXAMPLES.md). Auth0 concepts: https://auth0.com/docs/libraries/auth0-swift
