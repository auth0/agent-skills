# @auth0/nextjs-auth0 v4 — Organizations

**Minimum version:** 4.0.0. This SDK is **v4** — middleware + `Auth0Client` from
`@auth0/nextjs-auth0/server`, routes under `/auth/*`. The v3 patterns (`handleAuth`,
`withPageAuthRequired`, `/api/auth/*`, `AUTH0_ISSUER_BASE_URL`) are gone.

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference.

Two things are different here from the SPA SDKs:

- The v4 key is **`authorizationParameters`** (full word), not the v3 `authorizationParams`.
- There is **no `organization` env var** — `AUTH0_ORGANIZATION` does not exist. Set it on the
  client or as a login-URL query param.

## Org-scoped login

Client-wide default on the `Auth0Client` constructor:

```ts
// lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client({
  authorizationParameters: { organization: 'org_barkbook_acme' },
});
```

…or per login as a query param the middleware forwards to `/authorize`:

```tsx
<a href="/auth/login?organization=org_barkbook_acme">Log in</a>
```

## Accepting an invitation

Point the user at `/auth/login` with the `invitation` and `organization` query params. The v4
middleware (`middleware.ts` or `proxy.ts` — both are valid in Next.js 16) **forwards these to
`/authorize` automatically**; no manual extraction is needed:

```tsx
// invite link: /auth/login?invitation={ticket}&organization={org_id}
<a href={`/auth/login?invitation=${invitation}&organization=${organization}`}>Accept invite</a>
```

"Forwarded automatically" does not mean "nothing to build": you must still create the
invitation-acceptance entry point (a link or landing route) that carries the incoming
`invitation` and `organization` params into `/auth/login`. Do not reject a valid invitation
because its `organization` differs from your default — forward the invite's own org.

## Reading the organization back

`org_id` is on `session.user` automatically in v4 — **no JWT decode**. Read it server-side:

```ts
import { auth0 } from '@/lib/auth0';

const session = await auth0.getSession(); // Server Component, Server Action, or Route Handler
const orgId = session?.user.org_id;
const orgName = session?.user.org_name; // human-readable name, when the tenant sets one
```

To show a human-readable organization name, read `org_name` from the session (present when the
tenant assigns names) rather than hardcoding a display string mapped from the `org_id`. Use
`org_id` for any membership/authorization check.

## Security

This is a confidential server-side client. Do **not** expose Auth0 tokens or `org_id` to the
browser — do not return them from Server Components as props to Client Components, do not embed
them in client state, and do not send them in a JSON response. Keep the client ID/secret/domain
in env vars, never in source.

Do **not** use the SPA APIs here (`loginWithRedirect`, `getIdTokenClaims`, `useOrganization`) —
this is a server SDK. All names above are accurate for nextjs-auth0 v4 — do not grep
`node_modules` or read `.d.ts` files to re-verify them.
