# Migration Process — Edge Cases & Procedures

This skill migrates developers to the **latest major version** of Auth0.swift. It detects the currently installed version, determines the latest stable release, analyzes the new SDK's actual source code, and applies changes based on the project's existing architecture and Apple-recommended standards — not by mechanically following a migration guide.

**Core principle:** Code changes must respect the project's design patterns (MVVM, MVC, TCA, VIPER, etc.), concurrency model (async/await, Combine, completion handlers), and platform conventions (SwiftUI, UIKit, Swift 6 strict concurrency, `@Sendable`, actor isolation). The migration is minimal and targeted — only compile-time and behavioral breaking changes, applied only where the project actually uses the affected API.

Detailed guidance for scenarios that go beyond the standard workflow.

---

## Multi-Major-Version Jumps

The goal is always to reach the **latest stable major version**. When the project is multiple major versions behind (e.g., v1 when latest is v3), apply migrations sequentially:

1. Migrate v1 → v2 (analyze v2 SDK source, apply, build)
2. Migrate v2 → v3 (analyze v3 SDK source, apply, build)

Each intermediate migration must produce a successful build before proceeding to the next.

**Why sequential?** Each major version's breaking changes assume you're coming from the immediately prior version. Skipping versions may miss intermediate renames or behavioral changes that compound.

**Exception:** If the target version's migration guide explicitly states it covers migration from multiple prior versions (e.g., "Migrating from v1 or v2 to v3"), you may migrate in a single pass — but still base the actual code changes on the new SDK's public API.

---

## Rollback Procedure

If the migration fails beyond repair or the user decides to abort:

```bash
# Option 1: Reset to the backup branch
git checkout auth0-swift-migration-backup
git branch -D <current-branch>  # only if user confirms

# Option 2: Revert all migration changes
git checkout -- .
git clean -fd  # removes new untracked files — confirm with user first

# Option 3: Stash changes for later
git stash push -m "auth0-swift-migration-in-progress"
```

Always confirm with the user before any destructive git operation.

---

## Xcode-Managed SPM Dependencies

When the project uses Xcode's built-in SPM (no `Package.swift` at root):

1. The version constraint lives inside `project.pbxproj`
2. Direct editing of pbxproj is fragile — prefer instructing the user to update via Xcode UI
3. After the user updates, verify resolution:
   ```bash
   grep -A2 "Auth0.swift" *.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved 2>/dev/null || \
   grep -A2 "Auth0.swift" **/Package.resolved 2>/dev/null
   ```

---

## Workspace with Multiple Targets

For projects with multiple targets (app + extensions + widgets):

1. All targets importing Auth0 must be migrated simultaneously
2. Search ALL targets for Auth0 imports:
   ```bash
   grep -rl "import Auth0" --include="*.swift" .
   ```
3. Group affected files by target (check which target membership each file has)
4. Apply the same migration changes to all targets
5. Build each scheme individually if needed:
   ```bash
   xcodebuild -list  # shows all schemes
   ```

---

## CocoaPods Subspecs

Some versions of Auth0.swift expose subspecs. During migration:

1. Check if the Podfile uses subspecs: `pod 'Auth0/WebAuth'`, `pod 'Auth0/Authentication'`
2. Check the new version's podspec to see if subspecs still exist or were merged
3. If subspecs were removed, simplify to `pod 'Auth0', '~> N.0'`

---

## Carthage Binary Frameworks

For Carthage users migrating to a version that ships XCFrameworks:

1. Remove old framework references from Xcode
2. Use `--use-xcframeworks` flag:
   ```bash
   carthage update Auth0.swift --use-xcframeworks
   ```
3. Re-add the XCFrameworks to the target's "Frameworks, Libraries, and Embedded Content"

---

## Primary Approach: SDK Source Analysis

The primary method for determining what needs to change is analyzing the new SDK's actual source code:

1. **Fetch the public API surface** of the target version from the repository
2. **Compare with the APIs used in the project** to identify what's renamed, removed, or changed
3. **Use build errors as validation** — bump the version, build, and fix errors guided by your understanding of the new API
4. **Check API diff** between versions:
   ```bash
   # Compare public API between tags
   curl -s "https://api.github.com/repos/auth0/Auth0.swift/compare/CURRENT_TAG...TARGET_TAG" | python3 -c "
   import sys, json
   data = json.load(sys.stdin)
   for f in data.get('files', []):
       if f['filename'].endswith('.swift') and '/Sources/' in f['filename']:
           print(f['filename'], f['status'])
   "
   ```

The migration guide (if available) is a supplementary reference for understanding _why_ changes were made, but it must not dictate _how_ you write the replacement code. The replacement code must match the project's architecture and Apple platform conventions.

---

## Boundary Conditions — Apply Changes Only Where Required

The most common way a migration goes wrong is by over-applying changes. Hold these boundaries firmly:

### SDK-internal changes do not propagate to consumer code

A new major version often adopts new language features internally (e.g., Swift 6 strict concurrency, `Sendable` conformances, actor isolation). This is the SDK's internal implementation detail.

