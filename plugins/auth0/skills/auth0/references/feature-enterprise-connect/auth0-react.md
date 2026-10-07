# @auth0/auth0-react — Enterprise Connect

**Minimum version:** `2.26.0`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. There is **no
`startEnterpriseLogin`** here; use the `useEnterpriseConnect()` hook. Import only from
`@auth0/auth0-react`, not `@auth0/auth0-spa-js`.

## Enable relay mode

Set the `enterpriseConnect` prop on `Auth0Provider`, with the B2B Integration's Client ID:

```tsx
import { Auth0Provider } from '@auth0/auth0-react';

<Auth0Provider
  domain={import.meta.env.VITE_AUTH0_DOMAIN}
  clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
  enterpriseConnect={true}
  authorizationParams={{
    redirect_uri: window.location.origin,
    scope: 'openid profile email', // no offline_access, no static organization
  }}
>
  <App />
</Auth0Provider>
```

## Discover and start login

`useEnterpriseConnect()` returns `isFederatedDomain(emailDomain)` - it takes **only the email
domain** and reads the tenant domain from the provider - and `loginWithSSO(email)`, which calls
`loginWithRedirect` with `login_hint` set to the email:

```tsx
import { useEnterpriseConnect } from '@auth0/auth0-react';

export default function Login() {
  const { isFederatedDomain, loginWithSSO } = useEnterpriseConnect();

  const handleSubmit = async (email: string) => {
    if (await isFederatedDomain(email.split('@')[1])) {
      await loginWithSSO(email);
    } else {
      // not federated: your existing login
    }
  };
  return <LoginForm onSubmit={handleSubmit} />;
}
```

## Read the user and `org_id`

`Auth0Provider` processes `code`/`state` on load:

```tsx
const { isLoading, isAuthenticated, user } = useAuth0(); // user?.email, user?.org_id
```

## Validate the organization (optional)

```tsx
const { getIdTokenClaims, logout } = useAuth0();
const allowedOrgs = ['org_123']; // your organization IDs

const claims = await getIdTokenClaims();
if (!claims?.org_id || !allowedOrgs.includes(claims.org_id)) {
  await logout({ logoutParams: { federated: true, returnTo: `${window.location.origin}/login` } });
}
```

Run it from a `useEffect` once `isAuthenticated` is true.

## Federated logout

```tsx
const { logout } = useAuth0();

<button onClick={() => logout({
  logoutParams: { federated: true, returnTo: `${window.location.origin}/login` },
})}>
  Sign out
</button>
```

`returnTo` must be in Allowed Logout URLs; the app origin must be in Allowed Callback URLs and
Allowed Web Origins.

## Security

Public client: no client secret. Tokens stay in memory - do not set `useRefreshTokens` or copy
tokens to storage. Maintained example:
https://raw.githubusercontent.com/auth0/auth0-react/main/EXAMPLES.md#enterprise-connect

All calls above are accurate for `@auth0/auth0-react` 2.26.0+ — do not read the SDK source to
re-verify them.
