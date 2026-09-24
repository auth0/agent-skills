# Auth0 Next.js Integration

The full, version-pinned integration guide now ships **inside** the SDK package. This file
bootstraps it: make sure `@auth0/nextjs-auth0` is installed, then read the guide from
`node_modules`, which always matches the version the project actually runs.

## Bootstrap

1. Is `@auth0/nextjs-auth0` a dependency? Check `package.json` and `node_modules`.
   - **If not installed:** install it with the project's package manager (pnpm/yarn/npm —
     match the lockfile): `npm install @auth0/nextjs-auth0`.
2. Read and follow `node_modules/@auth0/nextjs-auth0/skills/nextjs-auth0/SKILL.md`. That is
   the source of truth for the installed SDK version — prefer it over anything here.
3. If that path does **not** exist, the installed version predates bundled skills. Run
   `npm install @auth0/nextjs-auth0@latest` and re-check the path.
4. If it still isn't there (upgrade blocked, offline), use the Fallback below.

## Fallback

Only if the in-package skill above is unavailable. This is a condensed v4 setup; the
in-package skill is more complete and version-accurate.

- **Install:** `npm install @auth0/nextjs-auth0`.
- **Env** (`.env.local`, git-ignored): `AUTH0_SECRET` (`openssl rand -hex 32`, ≥32 chars),
  `APP_BASE_URL=http://localhost:3000`, `AUTH0_DOMAIN` (no scheme), `AUTH0_CLIENT_ID`,
  `AUTH0_CLIENT_SECRET`. App must be a **Regular Web Application**; add
  `http://localhost:3000/auth/callback` to Allowed Callback URLs.
- **Client** `lib/auth0.ts` (or `src/lib/auth0.ts` if `src/` is used):
  `export const auth0 = new Auth0Client();` from `@auth0/nextjs-auth0/server`.
- **Middleware** `middleware.ts` (or `proxy.ts` on Next.js 16) exporting a handler that
  returns `await auth0.middleware(request)`, with a matcher excluding static assets. This
  mounts `/auth/login|logout|callback|profile`.
- **UI:** `useUser()` from `.../client` (client components only); link to `/auth/login` and
  `/auth/logout`.
- **Server:** `auth0.getSession()` for Server Components / API routes; `getAccessToken()`
  for calling APIs. `useUser` is client-only.
- **v4 gotchas:** routes are `/auth/*` (no `/api`); env is `APP_BASE_URL` /`AUTH0_DOMAIN`
  (not `AUTH0_BASE_URL`/`AUTH0_ISSUER_BASE_URL`); `withPageAuthRequired` /
  `withApiAuthRequired` are removed — use `getSession()`.

## Related

- MFA / step-up → `feature:mfa`
- Multi-tenant B2B / Organizations → `feature:organizations`
- Auth0 tenant setup → the Auth0 CLI (`tooling-cli`)
- Migrating from another provider → `migrate`
