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
domain**, reads the tenant domain from the provider, and returns `Promise<boolean>` that resolves
`false` on any failure (never throws), so `await` it and treat `false` as "use your existing
login" - and `loginWithSSO(email)`, which calls `loginWithRedirect` with `login_hint` set to the
email:

```tsx
import { useEnterpriseConnect } from '@auth0/auth0-react';

export default function Login() {
  const { isFederatedDomain, loginWithSSO } = useEnterpriseConnect();

  const handleSubmit = async (email: string) => {
    const emailDomain = email.trim().split('@')[1];

    if (emailDomain && (await isFederatedDomain(emailDomain))) {
      await loginWithSSO(email.trim());
    } else {
      // not federated or malformed email: your existing login
    }
  };
  return <LoginForm onSubmit={handleSubmit} />;
}
```

## Read the user and `org_id`

`Auth0Provider` processes `code`/`state` on load and sets `isLoading` until it finishes, so do
not call `handleRedirectCallback` yourself:

```tsx
const { isLoading, isAuthenticated, user } = useAuth0(); // user?.email, user?.org_id
```

The default `onRedirectCallback` only calls `history.replaceState`, which client-side routers ignore.
To land on a route, pass `loginWithSSO(email, { appState: { returnTo } })` and navigate in
`onRedirectCallback(appState)` with the app's router (React Router: render the provider inside the
router, call `navigate(appState?.returnTo ?? '/')`). Never use `window.location` there - a full page
load clears the in-memory session.

Enterprise Connect issues no refresh token, so `getAccessTokenSilently` cannot renew an expired
access token; send the user through login again.

## Validate the organization (optional)

Reject with a **federated** logout. This is a client-side guard; enforce `org_id` on your server
for every API call that trusts the token:

```tsx
import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const allowedOrgs = ['org_123']; // your organization IDs

export function useOrgGuard() {
  const { isLoading, isAuthenticated, user, logout } = useAuth0();

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (!user?.org_id || !allowedOrgs.includes(user.org_id)) {
      logout({ logoutParams: { federated: true, returnTo: `${window.location.origin}/login` } });
    }
  }, [isLoading, isAuthenticated, user, logout]);
}
```

## Federated logout

```tsx
import { useAuth0 } from '@auth0/auth0-react';

export function LogoutButton() {
  const { logout } = useAuth0();

  return (
    <button
      onClick={() =>
        logout({ logoutParams: { federated: true, returnTo: `${window.location.origin}/login` } })
      }
    >
      Sign out
    </button>
  );
}
```

`returnTo` must be in Allowed Logout URLs; the app origin must be in Allowed Callback URLs and
Allowed Web Origins.

## Security

Public client: no client secret. Tokens stay in memory - do not set `useRefreshTokens` or copy
tokens to storage. Maintained example:
https://raw.githubusercontent.com/auth0/auth0-react/main/EXAMPLES.md#enterprise-connect

All calls above are accurate for `@auth0/auth0-react` 2.26.0+ — do not read the SDK source to
re-verify them.
