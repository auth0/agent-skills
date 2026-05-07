---
name: auth0-sdk-migration
description: Use when upgrading Auth0 SDKs to a new major version — detects the current SDK and version in the project, fetches the official migration guide from GitHub, applies all breaking changes, and iterates until the project builds successfully. Covers all Auth0 SDKs (nextjs-auth0, auth0-react, auth0-angular, auth0-vue, auth0-spa-js, express-openid-connect, react-native-auth0, Auth0.swift, Auth0.Android, node-auth0, auth0-java, auth0-PHP, auth0.net, auth0-python).
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F4E6"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0 SDK Major Version Migration

Upgrade Auth0 SDKs to a new major version. Asks the user for the app path, SDK name, and target version, then fetches the official migration guide from GitHub, applies all breaking changes to the codebase, and iterates until the project builds successfully.

---

## When to Use This Skill

- Upgrading an Auth0 SDK to a new major version (e.g., nextjs-auth0 v3 → v4)
- The user mentions "upgrade", "update", "migrate", "breaking changes", or "new version" for an Auth0 SDK
- Dependency audit flags a major version bump for an Auth0 package

## When NOT to Use

- **Migrating FROM another auth provider TO Auth0** — Use `auth0-migration` instead
- **Fresh Auth0 integration (no existing SDK)** — Use `auth0-quickstart` or the framework-specific skill
- **Minor or patch version updates** — These are backward-compatible; just update the version number
- **Auth0 tenant or configuration changes** — This skill only covers SDK code changes

---

## Step 1: Ask the User for App Path, SDK, and Target Version

**You must collect three things from the user before proceeding:**

1. **Path to the application** — the root directory of the app that uses the Auth0 SDK
2. **Which Auth0 SDK** they want to migrate
3. **Which major version** they want to migrate to

> **Agent instruction:** Always ask the user explicitly. Do NOT assume or skip this step.
>
> Ask the user:
>
> "To perform the SDK migration, I need the following:
>
> 1. **App path** — What is the path to your application? (e.g., `/Users/you/projects/my-app`)
> 2. **SDK name** — Which Auth0 SDK do you want to upgrade? (e.g., `@auth0/nextjs-auth0`, `Auth0.swift`, `com.auth0.android:auth0`)
> 3. **Target version** — Which major version do you want to migrate to? (e.g., v4, v2, v3)"
>
> **If the user has already provided all three** in their request (e.g., "upgrade nextjs-auth0 to v4 in /Users/me/my-app"), confirm and proceed:
>
> "I'll migrate **[SDK] → v[target]** in `[path]`. Proceeding."
>
> **Do not proceed to Step 2 until you have the app path, SDK name, and target major version confirmed.**

---

## Step 2: Navigate to App and Detect Current Version

Once you have the app path, navigate to it and detect the currently installed version of the specified SDK.

> **Agent instruction:** Change your working directory to the app path provided by the user. Then detect the current version:

### Detection by Platform

**For JavaScript/TypeScript projects**, read `package.json` and look for the specified package in `dependencies` or `devDependencies`:

| Package Name | SDK | Platform |
|---|---|---|
| `@auth0/nextjs-auth0` | Next.js SDK | Web |
| `@auth0/auth0-react` | React SDK | Web SPA |
| `@auth0/auth0-angular` | Angular SDK | Web SPA |
| `@auth0/auth0-vue` | Vue SDK | Web SPA |
| `@auth0/auth0-spa-js` | SPA JS SDK | Web SPA |
| `express-openid-connect` | Express SDK | Web Server |
| `express-oauth2-jwt-bearer` | Express API SDK | API |
| `react-native-auth0` | React Native SDK | Mobile |
| `auth0` | Node.js Management SDK | Server |
| `@auth0/auth0-fastify` | Fastify SDK | Web Server |
| `@auth0/auth0-fastify-api` | Fastify API SDK | API |
| `@auth0/auth0-nuxt` | Nuxt SDK | Web |

**For Swift (iOS/macOS)**, check `Package.swift`, `Podfile`, or `Cartfile` for `Auth0.swift` or `Auth0` dependency version.

