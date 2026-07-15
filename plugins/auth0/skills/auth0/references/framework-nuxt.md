
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

## Quick Setup

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

**For role-based, permission-based, and advanced patterns, see the Route Protection Patterns section below.**

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

**For complete session store implementations, see the Custom Session Stores section below.**

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

**Guides (sections below):** Route Protection Patterns • Custom Session Stores • Common Examples

## Related Capabilities

- Auth0 setup — if Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Managing Auth0 resources from the terminal — the Auth0 CLI (`tooling-cli`)


**Links:** [Auth0-Nuxt GitHub](https://github.com/auth0/auth0-nuxt) • [Auth0 Docs](https://auth0.com/docs) • [Nuxt Modules](https://nuxt.com/modules)

---

# Route Protection Patterns for Auth0-Nuxt

Comprehensive guide for protecting routes, pages, and API endpoints in Nuxt 3/4 applications with Auth0.

## Protection Layers

Auth0-Nuxt provides three protection layers:

1. **Route Middleware** - Client-side navigation guards (pages)
2. **Server Middleware** - SSR protection (server-rendered routes)
3. **API Route Guards** - Protect API endpoints

## Route Middleware (Client-Side Navigation)

### Basic Route Middleware

Create `middleware/auth.ts`:

```typescript
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useUser();

  if (!user.value) {
    return navigateTo(`/auth/login?returnTo=${encodeURIComponent(to.path)}`);
  }
});
```

### Apply to Specific Pages

```vue
<!-- pages/dashboard.vue -->
<script setup>
definePageMeta({
  middleware: ['auth']
});
</script>

<template>
  <div>Private Dashboard</div>
</template>
```

### Role-Based Middleware

```typescript
// middleware/admin.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useUser();

  if (!user.value) {
    return navigateTo(`/auth/login?returnTo=${encodeURIComponent(to.path)}`);
  }

  // Check for admin role
  const roles = user.value['https://my-app.com/roles'] || [];
  if (!roles.includes('admin')) {
    return navigateTo('/unauthorized');
  }
});
```

```vue
<!-- pages/admin/index.vue -->
<script setup>
definePageMeta({
  middleware: ['admin']
});
</script>
```

### Permission-Based Middleware

```typescript
// middleware/permissions.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useUser();

  if (!user.value) {
    return navigateTo(`/auth/login?returnTo=${encodeURIComponent(to.path)}`);
  }

  // Check for specific permission
  const permissions = user.value['https://my-app.com/permissions'] || [];
  const requiredPermission = to.meta.permission;

  if (requiredPermission && !permissions.includes(requiredPermission)) {
    return navigateTo('/forbidden');
  }
});
```

```vue
<!-- pages/settings/billing.vue -->
<script setup>
definePageMeta({
  middleware: ['permissions'],
  permission: 'read:billing'
});
</script>
```

### Multiple Middleware Chain

```vue
<script setup>
definePageMeta({
  middleware: ['auth', 'admin', 'audit-log']
});
</script>
```

## Server Middleware (SSR Protection)

### Global Server Middleware

```typescript
// server/middleware/auth.server.ts
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);

  // Skip auth routes
  if (url.pathname.startsWith('/auth/')) {
    return;
  }

  // Protect all /dashboard routes
  if (url.pathname.startsWith('/dashboard')) {
    const auth0Client = useAuth0(event);
    const session = await auth0Client.getSession();

    if (!session) {
      return sendRedirect(event, `/auth/login?returnTo=${encodeURIComponent(url.pathname)}`);
    }
  }
});
```

### Path-Specific Protection

```typescript
// server/middleware/auth.server.ts
const protectedPaths = ['/dashboard', '/profile', '/settings'];

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);

  const isProtected = protectedPaths.some(path =>
    url.pathname.startsWith(path)
  );

  if (isProtected) {
    const auth0Client = useAuth0(event);
    const session = await auth0Client.getSession();

    if (!session) {
      return sendRedirect(event, `/auth/login?returnTo=${encodeURIComponent(url.pathname)}`);
    }
  }
});
```

### Role-Based Server Protection

```typescript
// server/middleware/admin-routes.server.ts
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);

  if (url.pathname.startsWith('/admin')) {
    const auth0Client = useAuth0(event);
    const session = await auth0Client.getSession();

    if (!session) {
      return sendRedirect(event, `/auth/login?returnTo=${encodeURIComponent(url.pathname)}`);
    }

    const user = await auth0Client.getUser();
    const roles = user?.['https://my-app.com/roles'] || [];

    if (!roles.includes('admin')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: Admin access required'
      });
    }
  }
});
```

## API Route Protection

### Basic API Protection

```typescript
// server/api/user-data.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const session = await auth0Client.getSession();

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  return { data: 'protected user data' };
});
```

### Reusable Auth Guard

```typescript
// server/utils/require-auth.ts
export async function requireAuth(event: H3Event) {
  const auth0Client = useAuth0(event);
  const session = await auth0Client.getSession();

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  return session;
}
```

Use in API routes:

```typescript
// server/api/protected.ts
export default defineEventHandler(async (event) => {
  await requireAuth(event);
  return { message: 'This is protected' };
});
```

### Permission-Based API Protection

```typescript
// server/utils/require-permission.ts
export async function requirePermission(
  event: H3Event,
  permission: string
) {
  const auth0Client = useAuth0(event);
  const user = await auth0Client.getUser();

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  const permissions = user['https://my-app.com/permissions'] || [];

  if (!permissions.includes(permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Forbidden: Missing permission '${permission}'`
    });
  }

  return user;
}
```

Use in API routes:

```typescript
// server/api/billing/invoices.get.ts
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'read:billing');

  return { invoices: [] };
});
```

### Global API Middleware

```typescript
// server/middleware/api-auth.server.ts
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);

  // Protect all API routes except public ones
  if (url.pathname.startsWith('/api/')) {
    const publicRoutes = ['/api/health', '/api/version'];

    if (!publicRoutes.includes(url.pathname)) {
      const auth0Client = useAuth0(event);
      const session = await auth0Client.getSession();

      if (!session) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Unauthorized'
        });
      }
    }
  }
});
```

## Advanced Patterns

### Conditional Protection by Environment

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const config = useRuntimeConfig();

  // Skip auth in development
  if (config.public.environment === 'development') {
    return;
  }

  const user = useUser();
  if (!user.value) {
    return navigateTo(`/auth/login?returnTo=${encodeURIComponent(to.path)}`);
  }
});
```

