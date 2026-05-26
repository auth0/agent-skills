---
name: auth0-swift-major-migration
description: Use when upgrading Auth0.swift to the latest major version in an iOS, macOS, tvOS, watchOS, or visionOS app — detects current version, analyzes the new SDK's source code, applies changes based on the project's architecture and Apple-recommended standards, and builds until successful.
license: Proprietary
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F504"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0.swift Major Version Migration

Migrates an existing Auth0.swift integration to the latest major version. This skill is version-agnostic — it dynamically discovers the current and target versions, analyzes the new SDK's actual source code, and applies changes based on the project's existing architecture and Apple-recommended standards. Changes are applied iteratively until the project builds successfully.

The migration is driven by the SDK's real public API surface and the project's code — not by mechanically following a migration guide. The agent adapts its approach to match the app's design patterns (MVVM, TCA, etc.), concurrency model (async/await, Combine, callbacks), and platform conventions (SwiftUI, UIKit, Swift 6 strict concurrency).

## When NOT to Use

- **New Auth0 integration** (no existing Auth0.swift): Use [auth0-swift](/auth0-swift)
- **Minor/patch updates** (e.g., 2.17 → 2.18): Run `pod update Auth0` or update SPM — no migration needed
- **Android apps**: Use [auth0-android](/auth0-android)
- **React Native / Expo apps**: Use [auth0-react-native](/auth0-react-native) or [auth0-expo](/auth0-expo)

## Prerequisites

- Existing Auth0.swift integration in the project
- Xcode installed and project buildable before starting
- Project under version control (git) with a clean working tree

## Quick Start Workflow

> **Agent instruction:** Follow these steps strictly in order. The end goal is a **green build** on the target major version. Never skip the backup step. Never apply changes without understanding them from the official guide first.

---

### Step 1 — Pre-flight & Backup

> **Agent instruction:**
>
> 1. **Verify clean git state:**
>    ```bash
>    git status --porcelain
>    ```
>    If there are uncommitted changes, stop and ask the user: _"You have uncommitted changes. Should I stash them before proceeding, or would you like to commit first?"_
>
> 2. **Create a safety branch:**
>    ```bash
>    git checkout -b auth0-swift-migration-backup
>    git checkout -
>    ```
>    This ensures the user can always revert.
>
> 3. **Verify the project builds on the current version:**
>    ```bash
>    xcodebuild build -scheme <SCHEME> -destination "platform=iOS Simulator,name=iPhone 16" 2>&1 | tail -5
>    ```
>    If the build fails, stop. The project must build before migration begins. Ask the user to fix existing issues first.

---

### Step 2 — Detect Current Version & Target Version

> **Agent instruction:**
>
> 1. **Detect current Auth0.swift version** — search in order:
>    - `Package.resolved` → look for `"https://github.com/auth0/Auth0.swift"` and its `"version"` field
>    - `Podfile.lock` → look for `Auth0 (X.Y.Z)`
>    - `Cartfile.resolved` → look for `auth0/Auth0.swift`
>    - `Package.swift` → look for the `from:` version in the Auth0 dependency
>    - `Podfile` → look for `pod 'Auth0'` version constraint
>
>    If no version is found, ask the user: _"What version of Auth0.swift is your project currently using?"_
>
> 2. **Determine the latest major version available:**
>    ```bash
>    curl -s https://api.github.com/repos/auth0/Auth0.swift/releases | python3 -c "
>    import sys, json
>    releases = json.load(sys.stdin)
>    stable = [r for r in releases if not r['prerelease'] and not r['draft']]
>    if stable:
>        print(stable[0]['tag_name'])
>    else:
>        all_rel = [r for r in releases if not r['draft']]
>        print(all_rel[0]['tag_name'] if all_rel else 'UNKNOWN')
>    "
>    ```
>
> 3. **Confirm the migration target** with the user:
>    _"Your project uses Auth0.swift vX.Y.Z. The latest major version is vN.M.P. Shall I proceed with the migration to vN?"_
>
>    If the user specifies a different target version, use that instead.
>
> 4. **Determine the major version jump.** If migrating across multiple major versions (e.g., v1 → v3), migrations must be applied sequentially (v1 → v2 → v3). Inform the user and proceed one major version at a time.

