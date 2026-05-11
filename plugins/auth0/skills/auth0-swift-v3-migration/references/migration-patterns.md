# Auth0.swift v3 Migration Patterns

Complete before/after code examples for every breaking change in Auth0.swift v3.

> **Security note:** All code examples use placeholder variable names (e.g. `accessToken`, `credentials`). Never substitute real credential values when applying these patterns. Remove or redact any `print()` statements that output tokens, credentials, or user-identifiable information before shipping to production.

---

## Storage Methods Now Throw

`CredentialsManager` storage methods no longer return `Bool` or optional values. They throw errors, surfacing underlying Keychain failures.

### store(credentials:)

```swift
// v2
if credentialsManager.store(credentials: credentials) {
    // stored successfully
} else {
    // handle failure
}

// v2 — ignoring result
_ = credentialsManager.store(credentials: credentials)

// v3
do {
    try credentialsManager.store(credentials: credentials)
    // stored successfully
} catch {
    // Keychain write failed — report to error monitoring
    print("Store failed: \(error)")
}

// v3 — if you want to silently ignore failures (not recommended)
try? credentialsManager.store(credentials: credentials)
```

### clear()

```swift
// v2
if credentialsManager.clear() {
    navigateToLogin()
} else {
    // handle failure
}

// v3
do {
    try credentialsManager.clear()
    navigateToLogin()
} catch {
    // Keychain delete failed — treat as logged out anyway
    navigateToLogin()
}
```

### clear(forAudience:scope:)

```swift
// v2
_ = credentialsManager.clear(forAudience: "https://api.example.com", scope: "read:data")

// v3
try? credentialsManager.clear(forAudience: "https://api.example.com", scope: "read:data")
```

### user property → userProfile() method

```swift
// v2
let user = credentialsManager.user  // nil on any failure

// v3
do {
    let user = try credentialsManager.userProfile()
} catch {
    print("Failed to retrieve user profile: \(error)")
}

// v3 — preserve v2 behavior (not recommended)
let user = try? credentialsManager.userProfile()
```

### Custom CredentialsStorage

```swift
// v2
class MyCustomStorage: CredentialsStorage {
    func getEntry(forKey key: String) -> Data? {
        return myStore[key]
    }
    func setEntry(_ data: Data, forKey key: String) -> Bool {
        myStore[key] = data
        return true
    }
    func deleteEntry(forKey key: String) -> Bool {
        myStore.removeValue(forKey: key)
        return true
    }
}

// v3
class MyCustomStorage: CredentialsStorage {
    func getEntry(forKey key: String) throws -> Data {
        guard let data = myStore[key] else {
            throw MyStorageError.itemNotFound
        }
        return data
    }
    func setEntry(_ data: Data, forKey key: String) throws {
        myStore[key] = data
    }
    func deleteEntry(forKey key: String) throws {
        guard myStore[key] != nil else {
            throw MyStorageError.itemNotFound
        }
        myStore.removeValue(forKey: key)
    }
    // Required if you use clearAll()
    func deleteAllEntries() throws {
        myStore.removeAll()
    }
}
```

### New Error Paths in Async Methods

v3 surfaces previously-silent storage errors:

| Error | Trigger | Affected methods |
|-------|---------|-----------------|
| `.noCredentials` | `getEntry(forKey:)` throws when reading stored credentials | `credentials()`, `renew()`, `apiCredentials()`, `ssoCredentials()`, `revoke()` |
| `.storeFailed` | Keychain write fails when saving renewed credentials | `credentials()`, `renew()`, `apiCredentials()`, `ssoCredentials()` |
| `.clearFailed` | Keychain delete fails after token revocation | `revoke()` |

```swift
// v3 — handling new revoke failure paths
credentialsManager.revoke { result in
    switch result {
    case .success:
        navigateToLogin()
    case .failure(let error):
        switch error {
        case CredentialsManagerError.noCredentials:
            // Nothing stored — treat as logged out
            navigateToLogin()
        case CredentialsManagerError.revokeFailed:
            // Network revocation failed — token may still be active
            showError(error)
        case CredentialsManagerError.clearFailed:
            // Token revoked but couldn't remove from storage — treat as logged out
            navigateToLogin()
        default:
            showError(error)
        }
    }
}
```

---

## Renamed APIs

### clearSession → logout

