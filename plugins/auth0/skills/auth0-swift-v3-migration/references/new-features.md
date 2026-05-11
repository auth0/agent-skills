# Auth0.swift v3 — New Features & Behavior

Guide to new APIs and behavior changes in Auth0.swift v3 that can be adopted after migrating breaking changes.

> **Security note:** All code examples use placeholder variable names. Never log or print actual credential values (access tokens, ID tokens, refresh tokens, client IDs) in production code.

---

## Automatic Credentials Management

New method `useCredentialsManager(_:)` on the Web Auth builder automatically stores credentials after login and clears them after logout.

### Basic Usage

```swift
let credentialsManager = CredentialsManager(authentication: Auth0.authentication())

// Login — credentials stored automatically
Auth0
    .webAuth()
    .useCredentialsManager(credentialsManager)
    .start { result in
        switch result {
        case .success:
            // Credentials stored automatically — navigate to authenticated screen
        case .failure(let error):
            handleError(error)
        }
    }

// Logout — credentials cleared automatically
Auth0
    .webAuth()
    .useCredentialsManager(credentialsManager)
    .logout { result in
        switch result {
        case .success:
            // Credentials cleared automatically — navigate to login screen
            break
        case .failure(let error):
            handleError(error)
        }
    }
```

### With Custom Storage

```swift
let customStorage = MyCustomKeychainStorage()
let credentialsManager = CredentialsManager(
    authentication: Auth0.authentication(),
    storage: customStorage
)

Auth0
    .webAuth()
    .useCredentialsManager(credentialsManager)
    .start { result in ... }
```

### Important Rules

1. Call `useCredentialsManager(_:)` on **both** `start()` and `logout()` chains
2. Do **not** manually call `store(credentials:)` after login or `clear()` after logout on the same instance
3. If storage fails, `WebAuthError.credentialsManagerError` is thrown (underlying error in `.cause`)

```swift
// ✅ Correct — used on both login and logout
Auth0.webAuth().useCredentialsManager(credentialsManager).start { ... }
Auth0.webAuth().useCredentialsManager(credentialsManager).logout { ... }

// ❌ Wrong — manual store after automatic management
Auth0.webAuth().useCredentialsManager(credentialsManager).start { result in
    if case .success(let creds) = result {
        try? credentialsManager.store(credentials: creds)  // DON'T — already stored
    }
}
```

---

## Multi-Window Web Auth Support

New method `presentationWindow(_:)` controls which window the in-app browser appears in. Essential for iPadOS multi-window and macOS apps.

```swift
// Present Web Auth in a specific window
Auth0
    .webAuth()
    .presentationWindow(myWindow)
    .start { result in ... }

// Common pattern — use the current scene's key window
if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
   let window = windowScene.windows.first(where: { $0.isKeyWindow }) {
    Auth0
        .webAuth()
        .presentationWindow(window)
        .start { result in ... }
}
```

---

## ID Token Validation

All credential-returning methods on `Authentication` and `MFAClient` now return `any TokenRequestable`, which adds opt-in ID token claim validation via `.validateClaims()`.

### Basic Usage

```swift
// Validate with defaults
Auth0
    .authentication()
    .renew(withRefreshToken: refreshToken)
    .validateClaims()
    .start { result in ... }
```

### With Custom Options

```swift
Auth0
    .authentication()
    .codeExchange(withCode: code, codeVerifier: verifier, redirectURI: redirectURI)
    .validateClaims()
    .withLeeway(120)                           // 2-minute clock skew tolerance
    .withNonce("expected-nonce")               // Verify nonce claim
    .withOrganization("org_abc123")            // Verify org_id/org_name claim
    .withMaxAge(3600)                          // Max seconds since last auth
    .start { result in ... }
```

### Available Modifiers

| Modifier | Default | Description |
|----------|---------|-------------|
| `.withLeeway(_ leeway: Int)` | `60` s | Clock-skew tolerance in seconds |
| `.withIssuer(_ issuer: String)` | Auth0 domain URL | Expected `iss` claim |
| `.withNonce(_ nonce: String?)` | `nil` (skip) | Expected `nonce` claim |
| `.withMaxAge(_ maxAge: Int?)` | `nil` (skip) | Max seconds since last authentication |
| `.withOrganization(_ organization: String?)` | `nil` (skip) | Expected `org_id` or `org_name` |

### Important Notes

- Web Auth (PKCE flow) already validates ID tokens automatically — no need to call `.validateClaims()`
- If `validateClaims()` is enabled but no ID token is in the response, the request fails with `AuthenticationError` wrapping `IDTokenDecodingError.missingIDToken`

### Affected Methods

These now return `any TokenRequestable` (instead of `Request`):

