---
name: auth0-sdk-migration
description: Use when upgrading Auth0 SDKs to a new major version — detects the current SDK and version in the project, fetches the official migration guide from GitHub, and applies breaking changes step by step. Covers all Auth0 SDKs (nextjs-auth0, auth0-react, auth0-angular, auth0-vue, auth0-spa-js, express-openid-connect, react-native-auth0, Auth0.swift, Auth0.Android, node-auth0, auth0-java, auth0-PHP, auth0.net, auth0-python).
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F4E6"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0 SDK Major Version Migration

Upgrade Auth0 SDKs to the latest major version by detecting the current SDK and version, fetching the official migration guide, and applying breaking changes to the codebase.

---

## When to Use This Skill

- Upgrading an Auth0 SDK to a new major version (e.g., nextjs-auth0 v3 → v4)
- The user mentions "upgrade", "update", "migrate", "breaking changes", or "new version" for an Auth0 SDK
- Dependency audit flags a major version bump for an Auth0 package
- The user wants to know what changed between major versions of an Auth0 SDK

## When NOT to Use

- **Migrating FROM another auth provider TO Auth0** — Use `auth0-migration` instead
- **Fresh Auth0 integration (no existing SDK)** — Use `auth0-quickstart` or the framework-specific skill
- **Minor or patch version updates** — These are backward-compatible; just update the version number
- **Auth0 tenant or configuration changes** — This skill only covers SDK code changes

---

## Step 1: Detect Auth0 SDK and Current Version

Scan the project to identify which Auth0 SDK(s) are installed and at what version.

**For JavaScript/TypeScript projects**, read `package.json` and look for these packages in `dependencies` or `devDependencies`:

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

**For Swift (iOS/macOS)**, check `Package.swift`, `Podfile`, or `Cartfile` for `Auth0.swift` or `Auth0` dependency.

**For Android (Kotlin/Java)**, check `build.gradle` or `build.gradle.kts` for `com.auth0.android:auth0`.

**For Python**, check `requirements.txt`, `pyproject.toml`, `setup.py`, or `Pipfile` for `auth0-python`.

**For Java**, check `pom.xml` or `build.gradle` for `com.auth0:auth0`, `com.auth0:mvc-auth-commons`, or `com.auth0:auth0-spring-security-api`.

**For PHP**, check `composer.json` for `auth0/auth0-php` or `auth0/login`.

**For .NET**, check `.csproj` for `Auth0.AuthenticationApi`, `Auth0.ManagementApi`, or `Auth0.AspNetCore.Authentication`.

> **Agent instruction:** After detecting the SDK and version, confirm with the user:
>
> "I found **[SDK name] v[current version]** in your project. The latest major version is **v[target]**. Would you like me to migrate to v[target]?"
>
> If multiple Auth0 SDKs are found, list all of them and ask which one(s) to upgrade.

---

## Step 2: Fetch the Official Migration Guide

Each Auth0 SDK publishes a migration guide in its GitHub repository. **You must fetch and read the migration guide before making any changes.**

> **Agent instruction:** Use the migration guide URL from the [SDK Migration Guide Reference](references/migration-guides.md) for the detected SDK and target version. Fetch the raw markdown content from GitHub using the URL pattern:
>
> `https://raw.githubusercontent.com/{org}/{repo}/{branch}/{path-to-migration-guide}`
>
> If the migration guide URL returns a 404, try these fallback strategies in order:
> 1. Check the repository's root for files matching: `MIGRATION_GUIDE.md`, `MIGRATION.md`, `UPGRADE.md`, `V{N}_MIGRATION_GUIDE.md`
> 2. Check the `docs/` directory for migration files
> 3. Check the `CHANGELOG.md` for the major version's breaking changes section
> 4. Check the GitHub release notes for the major version tag
>
> **Do not proceed with migration without reading the migration guide.** The guide is the source of truth for breaking changes.

---

## Step 3: Analyze Breaking Changes

After reading the migration guide, categorize the changes:

### 3a. Dependency Changes

