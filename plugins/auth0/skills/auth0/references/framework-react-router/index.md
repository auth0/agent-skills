
# Auth0 React Router Integration

Add authentication to React Router framework-mode applications (v7 or later) using `@auth0/auth0-react-router`.


## Prerequisites

- React Router framework-mode project, v7 or later (`react-router.config.ts` present)
- Node.js 20 or newer for React Router v7 (22.22 or newer for v8)
- Auth0 account and application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **React Router SPA (no `react-router.config.ts`)** — Use `@auth0/auth0-react` instead
- **TanStack Start** — Use `@auth0/auth0-tanstack-start-react` instead
- **Next.js** — Use `@auth0/nextjs-auth0` instead
- **Stateless API routes only** — Use `express-oauth2-jwt-bearer` or similar for JWT validation without sessions


## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-react-router
```

### 2. Configure Environment

Create `.env` at the project root (**add to `.gitignore` immediately**):

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
# Encrypts the session cookie; must be at least 32 characters. Generate with: openssl rand -hex 32
AUTH0_SESSION_SECRET=replace-with-a-32-byte-random-value
AUTH0_APP_BASE_URL=http://localhost:5173
# Required when calling APIs with getAccessToken():
# AUTH0_AUDIENCE=https://your-api-identifier
# Required for getAccessToken() to auto-refresh (also enable Allow Offline Access on the API):
# AUTH0_SCOPE=openid profile email offline_access
```

In Auth0 Dashboard, set for the application (Regular Web Application type):

| Setting | Value |
|---------|-------|
| Allowed Callback URLs | `http://localhost:5173/auth/callback` |
| Allowed Logout URLs | `http://localhost:5173` |
| Allowed Web Origins | `http://localhost:5173` |

### 3. Create the Auth0 Server Instance

```ts
// app/auth0.server.ts
import { Auth0Server, registerAuth0Instance } from '@auth0/auth0-react-router/server'

export const auth0 = new Auth0Server()
registerAuth0Instance(auth0)
```

The `.server.ts` suffix keeps this file out of the client bundle. `registerAuth0Instance` wires standalone helpers (`getSession`, `requireSession`, etc.) so you don't need to pass `auth0` everywhere.

### 4. Register the Auth Route

```ts
// app/routes/auth.$.tsx
import { handleAuth } from '@auth0/auth0-react-router/server'
import { auth0 } from '../auth0.server'

export const loader = ({ request }: { request: Request }) => handleAuth(auth0, request)
export const action = ({ request }: { request: Request }) => handleAuth(auth0, request)
```

Add to route config:

```ts
// app/routes.ts
import { type RouteConfig, route } from '@react-router/dev/routes'

export default [
  route('auth/*', 'routes/auth.$.tsx'),
  // ...other routes
] satisfies RouteConfig
```

`handleAuth` dispatches to `handleLogin`, `handleCallback`, `handleLogout`, or `handleBackchannelLogout` based on the URL path.

### 5. Configure Root Layout

```tsx
// app/root.tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import { Auth0Provider } from '@auth0/auth0-react-router'
import { rootAuthLoader } from '@auth0/auth0-react-router/server'
import type { Route } from './+types/root'

export const loader = ({ request }: Route.LoaderArgs) => rootAuthLoader(request)

export default function Root() {
  return (
    <html lang="en">
      <head><Meta /><Links /></head>
      <body>
        <Auth0Provider>
          <Outlet />
          <ScrollRestoration />
          <Scripts />
        </Auth0Provider>
      </body>
    </html>
  )
}
```

`rootAuthLoader` decrypts the JWE session cookie and returns a browser-safe session (user profile only — no tokens). `Auth0Provider` hydrates client state from this data.

### 6. Add Login / Logout UI

```tsx
import { SignedIn, SignedOut, LoginButton, LogoutButton, AuthLoading } from '@auth0/auth0-react-router'

export default function Home() {
  return (
    <main>
      <AuthLoading><p>Loading…</p></AuthLoading>
      <SignedOut><LoginButton>Log in</LoginButton></SignedOut>
      <SignedIn><LogoutButton>Log out</LogoutButton></SignedIn>
    </main>
  )
}
```

### 7. Protect a Route

```ts
// app/routes/dashboard.tsx
import { requireSession } from '@auth0/auth0-react-router/server'
import type { Route } from './+types/dashboard'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await requireSession(request)  // redirects to /auth/login if unauth'd
  return { user: session.user }
}
```

Use `useUser()` / `useSession()` client-side for access after hydration.

### 8. Test Authentication

```bash
npm run dev
```

Visit `http://localhost:5173/auth/login` — should redirect to Auth0 Universal Login and back.


## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `AUTH0_SESSION_SECRET` fewer than 32 characters | `openssl rand -hex 32`; store in `.env`, add `.env` to `.gitignore` |
| Callback URL mismatch after login | Add `http://localhost:5173/auth/callback` to Allowed Callback URLs in Dashboard |
| 404 on `/auth/login` | Confirm `auth.$.tsx` exists and is registered in `app/routes.ts` |
| `rootAuthLoader` returns `undefined` | Ensure root route exports `loader = ({ request }) => rootAuthLoader(request)` and its id is `root` |
| `Auth0Provider` crashes on first render | Import from `@auth0/auth0-react-router` (not `/server`) for client components |
| `useUser` returns `null` after login | `rootAuthLoader` not wired or `id: 'root'` missing on the layout route |
| Mixed RWA + SPA env vars | Use either `AUTH0_*` (RWA) or `VITE_AUTH0_*` (SPA), never both at once |