**For Android (Kotlin/Java)**, check `build.gradle` or `build.gradle.kts` for `com.auth0.android:auth0` version.

**For Python**, check `requirements.txt`, `pyproject.toml`, `setup.py`, or `Pipfile` for `auth0-python` version.

**For Java**, check `pom.xml` or `build.gradle` for `com.auth0:auth0`, `com.auth0:mvc-auth-commons`, or `com.auth0:auth0-spring-security-api` version.

**For PHP**, check `composer.json` for `auth0/auth0-php` or `auth0/login` version.

**For .NET**, check `.csproj` for `Auth0.AuthenticationApi`, `Auth0.ManagementApi`, or `Auth0.AspNetCore.Authentication` version.

> **Agent instruction:** After detection, confirm:
>
> "Found **[SDK] v[current]** in `[app path]`. Migrating to **v[target]**."
>
> If the SDK is not found at the given path, inform the user and ask them to verify the path and SDK name.

---

## Step 3: Fetch and Read the Migration Guide

Each Auth0 SDK publishes a migration guide in its GitHub repository. **You must fetch and read the full migration guide before making any changes.** The migration guide is the single source of truth for what needs to change.

> **Agent instruction:** Look up the migration guide URL from the [SDK Migration Guide Reference](references/migration-guides.md) for the detected SDK and target major version. Fetch the raw markdown content from GitHub:
>
> `https://raw.githubusercontent.com/{org}/{repo}/{branch}/{migration-guide-filename}`
>
> **Read the entire migration guide.** Extract every breaking change, renamed API, removed API, changed configuration, and new requirement. You will use this as your checklist in the next steps.
>
> If the migration guide URL returns a 404, try these fallback strategies in order:
> 1. Check the repository's root for files matching: `MIGRATION_GUIDE.md`, `MIGRATION.md`, `UPGRADE.md`, `V{N}_MIGRATION_GUIDE.md`
> 2. Check the `CHANGELOG.md` for the major version's breaking changes section
> 3. Check the GitHub release notes for the major version tag
>
> **Do not proceed with migration without reading the migration guide.**

---

## Step 4: Apply Migration Changes

Work through every breaking change from the migration guide systematically. Apply changes in this order to minimize intermediate breakage:

### 4a. Update the SDK Dependency

Update the SDK version in the package manifest to the new major version:

```bash
# JavaScript/TypeScript
npm install @auth0/[sdk-name]@latest

# Swift Package Manager — update version in Package.swift

# Gradle — update version in build.gradle / build.gradle.kts

# Python
pip install --upgrade auth0-python

# PHP
composer require auth0/auth0-php:^[new-major]

# .NET
dotnet add package Auth0.AuthenticationApi --version [new-major].*
```

Also check the migration guide for:
- New peer dependency requirements (minimum Node.js, React, Angular, Swift, etc. version)
- New required dependencies that must be added
- Dependencies that should be removed

> **Agent instruction:** If the migration guide specifies a minimum platform/framework version that the project does not meet, warn the user immediately and ask how to proceed.

### 4b. Update Configuration

Apply every configuration change from the migration guide:

- Rename environment variables (update `.env`, `.env.local`, `.env.example`, and all code references)
- Update SDK initialization (constructor arguments, factory functions, new required options)
- Update configuration files (new required fields, removed options, renamed keys)
- Update Auth0 Dashboard settings if the guide mentions them (inform the user of required manual steps)

### 4c. Update All Application Code

Search the entire codebase for every usage of the SDK and apply the changes documented in the migration guide:

1. **Update imports** — renamed modules, changed import paths, removed exports
2. **Update function/method calls** — renamed functions, changed signatures, new required parameters
3. **Replace removed APIs** — use the exact replacement documented in the migration guide
4. **Update types** — changed interfaces, renamed types, new generic parameters
5. **Update middleware/guards/decorators** — removed or restructured patterns
6. **Update hooks/composables** — renamed hooks, changed return types, new usage patterns

> **Agent instruction:** For each breaking change in the migration guide:
> 1. Search the entire project for usages of the old API (`grep -r "oldApiName" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"` or equivalent for the project language)
> 2. Apply the transformation documented in the migration guide to every occurrence
> 3. If the migration guide does not provide a clear replacement for a removed API, add a `// TODO: [SDK] v[version] — manual migration needed for [old API]` comment and inform the user

