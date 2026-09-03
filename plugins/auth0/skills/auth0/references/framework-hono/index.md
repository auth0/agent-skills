# Auth0 Hono Integration

Add authentication to Hono web applications using @auth0/auth0-hono.

---

## Prerequisites

- **Hono:** v3.0.0 or newer
- **Node.js:** 18+ (published package.json has no engines field; README states 18+)
- **ESM:** Package type `"module"` in package.json (SDK is ESM-only; no CommonJS)
- **Peer dependency:** `hono >=3.0.0`
- **Auth0 account:** Set up a Regular Web Application client (NOT SPA type)
- **Env vars:** `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `APP_BASE_URL`, `AUTH0_SESSION_ENCRYPTION_KEY`

---

## Developer intent → primary reference

| Developer intent | Primary leaf | Read |
|---|---|---|
| Add login, logout, protected routes, sessions, tokens, silent login, error handling | integrate | `Read: references/framework-hono/integrate.md` |

---

## Then, as needed

- **Setup & environment:** `Read: references/framework-hono/setup.md` (install dependencies, Auth0 dashboard config, multi-runtime deployment)
- **API reference & config:** `Read: references/framework-hono/api-reference.md` (complete config object, claims, error types, testing checklist, FAQs)
- **Advanced patterns:** `Read: references/framework-hono/patterns.md` (RBAC, organizations, multi-runtime, custom session store, session enrichment)

---

## Quick Start

1. Install SDK: `npm install @auth0/auth0-hono hono @hono/node-server`
2. Set environment variables (see setup.md)
3. Configure Auth0 dashboard application with callback URL, allowed logout URL, and allowed origins
4. Add middleware to your Hono app and protect routes (see integrate.md)
5. Test login/logout flow in development before deploying