---

### Step 3 — Analyze Target SDK Source

> **Agent instruction:** Understand what changed in the target major version by examining the actual source code of the new SDK, not just a migration guide.
>
> 1. **Fetch the public API surface of the target version:**
>    ```bash
>    # Get the source tree listing for the target tag
>    curl -s "https://api.github.com/repos/auth0/Auth0.swift/git/trees/{TAG}?recursive=1" | python3 -c "
>    import sys, json
>    tree = json.load(sys.stdin).get('tree', [])
>    for item in tree:
>        if item['path'].startswith('Auth0/') and item['path'].endswith('.swift'):
>            print(item['path'])
>    "
>    ```
>
> 2. **Fetch key public API files** to understand renamed, removed, or changed interfaces:
>    ```bash
>    # Fetch core public types (adjust paths based on tree listing)
>    curl -sf "https://raw.githubusercontent.com/auth0/Auth0.swift/{TAG}/Auth0/WebAuth.swift"
>    curl -sf "https://raw.githubusercontent.com/auth0/Auth0.swift/{TAG}/Auth0/CredentialsManager.swift"
>    curl -sf "https://raw.githubusercontent.com/auth0/Auth0.swift/{TAG}/Auth0/Authentication.swift"
>    ```
>
> 3. **Optionally fetch the migration guide** as a supplementary reference (not the primary source of truth):
>    ```bash
>    curl -sf "https://raw.githubusercontent.com/auth0/Auth0.swift/{TAG}/V{N}_MIGRATION_GUIDE.md" || \
>    curl -sf "https://raw.githubusercontent.com/auth0/Auth0.swift/main/V{N}_MIGRATION_GUIDE.md"
>    ```
>    Use this for context on _why_ changes were made, but base your code modifications on the actual SDK source and the project's architecture.
>
> **Key principle:** The migration guide is informational. The actual code changes you apply must be driven by the SDK's real public API surface and the project's existing architecture.

---

### Step 4 — Audit Project Architecture & Usage

> **Agent instruction:** Before making any changes, understand the project's architecture, patterns, and Auth0 usage in depth.
>
> 1. **Find all files importing Auth0:**
>    ```bash
>    grep -rl "import Auth0" --include="*.swift" .
>    ```
>
> 2. **Understand the project's architecture:**
>    - Identify the app's design pattern (MVVM, MVC, VIPER, TCA, etc.)
>    - Note how Auth0 is integrated (singleton service, dependency injection, protocol abstraction, etc.)
>    - Check Swift concurrency usage (async/await, Combine, completion handlers, actors)
>    - Check minimum deployment target and Swift version
>
> 3. **For each file**, read it and note which Auth0 APIs are used and how they fit into the project's architecture.
>
> 4. **Check for custom protocol implementations** (custom `CredentialsStorage`, `Logger`, `WebAuth` conformances) — these often have signature changes in major versions.
>
> 5. **Check tests** — search for Auth0 usage in test targets:
>    ```bash
>    grep -rl "import Auth0\|@testable import" --include="*.swift" . | grep -i test
>    ```
>
> 6. **Identify Apple platform patterns** the project uses:
>    - SwiftUI vs UIKit/AppKit
>    - Swift 6 strict concurrency / `@Sendable` / actor isolation
>    - Structured concurrency (TaskGroup, async let)
>    - Observation framework (`@Observable`) vs ObservableObject
>    - App Intents, WidgetKit, or extension targets sharing credentials
>
> **Important:** Do NOT start modifying code yet. This step is read-only reconnaissance. The goal is to understand how the project is structured so that migrated code respects the existing architecture and Apple-recommended standards.

