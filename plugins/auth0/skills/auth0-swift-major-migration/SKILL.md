---
name: auth0-swift-major-migration
description: Use when upgrading Auth0.swift to the latest major version in an iOS, macOS, tvOS, watchOS, or visionOS app — detects current version, analyzes the new SDK's source code, applies the minimal set of compile-time and behavioral breaking changes (only where the project actually uses the affected APIs) following the project's architecture and Apple-recommended standards, builds until successful, and produces a summary with manual-review items and backend follow-up actions.
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

## Migration Scope & Boundaries

This skill applies a **minimal, targeted** migration. Read these boundaries before starting — they govern every change you make.

**In scope (apply automatically):**
- **Compile-time breaking changes** — renamed/removed types, methods, properties, and parameters that prevent the project from building against the new major version
- **Behavioral breaking changes** — changes where the old code compiles but behaves differently (e.g., a default that changed, a method that now throws), but only where the project actually relies on the old behavior

**Out of scope (do NOT apply automatically):**
- **Opt-in / optional features** — new capabilities the new version offers that the project did not previously use. Mention them in the summary as optional, never apply them.
- **Deprecations that still compile** — note them for follow-up; do not change them.
- **Cosmetic refactors** — do not restyle, reorganize, or "modernize" code beyond what the migration requires.

**Boundary conditions (critical — apply changes only where the project is actually affected):**
- **SDK-internal changes do not propagate to consumer code.** If the SDK itself adopts Swift 6 / strict concurrency internally, that does NOT mean you migrate the consumer app to Swift 6. Only adjust call sites where the SDK's *public* signature change forces a change.
- **API-specific changes apply only to used APIs.** If there is a breaking change in, say, the `CredentialsManager` API, only touch integrator code that actually uses `CredentialsManager`. If the project never imports or calls that API, make no change for it.
- **Never invent usage.** If you cannot find a concrete call site for a breaking change in the project, do not add code "just in case." This prevents hallucinated changes.

When a change is genuinely ambiguous or could be applied multiple valid ways, stop and ask the user rather than guessing.

## Quick Start Workflow

> **Agent instruction:** Follow these steps strictly in order. The end goal is a **green build** on the target major version, with the **smallest correct set of changes**. Never skip the backup step. Never apply a change unless you can point to the specific SDK API change and the specific project call site it affects. Respect the Migration Scope & Boundaries above at every step.

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
> - **Apply changes only where the project actually uses the affected API** (see Migration Scope & Boundaries). If a breaking change targets an API the project never calls, skip it entirely — do not add speculative code.
> - **Do not propagate SDK-internal changes to consumer code.** A Swift 6 / concurrency change inside the SDK only requires a consumer change if the SDK's *public* signature forces it. Do not migrate the app's language mode or annotate unrelated code.
> - Exclude opt-in/optional features and still-compiling deprecations — note them for the summary instead (see Step 8)
> - If a change is ambiguous or has multiple valid approaches, ask the user before proceeding
> - Never remove functionality — migrate it to the new API equivalent
> - If an API is removed with no in-SDK replacement (e.g., functionality moved server-side), do NOT silently delete the code. Add a `// TODO:` comment explaining what is needed, record it for the summary, and inform the user
>
> **Pattern for each change:**
> 1. Search for the old pattern across all Swift files
> 2. Confirm the project actually uses it — if there are no call sites, skip
> 3. Determine the correct replacement based on the new SDK's public API and the project's architecture
> 4. Apply the replacement in a way that is consistent with the project's style and Apple platform conventions
> 5. Verify the replacement is semantically equivalent (preserves behavior)
>
> **Apple platform considerations (match what the project already uses — never upgrade it):**
> - If the project *already* targets Swift 6, keep Auth0 interactions `@Sendable`-correct and respect actor boundaries. If it does NOT, do not introduce Swift 6 concurrency requirements.
> - If using SwiftUI, prefer `@MainActor`-isolated view models over manual `DispatchQueue.main` calls — only when touching code you're already migrating
> - If the project uses structured concurrency, prefer the SDK's `async throws` APIs; if it uses completion handlers or Combine, migrate to the matching style the SDK offers
> - Respect the project's existing error-handling strategy (typed throws, Result, do-catch)
>
> **Error-handling migrations (be explicit):**
> - When an API's error type or throwing behavior changes, map it onto the project's *existing* error-handling approach — do not impose a new one
> - If the project routes errors through a custom logging or telemetry layer (e.g., a `Logger`, analytics SDK, crash reporter), preserve that integration: convert the new error type and feed it into the same sink the project already uses
> - When the new error type exposes richer cases than before, you may surface them to the existing handler, but do not invent new user-facing error UI unless asked
> - Record any error-handling change that the user should review in the migration summary (Step 8)
>
> **Security rules:**
> - Never hardcode tokens, secrets, or credentials during migration
> - **Never print, log, or echo credentials, tokens, or other sensitive values** — not in code you generate, not in example snippets, not in debug statements. If the old code logged a token, treat removing/redacting that as part of the migration.
> - If migration involves auth flow changes, preserve existing security properties (PKCE, secure storage, etc.)
> - Never downgrade from CredentialsManager/Keychain to UserDefaults or in-memory storage
> - If the new SDK offers improved security features, mention them to the user as optional improvements (do not auto-apply)

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
> 2. Identify which breaking change it belongs to, using the SDK source analysis from Step 3
> 3. Determine the correct fix from the new SDK's public API (the migration guide is supplementary context only)
> 4. Apply the fix in keeping with the project's architecture and the boundary rules
> 5. Rebuild
>
> **Iteration limits:**
> - Up to **10 build-fix cycles** are allowed
> - If after 10 attempts the build still fails, stop and present the remaining errors to the user with context
>
> **Common error patterns (version-agnostic):**
> - `has no member 'X'` → API renamed or removed; find replacement in the new SDK source
> - `cannot find type 'X'` → Type renamed; find new name in the SDK source
> - `cannot convert value` → Return type changed; update call site
> - `does not conform to protocol` → Protocol requirements changed; add new required methods
> - `missing argument` → New required parameter added; check the SDK source for the default value
> - `extra argument` → Parameter removed; delete it
> - `is inaccessible due to access control` → API made internal; find the supported alternative
> - `call can throw, but is not marked with 'try'` → method now throws; wrap in the project's existing error-handling pattern
> - `sending 'X' risks causing data races` → only appears if the project already uses strict concurrency; resolve within the project's existing actor model — do not enable strict concurrency where it wasn't already on
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
>    If tests fail due to migration-related changes, fix them within the boundary rules. Test failures are acceptable to report to the user if they require test logic changes beyond API updates.
>
> 2. **Collect the diff for the summary:**
>    ```bash
>    git diff --stat
>    ```

