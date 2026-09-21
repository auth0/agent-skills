
# Auth0 TanStack Start Integration

Add authentication to a TanStack Start (React) application using `@auth0/auth0-tanstack-start-react`. This is a **Regular Web Application** SDK: login, callback, and logout are handled on the server, and the session lives in an encrypted, HTTP-only JWE cookie. Access, refresh, and ID tokens never reach the browser.

## Prerequisites

- A TanStack Start (React) app — `@tanstack/react-start`, `@tanstack/react-router`, and `@tanstack/start-server-core` `^1.0.0`
- React 18 or 19 (`react` and `react-dom` `^18.0.0` or `^19.0.0`)
- Node.js 20+ (current LTS; the SDK itself declares no `engines` constraint)
- An Auth0 account and a **Regular Web Application**. If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`) — see the Setup Guide section below.

## When NOT to Use

- **Browser-only React SPA (Vite/CRA, or a TanStack Router SPA)** — use `@auth0/auth0-react`. This SDK is server-rendered only; SPA and TanStack Start SPA mode are out of scope.
- **Stateless JWT API with no login UI** — use a resource-server SDK (`@auth0/auth0-api-js`, `express-oauth2-jwt-bearer`, etc.). API-only deployments are out of scope for this SDK.
- **Next.js** — use `@auth0/nextjs-auth0`.
- **Nuxt / Vue / Angular / other frameworks** — use the framework-specific Auth0 SDK.

## Package structure

The SDK is one package with seven entry points. The bundle boundary is enforced by the `exports` map, so server code never enters the client bundle. Importing from the right entry point is the single most important thing to get right in this SDK.

| Import path | Contents |
|---|---|
| `@auth0/auth0-tanstack-start-react` (root, resolves to `/client`) | Provider, hooks, components, route guards |
| `@auth0/auth0-tanstack-start-react/client` | Same as the root import |
| `@auth0/auth0-tanstack-start-react/server` | `auth0Server()` factory, session/token helpers, auth-route handlers, server-function middleware, enterprise features |
| `@auth0/auth0-tanstack-start-react/server/middleware` | The request middleware only, in a client-safe module — import this one (never the `/server` barrel) in `start.ts` |
| `@auth0/auth0-tanstack-start-react/testing` | Test utilities |
| `@auth0/auth0-tanstack-start-react/errors` | Typed error classes |
| `@auth0/auth0-tanstack-start-react/types` | TypeScript types |

**API style — free functions, not instance methods.** Server helpers take your `auth0` instance as the first argument: `getSession(auth0)`, `getAccessToken(auth0)`. This differs from `@auth0/nextjs-auth0`, where you call `auth0.getSession()`. If you are migrating, the rename is mechanical.

## Quick Start Workflow

### 1. Install the SDK

```bash
npm install @auth0/auth0-tanstack-start-react
```

### 2. Configure Auth0 and environment

**For automated setup with the Auth0 CLI**, see the Setup Guide section below for the complete script (it asks for confirmation before writing any env file).

**For manual setup**, create a `.env` file at the project root with your Regular Web Application credentials. These are read on the **server**, so never prefix them with `VITE_` (that would expose them to the browser).

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
# Encrypts the session cookie; must be at least 32 bytes. Generate with: openssl rand -hex 32
AUTH0_SECRET=replace-with-a-32-byte-random-value
APP_BASE_URL=http://localhost:3000
```

**Important:** add `.env` to `.gitignore` so credentials are never committed.

In the Auth0 application settings, add:
- **Allowed Callback URLs:** `http://localhost:3000/auth/callback`
- **Allowed Logout URLs:** `http://localhost:3000`

### 3. Create the server Auth0 instance

Create one Auth0 instance for the whole app. `auth0Server()` reads the environment variables from step 2.

```typescript
// src/auth.server.ts
import { auth0Server } from '@auth0/auth0-tanstack-start-react/server'

// Reads AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET, and
// APP_BASE_URL from the environment. Pass options to override any of them.
export const auth0 = auth0Server()
```

### 4. Register the request middleware

`src/start.ts` is the global entry point. TanStack Start compiles it into **both** the client and server bundles, and import-protection forbids it from statically importing any server-only module. Import `auth0Middleware` from the dedicated `/server/middleware` entry point (never the `/server` barrel), and call it with **no arguments** so it reads its own config from the environment.