---

### Step 5 — Update SDK Version

> **Agent instruction:** Update the dependency declaration to the target major version. Apply **only** the matching package manager.
>
> 1. **Detect package manager:**
>    - `Package.swift` or `.xcodeproj` with SPM → Swift Package Manager
>    - `Podfile` → CocoaPods
>    - `Cartfile` → Carthage
>
> 2. **Update the version constraint:**
>    - **SPM (Package.swift):** Change `from: "X.0.0"` to `from: "N.0.0"`
>    - **SPM (Xcode-managed):** Tell the user: _"Update Auth0.swift in Xcode: File → Packages → Update to Latest Package Versions. If it doesn't resolve to vN, change the version rule to 'Up to Next Major' from N.0.0."_
>    - **CocoaPods:** Change `pod 'Auth0', '~> X.0'` to `pod 'Auth0', '~> N.0'` then run:
>      ```bash
>      pod update Auth0
>      ```
>    - **Carthage:** Change `~> X.0` to `~> N.0` then run:
>      ```bash
>      carthage update Auth0.swift --use-xcframeworks
>      ```
>
> 3. **For SPM projects with Package.swift**, resolve dependencies:
>    ```bash
>    swift package resolve
>    ```
>
> **Do NOT attempt to build yet** — we apply API changes first to minimize error noise.

---

### Step 6 — Apply Code Changes

> **Agent instruction:** Using the SDK source analysis from Step 3 and the architecture audit from Step 4, systematically update the project's Auth0 integration. Changes must respect the project's existing architecture and follow Apple-recommended standards.
>
> **Principles:**
> - **Architecture-first:** Match the project's existing patterns. If the app uses MVVM with async/await, migrate to async APIs. If it uses Combine, use Combine publishers. Do not force a pattern the project doesn't use.
> - **Apple standards:** Follow current Apple platform conventions — structured concurrency, `@Sendable` correctness, actor isolation where appropriate, `@MainActor` for UI-bound code.
> - **Minimal disruption:** Change only what the new SDK requires. Do not refactor surrounding code unless it's necessary for compilation.
> - **Project consistency:** New code should look like it belongs in this project, not like it was copy-pasted from a migration guide.
>
> **Rules:**
> - Work through one API change category at a time
> - For each category, search the ENTIRE project (app code + tests + extensions) for affected patterns
> - Apply the fix to ALL occurrences before moving to the next category
> - If a change is ambiguous or has multiple valid approaches, ask the user before proceeding
> - Never remove functionality — migrate it to the new API equivalent
> - If an API is removed with no direct replacement, add a `// TODO:` comment explaining what backend work is needed and inform the user
>
> **Pattern for each change:**
> 1. Search for the old pattern across all Swift files
> 2. Determine the correct replacement based on the new SDK's public API and the project's architecture
> 3. Apply the replacement in a way that is consistent with the project's style and Apple platform conventions
> 4. Verify the replacement is semantically equivalent (preserves behavior)
>
> **Apple platform considerations:**
> - If the project targets Swift 6, ensure all Auth0 interactions are `@Sendable`-correct and respect actor boundaries
> - If using SwiftUI, prefer `@MainActor`-isolated view models over manual `DispatchQueue.main` calls
> - If using structured concurrency, prefer `async throws` over completion handler patterns even if both are available in the new SDK
> - Respect the project's error handling strategy (typed throws, Result, do-catch patterns)
>
> **Security rules:**
> - Never hardcode tokens, secrets, or credentials during migration
> - If migration involves auth flow changes, preserve existing security properties (PKCE, secure storage, etc.)
> - Never downgrade from CredentialsManager/Keychain to UserDefaults or in-memory storage
> - If the new SDK offers improved security features, mention them to the user as optional improvements

---

### Step 7 — Build & Fix Loop

