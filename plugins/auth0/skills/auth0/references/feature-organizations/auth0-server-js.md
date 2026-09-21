# @auth0/auth0-server-js — Organizations

**Minimum version:** 1.9.0 (organization support was added in 1.9.0 — earlier 1.x releases do not have it).

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. This is
a Regular Web App SDK built on `ServerClient` — there is no hook API and no `useOrganization`.

## Org-scoped login

Pass `organization` as a first-class option to `startInteractiveLogin` (preferred), or as the
client-wide `organization` config key on `ServerClient` — not inside `authorizationParams`
alone:

```ts
import { ServerClient } from '@auth0/auth0-server-js';

const serverClient = new ServerClient({ domain, clientId, clientSecret, transactionStore, stateStore });

const url = await serverClient.startInteractiveLogin({ organization: 'org_barkbook_acme' }, storeOptions);
```

## Accepting an invitation

Read `invitation` + `organization` off the request URL query string and forward **both** as the
`invitation`/`organization` options to `startInteractiveLogin`; forward the invite's own
`organization`, not the configured default.

## Handling validation + reading org back

`completeInteractiveLogin` validates the returned `org_id` and throws
`OrganizationValidationError` (imported from `@auth0/auth0-server-js`) on a mismatch — catch it
in the callback route and respond appropriately:

```ts
import { OrganizationValidationError } from '@auth0/auth0-server-js';

try {
  await serverClient.completeInteractiveLogin(url, storeOptions);
} catch (err) {
  if (err instanceof OrganizationValidationError) { /* reject / re-auth */ }
}

const user = await serverClient.getUser(storeOptions);
const orgId = user?.org_id; // read org_id from the session user
```

## Security

Confidential client — keep client ID/secret/domain in env vars, never in source. Do not use the
low-level `@auth0/auth0-auth-js` or a React SDK here.

All method and type names above are accurate for auth0-server-js 1.x — do not read `node_modules`
or `@types` packages to re-verify them.
