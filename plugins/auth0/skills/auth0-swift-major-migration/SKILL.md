---
name: auth0-swift-major-migration
description: Use when upgrading Auth0.swift to v3 in an iOS, macOS, tvOS, watchOS, or visionOS app. Detects the current version, fetches the new SDK's actual source to confirm signatures, audits which Auth0 APIs the project actually uses, and applies only the breaking changes that affect real call sites — nothing else. Builds until green, then summarises what changed.
license: Proprietary
metadata:
  author: Auth0 <support@auth0.com>
  version: '2.0.0'
  openclaw:
    emoji: "\U0001F504"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0.swift v3 Migration

Migrates an existing Auth0.swift v1 or v2 integration to v3. Every code change is gated on a search that confirms the project actually calls the affected API — if the project never uses `CredentialsManager`, no `CredentialsManager` code is touched. Changes follow the project's existing architecture and Apple platform conventions.

## When NOT to Use

- **New Auth0 integration** (no existing Auth0.swift): Use [auth0-swift](/auth0-swift)
- **Minor/patch update** (e.g., 2.17 → 2.18): Run `pod update Auth0` or update SPM — no migration needed
- **Android apps**: Use [auth0-android](/auth0-android)
- **React Native / Expo**: Use [auth0-react-native](/auth0-react-native) or [auth0-expo](/auth0-expo)

## Prerequisites

- Existing Auth0.swift v1 or v2 integration
- Xcode installed; project builds cleanly on the current version
- Project under git version control with a clean working tree

---

## Migration Workflow

> **Agent instruction:** Execute every step in order. The goal is a green build with the smallest correct changeset. Each code-change step is gated by a grep — if the grep returns nothing, skip the entire step for that API area. Never add code the project doesn't already call.

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
# 1c. Confirm the project builds on the current version before touching anything
xcodebuild build \
  -scheme <SCHEME> \
  -destination "platform=iOS Simulator,name=iPhone 16" \
  2>&1 | tail -5
```

If the build fails, stop. Ask the user to fix the existing issues first.

---

### Step 2 — Detect Current & Target Versions

```bash
# Check Package.resolved first (most reliable)
grep -A3 '"auth0/Auth0.swift"\|Auth0.swift"' \
  **/Package.resolved 2>/dev/null | grep '"version"'

# Fallback: Podfile.lock
grep "^  - Auth0 " Podfile.lock 2>/dev/null

# Fallback: Cartfile.resolved
grep "auth0/Auth0.swift" Cartfile.resolved 2>/dev/null

# Fallback: Package.swift
grep -A2 'auth0/Auth0.swift' Package.swift 2>/dev/null
```

```bash
# Find the latest v3 release tag on GitHub
curl -s https://api.github.com/repos/auth0/Auth0.swift/releases | python3 -c "
import sys, json
releases = json.load(sys.stdin)
v3 = [r for r in releases if r['tag_name'].startswith('3') and not r['draft']]
print(v3[0]['tag_name'] if v3 else 'No v3 release found')
"
```

Confirm with the user before proceeding:
> *"Your project uses Auth0.swift vX.Y.Z. The latest v3 release is vN.M.P. Shall I proceed with the migration?"*

**Multi-version jumps:** If migrating from v1, apply v1→v2 first (build successfully), then v2→v3. Do not skip intermediate versions.

---

### Step 3 — Fetch & Read the v3 SDK Source

Fetch the actual Swift source for the target tag. The signatures here are the authoritative reference for every change made in Step 6.

```bash
TAG=<target-tag>   # e.g., 3.0.0-beta.2

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
            Credentials.swift UserInfo.swift UserProfile.swift \
            CredentialsStorage.swift AuthenticationError.swift \
            CredentialsManagerError.swift WebAuthError.swift; do
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

Run these greps **before touching any code**. Record which ones return results — only those API areas need migration.

