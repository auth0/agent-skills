---
name: auth0-swift-major-migration
description: Use when upgrading Auth0.swift to the latest major version in an iOS, macOS, tvOS, watchOS, or visionOS app — detects current version, fetches the official migration guide, applies breaking changes iteratively, and builds until successful.
license: Proprietary
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F504"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0.swift Major Version Migration

Migrates an existing Auth0.swift integration to the latest major version. This skill is version-agnostic — it dynamically discovers the current and target versions, fetches the official migration guide from the Auth0.swift repository, and applies changes iteratively until the project builds successfully.

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

### Step 3 — Fetch Official Migration Guide

> **Agent instruction:** Fetch the migration guide from the Auth0.swift repository. The guide filename follows the pattern `V{N}_MIGRATION_GUIDE.md` where N is the target major version.
>
> 1. **Try to fetch the guide from the release tag:**
>    ```bash
>    curl -sf "https://raw.githubusercontent.com/auth0/Auth0.swift/{TAG}/V{N}_MIGRATION_GUIDE.md"
>    ```
>    Where `{TAG}` is the target version tag (e.g., `3.0.0`) and `{N}` is the major version number.
>
> 2. **If not found, try the main branch:**
>    ```bash
>    curl -sf "https://raw.githubusercontent.com/auth0/Auth0.swift/main/V{N}_MIGRATION_GUIDE.md"
>    ```
>
> 3. **If not found, try the CHANGELOG:**
>    ```bash
>    curl -sf "https://raw.githubusercontent.com/auth0/Auth0.swift/{TAG}/CHANGELOG.md"
>    ```
>    Extract the breaking changes section for the target major version.
>
> 4. **If no guide is found**, check the GitHub release notes:
>    ```bash
>    curl -s "https://api.github.com/repos/auth0/Auth0.swift/releases/tags/{TAG}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('body',''))"
>    ```
>
> 5. **If still nothing found**, ask the user: _"I couldn't find the official migration guide for vN. Do you have a link to it, or would you like me to proceed by analyzing the build errors after the version bump?"_
>
> **Store the migration guide content** — you will reference it throughout the remaining steps.

---

### Step 4 — Audit Project Usage

> **Agent instruction:** Before making any changes, build a complete inventory of Auth0.swift usage across the project.
>
> 1. **Find all files importing Auth0:**
>    ```bash
>    grep -rl "import Auth0" --include="*.swift" .
>    ```
>
> 2. **For each file**, read it and note which Auth0 APIs are used.
>
> 3. **Cross-reference with the migration guide** — identify which breaking changes affect this project. Create a mental checklist of only the relevant changes.
>
> 4. **Check for custom protocol implementations** (custom `CredentialsStorage`, `Logger`, `WebAuth` conformances) — these often have signature changes in major versions.
>
> 5. **Check tests** — search for Auth0 usage in test targets:
>    ```bash
>    grep -rl "import Auth0\|@testable import" --include="*.swift" . | grep -i test
>    ```
>
> **Important:** Do NOT start modifying code yet. This step is read-only reconnaissance.

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

### Step 6 — Apply Breaking Changes

> **Agent instruction:** Using the migration guide from Step 3 and the usage audit from Step 4, systematically apply each breaking change.
>
> **Rules:**
> - Work through one breaking change category at a time
> - For each category, search the ENTIRE project (app code + tests + extensions) for affected patterns
> - Apply the fix to ALL occurrences before moving to the next category
> - If a change is ambiguous or has multiple valid approaches, ask the user before proceeding
> - Never remove functionality — migrate it to the new API equivalent
> - If an API is removed with no direct replacement, add a `// TODO:` comment explaining what backend work is needed and inform the user
>
> **Pattern for each breaking change:**
> 1. Search for the old pattern across all Swift files
> 2. For each occurrence, apply the migration guide's recommended replacement
> 3. Verify the replacement is semantically equivalent (preserves behavior)
>
> **Security rules:**
> - Never hardcode tokens, secrets, or credentials during migration
> - If migration involves auth flow changes, preserve existing security properties (PKCE, secure storage, etc.)
> - Never downgrade from CredentialsManager/Keychain to UserDefaults or in-memory storage
> - If the migration guide suggests new security features, mention them to the user as optional improvements

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
