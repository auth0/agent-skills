# Auth0 Android — reference hub

Add authentication to Android applications using `com.auth0.android:auth0`.

<!-- Shared prerequisites: version-fetch instruction, critical rules,
     prerequisites, and when-NOT-to-use. Read this first (hop 1), then follow
     the dispatch table below to the one leaf for your intent. (Carved from the
     original framework-android.md.) -->

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```
> gh api repos/auth0/Auth0.Android/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all `implementation` dependency lines instead of any hardcoded version below. If the command fails, fall back to checking https://github.com/auth0/Auth0.Android/releases.

## Critical rules

- Before running any part of the automatic setup that writes to `strings.xml`, you MUST ask the user for explicit confirmation before proceeding.
- After either automatic or manual Auth0 configuration, you MUST apply the required Post-Setup changes to the project (manifest placeholders in `app/build.gradle` for `auth0Domain` and `auth0Scheme`, etc.) before treating the integration as complete.

## Prerequisites

- Android API 21 or higher
- Kotlin or Java project
- Auth0 account with a Native application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **React Native apps**: Use the Auth0 React Native integration
- **Flutter apps**: Use the native Flutter Auth0 SDK
- **Web SPAs** (React, Angular, Vue): Use the Auth0 React, Angular, or Vue integration
- **Node.js/Express servers**: Use the Auth0 Express integration
- **iOS/macOS apps**: Use the Auth0 Swift integration

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-android/integrate.md` |
| upgrade-sdk | `Read: references/framework-android/migration.md` |

**Then, as needed for your task:**
- Tenant setup, CLI provisioning, `strings.xml`, SDK install, App Links, and integration patterns (login, storage, biometrics, passwordless, Organizations, MFA handling) all live in `integrate.md` (Setup and Integration Patterns sections).
- Full API / configuration lookup, testing checklist, security considerations: `Read: references/framework-android/api-reference.md`
- Any other task (guidance, debugging, Organizations, provider migration):
  start with `Read: references/framework-android/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