## Advanced Patterns

**Enable middleware (React Router ≥ 7.9.0)** — `defineRouteAuth` below needs the middleware API, and `getAccessToken` needs `auth0Middleware` on the root route to save refreshed tokens back to the session cookie (without it the refresh repeats on every request). On 7.x, opt in with the future flag; v8 enables middleware by default, so skip the flag there:

```ts
// react-router.config.ts (7.9+ only)
import type { Config } from '@react-router/dev/config'

export default {
  // ...existing config
  future: { v8_middleware: true },
} satisfies Config
```

```ts
// app/root.tsx — add alongside the root loader from step 5
import { auth0Middleware } from '@auth0/auth0-react-router/server'

export const middleware = [auth0Middleware]
```

**Call a backend API with an access token:**

```ts
// app/routes/items.tsx
import { getAccessToken, deleteSession } from '@auth0/auth0-react-router/server'
import { TokenError } from '@auth0/auth0-react-router/errors'
import type { Route } from './+types/items'

export const loader = async ({ request }: Route.LoaderArgs) => {
  try {
    const token = await getAccessToken(request)  // auto-refreshes if expired (needs offline_access + auth0Middleware)
    const data = await fetch('https://api.example.com/items', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json())
    return { data }
  } catch (err) {
    if (err instanceof TokenError) return deleteSession(request, { redirectTo: '/auth/login' })
    throw err
  }
}
```

**Role-based route protection (requires the middleware setup above; on React Router < 7.9.0 call `requireSession` in the loader and check the roles claim yourself):**

```ts
// app/routes/admin.tsx
import { defineRouteHandle } from '@auth0/auth0-react-router'
import { defineRouteAuth, auth0UserContext } from '@auth0/auth0-react-router/server'
import type { Route } from './+types/admin'

const auth = { role: 'admin', rolesClaim: 'https://myapp.example.com/roles' }
export const handle = defineRouteHandle(auth)
export const middleware = defineRouteAuth(auth).middleware

export const loader = ({ context }: Route.LoaderArgs) => {
  const user = context.get(auth0UserContext)  // guaranteed to have the admin role
  return { user }
}
```

Auth0 doesn't add roles to tokens by default, and the SDK's default claim (`https://auth0.com/claims/roles`) uses a reserved Auth0 namespace that Actions can't set — so always pass your own `rolesClaim`, and add it with a post-login Action (otherwise every user gets a 403):

```js
// Auth0 Dashboard → Actions → Triggers → post-login
exports.onExecutePostLogin = async (event, api) => {
  api.idToken.setCustomClaim('https://myapp.example.com/roles', event.authorization?.roles ?? [])
}
```

**SPA mode** — activated automatically when `VITE_AUTH0_DOMAIN` + `VITE_AUTH0_CLIENT_ID` are present. It replaces the whole server setup: skip the `AUTH0_*` vars, `app/auth0.server.ts`, the `auth/*` route and the root `loader` from steps 2–5 (keep `<Auth0Provider>` in `root.tsx`). Hybrid mode isn't supported — SPA logout won't clear a server session cookie, and the root loader fails without server config.

```bash
npm install @auth0/auth0-spa-js
```

```bash
VITE_AUTH0_DOMAIN=example.us.auth0.com
VITE_AUTH0_CLIENT_ID=your_spa_client_id
```


## Related Skills

- Auth0 setup → set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Migrate from another auth provider → migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Manage Auth0 resources from the terminal → the Auth0 CLI (tooling-cli)


## Quick Reference

**Entry points:**
- `@auth0/auth0-react-router` — client components, hooks (`useUser`, `useSession`, `useAuth0`)
- `@auth0/auth0-react-router/server` — loaders, session helpers, middleware
- `@auth0/auth0-react-router/errors` — typed error classes (`TokenError`, `AuthenticationError`)
- `@auth0/auth0-react-router/testing` — mock factories for unit tests

**Key server helpers:**
- `rootAuthLoader(request)` — root loader; decrypts session for client hydration
- `handleAuth(auth0, request)` — auth route dispatcher (login / callback / logout)
- `requireSession(request)` — get session or redirect to `/auth/login`
- `getSession(request)` — get session or `null` (no redirect)
- `getAccessToken(request)` — get access token (auto-refreshes); requires `AUTH0_AUDIENCE`
- `defineRouteAuth({ role })` — per-route middleware guard (React Router ≥ 7.9.0)

**Key client components:**
- `<Auth0Provider>` — wraps the app; reads session from root loader data
- `<SignedIn>`, `<SignedOut>`, `<AuthLoading>` — conditional rendering
- `<LoginButton>`, `<LogoutButton>` — pre-wired nav buttons
- `<RequireAuth>`, `<RequireRole role="…" rolesClaim="…">` — client-side guards


## References

- [Auth0 React Router Quickstart](https://auth0.com/docs/quickstart/webapp/react-router)
- [SDK GitHub Repository](https://github.com/auth0/auth0-react-router)