```typescript
// src/start.ts
import { createStart } from '@tanstack/react-start'
import { auth0Middleware } from '@auth0/auth0-tanstack-start-react/server/middleware'

export const startInstance = createStart(() => ({
  requestMiddleware: [auth0Middleware()],
}))
```

The middleware serves the `/auth/*` endpoints (`login`, `callback`, `logout`, `profile`, `backchannel-logout`) automatically and attaches `context.auth0` to every other request. You do not add route files for the auth endpoints.

### 5. Wire auth state into the router

Seed the router context with the SDK sentinel, and set `auth0BeforeLoad()` on the root route so `context.auth0` is populated for the whole route tree. Wrap the app in `Auth0Provider` so hooks and components can read the state.

```typescript
// src/router.tsx — the export MUST be named getRouter (a TanStack Start convention)
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { auth0RouterContext } from '@auth0/auth0-tanstack-start-react/client'
import type { Auth0RouterContext } from '@auth0/auth0-tanstack-start-react/types'
import { routeTree } from './routeTree.gen'

export interface RouterContext {
  auth0: Auth0RouterContext
}

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    // Seed context.auth0 with the SDK sentinel; auth0BeforeLoad replaces it
    // with the real (server-resolved) auth state at runtime.
    context: { auth0: auth0RouterContext } satisfies RouterContext,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

```tsx
// src/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Auth0Provider, auth0BeforeLoad } from '@auth0/auth0-tanstack-start-react/client'
import type { RouterContext } from '../router'

export const Route = createRootRouteWithContext<RouterContext>()({
  // Populates context.auth0 for the whole route tree. On the server it reads the
  // session auth0Middleware resolved; on the client it reads the hydrated cache.
  beforeLoad: auth0BeforeLoad(),
  component: () => (
    <Auth0Provider>
      <Outlet />
    </Auth0Provider>
  ),
})
```

> The snippet above shows only the Auth0 wiring. A real TanStack Start root also
> renders the document shell (`<html>`/`<body>` with `<HeadContent />` and
> `<Scripts />`). Wrap the existing shell's `<Outlet />` in `<Auth0Provider>`
> rather than replacing the shell.

### 6. Add sign-in / sign-out UI

There is no drop-in sign-in button: login is a full-page redirect to Auth0 Universal Login. Start it with `useLogin()` (which accepts an optional `returnTo`), and end it with `useLogout()`. `SignedIn` / `SignedOut` render conditionally on auth state.

```tsx
// src/routes/index.tsx
import {
  useUser,
  useLogin,
  useLogout,
  SignedIn,
  SignedOut,
} from '@auth0/auth0-tanstack-start-react/client'