- `login(email:code:audience:scope:)`
- `login(phoneNumber:code:audience:scope:)`
- `login(usernameOrEmail:password:realmOrConnection:audience:scope:)`
- `loginDefaultDirectory(withUsername:password:audience:scope:)`
- `login(appleAuthorizationCode:fullName:profile:audience:scope:)`
- `login(facebookSessionAccessToken:profile:audience:scope:)`
- `login(passkey:challenge:connection:audience:scope:)`
- `codeExchange(withCode:codeVerifier:redirectURI:)`
- `ssoExchange(withRefreshToken:)`
- `renew(withRefreshToken:audience:scope:)`
- `MFAClient.verify(oobCode:bindingCode:mfaToken:)`
- `MFAClient.verify(otp:mfaToken:)`
- `MFAClient.verify(recoveryCode:mfaToken:)`

---

## clearAll() — Wipe All Stored Credentials

New method on `CredentialsManager` that removes **all** entries from the configured storage/service, including API credentials and SSO credentials. Also resets biometric authentication session.

```swift
// Clear everything (account deletion, full sign-out)
do {
    try credentialsManager.clearAll()
} catch {
    print("Failed to clear all credentials: \(error)")
}
```

**Difference from `clear()`:**
- `clear()` — removes only the default credentials entry
- `clearAll()` — removes all entries (default + API credentials + SSO credentials) and resets biometrics

**Custom CredentialsStorage:** If you use `clearAll()` with a custom storage, you must implement `deleteAllEntries()`:

```swift
class MyStorage: CredentialsStorage {
    // ... existing methods ...

    func deleteAllEntries() throws {
        // Remove ALL entries from your storage
        myStore.removeAll()
    }
}
```

---

## Main Thread Delivery Guarantee

All three API variants (callback, Combine, async/await) now guarantee results on the main thread. This is a behavior change, not a new API, but it simplifies code:

| Variant | How guaranteed |
|---------|---------------|
| Callback | Parameter annotated `@MainActor` |
| Combine | Publisher wraps `@MainActor` callback — `Future` resolves on main actor |
| Async/await | `start()` annotated `@MainActor` — resumes on main actor |

### What You Can Remove

```swift
// Remove DispatchQueue.main.async in callbacks
// Remove .receive(on: DispatchQueue.main) in Combine chains
// Remove await MainActor.run { } after Auth0 async calls
```

### What You Should Add

If your callback does CPU-intensive work, dispatch it to background:

```swift
credentialsManager.credentials { result in
    // Already on main thread
    DispatchQueue.global().async {
        let processed = self.performExpensiveOperation(result)
        DispatchQueue.main.async {
            self.updateUI(processed)
        }
    }
}
```

---

## Request to Requestable (Protocol Return Types)

Authentication methods now return `any Requestable<T, E>` or `any TokenRequestable<T, E>` instead of concrete `Request<T, E>`. This enables mocking without `URLProtocol`:

```swift
// v3 — mock the Authentication protocol directly
struct MockTokenRequest: TokenRequestable {
    typealias ResultType = Credentials
    typealias ErrorType = AuthenticationError

    let mockResult: Result<Credentials, AuthenticationError>

    func start(_ callback: @escaping @MainActor (Result<Credentials, AuthenticationError>) -> Void) {
        Task { @MainActor in callback(mockResult) }
    }

    func validateClaims() -> any TokenRequestable<Credentials, AuthenticationError> { self }
    func withLeeway(_ leeway: Int) -> any TokenRequestable<Credentials, AuthenticationError> { self }
    func withIssuer(_ issuer: String) -> any TokenRequestable<Credentials, AuthenticationError> { self }
    func withNonce(_ nonce: String?) -> any TokenRequestable<Credentials, AuthenticationError> { self }
    func withMaxAge(_ maxAge: Int?) -> any TokenRequestable<Credentials, AuthenticationError> { self }
    func withOrganization(_ organization: String?) -> any TokenRequestable<Credentials, AuthenticationError> { self }
}

class MockAuthentication: Authentication {
    let mockResult: Result<Credentials, AuthenticationError>

    func login(email: String, code: String, audience: String?, scope: String)
        -> any TokenRequestable<Credentials, AuthenticationError> {
        return MockTokenRequest(mockResult: mockResult)
    }
    // ... implement other required methods
}
```

---

## DPoP Thumbprint Persistence

When the `Authentication` client is configured with DPoP, `store(credentials:)` now automatically persists the DPoP thumbprint alongside credentials. This enables the Credentials Manager to detect key changes across app launches and throw appropriate errors (`.dpopNotConfigured`, `.dpopKeyMissing`, `.dpopKeyMismatch`).

No migration action required — this is automatic when using DPoP.