```bash
# All files that import Auth0 (scope of migration)
grep -rl "import Auth0" --include="*.swift" .

# WebAuth usage
grep -rn "webAuth()\|WebAuth\|clearSession\|\.logout(" --include="*.swift" .

# CredentialsManager usage
grep -rn "CredentialsManager\|credentialsManager" --include="*.swift" .

# Credentials model usage
grep -rn "\.expiresIn\b" --include="*.swift" .

# UserInfo / UserProfile type usage
grep -rn "\bUserInfo\b" --include="*.swift" .

# WebAuthError switch statements that reference removed v2 cases
grep -rn "\.noBundleIdentifier\|\.noAuthorizationCode\|\.invalidInvitationURL\|\.pkceNotAllowed" \
  --include="*.swift" .

# CredentialsManager revoke usage
grep -rn "\.revoke(" --include="*.swift" .

# Custom CredentialsStorage implementation
grep -rn "CredentialsStorage" --include="*.swift" .

# Management client usage (removed in v3)
grep -rn "Auth0\.users\|\.users(token:" --include="*.swift" .

# Old MFA methods (removed in v3)
grep -rn "login(withOTP\|login(withOOBCode\|login(withRecoveryCode\|multifactorChallenge(" \
  --include="*.swift" .

# Authentication API usage
grep -rn "Auth0\.authentication()\|authentication()\.login\|authentication()\.signup" \
  --include="*.swift" .

# Tests that use Auth0
grep -rl "import Auth0\|@testable import" --include="*.swift" . | grep -i test
```

**Rule:** If a grep returns no results, that entire API area is out of scope. Do not touch it.

---

### Step 5 — Update the SDK Dependency

Apply only the matching package manager.

**Swift Package Manager (Package.swift):**
```swift
// Before
.package(url: "https://github.com/auth0/Auth0.swift", from: "2.0.0")

// After
.package(url: "https://github.com/auth0/Auth0.swift", from: "3.0.0")
```

Then resolve:
```bash
swift package resolve
```

**CocoaPods (Podfile):**
```ruby
# Before
pod 'Auth0', '~> 2.0'

# After
pod 'Auth0', '~> 3.0'
```

Then:
```bash
pod update Auth0
```

**Carthage (Cartfile):**
```
# Before
github "auth0/Auth0.swift" ~> 2.0

# After
github "auth0/Auth0.swift" ~> 3.0
```

Then:
```bash
carthage update Auth0.swift --use-xcframeworks
```

**Xcode-managed SPM** (no `Package.swift` at root): Tell the user to update via *File → Packages → Update to Latest Package Versions*. If it doesn't resolve to v3, change the version rule to *Up to Next Major* from 3.0.0.

Do **not** build yet — apply all known code changes first.

---

### Step 6 — Apply Breaking Changes

> **Agent instruction:** Work through each subsection below. Before making any edit in a subsection, run the stated grep. If it returns nothing, skip the entire subsection — do not touch those files. For each grep hit, apply the change shown in that subsection. Then move to the next subsection.
>
> Apply the change exactly as shown. Do not alter surrounding code, rename variables, reformat, or modernise code that isn't being migrated. If the project uses completion handlers, use the completion-handler version; if it uses async/await, use the async version; if it uses Combine, use the Combine version.

---

#### 6.1 — `WebAuth.clearSession()` → `WebAuth.logout()`

**Scope check (skip if empty):**
```bash
grep -rn "clearSession" --include="*.swift" .
```

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

**Scope check (skip if empty):**
```bash
grep -rn "\.noBundleIdentifier\|\.noAuthorizationCode\|\.invalidInvitationURL\|\.pkceNotAllowed" \
  --include="*.swift" .
```

Four `WebAuthError` cases were **removed** in v3. They represent configuration mistakes that should be caught in development, not handled in production. If the project has an exhaustive `switch` over `WebAuthError` (or explicitly matches these cases), the build will fail.

Three **new** cases were added to surface previously hidden failures.

**Removed cases (will no longer compile if matched):**

| v2 case | v3 behaviour |
|---|---|
| `.noBundleIdentifier` | Removed — now surfaces as `.unknown` with a descriptive message |
| `.noAuthorizationCode` | Removed — now surfaces as `.unknown` |
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
        case .noBundleIdentifier:
            // ❌ compile error in v3 — remove this case
            showConfigError("Bundle ID missing")
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
        case .credentialsManagerError(let cause):
            // login succeeded but credentials could not be stored
            // the user is authenticated in memory but will need to log in again next launch
            reportToMonitoring(cause)
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