function Nav() {
  const user = useUser()
  const login = useLogin()
  const logout = useLogout()

  return (
    <nav>
      <SignedIn>
        <span>Hi {user?.name}</span>
        <button onClick={() => logout()}>Log out</button>
      </SignedIn>
      <SignedOut>
        <button onClick={() => login('/dashboard')}>Log in</button>
      </SignedOut>
    </nav>
  )
}
```

`useLogin` and `useLogout` perform a full browser navigation (not a TanStack Router transition), because the `/auth/*` routes are handled on the server and the browser must reload to pick up the new session cookie. A plain link works too: `<a href="/auth/login">Log in</a>`.

### 7. Protect a route

Guard a route in its `beforeLoad` with `requireAuth`. Unauthenticated users are redirected to the login route, preserving the intended destination as `returnTo`.

```tsx
// src/routes/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth, useUser } from '@auth0/auth0-tanstack-start-react/client'

export const Route = createFileRoute('/dashboard')({
  // Protected server-side: unauthenticated users are redirected to /auth/login
  // before any HTML is sent.
  beforeLoad: requireAuth({ returnTo: '/dashboard' }),
  component: Dashboard,
})

function Dashboard() {
  const user = useUser()
  return <h1>Welcome, {user?.name}</h1>
}
```

### 8. Run and test

```bash
npm run dev
```

Visit `http://localhost:3000`, click **Log in**, complete Universal Login, and confirm you land back on the protected route with a session.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Importing `auth0Middleware` from `/server` in `start.ts` | Import from `/server/middleware` — the `/server` barrel pulls server-only code into the client-compiled `start.ts` and import-protection rejects it. |
| Passing your `auth.server` instance to `auth0Middleware()` | Call `auth0Middleware()` with **no arguments**. It reads its own config from the environment; passing the instance reintroduces a server-only import into `start.ts`. |
| Expecting `auth0Server({ ... })` options to change the `/auth/*` endpoints | `auth0Middleware()` runs on its own env-only config, so `trustProxy`, a `routes` override, an `appBaseUrl` allow-list, or `excludedClaims` must reach it too — set them in the environment, or pass them to **both** `auth0Server(...)` and `auth0Middleware(...)`. |
| Router export not named `getRouter` | TanStack Start requires the router module to export a function named exactly `getRouter`. |
| Prefixing server env vars with `VITE_` | `AUTH0_*` and `APP_BASE_URL` are server-side; a `VITE_` prefix leaks them to the browser bundle. |
| `AUTH0_SECRET` missing or under 32 bytes | Generate with `openssl rand -hex 32`; it encrypts the session cookie. |
| `AUTH0_DOMAIN` includes `https://` | Use the bare domain, e.g. `your-tenant.auth0.com`, with no scheme. |
| App created as SPA type in Auth0 | Must be a **Regular Web Application** (it uses a client secret and server-side sessions). |
| Callback URL not registered | Add `http://localhost:3000/auth/callback` to Allowed Callback URLs, and `http://localhost:3000` to Allowed Logout URLs. |
| Trying to read a token in the browser | Tokens stay on the server. Call a server function that reads the token and returns only the data (see the Integration Patterns section). |

## Related Capabilities

- Auth0 account setup — run the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Migrating from another auth provider → ask for migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- B2B multi-tenancy → ask for Organizations (feature:organizations)
- Managing Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**Setup files:**
- `src/auth.server.ts` — `export const auth0 = auth0Server()`
- `src/start.ts` — `requestMiddleware: [auth0Middleware()]` (import from `/server/middleware`)
- `src/router.tsx` — seed `context: { auth0: auth0RouterContext }`, export `getRouter`
- `src/routes/__root.tsx` — `beforeLoad: auth0BeforeLoad()` + wrap in `<Auth0Provider>`

**Client hooks (`/client`):** `useAuth0`, `useUser`, `useOrg`, `useLogin`, `useLogout`

**Client components (`/client`):** `SignedIn`, `SignedOut`, `HasOrg`, `AuthReady`, `AuthLoading`

**Route guards (`/client`):** `requireAuth`, `requireOrg`; imperative `login` / `logout` for `beforeLoad`/loaders

**Server helpers (`/server`):** `getSession`, `getAccessToken`, `getTokenSet`, `createFetcher`; middleware `requireAuthMiddleware`, `requireOrgMiddleware`, `withApiAuth`, `withApiScopes`, `withApiOrg`, `withApiClaimEquals`, `withApiClaimIncludes`

## References

- [Auth0 TanStack Start quickstart](https://auth0.com/docs/quickstart/webapp/tanstack-start)
- [SDK GitHub repository](https://github.com/auth0/auth0-tanstack-start-react)
- [SDK examples & enterprise walkthroughs](https://github.com/auth0/auth0-tanstack-start-react/blob/main/EXAMPLES.md)
- [TanStack Start documentation](https://tanstack.com/start)

---

# Auth0 TanStack Start Integration Patterns

Server-side and client-side auth patterns for TanStack Start Regular Web Applications. All of these assume the four setup files from the Integration section are in place.

## Protect routes

Use a pathless layout route so a single guard covers a whole subtree. `requireAuth` redirects unauthenticated users to the login route and preserves the destination as `returnTo`.

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@auth0/auth0-tanstack-start-react/client'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: requireAuth({ returnTo: '/dashboard' }),
})
```

`requireOrg('org_xyz')` guards a route so only members of a given organization can enter. For roles or permissions, check the exact claim on the server with `withApiClaimIncludes` or `withApiClaimEquals` (see "Protect server functions and JSON APIs" below).

**How guards read auth state.** Every guard reads `context.auth0`, which carries a `status` field:

| Status | Meaning | Guard behavior |
|---|---|---|
| `resolved` | Auth state is known — the normal case, since `auth0Middleware` resolves it on the server before the page is sent. | Redirects only if the user is not authenticated. |
| `loading` | Auth state is still being determined. | Waits without redirecting. |
| `unresolved` | The context was never populated. | Treats the request as unauthenticated and redirects to login. |

Because an unpopulated context redirects rather than passing, a misconfiguration **fails closed**. `unresolved` almost always means `auth0Middleware` is not registered in `start.ts`, or `Auth0Provider` / `auth0BeforeLoad()` is not wired into the root route.

## Read auth state in components

The client hooks and components read the auth state resolved on the server.

| Hook | Purpose |
|---|---|
| `useAuth0()` | Returns `{ user, isAuthenticated, status, isLoading }`. |
| `useUser()` | Shorthand for the current `user`, or `undefined`. |
| `useOrg()` | Returns the current `Organization` from the `org_id` / `org_name` claims, or `undefined`. |
| `useLogin()` | Returns a function that redirects to the login route, with an optional `returnTo`. |
| `useLogout()` | Returns a function that clears the client cache and redirects to logout. |

| Component | Purpose |
|---|---|
| `SignedIn` | Renders its children only when the user is authenticated. |
| `SignedOut` | Renders its children only when the user is not authenticated. |
| `HasOrg` | Renders its children when the user's `org_id` matches, with an optional `fallback`. |
| `AuthReady` | Renders its children once `status` is `resolved`. |
| `AuthLoading` | Renders its children while `status` is `loading`. |

```tsx
import { HasOrg } from '@auth0/auth0-tanstack-start-react/client'

function AdminPanel() {
  return (
    <HasOrg orgId="org_admins" fallback={<p>You do not have access.</p>}>
      <SecretControls />
    </HasOrg>
  )
}
```

## Fetch protected data

Tokens stay on the server, so the browser never holds an access token. To fetch protected data, call a server function that reads the token on the server and returns only the data.

A server function reachable from the client route tree must not statically import a server-only module. Keep the server-only logic (which imports your `auth.server` instance) in a separate `*.server.ts` file, and load it with a dynamic `import()` inside `.handler()`, which runs only on the server.

```typescript
// src/data.server.ts — server-only logic
import { getAccessToken } from '@auth0/auth0-tanstack-start-react/server'
import { auth0 } from './auth.server'

export async function loadInvoices() {
  const { token } = await getAccessToken(auth0)
  const res = await fetch('https://api.example.com/invoices', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}
```

```typescript
// src/data-fns.ts — imported by components; imports nothing server-only
import { createServerFn } from '@tanstack/react-start'

export const getInvoices = createServerFn({ method: 'GET' }).handler(async () => {
  const { loadInvoices } = await import('./data.server')
  return loadInvoices()
})
```

```tsx
// component: call the server function; the token never reaches the browser
import { useServerFn } from '@tanstack/react-start'
import { getInvoices } from '../data-fns'

function Invoices() {
  const load = useServerFn(getInvoices)
  // Call load() from an event or effect, then render the returned data.
}
```

`createFetcher` is a convenient alternative for several calls to the same API. It returns a `fetch`-compatible function that attaches the current access token as a Bearer header on every request.

```typescript
import { createFetcher } from '@auth0/auth0-tanstack-start-react/server'
import { auth0 } from './auth.server'

export async function loadInvoices() {
  const fetcher = createFetcher(auth0, { audience: 'https://api.example.com' })
  const res = await fetcher('https://api.example.com/invoices')
  return res.json()
}
```

## Protect server functions and JSON APIs

Server functions attach `context.auth0` through middleware. Use `requireAuthMiddleware` for flows that should redirect, and the API middleware family for JSON APIs that should return HTTP errors. The middleware attaches `user`, `isAuthenticated`, `status`, and `isLoading` — it does **not** carry tokens. Read tokens with `getSession(auth0)` or `getAccessToken(auth0)`.

```typescript
import { createServerFn } from '@tanstack/react-start'
import {
  requireAuthMiddleware,
  withApiScopes,
} from '@auth0/auth0-tanstack-start-react/server'
import { auth0 } from './auth.server'

// Redirect flow: unauthenticated users are sent to the login route.
const getDashboard = createServerFn()
  .middleware([requireAuthMiddleware(auth0)])
  .handler(({ context }) => ({ userId: context.auth0.user?.sub }))

// JSON API flow: a missing scope throws ForbiddenError (HTTP 403).
const getReports = createServerFn()
  .middleware([withApiScopes(auth0, ['read:reports'])])
  .handler(() => ({ reports: [] }))
```

| Middleware | Behavior when the check fails |
|---|---|
| `auth0FunctionMiddleware(auth0)` | Never blocks. Attaches `context.auth0`, where `user` may be `undefined`. |
| `requireAuthMiddleware(auth0)` | Redirects to the login route. |
| `requireOrgMiddleware(auth0, orgId)` | Redirects to the login route with the organization parameter. |
| `withApiAuth(auth0)` | Throws `UnauthorizedError` (HTTP 401). |
| `withApiScopes(auth0, scopes, options?)` | Throws `ForbiddenError` (HTTP 403) when the access token is missing any scope. Pass `options.audience` to check a specific API's token. |
| `withApiOrg(auth0, orgId)` | Throws `ForbiddenError` when `org_id` does not match. |
| `withApiClaimEquals(auth0, claim, value)` | Throws `ForbiddenError` when the claim does not equal the value. |
| `withApiClaimIncludes(auth0, claim, ...values)` | Throws `ForbiddenError` when the array claim includes none of the values. |

## Read the session on the server

`getSession(auth0)` returns the current session on the server, or `null` when there is none. It holds the user identity claims (`session.user`) alongside token data. Reach for it in any server function, loader, or route handler that needs the signed-in user.

```typescript
import { getSession } from '@auth0/auth0-tanstack-start-react/server'
import { createServerFn } from '@tanstack/react-start'
import { auth0 } from './auth.server'

const getProfile = createServerFn().handler(async () => {
  const session = await getSession(auth0)
  if (!session) throw new Error('Unauthorized')
  return { sub: session.user.sub, email: session.user.email }
})
```

If you only need the user: `const user = (await getSession(auth0))?.user`.

## Organizations

`useOrg()` reads the current organization and `requireOrg('org_x')` guards routes by organization. The two flows that require re-authentication — switching organizations and accepting an invitation — return the Auth0 authorization URL, and the caller issues the redirect.

```typescript
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { switchOrg, acceptOrgInvitation } from '@auth0/auth0-tanstack-start-react/server'
import { auth0 } from './auth.server'

// Both return the Auth0 authorization URL. `redirect({ href })` takes a string,
// so stringify the returned URL object with .toString().

// Switch to a different organization.
export const switchOrganization = createServerFn({ method: 'POST' })
  .inputValidator((organization: string) => organization)
  .handler(async ({ data: organization }) => {
    const url = await switchOrg(auth0, { organization, returnTo: '/' })
    throw redirect({ href: url.toString() })
  })

// Accept an invitation. organization + invitation come from the invite link's
// query params, e.g. /invite?organization=org_abc&invitation=inv_xyz.
export const acceptInvitation = createServerFn({ method: 'POST' })
  .inputValidator((data: { organization: string; invitation: string }) => data)
  .handler(async ({ data }) => {
    const url = await acceptOrgInvitation(auth0, data)
    throw redirect({ href: url.toString() })
  })
```

The existing session is replaced atomically when the user completes the new login, so the old organization session cannot leak into the new one.

**`org_id` reflects the session, not live membership.** The `org_id` in the session is fixed at login. If the user's membership or roles change on the Auth0 side afterward, the session does not update on its own until it is refreshed (via `switchOrg` / `acceptOrgInvitation` or re-authentication). For decisions that must reflect the latest membership, verify against Auth0 at that moment rather than trusting the session claim.

## Step-up MFA from a guard

Every login redirect accepts `authorizationParams`, which the login route forwards to Auth0. A `beforeLoad` can request a stronger login — for example the multi-factor `acr_values` — when a sensitive route needs a fresh MFA. The imperative `login()` throws the redirect for you.

```typescript
// src/routes/_authenticated/settings.tsx
import { createFileRoute } from '@tanstack/react-router'
import { login } from '@auth0/auth0-tanstack-start-react/client'

const MFA_ACR = 'http://schemas.openid.net/pape/policies/2007/06/multi-factor'

export const Route = createFileRoute('/_authenticated/settings')({
  beforeLoad: ({ context }) => {
    const amr = context.auth0.user?.amr
    const usedMfa = Array.isArray(amr) && amr.includes('mfa')
    if (context.auth0.isAuthenticated && !usedMfa) {
      login(context, {
        returnTo: '/settings',
        authorizationParams: { acr_values: MFA_ACR },
      })
    }
  },
})
```

Gate only on a claim you know the login will set: if the tenant never emits the claim you inspect (here, `amr`), or requests an `acr_values` Auth0 cannot satisfy, the guard loops back to login forever. Confirm the tenant issues the claim before gating a route on it. `requireAuth`, `requireOrg`, the server `requireAuthMiddleware` / `requireOrgMiddleware`, and `login()` / `useLogin()` all take the same `authorizationParams` option.

## Running behind a reverse proxy

With a single **static** `appBaseUrl` there is nothing to configure. The SDK builds the `redirect_uri` from `appBaseUrl` plus the route paths and reads no request headers to do it, so it is correct behind a proxy that terminates TLS. Keep `appBaseUrl` as the public URL the browser uses, not the address your server listens on.

Two configurations work out the origin **per request** and therefore need the forwarded headers: an `appBaseUrl` **allow-list** (staging/preview deployments) and a `domain` **resolver** (Multiple Custom Domains). Behind a TLS-terminating proxy, enable `trustProxy` so the SDK reads `X-Forwarded-Host` and `X-Forwarded-Proto`:

```typescript
export const auth0 = auth0Server({
  appBaseUrl: ['https://app.example.com', 'https://staging.example.com'],
  trustProxy: true, // or set AUTH0_TRUST_PROXY=true in the environment
})
```

Because `auth0Middleware()` runs on its own env-only config, the simplest way to make `trustProxy` (and any `routes` / `appBaseUrl` allow-list / `excludedClaims`) apply to the `/auth/*` endpoints is the `AUTH0_TRUST_PROXY=true` environment variable, which both read. Otherwise pass the option in both places: `auth0Server({ trustProxy: true })` **and** `auth0Middleware({ trustProxy: true })`.

**Security:** only enable `trustProxy` behind a proxy you control that overwrites `X-Forwarded-*` on every request. If your server can be reached directly, a client could forge those headers. Auth0's Allowed Callback URLs remain a backstop — a login cannot complete on an origin you never registered.

**Multiple Custom Domains (MCD):** to serve several branded custom domains fronting the same tenant, pass a function to `domain` that maps each request host to its Auth0 custom domain (from a fixed, trusted table — never from arbitrary request input). This mode almost always needs `trustProxy: true`, and every custom domain's callback must be registered in the Auth0 Dashboard.

## Session configuration and stateful store

Pass `sessionConfiguration` to `auth0Server()` to control the cookie and its lifetime:

```typescript
export const auth0 = auth0Server({
  sessionConfiguration: {
    rolling: true,
    absoluteDuration: 60 * 60 * 24 * 7, // seven days, in seconds
    inactivityDuration: 60 * 60 * 24, // one day, in seconds
    cookie: { name: '__my_session', sameSite: 'lax', secure: true, path: '/' },
  },
})
```

If omitted, the session still has a bounded lifetime inherited from `@auth0/auth0-server-js` (absolute 3 days, inactivity 1 day, rolling on).

By default the session is **stateless** — the whole encrypted session lives in the cookie. Pass a `sessionStore` (implementing `get`, `set`, `delete`, and `deleteByLogoutToken`) to keep the session body on the server and only an identifier in the cookie. A stateful store is what lets you **revoke** sessions on demand and is **required for back-channel logout** — in stateless mode there is no server-side record to delete, so logout only clears the current browser's cookie and `/auth/backchannel-logout` returns a `501`.

## Controlling which claims reach the browser

The `user` object is dehydrated into the server-rendered HTML so `useUser()` is populated on first paint. Tokens are never included, but raw ID-token claims are. The SDK strips five internal OIDC claims by default (`iss`, `aud`, `iat`, `exp`, `sid`). Pass `excludedClaims` to change the set (server-side `getSession(auth0)` still returns the full user object):

```typescript
export const auth0 = auth0Server({
  excludedClaims: ['iss', 'aud', 'iat', 'exp', 'sid', 'https://example.com/internal'],
})
```

Any custom claim your tenant adds through an Action is included in the client-visible user, so keep sensitive data out of ID-token claims.

## Error handling

The SDK throws typed error classes from the `/errors` entry point. Each extends `Error` and carries a stable `code`.

```typescript
import {
  AccessTokenError,
  UnauthorizedError,
  ForbiddenError,
} from '@auth0/auth0-tanstack-start-react/errors'

try {
  const { token } = await getAccessToken(auth0)
} catch (error) {
  if (error instanceof AccessTokenError) {
    // The token could not be obtained; prompt the user to log in again.
  }
}
```

| Error | Meaning |
|---|---|
| `InvalidConfigurationError` | Required configuration is missing or invalid. |
| `MissingSessionError` | No valid session exists where one is required. |
| `AccessTokenError` | An access token could not be obtained. |
| `UnauthorizedError` | A request lacks a valid session or token (HTTP 401). |
| `ForbiddenError` | The session lacks the required scopes or claims (HTTP 403). |
| `CallbackError` | Auth0 returned an error during the login callback. |

## Testing

The `/testing` entry point provides utilities for component, router-guard, and SSR integration tests: `Auth0TestProvider` (wrap a component so hooks have a context), `createMockAuth0Context` (seed a router-guard test context — pass `status` to exercise `loading`/`unresolved`), `createMockAuth0Client` (stub the server instance), and `generateSessionCookie` (produce a real encrypted cookie whose `secret` matches `auth0Server()`).

```typescript
import {
  Auth0TestProvider,
  createMockAuth0Context,
  createMockAuth0Client,
  generateSessionCookie,
} from '@auth0/auth0-tanstack-start-react/testing'
```

## Common Issues

| Issue | Solution |
|---|---|
| "The redirect URI is wrong" / callback mismatch | Ensure the Auth0 app has `http://localhost:3000/auth/callback` in Allowed Callback URLs and `APP_BASE_URL` matches the browser's origin. Behind a per-request proxy, set `trustProxy`. |
| Import-protection / server-only module error building `start.ts` | Import `auth0Middleware` from `/server/middleware`, not `/server`, and call it with no arguments. |
| Guard always redirects even when signed in | `context.auth0` is `unresolved` — `auth0Middleware` isn't registered in `start.ts`, or `Auth0Provider` / `auth0BeforeLoad()` isn't wired into the root route. |
| Session not persisting | `AUTH0_SECRET` must be set and at least 32 bytes (`openssl rand -hex 32`). |
| `trustProxy`/`routes` set but `/auth/*` behaves as before | Those options must also reach `auth0Middleware()` — set them via environment, or pass to both instances. |
| Client secret rejected | The Auth0 app must be a Regular Web Application, not a SPA. |

## Security Considerations

- **Never commit env files** — add `.env` to `.gitignore`; the file holds the client secret and `AUTH0_SECRET`.
- **Deploy over HTTPS end to end.** The short-lived transaction cookie (`__a0_tx`) is not marked `Secure` in this release, so its bytes must never traverse cleartext (its contents are encrypted regardless). The session cookie is `Secure` by default.
- **Tokens stay on the server** — never return an access, refresh, or ID token from a `createServerFn` to the browser.
- **Validate `returnTo`** in any hand-rolled callback with `toSafeRedirect` before using it in a `Location` header.
- **Only enable `trustProxy` behind a proxy you control** that overwrites `X-Forwarded-*` on every request.

---

# Auth0 TanStack Start Setup Guide

Configure an Auth0 Regular Web Application and write its credentials for a TanStack Start app.

## Quick Setup (Automated)

**Never read the contents of `.env` or `.env.local` at any point during setup.** The file may contain sensitive secrets that should not be exposed in the LLM context. If you determine you need to read it for any reason, ask the user for explicit permission first — do not proceed until the user confirms.

**Before running any part of this setup that writes to an env file, you MUST ask the user for explicit confirmation.** Follow the steps below precisely.

### Step 1: Check for existing env files and confirm with the user

Before writing credentials, check which env files exist:

```bash
test -f .env && echo "ENV_EXISTS" || echo "ENV_NOT_FOUND"
test -f .env.local && echo "ENV_LOCAL_EXISTS" || echo "ENV_LOCAL_NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding — do not continue until the user confirms:

- If `.env` exists, ask:
  - Question: "A `.env` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env" / "No, I'll update it manually"

- If `.env` does **not** exist but `.env.local` exists, ask:
  - Question: "A `.env.local` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env.local" / "No, I'll update it manually"

- If neither exists, ask:
  - Question: "This setup will create a `.env` file containing Auth0 credentials (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_SECRET) and a placeholder for AUTH0_CLIENT_SECRET that you will need to fill in manually. Do you want to proceed?"
  - Options: "Yes, create .env" / "No, I'll configure it manually"

**Do not proceed with writing to any env file unless the user selects the confirmation option.**

### Step 2: Run automated setup (only after confirmation)

```bash
#!/bin/bash

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install auth0
  else
    # Download and review the install script before executing
    curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh -o /tmp/auth0-install.sh
    echo "⚠️  Review the install script at /tmp/auth0-install.sh before running"
    sh /tmp/auth0-install.sh -b /usr/local/bin
    rm /tmp/auth0-install.sh
  fi
fi

# Login
if ! auth0 tenants list &> /dev/null; then
  echo "Visit https://auth0.com/signup if you need an account"
  auth0 login
fi

# Create/select app
auth0 apps list
read -p "Enter app ID (or Enter to create new): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create \
    --name "${PWD##*/}-tanstack-start" \
    --type regular \
    --callbacks "http://localhost:3000/auth/callback" \
    --logout-urls "http://localhost:3000" \
    --metadata "created_by=agent_skills" \
    --json-compact | jq -r '.client_id')