### Subscription-Based Protection

```typescript
// middleware/subscription.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useUser();

  if (!user.value) {
    return navigateTo(`/auth/login?returnTo=${encodeURIComponent(to.path)}`);
  }

  const subscription = user.value['https://my-app.com/subscription'];

  if (!subscription || subscription.status !== 'active') {
    return navigateTo('/subscribe');
  }
});
```

### Rate Limiting Protection

```typescript
// server/middleware/rate-limit.server.ts
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const user = await auth0Client.getUser();

  if (!user) {
    return;
  }

  const userId = user.sub;
  const now = Date.now();
  const limit = rateLimitMap.get(userId);

  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(userId, {
      count: 1,
      resetAt: now + 60000 // 1 minute
    });
  } else {
    limit.count++;

    if (limit.count > 100) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests'
      });
    }
  }
});
```

### Email Verification Required

```typescript
// middleware/verified.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useUser();

  if (!user.value) {
    return navigateTo(`/auth/login?returnTo=${encodeURIComponent(to.path)}`);
  }

  if (!user.value.email_verified) {
    return navigateTo('/verify-email');
  }
});
```

## Error Pages

### 401 Unauthorized Page

```vue
<!-- pages/unauthorized.vue -->
<template>
  <div>
    <h1>Unauthorized</h1>
    <p>You need to log in to access this page.</p>
    <a :href="`/auth/login?returnTo=${encodeURIComponent($route.query.returnTo || '/')}`">
      Log In
    </a>
  </div>
</template>
```

### 403 Forbidden Page

```vue
<!-- pages/forbidden.vue -->
<template>
  <div>
    <h1>Forbidden</h1>
    <p>You don't have permission to access this resource.</p>
    <a href="/">Go Home</a>
  </div>
</template>
```

## Testing Protected Routes

### Unit Testing Middleware