### 4d. Update Tests

Search for test files that reference Auth0 SDK APIs and update them:
- Update import paths and function names
- Update mocks to match the new API surface
- Update assertions for changed return types or response shapes
- Remove tests for removed APIs and add tests for new patterns if needed

---

## Step 5: Build and Fix Until Clean

**This step is mandatory.** The migration is not complete until the project builds successfully.

### 5a. Run Type Checking (if applicable)

```bash
# TypeScript
npx tsc --noEmit

# Swift
swift build

# Kotlin/Gradle
./gradlew compileKotlin

# .NET
dotnet build
```

### 5b. Run the Build

```bash
# JavaScript/TypeScript
npm run build

# Swift
swift build

# Android
./gradlew assembleDebug

# Python (check syntax/imports)
python -m py_compile [main-file]

# .NET
dotnet build
```

### 5c. Fix Build Errors Iteratively

> **Agent instruction:** If the build fails:
>
> 1. Read each error message carefully
> 2. Cross-reference the error with the migration guide — it likely indicates a missed breaking change
> 3. Apply the fix
> 4. Re-run the build
> 5. Repeat until the build passes with zero errors
>
> Common causes of post-migration build failures:
> - Missed usages of a renamed/removed API in files you didn't update
> - Type errors from changed return types or generics
> - Missing new required configuration or parameters
> - Import paths that changed but were referenced indirectly
>
> **Do not stop until the build succeeds.** If you cannot resolve an error after consulting the migration guide, explain the issue to the user and ask for guidance.

### 5d. Run Tests

```bash
npm test
# or framework-equivalent
```

> **Agent instruction:** If tests fail due to migration-related changes (not pre-existing failures), fix them using the migration guide. If tests fail for reasons unrelated to the migration, note them to the user but do not block the migration on pre-existing test failures.

---

## Step 6: Report Migration Summary

After the build succeeds, report to the user:

> **Agent instruction:** Provide a concise summary:
>
> 1. **SDK upgraded:** [name] v[old] → v[new]
> 2. **Files modified:** [count] files
> 3. **Key changes applied:** [bullet list of the most significant breaking changes that were applied]
> 4. **Manual steps required (if any):** [e.g., "Update Allowed Callback URLs in Auth0 Dashboard from /api/auth/callback to /auth/callback"]
> 5. **Build status:** Passing
> 6. **Test status:** Passing / [N] failures (pre-existing)

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Making changes without reading the migration guide | Always fetch and read the official migration guide first — it is the only source of truth for breaking changes |
| Stopping after updating package.json without fixing code | The migration is not complete until `npm run build` (or equivalent) passes with zero errors |
| Fixing one file but missing other usages of the same API | Always grep the entire project for each deprecated/removed API before moving on |
| Ignoring environment variable renames | Search all `.env*` files, CI/CD configs, and code references for old variable names |
| Not updating test mocks | Tests often mock SDK functions with the old API surface — update mocks to match new signatures |
| Skipping peer dependency checks | Major versions often require newer Node.js, framework, or language versions — check and warn |
| Applying changes from memory instead of the migration guide | Different SDKs have different breaking changes per version — always read the specific guide |

---

## Related Skills

- `auth0-migration` — Migrate from another auth provider to Auth0
- `auth0-quickstart` — Set up Auth0 from scratch
- `auth0-nextjs` — Next.js SDK integration details
- `auth0-react` — React SDK integration details
- `auth0-angular` — Angular SDK integration details
- `auth0-vue` — Vue SDK integration details
- `auth0-spa-js` — SPA JS SDK integration details
- `auth0-express` — Express SDK integration details
- `auth0-react-native` — React Native SDK integration details
- `auth0-swift` — Swift SDK integration details
- `auth0-android` — Android SDK integration details

---

## References

- [SDK Migration Guide Reference](references/migration-guides.md) — GitHub URLs for all Auth0 SDK migration guides
- [Auth0 SDK Libraries Overview](https://auth0.com/docs/libraries)
- [Auth0 SDK GitHub Organization](https://github.com/auth0)