**Scope check (skip if empty):**
```bash
grep -rn "DispatchQueue\.main\|MainActor\.run" --include="*.swift" . \
  | grep -E "webAuth|credentialsManager|CredentialsManager|Auth0\."
```

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

#### 6.4 — `CredentialsManager.store(credentials:)` — Bool return → throws

**Scope check (skip if empty):**
```bash
grep -rn "\.store(credentials:" --include="*.swift" .
```

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

#### 6.5 — `CredentialsManager.clear()` — Bool return → throws

**Scope check (skip if empty):**
```bash
grep -rn "credentialsManager\.clear()" --include="*.swift" .
```

`clear()` previously returned `Bool`. In v3 it throws.

```swift
// v2
_ = credentialsManager.clear()

// v3
try? credentialsManager.clear()
// or, if the project handles errors:
do {
    try credentialsManager.clear()
} catch {
    handleError(error)
}
```

---

#### 6.6 — `CredentialsManager.user` property → `userProfile()` throwing method

**Scope check (skip if empty):**
```bash
grep -rn "credentialsManager\.user\b" --include="*.swift" .
```

The `user: UserInfo?` computed property was replaced by `userProfile() throws -> UserProfile?` (see also §6.8 for the type rename).

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

#### 6.7 — `CredentialsManager` async methods — new error paths from throwing storage

**Scope check (skip if empty):**
```bash
grep -rn "credentialsManager\.revoke\|\.revoke(" --include="*.swift" .
```

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

#### 6.8 — `UserInfo` → `UserProfile` type rename

**Scope check (skip if empty):**
```bash
grep -rn "\bUserInfo\b" --include="*.swift" .
```

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

#### 6.9 — `Credentials.expiresIn` → `Credentials.expiresAt`

**Scope check (skip if empty):**
```bash
grep -rn "\.expiresIn\b" --include="*.swift" .
```

The `expiresIn: Date` property on `Credentials`, `APICredentials`, and `SSOCredentials` was renamed to `expiresAt: Date`. The underlying JSON key is unchanged; only the Swift property name changed.

```swift
// v2
let expiry: Date = credentials.expiresIn

// v3
let expiry: Date = credentials.expiresAt
```

---

#### 6.10 — `CredentialsStorage` custom implementation — methods now throw

**Scope check (skip if empty):**
```bash
grep -rn "CredentialsStorage" --include="*.swift" .
```

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

Verify the exact `CredentialsManagerError` cases against the SDK source fetched in Step 3 — the error type you throw must match what the SDK declares.

---

#### 6.11 — Management client removed

**Scope check (skip if empty):**
```bash
grep -rn "Auth0\.users\|\.users(token:" --include="*.swift" .
```

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

This **requires backend work** — record it in the Step 8 summary.

---

#### 6.12 — Old MFA methods removed

**Scope check (skip if empty):**
```bash
grep -rn "login(withOTP:\|login(withOOBCode:\|login(withRecoveryCode:\|multifactorChallenge(" \
  --include="*.swift" .
```

The following `Authentication` methods were removed in v3:
- `login(withOTP:mfaToken:)`
- `login(withOOBCode:mfaToken:bindingCode:)`
- `login(withRecoveryCode:mfaToken:)`
- `multifactorChallenge(mfaToken:types:authenticatorId:)`

These are replaced by the new `MFAClient` API. Fetch the v3 `MFAClient.swift` to understand the new signatures, then migrate accordingly. Do **not** silently delete MFA call sites — add `TODO` comments where you cannot complete the migration:

```swift
// v2 — OTP login
Auth0.authentication()
    .login(withOTP: otpCode, mfaToken: mfaToken)
    .start { result in ... }

// v3 — use MFAClient (fetch Auth0/MFAClient.swift from the target tag for exact signatures)
// TODO: Migrate to Auth0.authentication().mfaClient(mfaToken:).loginWithOTP(otp:)
// Verify the exact MFAClient method names against the v3 SDK source.
```