```typescript
// middleware/auth.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { mockNuxtImport } from '@nuxt/test-utils/runtime';

mockNuxtImport('useUser', () => {
  return () => ({ value: null });
});

mockNuxtImport('navigateTo', () => {
  return vi.fn((path) => path);
});

describe('auth middleware', () => {
  it('should redirect to login when user is not authenticated', async () => {
    const { default: authMiddleware } = await import('./auth');
    const result = authMiddleware(
      { path: '/dashboard' },
      { path: '/' }
    );

    expect(result).toBe('/auth/login?returnTo=/dashboard');
  });
});
```

### E2E Testing with Playwright

```typescript
// test/protected-routes.spec.ts
import { test, expect } from '@playwright/test';

test('should redirect to login when accessing protected route', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('should access protected route when logged in', async ({ page }) => {
  // Login first
  await page.goto('/auth/login');
  // ... perform login
  await page.waitForURL('/');

  // Access protected route
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/dashboard');
});
```

## Security Checklist

- [ ] Never rely on `useUser()` for any security-critical decisions (it's client-side only and can be tampered with)
- [ ] Always validate sessions server-side with `useAuth0(event).getSession()` for all security-critical decisions
- [ ] Implement proper error handling (401/403 responses)
- [ ] Validate `returnTo` parameter (SDK does this automatically)
- [ ] Use HTTPS in production
- [ ] Implement rate limiting for API routes
- [ ] Log authentication failures for monitoring
- [ ] Test protected routes thoroughly
- [ ] Implement proper error pages
- [ ] Consider role/permission hierarchies

## Common Pitfalls

### ❌ Client-Side Only Protection
```typescript
// BAD - Can be bypassed
if (!useUser().value) {
  return navigateTo('/login');
}
```

### ✅ Server-Side Validation
```typescript
// GOOD - Cannot be bypassed
const session = await useAuth0(event).getSession();
if (!session) {
  throw createError({ statusCode: 401 });
}
```

### ❌ Forgetting SSR Context
```typescript
// BAD - Only protects client-side navigation
definePageMeta({ middleware: ['auth'] });
```

### ✅ Both Client and Server Protection
```typescript
// GOOD - Protects both client navigation and SSR
definePageMeta({ middleware: ['auth'] });
// PLUS server middleware in server/middleware/
```

---

# Common Patterns and Examples

Real-world patterns and complete examples for Auth0-Nuxt implementations.

## Basic App Layout

### Navigation with Conditional Login/Logout

```vue
<!-- components/AppHeader.vue -->
<script setup>
const user = useUser();
const route = useRoute();
</script>

<template>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/dashboard" v-if="user">Dashboard</a>
      <a href="/profile" v-if="user">Profile</a>

      <div class="auth-actions">
        <a v-if="user" :href="`/auth/logout`">
          Logout ({{ user.name }})
        </a>
        <a v-else :href="`/auth/login?returnTo=${encodeURIComponent(route.path)}`">
          Login
        </a>
      </div>
    </nav>
  </header>
</template>
```

### App Layout with User Avatar

```vue
<!-- layouts/default.vue -->
<script setup>
const user = useUser();
</script>

<template>
  <div class="app-layout">
    <header>
      <nav>
        <a href="/">Home</a>

        <div v-if="user" class="user-menu">
          <img :src="user.picture" :alt="user.name" />
          <span>{{ user.name }}</span>
          <a href="/auth/logout">Logout</a>
        </div>
        <a v-else href="/auth/login">Login</a>
      </nav>
    </header>

    <main>
      <slot />
    </main>
  </div>
</template>
```

## User Profile Page

```vue
<!-- pages/profile.vue -->
<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
});

const user = useUser();
</script>

<template>
  <div class="profile" v-if="user">
    <h1>Profile</h1>

    <div class="profile-info">
      <img :src="user.picture" :alt="user.name" />

      <dl>
        <dt>Name</dt>
        <dd>{{ user.name }}</dd>

        <dt>Email</dt>
        <dd>{{ user.email }}</dd>
        <dd v-if="user.email_verified" class="verified">✓ Verified</dd>
        <dd v-else class="not-verified">⚠ Not Verified</dd>

        <dt>User ID</dt>
        <dd>{{ user.sub }}</dd>

        <dt>Last Updated</dt>
        <dd>{{ new Date(user.updated_at).toLocaleString() }}</dd>
      </dl>
    </div>
  </div>
</template>
```

## Protected API Calls

### Fetching User-Specific Data

```typescript
// server/api/user/profile.get.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const user = await auth0Client.getUser();

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    });
  }

  // Fetch user profile from database
  const profile = await getUserProfile(user.sub);

  return { profile };
});
```

### Calling External API with Access Token

```typescript
// server/api/external/data.get.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const { accessToken } = await auth0Client.getAccessToken();

  const response = await $fetch('https://api.example.com/data', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return response;
});
```

### Client-Side API Call Pattern

```vue
<!-- pages/dashboard.vue -->
<script setup>
definePageMeta({
  middleware: ['auth']
});

const { data, error } = await useFetch('/api/user/profile');
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <pre v-if="data">{{ data }}</pre>
    <div v-if="error">Error: {{ error }}</div>
  </div>
</template>
```

## Role-Based UI

### Conditional Rendering by Role

```vue
<script setup>
const user = useUser();

const hasRole = (role: string) => {
  if (!user.value) return false;
  const roles = user.value['https://my-app.com/roles'] || [];
  return roles.includes(role);
};
</script>

<template>
  <div>
    <h1>Dashboard</h1>

    <div v-if="hasRole('admin')">
      <h2>Admin Panel</h2>
      <a href="/admin">Admin Dashboard</a>
    </div>

    <div v-if="hasRole('editor')">
      <h2>Editor Tools</h2>
      <a href="/editor">Content Editor</a>
    </div>

    <div>
      <h2>User Content</h2>
      <p>All users see this</p>
    </div>
  </div>
</template>
```

### Composable for Role Checking

```typescript
// composables/useRoles.ts
export const useRoles = () => {
  const user = useUser();

  const hasRole = (role: string) => {
    if (!user.value) return false;
    const roles = user.value['https://my-app.com/roles'] || [];
    return roles.includes(role);
  };

  const hasAnyRole = (roles: string[]) => {
    return roles.some(role => hasRole(role));
  };

  const hasAllRoles = (roles: string[]) => {
    return roles.every(role => hasRole(role));
  };

  return {
    hasRole,
    hasAnyRole,
    hasAllRoles
  };
};
```

Usage:

```vue
<script setup>
const { hasRole, hasAnyRole } = useRoles();
</script>

<template>
  <button v-if="hasRole('admin')">Delete</button>
  <button v-if="hasAnyRole(['admin', 'moderator'])">Edit</button>
</template>
```

## Multi-Tenant Applications

### Tenant Selection After Login

```typescript
// server/api/auth/callback.get.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const { appState } = await auth0Client.completeInteractiveLogin(
    new URL(event.node.req.url, useRuntimeConfig().auth0.appBaseUrl)
  );

  const user = await auth0Client.getUser();
  const tenants = user?.['https://my-app.com/tenants'] || [];

  // If user has multiple tenants, redirect to tenant selection
  if (tenants.length > 1) {
    return sendRedirect(event, '/select-tenant');
  }

  // Single tenant, set and redirect
  if (tenants.length === 1) {
    // Store tenant in session or cookie
    setCookie(event, 'tenant-id', tenants[0]);
  }

  return sendRedirect(event, appState?.returnTo || '/');
});
```

### Tenant-Based Data Isolation

```typescript
// server/api/data.get.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const user = await auth0Client.getUser();

  if (!user) {
    throw createError({ statusCode: 401 });
  }

  const tenantId = getCookie(event, 'tenant-id');

  if (!tenantId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No tenant selected'
    });
  }

  // Verify user has access to this tenant
  const tenants = user['https://my-app.com/tenants'] || [];
  if (!tenants.includes(tenantId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Access denied to this tenant'
    });
  }

  return getTenantData(tenantId);
});
```

## Organization Support

### Organization Login

```vue
<!-- pages/org/[organization]/login.vue -->
<script setup>
const route = useRoute();
const organization = route.params.organization;
</script>

<template>
  <a :href="`/auth/login?organization=${organization}`">
    Login to {{ organization }}
  </a>
</template>
```

### Custom Login Handler with Organization

```typescript
// server/routes/auth/org-login.get.ts
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const organization = query.organization as string;

  if (!organization) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Organization parameter required'
    });
  }

  const auth0Client = useAuth0(event);
  const authUrl = await auth0Client.startInteractiveLogin({
    authorizationParams: {
      organization: organization
    },
    appState: {
      returnTo: query.returnTo || '/'
    }
  });

  return sendRedirect(event, authUrl.href);
});
```

## Impersonation Support

### Start Impersonation

```typescript
// server/api/admin/impersonate.post.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const admin = await auth0Client.getUser();

  if (!admin) {
    throw createError({ statusCode: 401 });
  }

  // Check admin permission
  const permissions = admin['https://my-app.com/permissions'] || [];
  if (!permissions.includes('impersonate:users')) {
    throw createError({ statusCode: 403 });
  }

  const body = await readBody(event);
  const { userId } = body;

  // Store impersonation in session
  const session = await auth0Client.getSession();
  if (session) {
    session.impersonating = {
      adminId: admin.sub,
      userId: userId
    };
  }

  return { success: true };
});
```

### End Impersonation

```typescript
// server/api/admin/stop-impersonate.post.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const session = await auth0Client.getSession();

  if (session?.impersonating) {
    delete session.impersonating;
  }

  return { success: true };
});
```

## Progressive Enhancement

### Login Link with Fallback

```vue
<template>
  <!-- Progressive enhancement: JavaScript-free login -->
  <a href="/auth/login" @click.prevent="handleLogin">
    Login
  </a>
</template>

<script setup>
const handleLogin = async () => {
  // Enhanced behavior with JavaScript
  const returnTo = useRoute().fullPath;
  await navigateTo(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
};
</script>
```

## Error Handling

### Global Error Handler

```typescript
// server/middleware/error-handler.server.ts
export default defineEventHandler(async (event) => {
  try {
    // Continue to next middleware/handler
  } catch (error) {
    console.error('Authentication error:', error);

    if (error.statusCode === 401) {
      return sendRedirect(event, '/auth/login');
    }

    throw error;
  }
});
```

### Client-Side Error Boundary

```vue
<!-- error.vue -->
<script setup>
const error = useError();
</script>

<template>
  <div v-if="error.statusCode === 401">
    <h1>Authentication Required</h1>
    <a href="/auth/login">Log In</a>
  </div>

  <div v-else-if="error.statusCode === 403">
    <h1>Access Denied</h1>
    <p>You don't have permission to access this resource.</p>
  </div>

  <div v-else>
    <h1>Error {{ error.statusCode }}</h1>
    <p>{{ error.message }}</p>
  </div>
</template>
```

## Loading States

### Auth Loading Component

```vue
<!-- components/AuthGuard.vue -->
<script setup>
const user = useUser();
const loading = ref(true);

onMounted(() => {
  // Give time for SSR hydration
  setTimeout(() => {
    loading.value = false;
  }, 100);
});
</script>

<template>
  <div v-if="loading">
    Loading...
  </div>
  <div v-else-if="user">
    <slot />
  </div>
  <div v-else>
    <p>You need to log in</p>
    <a href="/auth/login">Log In</a>
  </div>
</template>
```

## Logging and Monitoring

### Audit Log Middleware

```typescript
// server/middleware/audit-log.server.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const user = await auth0Client.getUser();

  if (user) {
    console.log({
      timestamp: new Date().toISOString(),
      userId: user.sub,
      path: event.node.req.url,
      method: event.node.req.method,
      ip: getRequestIP(event);
    });
  }
});
```

## Token Refresh Handling

```typescript
// server/api/sensitive-data.get.ts
export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);

  try {
    const { accessToken } = await auth0Client.getAccessToken();

    return await $fetch('https://api.example.com/sensitive', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  } catch (error) {
    // Token might be expired, SDK handles refresh automatically
    // If refresh fails, session is invalid
    if (error.statusCode === 401) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Session expired, please log in again'
      });
    }
    throw error;
  }
});
```

---

# Custom Session Stores for Auth0-Nuxt

This guide covers implementing custom session stores for stateful session management in Auth0-Nuxt.

## When to Use Custom Session Stores

Use custom session stores when:
- Session data exceeds cookie size limits (4KB per chunk)
- Running in distributed/load-balanced environments
- Storing sensitive PII that shouldn't be in cookies
- Need centralized session management across services
- Implementing advanced session features (expiration, revocation)

## Stateless vs Stateful Sessions

### Stateless (Default)
- **Storage**: Encrypted, chunked cookies
- **Advantages**: Simple, no infrastructure, scales horizontally
- **Disadvantages**: 4KB size limit per chunk, data in browser
- **Use When**: Sessions are small, simple deployments

### Stateful (Custom Store)
- **Storage**: Redis, MongoDB, PostgreSQL, etc.
- **Advantages**: Unlimited size, centralized control, revocable
- **Disadvantages**: Requires infrastructure, network latency
- **Use When**: Large sessions, distributed systems, compliance requirements

## SessionStore Interface

All custom stores must implement this interface:

```typescript
interface SessionStore {
  set(identifier: string, stateData: StateData): Promise<void>;
  get(identifier: string): Promise<StateData | undefined>;
  delete(identifier: string): Promise<void>;
  deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void>;
}
```

## Redis Session Store

Complete implementation using Nitro's unstorage layer:

### 1. Create Session Store Factory

```typescript
// server/utils/session-store-factory.ts
import type { SessionStore, StateData, StoreOptions } from '@auth0/auth0-nuxt';
import type { Storage } from 'unstorage';

export class RedisSessionStore implements SessionStore {
  readonly #store: Storage<StateData>;

  constructor(store: Storage<StateData>) {
    this.#store = store;
  }

  async set(identifier: string, stateData: StateData): Promise<void> {
    await this.#store.setItem(identifier, stateData);
  }

  async get(identifier: string): Promise<StateData | undefined> {
    const result = await this.#store.getItem<StateData>(identifier);
    // Redis returns null for missing keys, map to undefined
    return result ?? undefined;
  }

  async delete(identifier: string): Promise<void> {
    await this.#store.removeItem(identifier);
  }

  async deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void> {
    // Extract session ID from logout token claims
    const sid = claims.sid;

    if (sid) {
      // Delete session by session ID
      await this.delete(sid);
    }
  }
}

export default function getSessionStoreInstance() {
  const storage = useStorage<StateData>('redis');
  return new RedisSessionStore(storage);
}
```

### 2. Configure Module

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    ['@auth0/auth0-nuxt', {
      sessionStoreFactoryPath: '~/server/utils/session-store-factory.ts'
    }]
  ],
  runtimeConfig: {
    auth0: {
      domain: '',
      clientId: '',
      clientSecret: '',
      sessionSecret: '',
      appBaseUrl: 'http://localhost:3000',
    },
  },
});
```

### 3. Configure Nitro Storage

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    storage: {
      redis: {
        driver: 'redis',
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      }
    }
  }
});
```