> **Agent instruction:** Iteratively build and fix until the project compiles cleanly.
>
> ```bash
> xcodebuild build -scheme <SCHEME> -destination "platform=iOS Simulator,name=iPhone 16" 2>&1
> ```
>
> **For each build failure:**
> 1. Read the error message and source location
> 2. Identify which breaking change category it belongs to
> 3. Consult the migration guide for the correct fix
> 4. Apply the fix
> 5. Rebuild
>
> **Iteration limits:**
> - Up to **10 build-fix cycles** are allowed
> - If after 10 attempts the build still fails, stop and present the remaining errors to the user with context from the migration guide
>
> **Common error patterns (version-agnostic):**
> - `has no member 'X'` → API renamed or removed; check migration guide for replacement
> - `cannot find type 'X'` → Type renamed; find new name in guide
> - `cannot convert value` → Return type changed; update call site
> - `does not conform to protocol` → Protocol requirements changed; add new required methods
> - `missing argument` → New required parameter added; check guide for default value
> - `extra argument` → Parameter removed; delete it
> - `is inaccessible due to access control` → API made internal; check guide for alternative
>
> **After successful build:**
> ```bash
> xcodebuild build -scheme <SCHEME> -destination "platform=iOS Simulator,name=iPhone 16" 2>&1 | grep -E "BUILD SUCCEEDED|BUILD FAILED"
> ```

---

### Step 8 — Post-Migration Verification

> **Agent instruction:** After a successful build:
>
> 1. **Run tests if they exist:**
>    ```bash
>    xcodebuild test -scheme <SCHEME> -destination "platform=iOS Simulator,name=iPhone 16" 2>&1 | tail -20
>    ```
>    If tests fail due to migration-related changes, fix them using the same guide. Test failures are acceptable to report to the user if they require test logic changes beyond API updates.
>
> 2. **Show the user a summary of changes made:**
>    ```bash
>    git diff --stat
>    ```
>
> 3. **Highlight any `// TODO:` comments** added for changes that need manual follow-up (removed APIs, backend work needed, etc.).
>
> 4. **Mention optional new features** from the migration guide that the user might want to adopt (but do NOT apply them without asking).
>
> 5. **Ask the user** if they'd like to:
>    - Commit the migration changes
>    - Adopt any new features from the target version
>    - Review specific files in detail

---

## Detailed Documentation

- **[Migration Process](./references/process.md)** — Detailed guidance on edge cases, multi-version jumps, and rollback procedures
- **[Security Checklist](./references/security.md)** — Security invariants that must be preserved during any migration

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Starting migration on dirty working tree | Always verify clean git state and create backup branch first |
| Applying changes without reading migration guide | Always fetch and parse the official guide before making changes |
| Only fixing app code, missing tests | Search test targets for Auth0 usage too |
| Removing functionality when API is deleted | Add TODO comment and inform user — never silently remove features |
| Hardcoding version in multiple places | Update the single source of truth (Package.swift/Podfile/Cartfile) |
| Skipping intermediate major versions | Must migrate sequentially (v1→v2→v3, not v1→v3 directly) |
| Building before applying known changes | Apply all known breaking changes first, then build to catch remaining issues |
| Continuing after 10+ failed build attempts | Stop and ask the user — likely a misunderstood change or project-specific issue |

## Related Skills

- [auth0-swift](/auth0-swift) — New Auth0.swift integration from scratch
- [auth0-android](/auth0-android) — Android native authentication

---

## References

- [Auth0.swift GitHub](https://github.com/auth0/Auth0.swift)
- [Auth0.swift Releases](https://github.com/auth0/Auth0.swift/releases)
- [Auth0.swift API Documentation](https://auth0.github.io/Auth0.swift/documentation/auth0/)

---

> **Security:** Never echo tokens, client secrets, or credentials in build logs or terminal output. Use `--no-input` flags and redact sensitive values. Never commit secrets to version control.