fi

# Get credentials
AUTH0_DOMAIN=$(auth0 apps show "$APP_ID" --json-compact | jq -r '.domain')
AUTH0_CLIENT_ID=$(auth0 apps show "$APP_ID" --json-compact | jq -r '.client_id')

# Generate the session-encryption secret (at least 32 bytes)
AUTH0_SECRET=$(openssl rand -hex 32)

# Determine target env file
if [ -f .env ]; then
  TARGET_FILE=".env"
elif [ -f .env.local ]; then
  TARGET_FILE=".env.local"
else
  TARGET_FILE=".env"
fi

# Append Auth0 credentials (never overwrites existing content)
cat >> "$TARGET_FILE" << ENVEOF
AUTH0_DOMAIN=$AUTH0_DOMAIN
AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
AUTH0_CLIENT_SECRET='YOUR_CLIENT_SECRET'
AUTH0_SECRET=$AUTH0_SECRET
APP_BASE_URL=http://localhost:3000
ENVEOF

echo "✅ Auth0 credentials written to $TARGET_FILE"
```

After the script runs, remind the user to:
1. Open the env file that was written and replace `YOUR_CLIENT_SECRET` with the actual client secret from the Auth0 Dashboard (Applications → your app → Settings).
2. Ensure the env file is listed in `.gitignore` so secrets are never committed.

## Manual Setup

### Step 1: Install the SDK

```bash
npm install @auth0/auth0-tanstack-start-react
```

### Step 2: Create the env file

Create `.env` at the project root:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_SECRET=<openssl rand -hex 32>
APP_BASE_URL=http://localhost:3000
```