- Package renames (e.g., import path changes)
- Peer dependency requirements (e.g., minimum Node.js, React, Angular version)
- New required dependencies or removed dependencies
- Package manager install command changes

### 3b. Configuration Changes

- Environment variable renames or format changes
- Configuration file changes (new required fields, removed options, renamed keys)
- Initialization API changes (constructor arguments, factory functions)

### 3c. API and Code Changes

- Removed or renamed exports, functions, methods, hooks, or components
- Changed function signatures (new required parameters, removed parameters)
- Changed return types or response shapes
- Removed middleware, guards, or decorators with new replacements
- Async/sync behavior changes

### 3d. Behavioral Changes

- Authentication flow changes (redirect URLs, callback handling)
- Token storage or session management changes
- Default configuration value changes
- Security-related changes

> **Agent instruction:** Present a summary of the breaking changes to the user before applying them:
>
> "Here are the breaking changes for **[SDK] v[current] → v[target]**:
>
> **Dependencies:** [list]
> **Configuration:** [list]
> **Code changes:** [list]
> **Behavioral changes:** [list]
>
> I'll apply these changes to your project. Shall I proceed?"

---

## Step 4: Apply Migration Changes

Apply changes in this order to minimize intermediate breakage:

### 4a. Update Dependencies

Update the SDK version in the package manifest:

**npm/yarn/pnpm:**
```bash
npm install @auth0/[sdk-name]@latest
```

**Swift Package Manager:**
Update the version requirement in `Package.swift`.

**Gradle:**
Update the version in `build.gradle` / `build.gradle.kts`.

**pip/poetry:**
```bash
pip install --upgrade auth0-python
```

> **Agent instruction:** After updating the dependency, also check if the migration guide specifies peer dependency changes (e.g., minimum Node.js version, framework version). Warn the user if their project does not meet the new requirements.

### 4b. Update Configuration

Apply environment variable renames, configuration file changes, and initialization changes.

> **Agent instruction:** When renaming environment variables:
> 1. Update `.env`, `.env.local`, `.env.example`, and any other dotenv files
> 2. Update any code that references the old variable names
> 3. Update deployment configuration references (but only warn about these — do not modify CI/CD files without confirmation)

### 4c. Update Application Code

Apply code changes file by file. For each file:

1. Search for imports from the old SDK path
2. Update imports to new paths/names
3. Update function calls, hook usage, component props
4. Handle removed APIs by replacing with the recommended alternative from the migration guide
5. Update TypeScript types if applicable

> **Agent instruction:** When replacing removed APIs:
> - Always use the replacement recommended in the migration guide
> - If no direct replacement exists, add a `// TODO: [SDK] v[version] removed [old API] — manual review needed` comment
> - Show the user a before/after diff for complex changes

### 4d. Update Tests

Search for test files that reference Auth0 SDK APIs and update them to match the new API surface.

---

## Step 5: Verify Migration

After applying all changes:

### 5a. Type Check

```bash
# TypeScript projects
npx tsc --noEmit
```

### 5b. Run Tests

```bash
npm test
```

### 5c. Start Development Server

```bash
npm run dev
```

> **Agent instruction:** If type checking or tests fail:
> 1. Read the error messages
> 2. Cross-reference with the migration guide for any missed changes
> 3. Fix the issues
> 4. Re-run until clean
>
> Report any issues that cannot be automatically resolved and require manual intervention.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Upgrading without reading the migration guide | Always fetch and read the official migration guide first — it is the source of truth |
| Missing environment variable renames | Search entire project for old variable names, including CI/CD configs and documentation |
| Forgetting to update test mocks | Tests often mock SDK functions; update mocks to match the new API surface |
| Skipping peer dependency checks | Major versions often require newer Node.js, framework, or language versions |
| Partial migration of removed APIs | Search the entire codebase for usage of removed APIs, not just the files that import the SDK directly |
| Not testing the authentication flow end-to-end | After migration, always test login, logout, callback, token refresh, and protected route access |
| Mixing old and new API patterns | After migration, grep for any remaining references to old API patterns to ensure complete migration |

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
