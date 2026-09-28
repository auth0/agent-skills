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

> **Agent instruction:** Work through only the §6.x changes that matched during
> the Step 4 file-reading audit. Skip every change whose API the project does not
> use — do not touch those files. Apply each change exactly as the SDK's own v3
> migration guide shows; do not alter surrounding code, rename variables,
> reformat, or modernise code that isn't being migrated. Match the project's
> existing style (completion handler / async-await / Combine).

Every v2→v3 breaking change, its Step 4 trigger, and the fix direction:

| § | Change | Applies if the project… | Fix |
|---|---|---|---|
| 6.1 | `WebAuth.clearSession()` → `logout()` | calls `.clearSession(` | Rename the method; the `federated:` param and default are unchanged |
| 6.2 | `WebAuthError`: `.invalidInvitationURL` & `.pkceNotAllowed` removed (now surface as `.unknown`); `.authenticationFailed`, `.codeExchangeFailed`, `.credentialsManagerError` added | has an exhaustive `switch`/`catch` on `WebAuthError` cases | Delete the removed cases (compile errors); a `default:` already covers the new ones (`.credentialsManagerError` exposes the underlying error via `.cause`) |
| 6.3 | Callbacks/publishers/async methods now deliver on the main thread (`@MainActor`) | wraps an Auth0 callback body in `DispatchQueue.main.async`/`MainActor.run` | Remove the wrapper — but only where it *solely* wraps the Auth0 callback |
| 6.4 | `Authentication`/`MFAClient` methods return `any Requestable`/`any TokenRequestable` instead of the concrete `Request` | stores a `Request<…>` type annotation, or has test mocks conforming to `Authentication`/`MFAClient`/`Requestable` | Chained `.start(…)` (the common case) is unchanged. Update stored annotations to the protocol type; in mocks change the return type and add `@MainActor` to `start(_:)` |
| 6.5 | `store(credentials:)` `Bool` → `throws`/`Void` | calls `credentialsManager.store(` | `do-catch` (or `try?` to preserve intentional silent discard) |
| 6.6 | `clear()` / `clear(forAudience:scope:)` `Bool` → `throws` (both overloads) | calls `credentialsManager.clear(` | `try?` or `do-catch` |
| 6.7 | `CredentialsManager.user` property → `userProfile() throws -> UserProfile?` | reads `credentialsManager.user` as a property | `try? credentialsManager.userProfile()` |
| 6.8 | Throwing storage adds error paths to `revoke()`, `credentials()`, `renew()`, `apiCredentials()`, `ssoCredentials()` (`.noCredentials`, `.revokeFailed`/`.renewFailed`, `.clearFailed`/`.storeFailed`) | calls `credentialsManager.revoke(` (or switches on those methods' errors) | A `default:` branch needs no change; only add cases if the project distinguishes them |
| 6.9 | `UserInfo` → `UserProfile` | annotates/declares `UserInfo` anywhere | Rename every reference; `userInfo(withAccessToken:)` keeps its name but now returns `UserProfile` |
| 6.10 | `Credentials.expiresIn` → `expiresAt` (also on `APICredentials`, `SSOCredentials`) | reads `.expiresIn` | Rename the property (JSON key is unchanged) |
| 6.11 | `CredentialsStorage` methods now `throws`; new required `deleteAllEntries()` | has a **custom** `CredentialsStorage` conformance (skip if it only uses the default `SimpleKeychain`) | Make the methods throw; add `deleteAllEntries()` |
| 6.12 | Management client (`Auth0.users(token:)`) removed | calls `Auth0.users(` | **Security-critical:** never embed a Management API token in the client. Add a `TODO`, route the operation through a backend that uses an M2M token; **requires backend work** — record in the Step 9 summary. Do not silently delete the call site |
| 6.13 | MFA methods removed from `Authentication` → `MFAClient` via `Auth0.mfa()`; error type `AuthenticationError` → `MFAVerifyError` | calls `login(withOTP:`/`login(withOOBCode:`/`login(withRecoveryCode:`/`multifactorChallenge(`, or mocks `MFAClient` | Move to `mfa().verify(…)` / `mfa().challenge(with:mfaToken:)` (note the OOB param **reorder** and the removed `types:` on challenge). `mfaToken` extraction (`error.mfaRequiredErrorPayload?.mfaToken`) is unchanged. **Read `Auth0/MFA/MFAErrors.swift` from the target tag for exact `MFAVerifyError` case names — do not guess.** Add TODOs, don't delete; ask the user to re-test every MFA flow end-to-end |
| 6.14 | Default scope now includes `offline_access` | calls `webAuth()` with **no** `.scope(` in the chain (read the multi-line call site to confirm) | No change if refresh tokens are welcome (recommended); add explicit `.scope("openid profile email")` to keep v2 behaviour. **Silent behavioural change — always surface in Step 9**, and confirm the tenant allows offline access |
| 6.15 | `credentials()` default `minTTL` `0` → `60`s | calls `credentialsManager.credentials(` without an explicit `minTTL:` | No change if acceptable (recommended — avoids mid-request expiry); pass `minTTL: 0` to restore v2 exactly. **Silent behavioural change — always surface in Step 9** |

> **Exact before/after for each change:** read the SDK's own v3 migration guide at
> the target tag —
> `https://raw.githubusercontent.com/auth0/Auth0.swift/<TARGET_TAG>/V3_MIGRATION_GUIDE.md`
> (or on GitHub: github.com/auth0/Auth0.swift, `V3_MIGRATION_GUIDE.md`) — and
> cross-check every signature against the source fetched in Step 3. Apply only the
> §6.x sections the Step 4 audit matched, in the project's existing style; never
> apply a change from assumed knowledge.

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
