# @auth0/auth0-spa-js — Organizations

**Minimum version:** 2.0.0 (organizations supported across the 2.x line).

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. This
SDK is a public SPA client — there is **no** dedicated `organization` option; pass it inside
`authorizationParams`.

## Org-scoped login

Set `organization` inside `authorizationParams`, on the client (applies to every login) or on
the individual `loginWithRedirect` call:

```js
import { createAuth0Client } from '@auth0/auth0-spa-js';

const auth0 = await createAuth0Client({
  domain: 'YOUR_DOMAIN',
  clientId: 'YOUR_CLIENT_ID',
  authorizationParams: {
    redirect_uri: window.location.origin,
    organization: 'org_barkbook_acme', // client-wide default; omit here to set it per login
  },
});

// or per login
await auth0.loginWithRedirect({ authorizationParams: { organization: 'org_barkbook_acme' } });
```

## Accepting an invitation

The invite link lands on your app as `?invitation={ticket}&organization={org_id}`. Read **both**
off the URL and forward **both** in `authorizationParams` — forward the invite's own
`organization`, never your configured default:

```js
const params = new URLSearchParams(window.location.search);
const invitation = params.get('invitation');
const organization = params.get('organization');
if (invitation && organization) {
  await auth0.loginWithRedirect({ authorizationParams: { organization, invitation } });
}
```

A client-wide default `organization` is validated against the returned `org_id` at login
completion and **rejects** invites to other orgs — so when you accept cross-org invitations,
pass `organization` per login call rather than pinning it on the client.

## Reading the organization back

`org_id` is on the ID token after an org login. Use the SDK accessor — never hand-decode:

```js
const user = await auth0.getUser();
const orgId = user?.org_id;
// or: const claims = await auth0.getIdTokenClaims(); claims.org_id;
```

## Security

Public client: **no `client_secret`**. Do not persist tokens in `localStorage`/`sessionStorage`
— leave token storage to the SDK (in-memory by default, or `cacheLocation: 'localstorage'` only
if the app explicitly opts in). `org_id` is a display claim; reading it is fine, storing raw
tokens by hand is not.

All method and option names above are accurate for auth0-spa-js 2.x — do not grep
`node_modules` or read `.d.ts` files to re-verify them.
