# Auth0 Swift — reference hub

Auth0.swift is the official Auth0 SDK for Apple platforms (iOS, macOS, tvOS, watchOS, visionOS). This skill adds complete native authentication to Swift apps using Web Auth (system browser redirect), secure Keychain credential storage via `CredentialsManager`, and optional biometric protection.

<!-- Shared prerequisites: critical rules, when-not-to-use, and prerequisites.
     Read this first (hop 1), then follow the dispatch table below to the one
     leaf for your intent. (Carved from the original framework-swift.md.) -->

## Critical rules

- **Credential privacy is IMPORTANT:** never echo Auth0 credentials (domain, client ID, client secret) in response text or terminal output. Instead, redirect Auth0 CLI output to a temp file and use the Read tool to extract values, then write them directly into config files (e.g. `Auth0.plist`) with the Write or Edit tool. When confirming the active tenant, mask the domain (e.g. `your-te****.us.auth0.com`).

## When NOT to Use

- **Android apps**: Use the Auth0 integration workflow for Android
- **React Native apps**: Use the Auth0 integration workflow for React Native
- **Flutter apps**: Use the native Flutter Auth0 SDK
- **Web SPAs** (React, Angular, Vue): Use the Auth0 integration workflow for React, Angular, or Vue
- **Node.js/Express servers**: Use the Auth0 integration workflow for Express

## Prerequisites

- **iOS** 14.0+ / **macOS** 11.0+ / tvOS 14.0+ / watchOS 7.0+ / visionOS 1.0+
- **Xcode** 16.x
- **Swift** 6.0+
- Auth0 account — [Sign up free](https://auth0.com/signup)
- Auth0 CLI — `brew install auth0/auth0-cli/auth0` (for automated setup)

## Choose your task

You arrived here for a specific intent. After reading the shared prerequisites
above, read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-swift/integrate.md` |
| feature:mfa | `Read: references/framework-swift/integrate.md` |
| upgrade-sdk | `Read: references/framework-swift/migration.md` |

**Then, as needed for your task:**
- Tenant setup, CLI provisioning, `Auth0.plist`, URL scheme, Associated Domains, SDK install, integration patterns (login/logout, biometric protection, error handling, Organizations, SwiftUI/UIKit lifecycle, calling APIs), and MFA step-up all live in `integrate.md` (Setup and Integration Patterns sections).
- Full API / configuration lookup (WebAuth & CredentialsManager options, claims, testing checklist, security considerations): `Read: references/framework-swift/api-reference.md`
- Any other task (guidance, debugging, Organizations, provider migration):
  start with `Read: references/framework-swift/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
