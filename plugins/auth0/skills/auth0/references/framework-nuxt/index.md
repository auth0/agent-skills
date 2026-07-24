# Auth0 Nuxt SDK

Server-side session authentication for Nuxt 3/4 with `@auth0/auth0-nuxt`. Uses server-side encrypted cookie sessions, NOT client-side tokens (not the same as `@auth0/auth0-vue`).

## Critical rules

- **Never use `useUser()` for security checks.** It is client-side only and can be tampered with. Enforce all security-critical decisions server-side with `useAuth0(event).getSession()`.
- Install `@auth0/auth0-nuxt` — NOT `@auth0/auth0-vue` or `@auth0/auth0-spa-js`.
- Auth0 app type must be **Regular Web Application**, not Single Page Application.
- Environment variables use the `NUXT_AUTH0_*` prefix (not `VITE_AUTH0_*` or `VUE_APP_AUTH0_*`).
- Generate a strong session secret with `openssl rand -hex 64`; never commit `.env` files.

## When NOT to Use

- **Nuxt 2** — not supported; use a different Auth0 SDK.
- **Pure client-side SPA without a server** — use `@auth0/auth0-vue` instead.
- **Static site generation only (SSG) without a server runtime.**
- **Non-Auth0 authentication provider.**

## Quick start

```bash
# 1. Install
npm install @auth0/auth0-nuxt

# 2. Generate secret
openssl rand -hex 64
```

```bash
# 3. .env
NUXT_AUTH0_DOMAIN=your-tenant.auth0.com
NUXT_AUTH0_CLIENT_ID=your-client-id
NUXT_AUTH0_CLIENT_SECRET=your-client-secret
NUXT_AUTH0_SESSION_SECRET=<from-openssl>
NUXT_AUTH0_APP_BASE_URL=http://localhost:3000
NUXT_AUTH0_AUDIENCE=https://your-api  # optional
```

```typescript
// 4. nuxt.config.ts
// Leave values as empty strings — Nuxt auto-fills them from NUXT_AUTH0_* env vars at runtime.
// If you prefer explicit mapping, use: domain: process.env.NUXT_AUTH0_DOMAIN || ''
export default defineNuxtConfig({
  modules: ['@auth0/auth0-nuxt'],
  runtimeConfig: {
    auth0: {
      domain: '',
      clientId: '',
      clientSecret: '',
      sessionSecret: '',
      appBaseUrl: 'http://localhost:3000',
      audience: '',  // optional
    },
  },
})
```

### Built-in Routes

The SDK automatically mounts these routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/auth/login` | GET | Initiates login flow. Supports `?returnTo=/path` parameter |
| `/auth/callback` | GET | Handles Auth0 callback after login |
| `/auth/logout` | GET | Logs user out and redirects to Auth0 logout |
| `/auth/backchannel-logout` | POST | Receives logout tokens for back-channel logout |

**Customize:** Pass `routes: { login, callback, logout, backchannelLogout }` or `mountRoutes: false` to module config.

### Composables

| Composable | Context | Usage |
|------------|---------|-------|
| `useAuth0(event)` | Server-side | Access `getUser()`, `getSession()`, `getAccessToken()`, `logout()` |
| `useUser()` | Client-side | Display user data only. **Never use for security checks** — instead, enforce them server-side with `useAuth0(event).getSession()` |

```typescript
// Server example
const auth0 = useAuth0(event);
const session = await auth0.getSession();
```

```vue
<script setup>
const user = useUser();
</script>

<template>
  <div v-if="user">Welcome {{ user.name }}</div>
<template>
```

This gets a basic login/logout integration working. For route/API protection depth, session management, API integration, and troubleshooting, see this group's integration guide below.

---

## Choose your task

You arrived here for a specific intent. The quick start above gets a basic
integration working. After reading the shared setup above, read the reference
for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-nuxt/integrate.md` |

**Then, as needed for your task:**
- Protecting pages/routes (page-level `definePageMeta` middleware, role/permission guards) or custom session stores: `Read: references/framework-nuxt/patterns.md` — integrate.md covers only the baseline global/server middleware.
- Any other task (guidance, debugging, API integration, session management): start with `Read: references/framework-nuxt/integrate.md`

Read only the reference (or references) your task needs — not all of them.