### 4. Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

## MongoDB Session Store

Implementation using Nitro's MongoDB driver:

```typescript
// server/utils/session-store-factory.ts
import type { SessionStore, StateData, StoreOptions } from '@auth0/auth0-nuxt';
import type { Storage } from 'unstorage';

export class MongoSessionStore implements SessionStore {
  readonly #store: Storage<StateData>;

  constructor(store: Storage<StateData>) {
    this.#store = store;
  }

  async set(identifier: string, stateData: StateData): Promise<void> {
    await this.#store.setItem(identifier, stateData);
  }

  async get(identifier: string): Promise<StateData | undefined> {
    const result = await this.#store.getItem<StateData>(identifier);
    return result ?? undefined;
  }

  async delete(identifier: string): Promise<void> {
    await this.#store.removeItem(identifier);
  }

  async deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void> {
    const sid = claims.sid;
    if (sid) {
      await this.delete(sid);
    }
  }
}

export default function getSessionStoreInstance() {
  const storage = useStorage<StateData>('mongodb');
  return new MongoSessionStore(storage);
}
```

### MongoDB Nitro Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    storage: {
      mongodb: {
        driver: 'mongodb',
        connectionString: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        databaseName: 'auth0_sessions',
        collectionName: 'sessions',
      }
    }
  }
});
```

## PostgreSQL Session Store

Using a custom implementation with pg library:

```typescript
// server/utils/session-store-factory.ts
import type { SessionStore, StateData, StoreOptions } from '@auth0/auth0-nuxt';
import { Pool } from 'pg';

