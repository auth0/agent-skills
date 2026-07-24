# Auth0 Ionic Angular (Capacitor) — reference hub

Add authentication to an Ionic Angular application using the `@auth0/auth0-angular` SDK with Capacitor plugins for native iOS and Android. This skill covers login, logout, user profile display, and secure token management using the system browser (SFSafariViewController on iOS, Chrome Custom Tabs on Android) via Capacitor's Browser plugin.

<!-- Shared prerequisites: critical rules, prerequisites, and when-NOT-to-use.
     Read this first (hop 1), then follow the dispatch table below to the one
     leaf for your intent. (Carved from the original framework-ionic-angular.md.) -->

## Critical rules

- **SECURITY — NEVER display credentials.** After obtaining Auth0 credentials (domain, client ID) from the CLI or a user-provided env file, write them directly to the config file silently. Do not print, echo, or display them in text output; instead, confirm the config file was written and tell the user where to find it.

## Prerequisites

- Node.js 20+ and npm 10+
- Ionic CLI (`npm install -g @ionic/cli`)
- Capacitor 5+ configured in the project
- Auth0 CLI (for automatic setup): `brew install auth0/auth0-cli/auth0`
- An Auth0 account (free tier works)

## When NOT to Use

| Use Case | Use Instead |
|----------|------------------|
| Ionic **React** app with Capacitor | the Auth0 integration workflow for Ionic React |
| Ionic **Vue** app with Capacitor | the Auth0 integration workflow for Ionic Vue |
| Angular SPA (browser-only, no Capacitor) | the Auth0 integration workflow for Angular (or React) |
| React Native (no Ionic) | the Auth0 integration workflow for React Native |
| Expo (React Native) | the Auth0 integration workflow for Expo |
| Native iOS (Swift) | the Auth0 integration workflow for Swift (iOS) |
| Native Android (Kotlin) | the Auth0 integration workflow for Android (Kotlin) |

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-ionic-angular/integrate.md` |

**Then, as needed for your task:**
- Tenant setup, Auth0 CLI provisioning, Dashboard config, deep linking, and advanced framework patterns (login/logout flows, token management, route guards, error handling, Capacitor lifecycle) all live in `integrate.md` (Setup and Integration Patterns sections).
- Full API / configuration lookup, claims reference, testing checklist, security considerations: `Read: references/framework-ionic-angular/api-reference.md`
- Any other task (guidance, debugging, Organizations): start with `Read: references/framework-ionic-angular/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