List all removed MFA methods in the Step 8 summary and ask the user to re-test MFA flows end-to-end after migration.

---

#### 6.13 — Default scope now includes `offline_access`

**Scope check — only applies if the project calls WebAuth without an explicit `.scope()`:**
```bash
grep -rn "webAuth()" --include="*.swift" . \
  | grep -v "\.scope("
```

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

Surface this as a **behavioural change** in the Step 8 summary regardless of which path is chosen — the Auth0 tenant must permit offline access for this app if refresh tokens are to be issued.

---

### Step 7 — Update the Dependency & Build

```bash
# Attempt a build — expect errors for any remaining call sites
xcodebuild build \
  -scheme <SCHEME> \
  -destination "platform=iOS Simulator,name=iPhone 16" \
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
| `error enum element 'pkceNotAllowed' not found in type` (or other removed cases) | §6.2 — remove deleted `WebAuthError` cases from switch |
| `has no member 'user'` on CredentialsManager | §6.6 — change to `userProfile()` |
| `cannot find type 'UserInfo'` | §6.8 — rename to `UserProfile` |
| `has no member 'expiresIn'` | §6.9 — rename to `expiresAt` |
| `cannot convert value of type 'Bool'` on store/clear | §6.4/§6.5 — add do-catch or try? |
| `does not conform to protocol 'CredentialsStorage'` | §6.10 — update protocol methods + add deleteAllEntries |
| `call can throw, but is not marked with 'try'` | wrap in do-catch or add try? |
| `sending '...' risks causing data races` | only relevant if Swift 6 mode is already on; resolve within the existing actor model |

**Limit:** Up to **10 build-fix cycles**. If the build still fails after 10 attempts, stop and show the remaining errors to the user with context — do not guess.

---

### Step 8 — Run Tests & Verify

```bash
# Run the test suite if one exists
xcodebuild test \
  -scheme <SCHEME> \
  -destination "platform=iOS Simulator,name=iPhone 16" \
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
- **revoke() new error paths (§6.7):** If the project calls `revoke()`, note that `.noCredentials` and `.clearFailed` can now surface — confirm the failure handling navigates the user correctly.
- **Management client removed (§6.11):** List the specific operations that were stubbed with `TODO`. Describe what the user must implement on a secure backend.
- **MFA methods removed (§6.12):** List which MFA flows need updating to `MFAClient`. Ask the user to re-test MFA end-to-end.

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

- **[Migration Process](./references/process.md)** — Multi-version jumps, rollback, CocoaPods/Carthage edge cases, Swift version compatibility
- **[Security Checklist](./references/security.md)** — Invariants that must hold before and after migration

## Common Mistakes

| Mistake | Correct approach |
|---|---|
| Applying a breaking-change fix when the grep returns nothing | The grep gate is mandatory. No hits = skip the section entirely |
| Touching `CredentialsManager` when the project doesn't use it | Only migrate what the project actually calls |
| Removing `DispatchQueue.main` wrappers around non-Auth0 code | Only remove dispatch wrappers that are solely inside an Auth0 callback body |
| Silently deleting Management API call sites | Add `// TODO:` and surface in the summary — removing the call breaks functionality |
| Silently deleting old MFA call sites | Same as above — add `TODO` and note in the summary |
| Applying changes based on assumed knowledge, not the fetched SDK source | Every fix must trace to a signature in the files fetched in Step 3 |
| Starting migration on a dirty working tree | Always verify `git status --porcelain` is empty first |
| Skipping straight to build without applying known changes first | Apply all grepped changes first, then build to catch remainders |
| Continuing past 10 failed build cycles | Stop and show the user the remaining errors |
| Skipping the migration summary | Always produce the full summary — the user needs it |

## Related Skills

- [auth0-swift](/auth0-swift) — New Auth0.swift integration from scratch
- [auth0-android](/auth0-android) — Android native authentication

---

## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [Auth0.swift Releases](https://github.com/auth0/Auth0.swift/releases)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)

> **Security:** Never echo tokens, client secrets, or credentials in build logs or terminal output. Never commit secrets to version control.
