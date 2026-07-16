# Auth0 Ionic Vue (Capacitor) — reference hub

Add Auth0 authentication to Ionic Vue applications using Capacitor. This skill covers native mobile authentication using the `@auth0/auth0-vue` SDK combined with `@capacitor/browser` and `@capacitor/app` plugins for deep link handling on iOS and Android.

<!-- Shared prerequisites: critical rules, prerequisites, and when-NOT-to-use.
     Read this first (hop 1), then follow the dispatch table below to the one
     leaf for your intent. (Carved from the original framework-ionic-vue.md.) -->

## Critical rules

- **IMPORTANT — never display credentials.** After obtaining the domain, client ID, or any credential value from the CLI or user input, write them directly into config files. Do not echo, print, or display them in conversation output.

## Prerequisites

- Node.js 18+
- Ionic CLI (`npm install -g @ionic/cli`)
- An existing Ionic Vue application with Capacitor configured
- Auth0 account and tenant
- For iOS: Xcode 14+ and CocoaPods
- For Android: Android Studio with API level 21+
- Auth0 CLI — `brew install auth0/auth0-cli/auth0`

## When NOT to Use

| Use Case | Use Instead |
|----------|------------------|
| Vue SPA (no Capacitor/Ionic) | the Auth0 integration workflow for Vue |
| React SPA (no Capacitor/Ionic) | the Auth0 integration workflow for React |
| React Native (bare CLI) | the Auth0 integration workflow for React Native |
| Expo (React Native) | the Auth0 integration workflow for Expo |
| Ionic + React + Capacitor | the Auth0 integration workflow for Ionic React |
| Ionic + Angular + Capacitor | the Auth0 integration workflow for Ionic Angular |
| Next.js (server-side) | the Auth0 integration workflow for Next.js |
| Nuxt (server-side) | the Auth0 integration workflow for Nuxt |
| iOS native (Swift) | the Auth0 integration workflow for iOS (Swift) |
| Android native (Kotlin) | the Auth0 integration workflow for Android (Kotlin) |

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-ionic-vue/integrate.md` |

**Then, as needed for your task:**
- Full API / configuration lookup, claims reference, testing checklist, security considerations: `Read: references/framework-ionic-vue/api-reference.md`
- Tenant setup / Auth0 CLI provisioning / Dashboard config / deep linking: `Read: references/framework-ionic-vue/setup.md`
- Advanced framework patterns (login/logout flows, token management, route guards, error handling, Capacitor lifecycle): `Read: references/framework-ionic-vue/patterns.md`
- Any other task (guidance, debugging, Organizations): start with `Read: references/framework-ionic-vue/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
