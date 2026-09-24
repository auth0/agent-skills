# @auth0/nextjs-auth0 v4 — Organizations

The Next.js-specific Organizations guide now ships **inside** the SDK package, pinned to the
installed version. This file bootstraps it: make sure the SDK is new enough, then read the
guide from `node_modules`. The protocol shape, invitation flow, tenant config, and common
mistakes stay in the shared Organizations reference (`references/feature-organizations/index.md`).

## Bootstrap

1. `@auth0/nextjs-auth0` should already be installed (organizations layer onto an existing
   login). If it isn't, run the `integrate` intent first.
2. Read and follow `node_modules/@auth0/nextjs-auth0/skills/nextjs-auth0/organizations/SKILL.md`.
   It is the source of truth and carries the exact option/claim names for the installed version.
3. If that path does **not** exist, the installed version predates bundled skills. Upgrade:
   `npm install @auth0/nextjs-auth0@latest`, then re-check the path.
4. If it still isn't there (upgrade blocked, offline), use the Fallback below.

## Fallback

Only if the in-package skill above is unavailable. Condensed; the in-package skill is more
complete and version-accurate. This SDK is **v4** — middleware + `Auth0Client` from
`@auth0/nextjs-auth0/server`, routes under `/auth/*`. Two v4 specifics:

- The key is **`authorizationParameters`** (full word), not the v3 `authorizationParams`.
- There is **no `organization` env var** (`AUTH0_ORGANIZATION` does not exist) and no top-level
  `organization` option — set it inside `authorizationParameters`, or as a login-URL query param.

**Org-scoped login** — client-wide default on the constructor:

```ts
// lib/auth0.ts
export const auth0 = new Auth0Client({
  authorizationParameters: { organization: 'org_abc123' },
});
```

…or per login as a query param the middleware forwards to `/authorize`:
`<a href="/auth/login?organization=org_abc123">Log in</a>`.

**Accepting an invitation** — point the user at `/auth/login` carrying both params; the
middleware forwards them automatically (`invitation` rides through as an untyped param):
`/auth/login?invitation=<ticket>&organization=<org_id>`. Build the acceptance entry point, and
forward the invite's **own** `organization` — do not substitute your default org.

**Reading the organization back** — `org_id` is on `session.user` automatically in v4 (no JWT
decode): `const orgId = (await auth0.getSession())?.user.org_id`. Use `org_id` for any
membership/authorization check; on an API, validate it from the verified access token against
the set of orgs the request may serve, not a single hardcoded default.

**Security** — confidential server-side client. Do not expose Auth0 tokens or `org_id` to the
browser (no props to Client Components, no client state, no JSON responses). Do not use the SPA
APIs (`loginWithRedirect`, `getIdTokenClaims`, `useOrganization`) — this is a server SDK.