export class PostgresSessionStore implements SessionStore {
  readonly #pool: Pool;

  constructor() {
    this.#pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'auth0_sessions',
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    });
  }

  async set(identifier: string, stateData: StateData): Promise<void> {
    const query = `
      INSERT INTO sessions (id, data, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '1 day')
      ON CONFLICT (id) DO UPDATE SET data = $2, expires_at = NOW() + INTERVAL '1 day'
    `;
    await this.#pool.query(query, [identifier, JSON.stringify(stateData)]);
  }

  async get(identifier: string): Promise<StateData | undefined> {
    const query = `
      SELECT data FROM sessions
      WHERE id = $1 AND expires_at > NOW()
    `;
    const result = await this.#pool.query(query, [identifier]);

    if (result.rows.length === 0) {
      return undefined;
    }

    return JSON.parse(result.rows[0].data);
  }

  async delete(identifier: string): Promise<void> {
    await this.#pool.query('DELETE FROM sessions WHERE id = $1', [identifier]);
  }

  async deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void> {
    const sid = claims.sid;
    if (sid) {
      await this.delete(sid);
    }
  }
}

export default function getSessionStoreInstance() {
  return new PostgresSessionStore();
}
```

### PostgreSQL Schema

```sql
CREATE TABLE sessions (
  id VARCHAR(255) PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

## Back-Channel Logout Implementation

Proper implementation of `deleteByLogoutToken`:

```typescript
async deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void> {
  // Claims from the logout_token JWT
  const sid = claims.sid; // Session ID
  const sub = claims.sub; // User ID

  if (sid) {
    // Delete specific session by session ID
    await this.delete(sid);
  } else if (sub) {
    // Delete all sessions for the user
    // Implementation depends on your storage
    // This example assumes you track sessions by user
    await this.deleteAllForUser(sub);
  }
}
```

## Session Expiration

Implement TTL (Time-To-Live) in your session store:

```typescript
// Redis with TTL
async set(identifier: string, stateData: StateData): Promise<void> {
  await this.#store.setItem(identifier, stateData, {
    ttl: 86400, // 24 hours in seconds
  });
}

// PostgreSQL with automatic cleanup
// Run this periodically (cronjob or Nitro task)
async cleanup(): Promise<void> {
  await this.#pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
}
```

## Testing Your Session Store

```typescript
// test/session-store.test.ts
import { describe, it, expect } from 'vitest';
import getSessionStoreInstance from '~/server/utils/session-store-factory';

describe('Session Store', () => {
  const store = getSessionStoreInstance();
  const testData = {
    user: { sub: 'test-user' },
    idToken: 'test-token',
    tokenSets: [],
    internal: { sid: 'test-session', createdAt: Date.now() },
  };

  it('should store and retrieve session', async () => {
    await store.set('test-id', testData);
    const result = await store.get('test-id');
    expect(result).toEqual(testData);
  });

  it('should delete session', async () => {
    await store.set('test-id-2', testData);
    await store.delete('test-id-2');
    const result = await store.get('test-id-2');
    expect(result).toBeUndefined();
  });

  it('should handle logout token', async () => {
    await store.set('test-id-3', testData);
    await store.deleteByLogoutToken({ sid: 'test-session' });
    const result = await store.get('test-id-3');
    expect(result).toBeUndefined();
  });
});
```

## Performance Considerations

1. **Connection Pooling**: Always use connection pools for database connections
2. **Caching**: Consider caching frequently accessed sessions
3. **Indexing**: Add indexes on session ID and expiration columns
4. **TTL**: Implement automatic expiration to prevent storage bloat
5. **Serialization**: Use efficient serialization (JSON, MessagePack)

## Security Considerations

1. **Encryption**: Session data is already encrypted by Auth0-Nuxt
2. **Access Control**: Restrict database access to your application only
3. **Network Security**: Use TLS for database connections
4. **Secrets Management**: Store credentials in environment variables
5. **Audit Logging**: Log session access for compliance

## Migration from Stateless to Stateful

1. Deploy stateful configuration alongside stateless
2. New sessions use stateful store
3. Old cookie-based sessions continue working
4. Gradually phase out cookie sessions as they expire
5. Monitor cookie size metrics
