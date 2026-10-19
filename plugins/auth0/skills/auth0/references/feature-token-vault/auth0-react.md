# @auth0/auth0-react — Token Vault (Connected Accounts)

**Minimum version:** 2.9.0 (`connectAccountWithRedirect` with the top-level `scopes` option).

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. A React SPA is a **public client — it never
receives the provider token.** It only *links* the provider account (Connected Accounts); your
backend API exchanges the app's Auth0 access token for the provider token. There is no Token Vault
exchange method in auth0-react — do not hand-roll one.

## Configure the provider

```jsx
import { Auth0Provider } from '@auth0/auth0-react';

<Auth0Provider
  domain="<AUTH0_DOMAIN>"
  clientId="<AUTH0_CLIENT_ID>"
  authorizationParams={{
    redirect_uri: window.location.origin,
    audience: '<YOUR API IDENTIFIER>', // the backend that performs the exchange
  }}
  useRefreshTokens={true}
  useMrrt={true}
  useDpop={true}
  onRedirectCallback={(appState) => {
    if (appState?.connectedAccount) {
      // appState.connectedAccount.connection, .scopes
    }
    window.history.replaceState({}, document.title, appState?.returnTo ?? '/');
  }}
>
  <App />
</Auth0Provider>
```

## Connect the account

```jsx
import { useAuth0 } from '@auth0/auth0-react';

function ConnectGoogleCalendar() {
  const { connectAccountWithRedirect } = useAuth0();
  return (
    <button
      onClick={() =>
        connectAccountWithRedirect({
          connection: 'google-oauth2',
          scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        })
      }
    >
      Connect Google Calendar
    </button>
  );
}
```

The provider handles the `connect_code` callback itself — **do not call `handleRedirectCallback`**.
Read the result from `appState.connectedAccount` in `onRedirectCallback` (it fires for both login and
connect). A failed connect surfaces as `useAuth0().error` (`ConnectError` / `MyAccountApiError`), not
as a rejected `connectAccountWithRedirect` promise. `skipRedirectCallback` also skips connect.

## Call your API

```jsx
const { getAccessTokenSilently } = useAuth0();
const token = await getAccessTokenSilently();
await fetch('/api/calendar', { headers: { Authorization: `Bearer ${token}` } });
// The API verifies it and exchanges it for the Google token server-side.
```

## Security

No `client_secret` in the app. Never request or store provider tokens in the browser. Enable
*Offline Access* on the connection's permissions in the Dashboard. Use the `useAuth0()` method, not a
directly instantiated spa-js client. These names and options are accurate for auth0-react 2.9.0+; do
not grep `node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/auth0-react/blob/98ad48cd6dbd03cf509ef614bac64d835151edb6/EXAMPLES.md#L1033-L1116
