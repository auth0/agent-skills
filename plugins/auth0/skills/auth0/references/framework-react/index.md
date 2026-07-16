# Auth0 React — reference hub

Add authentication to React single-page applications using @auth0/auth0-react.

<!-- Shared prerequisites: critical rules, prerequisites, and when-NOT-to-use.
     Read this first (hop 1), then follow the dispatch table below to the one
     leaf for your intent. (Carved from the original framework-react.md.) -->

## Critical rules

- Always ask the user for explicit confirmation before running any setup step that writes to `.env`; wait for their answer before proceeding.
- Keep the contents of `.env` out of the agent context. If reading it seems necessary, ask the user for explicit permission first.

## Prerequisites

- React 16.11+ application (Vite or Create React App) - supports React 16, 17, 18, and 19
- Auth0 account and application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Next.js applications** - Use the Auth0 integration workflow for Next.js (App Router and Pages Router)
- **React Native mobile apps** - Use the Auth0 integration workflow for React Native (iOS/Android)
- **Server-side rendered React** - Use framework-specific SDK (Next.js, Remix, etc.)
- **Embedded login** - This SDK uses Auth0 Universal Login (redirect-based)
- **Backend API authentication** - Use express-openid-connect or JWT validation instead

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-react/integrate.md` |
| feature:organizations | `Read: references/framework-react/integrate.md` |
| migrate | `Read: references/framework-react/integrate.md` |

**Then, as needed for your task:**
- Full API / configuration lookup (Auth0Provider config, useAuth0 hook, MFA error types, TypeScript types): `Read: references/framework-react/api-reference.md`
- Tenant setup / CLI provisioning / automated `.env` scripts: `Read: references/framework-react/setup.md`
- Advanced framework patterns (protected routes, calling APIs, error handling, MFA handling, security): `Read: references/framework-react/patterns.md`
- Any other task (guidance, debugging, Organizations, provider migration):
  start with `Read: references/framework-react/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
