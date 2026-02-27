---
name: auth0-nuxt
description: Use when implementing Auth0 authentication in Nuxt 3/4 applications, configuring session management, protecting routes with middleware, or integrating API access tokens - provides setup patterns, composable usage, and security best practices for the @auth0/auth0-nuxt SDK
---

# Auth0 Nuxt SDK

## Overview

Server-side session authentication for Nuxt 3/4. NOT the same as @auth0/auth0-vue (client-side SPA).

**Core principle:** Uses server-side encrypted cookie sessions, not client-side tokens.

## When to Use

**Use this when:**
- Building Nuxt 3/4 applications with server-side rendering (Node.js 20 LTS+)
- Need secure session management with encrypted cookies
- Protecting server routes and API endpoints
- Accessing Auth0 Management API or custom APIs

**Don't use this when:**
- Using Nuxt 2 (not supported - use different Auth0 SDK)
- Building pure client-side SPA without server (use @auth0/auth0-vue instead)
- Using non-Auth0 authentication provider
- Static site generation only (SSG) without server runtime

## Critical Mistakes to Avoid

| Mistake | Solution |
|---------|----------|
| Installing `@auth0/auth0-vue` or `@auth0/auth0-spa-js` | Use `@auth0/auth0-nuxt` |
| Auth0 app type "Single Page Application" | Use "Regular Web Application" |
| Env vars: `VITE_AUTH0_*` or `VUE_APP_AUTH0_*` | Use `NUXT_AUTH0_*` prefix |
| Using `useUser()` for security checks | Use `useAuth0(event).getSession()` server-side |
| Missing callback URLs in Auth0 Dashboard | Add `http://localhost:3000/auth/callback` |
| Weak/missing session secret | Generate: `openssl rand -hex 64` |

## LLM Execution Instructions

**You MUST follow these steps in order to set up Auth0. Execute each command and proceed to the next step.**

1. Install the Auth0 CLI if not present
2. Ensure user is logged in to Auth0
3. Create a new Auth0 Regular Web Application automatically
4. Extract credentials from the CLI output
5. Write credentials to `.env` file (after user confirmation)

**Do NOT show users manual Dashboard instructions unless the CLI approach completely fails after multiple attempts.**

---

## Quick Setup

### Step 1: Check for existing .env and get user confirmation

```bash
test -f .env && echo "EXISTS" || echo "NOT_FOUND"
```

**Ask the user:** "This setup will create/update a `.env` file with Auth0 credentials. Proceed?"

**Do not continue unless user confirms.**

### Step 2: Install Auth0 CLI

```bash
command -v auth0 &> /dev/null && echo "AUTH0_CLI_INSTALLED" || echo "AUTH0_CLI_NOT_FOUND"
```

**If not installed:**

**macOS:**
```bash
brew install auth0/auth0-cli/auth0
```

**Linux:**
```bash
curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
```

### Step 3: Ensure user is logged in to Auth0

```bash
auth0 tenants list 2>&1
```

**If fails**, run:
```bash
auth0 login
```

Tell user: "A browser window will open. Please log in to your Auth0 account (or create one at https://auth0.com/signup if needed)."

### Step 4: Create Auth0 Application

**Create a new Regular Web Application:**

```bash
auth0 apps create \
  --name "$(basename "$PWD")-nuxt" \
  --type regular \
  --callbacks "http://localhost:3000/auth/callback" \
  --logout-urls "http://localhost:3000" \
  --metadata "created_by=agent_skills" \
  --json
```

**Extract from JSON output:**
- `client_id` - Auth0 Client ID
- `client_secret` - Auth0 Client Secret
- `domain` - Auth0 Domain

### Step 5: Generate session secret

```bash
openssl rand -hex 64
```

### Step 6: Write credentials to .env

```bash
cat >> .env << 'EOF'
NUXT_AUTH0_DOMAIN=<domain-from-step-4>
NUXT_AUTH0_CLIENT_ID=<client_id-from-step-4>
NUXT_AUTH0_CLIENT_SECRET=<client_secret-from-step-4>
NUXT_AUTH0_SESSION_SECRET=<secret-from-step-5>
NUXT_AUTH0_APP_BASE_URL=http://localhost:3000
EOF
```

