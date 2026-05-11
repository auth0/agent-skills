---
name: auth0-swift-v3-migration
description: Use when migrating an iOS, macOS, tvOS, watchOS, or visionOS application from Auth0.swift v1 or v2 to v3 — covers Swift 6 concurrency changes, throwing storage methods, renamed APIs, removed Management client, and updated defaults.
license: Proprietary
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F504"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0.swift v3 Migration

Migrate existing iOS/macOS/tvOS/watchOS/visionOS apps from Auth0.swift v1 or v2 to v3. Auth0.swift v3 is a Swift 6-ready release with improved error handling, predictable threading, and a cleaner API surface.

> **Agent instruction:** This skill handles **upgrading** an existing Auth0.swift integration to v3. If the project does not already use Auth0.swift, use `auth0-swift` instead to add a fresh integration.
>
> **Security — credential handling:**
> - **NEVER** echo, print, or display actual values of: access tokens, ID tokens, refresh tokens, client secrets, client IDs, Auth0 domains, API keys, or any other credentials found in the user's project (e.g. `Auth0.plist`, environment variables, Keychain data, `.env` files).
> - When reporting migration findings (Step 1), reference files and line numbers only — do not quote credential values from config files.
> - When showing code diffs or migration examples, use placeholder variables (e.g. `accessToken`, `clientId`) — never substitute real values from the project.
> - If a user's code contains `print()` or logging statements that output tokens, flag it as a security issue and recommend removal or redaction.

## When NOT to Use

- **New Auth0 integration** (no existing Auth0.swift dependency): Use [auth0-swift](/auth0-swift)
- **Android migration**: Use [auth0-android](/auth0-android) for Android SDK changes
- **React Native migration**: Use [auth0-sdk-migration](/auth0-sdk-migration) for cross-SDK upgrades
- **Non-Apple platforms**: This skill is exclusively for Auth0.swift on Apple platforms

## Prerequisites

- Existing project using Auth0.swift v1.x or v2.x
- **Xcode** 16.x+
- **Swift** 6.0+ (v3 is compiled with Swift 6 language mode)
- iOS 14.0+ / macOS 11.0+ / tvOS 14.0+ / watchOS 7.0+ / visionOS 1.0+

## Quick Start Workflow

> **Agent instruction:** Follow these steps in order. The migration touches multiple areas — work through each systematically. After each step, verify the project still compiles before moving on.

### Step 1 — Detect Current Version and Usage

> **Agent instruction:**
> 1. Determine the current Auth0.swift version:
>    - Check `Package.resolved` or `Package.swift` for SPM
>    - Check `Podfile.lock` for CocoaPods
>    - Check `Cartfile.resolved` for Carthage
> 2. Search the codebase for Auth0.swift usage patterns that will need migration:
>    - `import Auth0` — find all files using the SDK
>    - `credentialsManager.store` / `credentialsManager.clear` — throwing changes
>    - `clearSession` — renamed to `logout`
>    - `UserInfo` — renamed to `UserProfile`
>    - `.expiresIn` — renamed to `.expiresAt`
>    - `Auth0.users(` — Management API removed
>    - `login(withOTP:` / `login(withOOBCode:` / `login(withRecoveryCode:` — MFA methods moved
>    - `Telemetry` — renamed to `Auth0ClientInfo`
>    - Custom `WebAuth` conformances (now must be `Sendable`)
>    - Custom `CredentialsStorage` conformances (methods now throw)
>    - Builder methods called imperatively (not chained) on `webAuth()`
> 3. Report findings to the user with a summary of required changes before proceeding. List affected files and line numbers — **never** include actual credential values (tokens, client IDs, domains) in the summary.

### Step 2 — Update SDK Version

