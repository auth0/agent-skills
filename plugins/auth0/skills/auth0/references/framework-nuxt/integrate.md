# Auth0 Nuxt SDK

## Overview

Server-side session authentication for Nuxt 3/4. NOT the same as @auth0/auth0-vue (client-side SPA).

**Core principle:** Uses server-side encrypted cookie sessions, not client-side tokens.

> **Quick start:** installation, session secret generation, `.env` setup, `nuxt.config.ts` module wiring, the built-in `/auth/*` routes, and baseline `useAuth0()`/`useUser()` composable usage live in this group's overview — already read on the way here. This file covers route and API protection depth, session management, API integration, and troubleshooting.

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

## Protecting Routes

**Three layers:** Route middleware (client), server middleware (SSR), API guards.

```typescript
// middleware/auth.ts - Client navigation
export default defineNuxtRouteMiddleware((to) => {
  if (!useUser().value) return navigateTo(`/auth/login?returnTo=${encodeURIComponent(to.path)}`);
});
```

```typescript
// server/middleware/auth.server.ts - SSR protection
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const auth0Client = useAuth0(event);
  const session = await auth0Client.getSession();
  if (!session)  {
    return sendRedirect(event, `/auth/login?returnTo=${encodeURIComponent(url.pathname)}`);
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

**For role-based, permission-based, and advanced patterns (including page-level `definePageMeta` middleware), see the Route Protection Patterns section in this group's patterns guide.**

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

**For complete session store implementations, see the Custom Session Stores section in this group's patterns guide.**

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

**Guides (in this group's patterns guide):** Route Protection Patterns • Custom Session Stores • Advanced examples (Organizations, multi-tenant, token refresh, error handling)

## Related Capabilities

- Auth0 setup — if Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Managing Auth0 resources from the terminal — the Auth0 CLI (`tooling-cli`)


**Links:** [Auth0-Nuxt GitHub](https://github.com/auth0/auth0-nuxt) • [Auth0 Docs](https://auth0.com/docs) • [Nuxt Modules](https://nuxt.com/modules)
