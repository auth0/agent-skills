# Auth0 Expo — reference hub

Add authentication to Expo (React Native) applications using `react-native-auth0` with the Expo Config Plugin.

<!-- Shared prerequisites: prerequisites and when-NOT-to-use notes. Read this
     first (hop 1), then follow the dispatch table below to the one leaf for
     your intent. (Carved from the original framework-expo.md.) -->

## Prerequisites

- Expo SDK 53 or higher (react-native-auth0 v5.x requires Expo 53+)
- React 19 and React Native 0.78.0 or higher
- Auth0 account with a **Native** application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- **Not compatible with Expo Go** — requires custom development client or EAS Build

## When NOT to Use

| Use Case | Use Instead |
|----------|------------------|
| Bare React Native CLI project (no Expo) | the Auth0 integration workflow for React Native |
| React web SPA (Vite/CRA) | the Auth0 integration workflow for React |
| Next.js application | the Auth0 integration workflow for Next.js |
| Vue.js SPA | the Auth0 integration workflow for Vue.js |
| Angular SPA | the Auth0 integration workflow for Angular |
| Express.js backend | the Auth0 integration workflow for Express.js |
| Native Android (Kotlin/Java) | the Auth0 integration workflow for Android |
| Backend API (JWT validation) | the Auth0 integration workflow for Fastify or Express.js |

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-expo/integrate.md` |

**Then, as needed for your task:**
- Full API / configuration lookup, testing checklist, common issues, security considerations: `Read: references/framework-expo/api-reference.md`
- Tenant setup / CLI provisioning, dev client, callback URLs, EAS Build, secret management: `Read: references/framework-expo/setup.md`
- Advanced framework patterns (login/logout, credential management, biometric auth, DPoP, organizations, error handling): `Read: references/framework-expo/patterns.md`
- Any other task (guidance, debugging, Organizations, provider migration): start with `Read: references/framework-expo/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