- **Do** update a call site if the SDK's *public* API signature changed in a way that forces it (e.g., a method became `async`, gained `@MainActor`, or now requires a `Sendable` argument).
- **Do NOT** change the consumer app's Swift language mode, enable strict concurrency, or sprinkle `@Sendable`/`@MainActor` across unrelated code just because the SDK now uses them. If the project builds in Swift 5 mode, keep it there unless the user asks otherwise.

### API-specific changes apply only to APIs the project uses

Each breaking change targets a specific API surface. Before applying any fix:

1. Confirm the project has a real call site for that API (`grep` for the symbol)
2. If there are no call sites, **skip the change entirely** — do not add code defensively
3. Example: a breaking change in `CredentialsManager` only matters if the project imports and calls `CredentialsManager`. A project using only `WebAuth` for login is unaffected and should get no `CredentialsManager`-related edits.

### Never invent usage

If a breaking change has no corresponding call site in the project, the correct action is no action. Speculative or "just in case" code is a hallucination risk and violates the minimal-migration principle.

---

## Scope: Breaking Changes Only

Limit automatic changes to **behavioral and compile-time breaking changes**:

- **Compile-time** — code won't build against the new version without the change
- **Behavioral** — code compiles but behaves differently, and the project relies on the old behavior

Explicitly exclude:

- **Opt-in / optional features** — new capabilities the project didn't use before. List them in the summary as optional; never auto-apply.
- **Still-compiling deprecations** — note for follow-up, don't change.
- **Modernization / refactors** unrelated to the migration.

Keeping scope tight minimizes diff size, reduces review burden, and avoids hallucinated changes.

---

## Error-Handling Migrations

Error handling deserves explicit, careful treatment because changes here are easy to get subtly wrong.

1. **Map onto the project's existing strategy.** If the new SDK changes an error type or makes a method throw, integrate it into how the project already handles errors (typed throws, `Result`, `do-catch`, Combine `.catch`, etc.). Do not introduce a new pattern.
2. **Preserve custom logging / telemetry integrations.** Many apps route auth errors through a custom `Logger`, analytics SDK, or crash reporter. If so, convert the new error type and feed it into the *same* sink the project already uses — keep the integration intact.
3. **Richer error cases.** If the new error type exposes more cases, you may pass them to the existing handler, but do not build new user-facing error UI unless the user asks.
4. **Never log sensitive data.** When adjusting error handling, ensure no token, credential, or other sensitive value is printed or logged. If the old code logged such values, redact or remove that as part of the migration.
5. **Flag for review.** Every error-handling change should appear in the migration summary's "Needs manual review" section so the user can confirm behavior.

---

## Management Client Removal (v3)

In Auth0.swift v3, the **Management client was removed** from the SDK. This is a high-impact change requiring backend work:

1. **Detect usage** — search for the Management API/client symbols the project may use:
   ```bash
   grep -rn "management\|Management(" --include="*.swift" .
   ```
2. **Do NOT silently delete** Management calls. Removing the call site fixes the build but breaks functionality the user depends on.
3. **Correct guidance:** Management API operations must move to a **secure backend**. The app should call your backend, which in turn calls the Auth0 Management API using appropriate credentials. A Management API token must **never** be embedded in or fetched directly by the client app.
4. **In the summary**, clearly state: which Management operations were in use, that the SDK no longer supports them, and that backend-side changes are required to restore the functionality.

---

## MFA API Migrations

If the project uses multi-factor authentication APIs and they changed across the major version:

1. **Detect usage** — search for MFA-related calls (e.g., `mfaChallenge`, `multifactorChallenge`, associate/enroll authenticators).
2. **Migrate old MFA APIs to the new MFA APIs** following the new SDK's public surface, respecting the project's architecture.
3. **In the summary**, list which MFA flows changed (enrollment, challenge, verification) and instruct the user to **re-test MFA end-to-end** against their tenant's MFA configuration, since these flows depend on tenant settings that can't be validated from code alone.

---

## Handling Deprecated APIs

When the migration guide marks APIs as deprecated (not removed):

1. **Do NOT change deprecated APIs during migration** — they still compile
2. Note them for the user as follow-up work
3. Only replace deprecated APIs if the user explicitly asks, or if they produce build warnings that the user wants resolved
4. Deprecated → removed happens in the NEXT major version, so they're safe for now

---

## Swift Version Compatibility

Major Auth0.swift versions may require newer Swift versions:

1. Check the migration guide or release notes for Swift version requirements
2. Verify the project's Swift version:
   ```bash
   grep "SWIFT_VERSION" *.xcodeproj/project.pbxproj | head -5
   ```
3. If a Swift version bump is needed, inform the user — this may require an Xcode update
4. Swift version changes can introduce their own compiler errors unrelated to Auth0 — distinguish between Auth0 migration issues and Swift version issues

---

## JWTDecode Dependency

Auth0.swift depends on JWTDecode.swift. Major version bumps of Auth0.swift may bump the JWTDecode dependency too:

1. If the project directly imports JWTDecode, check for breaking changes in that library as well
2. If other pods/packages depend on JWTDecode, version conflicts may arise — resolve by aligning versions
3. For CocoaPods, run `pod update Auth0 JWTDecode` to update both together
