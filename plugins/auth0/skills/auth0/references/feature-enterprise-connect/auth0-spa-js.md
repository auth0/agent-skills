# @auth0/auth0-spa-js — Enterprise Connect

**Minimum version:** `2.26.0`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. There is **no
`startEnterpriseLogin`** in this SDK: discover with `isFederatedDomain`, then call
`loginWithRedirect` with `login_hint`.

## Enable relay mode

`enterpriseConnect: true` only makes the SDK `console.warn` on `useRefreshTokens` /
`offline_access`, a static `organization`, or a logout without `federated: true`; it does not
change the login flow or throw. Use the B2B Integration's Client ID:

```ts
import { createAuth0Client } from '@auth0/auth0-spa-js';

// Export the promise: the default Vite build target rejects top-level await.
export const auth0Ready = createAuth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  enterpriseConnect: true,
  authorizationParams: {
    redirect_uri: window.location.origin,
    scope: 'openid profile email' // no offline_access, no static organization
  }
});
```

## Discover and start login

`isFederatedDomain(auth0Domain, emailDomain)` is a standalone export (not a client method). It
returns `Promise<boolean>`, never throws, and resolves `false` on any failure (unmanaged domain,
429, network error), so `await` it and treat `false` as "use your existing login". It is a routing
hint, not a security control:

```ts
import { isFederatedDomain } from '@auth0/auth0-spa-js';
import { auth0Ready } from './auth0';

async function login(email: string) {
  const auth0 = await auth0Ready;
  const emailDomain = email.trim().split('@')[1];

  if (emailDomain && (await isFederatedDomain(import.meta.env.VITE_AUTH0_DOMAIN, emailDomain))) {
    await auth0.loginWithRedirect({ authorizationParams: { login_hint: email.trim() } });
  } else {
    // not federated or malformed email: your existing login
  }
}
```

## Handle the callback and read `org_id`

The client does not process `code`/`state` on its own; call `handleRedirectCallback()` on the
redirect URI:

```ts
const auth0 = await auth0Ready;
const query = window.location.search;
if ((query.includes('code=') || query.includes('error=')) && query.includes('state=')) {
  await auth0.handleRedirectCallback(); // throws on an error response
  window.history.replaceState({}, document.title, '/');
}
if (await auth0.isAuthenticated()) {
  const user = await auth0.getUser(); // user?.email, user?.org_id
}
```

Enterprise Connect issues no refresh token, so `getTokenSilently` cannot renew an expired access
token; send the user through login again.

Never full-page navigate after `handleRedirectCallback()` - the in-memory cache does not survive it.
Protected views must accept `await auth0.isAuthenticated()`.

## Validate the organization (optional)

Reject with a **federated** logout so the IdP session ends too. This is a client-side guard;
enforce `org_id` on your server for every API call that trusts the token:

```ts
const claims = await auth0.getIdTokenClaims();
const allowedOrgs = ['org_123']; // your organization IDs
if (!claims?.org_id || !allowedOrgs.includes(claims.org_id)) {
  await auth0.logout({ logoutParams: { federated: true, returnTo: `${window.location.origin}/login` } });
}
```

## Federated logout

```ts
await auth0.logout({
  logoutParams: { federated: true, returnTo: `${window.location.origin}/login` }
});
```

`returnTo` (the app's sign-in route) must be in Allowed Logout URLs; the app origin must be in Allowed Callback URLs and
Allowed Web Origins.

## Security

Public client: no client secret. Tokens stay in the SDK's in-memory cache - do not copy them to
`localStorage` or enable refresh tokens. Maintained example:
https://raw.githubusercontent.com/auth0/auth0-spa-js/main/examples/enterprise-connect.md

All calls above are accurate for `@auth0/auth0-spa-js` 2.26.0+ — do not read the SDK source to
re-verify them.
