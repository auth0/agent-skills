# @auth0/auth0-spa-js — Enterprise Connect

**Minimum version:** `2.26.0`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. There is **no
`startEnterpriseLogin`** in this SDK: discover with `isFederatedDomain`, then call
`loginWithRedirect` with `login_hint`.

## Enable relay mode

`enterpriseConnect: true` is warn-only here: it `console.warn`s on `useRefreshTokens` /
`offline_access`, a static `organization`, or a non-federated logout, but does not throw. Use the
B2B Integration's Client ID:

```ts
import { createAuth0Client } from '@auth0/auth0-spa-js';

export const auth0 = await createAuth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  enterpriseConnect: true,
  authorizationParams: {
    redirect_uri: window.location.origin,
    scope: 'openid profile email' // no offline_access, no static organization
  }
});
```

## Discover and start login

`isFederatedDomain(auth0Domain, emailDomain)` is a standalone export (not a client method) that
resolves `false` on any failure:

```ts
import { isFederatedDomain } from '@auth0/auth0-spa-js';
import { auth0 } from './auth0';

document.querySelector('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const email = document.querySelector('#email').value;
  const federated = await isFederatedDomain(process.env.AUTH0_DOMAIN, email.split('@')[1]);

  if (federated) {
    await auth0.loginWithRedirect({ authorizationParams: { login_hint: email } });
  } else {
    // not federated: your existing login
  }
});
```

## Handle the callback and read `org_id`

```ts
const query = window.location.search;
if (query.includes('code=') && query.includes('state=')) {
  await auth0.handleRedirectCallback();
  window.history.replaceState({}, document.title, '/');
}
if (await auth0.isAuthenticated()) {
  const user = await auth0.getUser(); // user.email, user.org_id
}
```

## Validate the organization (optional)

Reject with a **federated** logout so the IdP session ends too:

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

`returnTo` must be in Allowed Logout URLs; the app origin must be in Allowed Callback URLs and
Allowed Web Origins.

## Security

Public client: no client secret. Tokens stay in the SDK's in-memory cache - do not copy them to
`localStorage` or enable refresh tokens. Maintained example:
https://raw.githubusercontent.com/auth0/auth0-spa-js/main/examples/enterprise-connect.md

All calls above are accurate for `@auth0/auth0-spa-js` 2.26.0+ — do not read the SDK source to
re-verify them.