---

### Step 9 — Migration Summary & Next Steps

> **Agent instruction:** Produce a concise, customer-focused summary. This is the most important output for the user — it tells them what changed, what they must review, and what follow-up work remains. Use the following structure:
>
> **1. What changed (automatic):**
> - List each breaking change applied, grouped by API area (e.g., Web Auth, CredentialsManager, Authentication, error types)
> - For each, note the files touched
>
> **2. Needs manual review:**
> - **Error handling** — call out every place where error types or throwing behavior changed, especially where the project's custom logging/telemetry integration was involved. Ask the user to verify error mapping is correct.
> - Any `// TODO:` comments added during migration
> - Any change where you had to make a judgment call about the project's architecture
>
> **3. Follow-up actions (backend / configuration):** Some breaking changes require work beyond the app code. Surface these explicitly when relevant to this migration:
> - **Management Client removed (v3):** If the project used the SDK's Management client, code calling it may have been removed or stubbed. The Management API can no longer be called directly from the SDK. **Inform the user that backend-side changes are required** — Management API operations must move to a secure backend (the app should call your backend, which calls the Management API with appropriate credentials). Never put a Management API token in the client.
> - **MFA API changes:** If old MFA APIs were migrated to new MFA APIs, list which flows changed and tell the user to re-test enrollment and challenge flows end-to-end against their tenant configuration.
> - **Any removed API whose functionality moved server-side:** describe what the user must implement on the backend.
>
> **4. Optional improvements (NOT applied):**
> - List opt-in features / new capabilities the target version offers that the project does not currently use
> - List still-compiling deprecations the user may want to address later
> - Make clear these were intentionally excluded to keep the migration minimal
>
> **5. Ask the user** if they'd like to:
> - Commit the migration changes
> - Adopt any of the optional features above
> - Review specific files in detail
>
> **Security reminder for the summary:** Never include actual tokens, secrets, or credential values in the summary output.

---

## Detailed Documentation

- **[Migration Process](./references/process.md)** — Boundary conditions, scope limits, error-handling migrations, Management Client removal, MFA API migrations, multi-version jumps, and rollback procedures
- **[Security Checklist](./references/security.md)** — Security invariants that must be preserved during any migration

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Starting migration on dirty working tree | Always verify clean git state and create backup branch first |
| Applying changes by mirroring the migration guide | Base changes on the new SDK's actual public API and the project's architecture; the guide is supplementary |
| Migrating the consumer app to Swift 6 because the SDK did | SDK-internal concurrency changes don't propagate; only change call sites the public API forces |
| Applying a breaking-change fix for an API the project doesn't use | Apply changes only where there's a real call site — never add speculative code |
| Adopting opt-in/optional new features automatically | Keep migration minimal; list optional features in the summary instead |
| Imposing a new error-handling style | Map new error types onto the project's existing handling and custom logging/telemetry |
| Silently removing Management Client code | Note it requires backend-side changes; surface in the summary and next steps |
| Only fixing app code, missing tests | Search test targets for Auth0 usage too |
| Removing functionality when API is deleted | Add TODO comment and inform user — never silently remove features |
| Printing or logging tokens/credentials in generated code | Never log sensitive values; redact and remove any existing credential logging |
| Hardcoding version in multiple places | Update the single source of truth (Package.swift/Podfile/Cartfile) |
| Skipping intermediate major versions | Must migrate sequentially (v1→v2→v3, not v1→v3 directly) |
| Building before applying known changes | Apply all known breaking changes first, then build to catch remaining issues |
| Continuing after 10+ failed build attempts | Stop and ask the user — likely a misunderstood change or project-specific issue |
| Skipping the migration summary | Always produce the summary with manual-review items and follow-up actions |

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