> **Agent instruction:** Update the dependency to Auth0.swift v3:
>
> **Swift Package Manager (`Package.swift`):**
> ```swift
> .package(url: "https://github.com/auth0/Auth0.swift", from: "3.0.0")
> ```
>
> **Swift Package Manager (`Package.resolved` / Xcode project):** Instruct the user:
> _"Update the Auth0.swift package in Xcode: File → Packages → Update to Latest Package Versions, or change the version rule to 'Up to Next Major Version' from 3.0.0."_
>
> **CocoaPods (`Podfile`):**
> ```ruby
> pod 'Auth0', '~> 3.0'
> ```
> Then run `pod update Auth0`.
>
> **Carthage (`Cartfile`):**
> ```
> github "auth0/Auth0.swift" ~> 3.0
> ```
> Then run `carthage update Auth0`.
>
> Also update JWTDecode.swift to v4 if used directly (it's updated as a transitive dependency).

### Step 3 — Apply Breaking Changes

> **Agent instruction:** Apply changes in the following order. For each category, refer to the detailed migration patterns in [references/migration-patterns.md](./references/migration-patterns.md). Apply ALL applicable changes — do not skip any.
>
> **Priority order (most impactful first):**
>
> 1. **Storage methods now throw** — `store(credentials:)`, `clear()`, `clear(forAudience:scope:)` no longer return `Bool`. Convert `if store(...)` patterns to `do { try store(...) } catch`. See [Storage Methods](./references/migration-patterns.md#storage-methods-now-throw).
>
> 2. **Renamed APIs** — Apply all renames:
>    - `clearSession(federated:)` → `logout(federated:)`
>    - `UserInfo` → `UserProfile`
>    - `.expiresIn` → `.expiresAt`
>    - `Telemetry` → `Auth0ClientInfo`
>    - `credentialsManager.user` → `try credentialsManager.userProfile()`
>    See [Renamed APIs](./references/migration-patterns.md#renamed-apis).
>
> 3. **Removed Management API** — Replace `Auth0.users(...)` calls with backend API endpoints. See [Removed APIs](./references/migration-patterns.md#management-api-removed).
>
> 4. **MFA methods moved** — Replace deprecated `Authentication` MFA methods with `Auth0.mfa()` client. See [MFA Migration](./references/migration-patterns.md#mfa-methods-moved).
>
> 5. **Swift 6 concurrency** — Ensure custom protocol conformances (`WebAuth`, `Auth0Error`, `Logger`, `CredentialsStorage`) are `Sendable`. Fix imperative builder patterns on `webAuth()`. See [Swift 6 Concurrency](./references/migration-patterns.md#swift-6-concurrency).
>
> 6. **Default values changed** — Review whether new defaults affect your app:
>    - `scope` now includes `offline_access` by default
>    - `minTTL` defaults to 60 seconds (was 0)
>    - `signup` connection defaults to `"Username-Password-Authentication"`
>    See [Default Values](./references/migration-patterns.md#default-values-changed).
>
> 7. **Main thread delivery** — Remove `DispatchQueue.main.async` and `.receive(on: DispatchQueue.main)` wrappers around Auth0 callbacks. See [Threading](./references/migration-patterns.md#main-thread-delivery).
>
> 8. **WebAuthError cases** — Update error handling for removed/added cases. See [Error Changes](./references/migration-patterns.md#webautherror-changes).

### Step 4 — Adopt New Features (Optional)

> **Agent instruction:** After all breaking changes are resolved, offer these new v3 features to the user via `AskUserQuestion`:
> _"Auth0.swift v3 adds several new features. Would you like me to adopt any of these?"_
> - **Automatic credentials management** — `useCredentialsManager(_:)` on Web Auth
> - **Multi-window Web Auth** — `presentationWindow(_:)` for iPadOS/macOS
> - **ID token validation** — `.validateClaims()` builder on Authentication methods
> - **`clearAll()`** — Wipe all stored credentials (useful for account deletion)
>
> Only apply features the user opts into. See [New Features](./references/migration-patterns.md#new-features).

### Step 5 — Verify Build

> **Agent instruction:** Run a build to verify the migration compiles without errors:
> ```bash
> xcodebuild build -scheme YOUR_SCHEME -destination "platform=iOS Simulator,name=iPhone 16" 2>&1 | tail -20
> ```
> If the build fails:
> - Check for remaining v2 API usage patterns
> - Verify all `Sendable` conformances are in place
> - Ensure `try` is added to all storage method calls
> - Fix up to 5 times before asking the user for guidance

## Detailed Documentation

- **[Migration Patterns](./references/migration-patterns.md)** — Complete before/after code examples for every breaking change, organized by category
- **[New Features & Behavior](./references/new-features.md)** — Detailed guide to new v3 APIs, automatic credentials management, ID token validation, and threading guarantees

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting `try` on `store(credentials:)` | All storage methods now throw — wrap in `do-try-catch` or use `try?` |
| Still using `clearSession()` | Renamed to `logout()` in v3 |
| Using `UserInfo` type | Renamed to `UserProfile` |
| Using `.expiresIn` on Credentials | Renamed to `.expiresAt` |
| Calling `Auth0.users(...)` | Management API removed — use backend endpoints instead |
| Using old MFA methods on `Authentication` | Use `Auth0.mfa().verify(...)` instead |
| Imperative `webAuth()` builder without reassignment | `Auth0WebAuth` is now a struct — chain methods or reassign return values |
| Custom `WebAuth` mock not `Sendable` | Add `Sendable` conformance (struct) or `@unchecked Sendable` (class with lock) |
| Custom `CredentialsStorage` still returning `Bool` | Methods must now `throw` instead of returning `Bool`/`nil` |
| Unnecessary `DispatchQueue.main.async` in callbacks | v3 guarantees main thread delivery — remove manual dispatch |
| Not handling new `.storeFailed` / `.clearFailed` errors | These new error paths surface previously-silent Keychain failures |
| Expecting `offline_access` not in default scope | v3 includes it by default — explicitly set scope if you don't want refresh tokens |
| Logging tokens or credentials via `print()` | Never log access tokens, ID tokens, refresh tokens, or client secrets — use error-only logging and redact sensitive fields |

## Related Skills

- `auth0-swift` — Fresh Auth0.swift integration (not migration)
- `auth0-sdk-migration` — Cross-SDK migration tool (covers all Auth0 SDKs)
- `auth0-mfa` — Add MFA support to Auth0 apps

---

## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [V3 Migration Guide (official)](https://github.com/auth0/Auth0.swift/blob/develop/v3.0/V3_MIGRATION_GUIDE.md)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)
- [iOS/macOS Quickstart](https://auth0.com/docs/quickstart/native/ios-swift)