```swift
// v2 — callback
Auth0.webAuth().clearSession { result in ... }
Auth0.webAuth().clearSession(federated: true) { result in ... }

// v2 — async/await
try await Auth0.webAuth().clearSession()
try await Auth0.webAuth().clearSession(federated: true)

// v2 — Combine
Auth0.webAuth().clearSession().start()

// v3 — callback
Auth0.webAuth().logout { result in ... }
Auth0.webAuth().logout(federated: true) { result in ... }

// v3 — async/await
try await Auth0.webAuth().logout()
try await Auth0.webAuth().logout(federated: true)

// v3 — Combine
Auth0.webAuth().logout().start()
```

### UserInfo → UserProfile

```swift
// v2
let userInfo: UserInfo = ...
func handleUserInfo(_ info: UserInfo) { ... }

// v3
let userProfile: UserProfile = ...
func handleUserProfile(_ profile: UserProfile) { ... }

// Note: The method name userInfo(withAccessToken:) is UNCHANGED
// as it maps to the OIDC /userinfo endpoint
Auth0.authentication().userInfo(withAccessToken: token)  // same in v2 and v3
```

### expiresIn → expiresAt

```swift
// v2
let expiry = credentials.expiresIn
let apiExpiry = apiCredentials.expiresIn
let ssoExpiry = ssoCredentials.expiresIn

// v3
let expiry = credentials.expiresAt
let apiExpiry = apiCredentials.expiresAt
let ssoExpiry = ssoCredentials.expiresAt
```

### Telemetry → Auth0ClientInfo

```swift
// v2
var telemetry = Telemetry()
telemetry.enabled = false
client.telemetry = telemetry

// v3
var info = Auth0ClientInfo()
info.enabled = false
client.auth0ClientInfo = info
```

---

## Management API Removed

The `Auth0.users(...)` factory, `Users` protocol, `ManagementError`, `ManagementResult`, and `UserPatchAttributes` are all removed.

### Before (v2)

```swift
import Auth0

Auth0
    .users(token: accessToken)
    .get("user_id", fields: ["user_metadata"])
    .start { result in
        switch result {
        case .success(let user):
            let metadata = user["user_metadata"] as? [String: Any]
        case .failure(let error):
            print("Failed: \(error)")
        }
    }

Auth0
    .users(token: accessToken)
    .patch("user_id", attributes: UserPatchAttributes().userMetadata(["key": "value"]))
    .start { result in ... }
```

### After (v3) — Use Backend Endpoints

```swift
// 1. Create a backend endpoint (e.g. GET /api/me/metadata, PATCH /api/me/metadata)
// 2. Call it from your app with the user's access token:

func getUserMetadata() async throws -> [String: Any] {
    var request = URLRequest(url: URL(string: "https://your-api.com/api/me/metadata")!)
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
}

func updateUserMetadata(_ metadata: [String: Any]) async throws {
    var request = URLRequest(url: URL(string: "https://your-api.com/api/me/metadata")!)
    request.httpMethod = "PATCH"
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: metadata)

    let (_, response) = try await URLSession.shared.data(for: request)
    guard (response as? HTTPURLResponse)?.statusCode == 200 else {
        throw MyAppError.metadataUpdateFailed
    }
}

// 3. On your backend, use Client Credentials flow to call the Management API
//    with the precise scopes required (read:users, update:users)
```

---

## MFA Methods Moved

Deprecated MFA methods on `Authentication` are removed. Use `Auth0.mfa()` instead.

```swift
// v2
Auth0.authentication().login(withOTP: otp, mfaToken: mfaToken).start { ... }
Auth0.authentication().login(withOOBCode: code, mfaToken: mfaToken, bindingCode: bindingCode).start { ... }
Auth0.authentication().login(withRecoveryCode: code, mfaToken: mfaToken).start { ... }
Auth0.authentication().multifactorChallenge(mfaToken: mfaToken, types: types, authenticatorId: id).start { ... }

// v3
Auth0.mfa().verify(otp: otp, mfaToken: mfaToken).start { ... }
Auth0.mfa().verify(oobCode: code, bindingCode: bindingCode, mfaToken: mfaToken).start { ... }
Auth0.mfa().verify(recoveryCode: code, mfaToken: mfaToken).start { ... }
Auth0.mfa().challenge(with: id, mfaToken: mfaToken).start { ... }
```

