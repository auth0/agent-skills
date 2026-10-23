# @auth0/auth0-react — Token Vault (Connected Accounts)

**Minimum version:** 2.9.0 (`connectAccountWithRedirect` with the top-level `scopes` option).

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. A React SPA is a **public client — it never
receives the provider token.** It only *links* the provider account (Connected Accounts); your
backend API exchanges the app's Auth0 access token for the provider token. There is no Token Vault
exchange method in auth0-react — do not hand-roll one.

## Configure the provider

**Set all three on `Auth0Provider` — the SDK's Token Vault guide configures exactly these:**
- `useRefreshTokens` + `useMrrt` — **required**: the SDK gets the My Account API (`/me/`) token for
  the connect flow through the refresh-token grant.
- `useDpop` — **set it; don't drop it.** It sender-constrains the access token your backend
  exchanges, and it is mandatory whenever the tenant's My Account API or your API is configured to
  *require* DPoP (Auth0's My Account API accepts DPoP by default). Once it is on, call your API
  through the SDK fetcher below.

This is the canonical setup — copy it whole. `onRedirectCallback(appState)` is where the connected
account comes back (see "Show the connected account on return"):

```jsx
import { useState } from 'react';
import { Auth0Provider } from '@auth0/auth0-react';

function Root() {
  const [connectedAccount, setConnectedAccount] = useState(null);

  return (
    <Auth0Provider
      domain="<AUTH0_DOMAIN>"
      clientId="<AUTH0_CLIENT_ID>"
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: '<YOUR API IDENTIFIER>', // the backend that performs the exchange
      }}
      useRefreshTokens={true} // required
      useMrrt={true}          // required
      useDpop={true}          // sender-constrained tokens; required if the API/My Account API enforces DPoP
      onRedirectCallback={(appState) => {
        // Set by the SDK after a connect redirect: { id, connection, scopes, access_type, ... }
        if (appState?.connectedAccount) setConnectedAccount(appState.connectedAccount);
        window.history.replaceState({}, document.title, appState?.returnTo ?? '/');
      }}
    >
      <App connectedAccount={connectedAccount} />
    </Auth0Provider>
  );
}
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
A failed connect surfaces as `useAuth0().error` (`ConnectError` / `MyAccountApiError`), not as a
rejected `connectAccountWithRedirect` promise. `skipRedirectCallback` also skips connect.

## Show the connected account on return

When the user comes back from the provider, the SDK completes the link and puts the result on
**`appState.connectedAccount`** before calling `onRedirectCallback(appState)` — you do not pass
anything into `connectAccountWithRedirect` for this. Lift it into state (as `Root` does above) and
render it:

```jsx
function App({ connectedAccount }) {
  return connectedAccount ? (
    <p>Connected {connectedAccount.connection} ({connectedAccount.scopes?.join(', ')})</p>
  ) : (
    <ConnectGoogleCalendar />
  );
}
```

`onRedirectCallback` fires for login **and** connect — only connect redirects carry
`connectedAccount`. auth0-react has **no** connected-accounts listing method (no
`getConnectedAccounts`, `listConnectedAccounts`, or similar on `useAuth0()` or `myAccount`).
**Do not fetch `/me/v1/connected-accounts` by hand** — the SDK owns connect/complete and returns the
account in `appState`. Persist that metadata yourself (never a token) if it must survive a reload;
if the app must list every linked account, have your backend return it.

## Call your API

Because `useDpop` is enabled, the access token is DPoP-bound — call the API **only** through the
SDK's fetcher, which attaches the token **and** a DPoP proof. Do not use `getAccessTokenSilently()`
with a hand-built `Authorization` header: it sends no proof, so a DPoP-enforcing API rejects it.

```jsx
const { createFetcher } = useAuth0();
const fetcher = createFetcher({ dpopNonceId: 'calendar_api' });
const res = await fetcher.fetchWithAuth('/api/calendar');
// The API verifies the token and DPoP proof, then exchanges the token for the Google token server-side.
```

## Security

No `client_secret` in the app. Never request or store provider tokens in the browser, and never
log or hand-store the Auth0 access or refresh token either — leave token caching to the SDK. Enable
*Offline Access* on the connection's permissions in the Dashboard. Use the `useAuth0()` method, not a
directly instantiated spa-js client. These names and options are accurate for auth0-react 2.9.0+; do
not grep `node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/auth0-react/blob/98ad48cd6dbd03cf509ef614bac64d835151edb6/EXAMPLES.md#L1033-L1116