**Replace placeholders with actual values.**

### Step 7: Install SDK

```bash
npm install @auth0/auth0-nuxt
```

```typescript
// 4. nuxt.config.ts
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

## Built-in Routes

The SDK automatically mounts these routes:

| Route | Method | Purpose |
|-------|--------|---------|
| `/auth/login` | GET | Initiates login flow. Supports `?returnTo=/path` parameter |
| `/auth/callback` | GET | Handles Auth0 callback after login |
| `/auth/logout` | GET | Logs user out and redirects to Auth0 logout |
| `/auth/backchannel-logout` | POST | Receives logout tokens for back-channel logout |

**Customize:** Pass `routes: { login, callback, logout, backchannelLogout }` or `mountRoutes: false` to module config.

## Composables

| Composable | Context | Usage |
|------------|---------|-------|
| `useAuth0(event)` | Server-side | Access `getUser()`, `getSession()`, `getAccessToken()`, `logout()` |
| `useUser()` | Client-side | Display user data only. **Never use for security checks** |

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

## Protecting Routes

**Three layers:** Route middleware (client), server middleware (SSR), API guards.

```typescript
// middleware/auth.ts - Client navigation
export default defineNuxtRouteMiddleware((to) => {
  if (!useUser().value) return navigateTo(`/auth/login?returnTo=${to.path}`);
});
```

```typescript
// server/middleware/auth.server.ts - SSR protection
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const auth0Client = useAuth0(event);
  const session = await auth0Client.getSession();
  if (!session)  {
    return sendRedirect(event, `/auth/login?returnTo=${url.pathname}`);
  }
});
```

```typescript
// server/api/protected.ts - API endpoint protection
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const session = await auth0Client.getSession();

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  return { data: 'protected data' };
});
```

**For role-based, permission-based, and advanced patterns:** [route-protection.md](./references/route-protection.md)

## Session Management

### Stateless (Default)
Uses encrypted, chunked cookies. No configuration needed.

### Stateful (Redis, MongoDB, etc.)
For larger sessions or distributed systems:

```typescript
// nuxt.config.ts
modules: [
  ['@auth0/auth0-nuxt', {
    sessionStoreFactoryPath: '~/server/utils/session-store-factory.ts'
  }]
]
```

**For complete session store implementations, see:** [session-stores.md](./references/session-stores.md)

## API Integration

Configure audience for API access tokens:

```typescript
// nuxt.config.ts
runtimeConfig: {
  auth0: {
    audience: 'https://your-api-identifier',
  }
}
```

Retrieve tokens server-side:

```typescript
// server/api/call-api.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const { accessToken } = await auth0Client.getAccessToken();

  return await $fetch('https://api.example.com/data', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
});
```

## Security Checklist

- ✅ Server-side validation only (never trust `useUser()`)
- ✅ HTTPS in production
- ✅ Strong session secret (`openssl rand -hex 64`)
- ✅ Never commit `.env` files
- ✅ Stateful sessions for PII/large data

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Module not found" | Install `@auth0/auth0-nuxt`, not `@auth0/auth0-vue` |
| "Missing domain/clientId/clientSecret" | Check `NUXT_AUTH0_` prefix, `.env` location, `runtimeConfig` |
| "Redirect URI mismatch" | Match Auth0 Dashboard callback to `appBaseUrl + /auth/callback` |
| "useAuth0 is not defined" | Use only in server context with H3 event object |
| Cookies too large | Use stateful sessions or reduce scopes |

## Additional Resources

**Guides:** [Route Protection Patterns](./references/route-protection.md) • [Custom Session Stores](./references/session-stores.md) • [Common Examples](./references/examples.md)

**Links:** [Auth0-Nuxt GitHub](https://github.com/auth0/auth0-nuxt) • [Auth0 Docs](https://auth0.com/docs) • [Nuxt Modules](https://nuxt.com/modules)