| v2 Method | v3 Replacement |
|-----------|---------------|
| `authentication().login(withOTP:mfaToken:)` | `mfa().verify(otp:mfaToken:)` |
| `authentication().login(withOOBCode:mfaToken:bindingCode:)` | `mfa().verify(oobCode:bindingCode:mfaToken:)` |
| `authentication().login(withRecoveryCode:mfaToken:)` | `mfa().verify(recoveryCode:mfaToken:)` |
| `authentication().multifactorChallenge(mfaToken:types:authenticatorId:)` | `mfa().challenge(with:mfaToken:)` |

---

## Swift 6 Concurrency

### WebAuth is Now a Struct (was final class)

`Auth0WebAuth` changed from `final class` to `struct`. This does **not** produce a compilation error but changes behavior for imperative (non-chaining) builder patterns.

```swift
// ✅ Method chaining — works identically in v2 and v3
Auth0.webAuth()
    .scope("openid")
    .audience("https://api.example.com")
    .start { result in ... }

// ⚠️ Imperative pattern — BROKEN in v3
var webAuth = Auth0.webAuth().scope("openid")
webAuth.audience("https://api.example.com")  // Return value discarded! No effect.
webAuth.start { result in ... }

// ✅ Fixed — reassign the return value
var webAuth = Auth0.webAuth().scope("openid")
webAuth = webAuth.audience("https://api.example.com")
webAuth.start { result in ... }
```

### Custom WebAuth Conformances Must Be Sendable

```swift
// v2
class MockWebAuth: WebAuth {
    // ...
}

// v3 — struct (automatic Sendable)
struct MockWebAuth: WebAuth {
    // ...
}

// v3 — class (manual thread safety required)
final class MockWebAuth: WebAuth, @unchecked Sendable {
    private let lock = NSLock()
    // ... thread-safe implementation
}
```

### Auth0Error and Logger Must Be Sendable

```swift
// v2
struct MyAppError: Auth0Error {
    var cause: Error?
    var debugDescription: String { "my error" }
    var errorDescription: String? { "my error" }
}

class MyLogger: Logger {
    func trace(request: URLRequest, session: URLSession) { ... }
    func trace(response: URLResponse, data: Data?) { ... }
    func trace(url: URL, source: String?) { ... }
}

// v3 — structs with Sendable properties are automatically Sendable
struct MyAppError: Auth0Error {  // no changes needed
    var cause: Error?
    var debugDescription: String { "my error" }
    var errorDescription: String? { "my error" }
}

// v3 — classes need explicit Sendable
final class MyLogger: Logger, @unchecked Sendable {
    private let lock = NSLock()
    // ... thread-safe implementation
}
```

### @MainActor on Callback Parameters

Custom protocol implementations (mocks/test doubles) must add `@MainActor` to callback parameters:

```swift
// v2
struct MockRequestable: Requestable {
    func start(_ callback: @escaping (Result<Credentials, AuthenticationError>) -> Void) {
        callback(.success(mockCredentials))
    }
}

// v3
struct MockRequestable: Requestable {
    func start(_ callback: @escaping @MainActor (Result<Credentials, AuthenticationError>) -> Void) {
        Task { @MainActor in callback(.success(mockCredentials)) }
    }
}
```

### WebAuthProvider Typealiases

If you implement a custom `WebAuthProvider` (replacing ASWebAuthenticationSession):

| Symbol | v2 | v3 |
|--------|----|----|
| `WebAuthProviderCallback` | `(WebAuthResult<Void>) -> Void` | `@Sendable (WebAuthResult<Void>) -> Void` |
| `WebAuthProvider` | `(_ url: URL, _ callback: ...) -> WebAuthUserAgent` | `@Sendable @MainActor (_ url: URL, _ callback: ...) -> WebAuthUserAgent` |

---

## Default Values Changed

### Scope Now Includes offline_access

```swift
// v2 — had to explicitly add offline_access for refresh tokens
Auth0.webAuth()
    .scope("openid profile email offline_access")
    .start { result in ... }

// v3 — offline_access included by default, just use:
Auth0.webAuth()
    .start { result in ... }

// v3 — opt OUT of refresh tokens if not needed:
Auth0.webAuth()
    .scope("openid profile email")
    .start { result in ... }
```

### minTTL Defaults to 60 Seconds (was 0)

```swift
// v2 — credentials renewed only when already expired (minTTL = 0)
credentialsManager.credentials { result in ... }

// v2 — explicit 60s buffer
credentialsManager.credentials(minTTL: 60) { result in ... }

// v3 — 60s buffer is now the default
credentialsManager.credentials { result in ... }

// v3 — restore v2 behavior (renew only when expired)
credentialsManager.credentials(minTTL: 0) { result in ... }
```