Generate `AUTH0_SECRET`:

```bash
openssl rand -hex 32
```

### Step 3: Configure the Auth0 Application

Via the Auth0 CLI:

```bash
auth0 login
auth0 apps create --name "My TanStack Start App" --type regular \
  --callbacks "http://localhost:3000/auth/callback" \
  --logout-urls "http://localhost:3000"
```

Via the Dashboard:
1. Create a **Regular Web Application**.
2. Configure:
   - Allowed Callback URLs: `http://localhost:3000/auth/callback`
   - Allowed Logout URLs: `http://localhost:3000`
3. Copy Domain, Client ID, and Client Secret into `.env`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `AUTH0_DOMAIN` | Yes | Tenant domain, bare (no scheme), e.g. `your-tenant.auth0.com`. |
| `AUTH0_CLIENT_ID` | Yes | Regular Web Application client ID. |
| `AUTH0_CLIENT_SECRET` | Yes | Regular Web Application client secret. |
| `AUTH0_SECRET` | Yes | Encrypts the session cookie; at least 32 bytes (`openssl rand -hex 32`). |
| `APP_BASE_URL` | Yes | Public URL of the app, e.g. `http://localhost:3000`. The browser's URL, not the server's listen address. |
| `AUTH0_TRUST_PROXY` | No | Set `true` to read `X-Forwarded-Host` / `X-Forwarded-Proto` when running behind a TLS-terminating proxy with an `appBaseUrl` allow-list or a `domain` resolver. |

Do not prefix any of these with `VITE_` — they are server-side only.

## Troubleshooting

**"The redirect URI is wrong" / callback mismatch:**
- Confirm `http://localhost:3000/auth/callback` is in Allowed Callback URLs and `APP_BASE_URL` matches the browser origin.
- Behind a per-request proxy (allow-list or MCD), set `trustProxy` / `AUTH0_TRUST_PROXY=true`.

**Server-only import error while building `start.ts`:**
- Import `auth0Middleware` from `/server/middleware` (not `/server`) and call it with no arguments.

**Session not persisting or "invalid" session:**
- Ensure `AUTH0_SECRET` is set and at least 32 bytes; regenerate with `openssl rand -hex 32`.

**Client secret rejected:**
- The Auth0 application must be a **Regular Web Application**, not a SPA.