### Signup Connection Defaults to "Username-Password-Authentication"

```swift
// v2 — connection was required
Auth0.authentication()
    .signup(email: email, username: username, password: password,
            connection: "Username-Password-Authentication")
    .start { result in ... }

// v3 — connection is optional (defaults to "Username-Password-Authentication")
Auth0.authentication()
    .signup(email: email, username: username, password: password)
    .start { result in ... }

// v3 — specify only if using a different connection
Auth0.authentication()
    .signup(email: email, username: username, password: password,
            connection: "custom-database")
    .start { result in ... }
```

---

## Main Thread Delivery

v3 guarantees all results (callback, Combine, async/await) are delivered on the main thread. Remove manual dispatch wrappers.

### Callbacks

```swift
// v2 — had to dispatch to main manually
credentialsManager.credentials { result in
    DispatchQueue.main.async {
        self.updateUI(result)
    }
}

// v3 — already on main thread
credentialsManager.credentials { result in
    self.updateUI(result)
}
```

### Combine

```swift
// v2 — needed receive(on:)
Auth0.authentication()
    .login(usernameOrEmail: email, password: password, realmOrConnection: "Username-Password-Authentication")
    .start()
    .receive(on: DispatchQueue.main)
    .sink { ... }
    .store(in: &cancellables)

// v3 — remove receive(on:)
Auth0.authentication()
    .login(usernameOrEmail: email, password: password, realmOrConnection: "Username-Password-Authentication")
    .start()
    .sink { ... }
    .store(in: &cancellables)
```

### Async/Await

```swift
// v2 — had to hop to main
Task {
    let credentials = try await Auth0.authentication()
        .login(usernameOrEmail: email, password: password, realmOrConnection: "Username-Password-Authentication")
        .start()
    await MainActor.run {
        self.updateUI(credentials)
    }
}

// v3 — already on main
Task {
    let credentials = try await Auth0.authentication()
        .login(usernameOrEmail: email, password: password, realmOrConnection: "Username-Password-Authentication")
        .start()
    self.updateUI(credentials)  // already on main thread
}
```

---

## WebAuthError Changes

### Removed Cases (now return .unknown)

These configuration errors that should be caught during development are no longer distinct cases:
- `.noBundleIdentifier`
- `.noAuthorizationCode`
- `.invalidInvitationURL`
- `.pkceNotAllowed`

### New Cases

| Case | Meaning |
|------|---------|
| `.authenticationFailed` | Server-side auth failures (wrong password, MFA required, account locked) |
| `.codeExchangeFailed` | Token exchange failures (network, invalid grant, backend errors) |
| `.credentialsManagerError` | Credentials manager failed to store/clear — access underlying error via `.cause` |

```swift
// v2
switch error {
case .noBundleIdentifier:
    // handle missing bundle ID
case .pkceNotAllowed:
    // handle PKCE config error
default:
    showError(error)
}

// v3
switch error {
case .authenticationFailed:
    // Server rejected authentication (wrong password, locked, etc.)
    showLoginError(error)
case .codeExchangeFailed:
    // Token exchange failed (network issue, invalid grant)
    showNetworkError(error)
case .credentialsManagerError:
    // Storage failed — underlying error in error.cause
    handleStorageError(error)
case .userCancelled:
    break  // User dismissed the browser
default:
    showError(error)
}
```

---

## DPoP Validation Errors

If you use DPoP-bound credentials, v3 adds validation before renewal:

| Error | Trigger |
|-------|---------|
| `.dpopNotConfigured` | Stored credentials are DPoP-bound but client not configured with `.useDPoP()` |
| `.dpopKeyMissing` | DPoP key pair no longer in Keychain |
| `.dpopKeyMismatch` | Current DPoP key doesn't match the one used at login |

```swift
// v3 — handle DPoP errors
credentialsManager.credentials { result in
    switch result {
    case .success(let credentials):
        break
    case .failure(let error):
        switch error {
        case .dpopNotConfigured:
            // Fix: CredentialsManager(authentication: Auth0.authentication().useDPoP())
            break
        case .dpopKeyMissing, .dpopKeyMismatch:
            // Key lost or rotated — clear state and re-authenticate
            try? credentialsManager.clear()
            promptReauthentication()
        default:
            showError(error)
        }
    }
}
```
