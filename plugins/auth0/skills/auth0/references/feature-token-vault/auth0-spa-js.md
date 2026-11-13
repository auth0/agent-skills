# @auth0/auth0-spa-js — Token Vault (Connected Accounts)

**Minimum version:** 2.9.0 (`connectAccountWithRedirect` with the top-level `scopes` option).

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. A SPA is a **public client — it never receives the
provider token.** It only *links* the provider account (Connected Accounts); your backend API then
exchanges the SPA's Auth0 access token for the provider token (the access-token exchange). There is
no Token Vault exchange method in spa-js — do not hand-roll one.

## Configure the client

**Set all three to `true` — the SDK's Token Vault guide configures exactly these:**
- `useRefreshTokens` + `useMrrt` — **required**: the SDK gets the My Account API (`/me/`) token for
  the connect flow through the refresh-token grant.
- `useDpop` — **set it; don't drop it.** It sender-constrains the access token your backend
  exchanges, and it is mandatory whenever the tenant's My Account API or your API is configured to
  *require* DPoP (Auth0's My Account API accepts DPoP by default). Once it is on, call your API
  through the SDK fetcher below.

```js
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0 = new Auth0Client({
  domain: '<AUTH0_DOMAIN>',
  clientId: '<AUTH0_CLIENT_ID>',
  useRefreshTokens: true, // adds offline_access
  useMrrt: true,          // lets the SDK mint a My Account API (/me/) token silently
  useDpop: true,          // sender-constrained tokens; required if the API/My Account API enforces DPoP
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: '<YOUR API IDENTIFIER>', // the backend that performs the exchange
  },
});
```

## Connect the account

```js
await auth0.connectAccountWithRedirect({
  connection: 'google-oauth2',
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  // authorization_params: { ... }  // extra params for the provider (snake_case)
  // redirectUri / appState         // camelCase
});

// On the callback page. Login returns `code`, connect returns `connect_code` — both use the same
// redirect URI here, so match both and let handleRedirectCallback() tell them apart:
const query = new URLSearchParams(window.location.search);
if ((query.has('code') || query.has('connect_code') || query.has('error')) && query.has('state')) {
  const result = await auth0.handleRedirectCallback();
  if (result.response_type === 'connect_code') {
    // result.connection, result.scopes
  }
}
```

`handleRedirectCallback` returns a login result **or** a connect result — narrow on `response_type`.
A provider-side failure throws `ConnectError` (`connection`, `appState`); a failed My Account call
throws `MyAccountApiError`.

## Show which account is connected

spa-js has **no** connected-accounts listing method — there is no `getConnectedAccounts`,
`listConnectedAccounts`, or similar on `Auth0Client` or `auth0.myAccount`. The only source of
connect data is the `handleRedirectCallback()` result: display `result.connection` /
`result.scopes`, and persist that metadata yourself (not any token) if it must survive a reload.
**Do not fetch `/me/v1/connected-accounts` by hand.** If the app must list every linked account,
have your backend return it.

## Call your API

Because `useDpop` is enabled, the access token is DPoP-bound — call the API **only** through the
SDK's fetcher, which attaches the token **and** a DPoP proof. Do not use `getTokenSilently()` with a
hand-built `Authorization` header: it sends no proof, so a DPoP-enforcing API rejects it.

```js
const fetcher = auth0.createFetcher({ dpopNonceId: 'calendar_api' });
const res = await fetcher.fetchWithAuth('/api/calendar');
// The API verifies the token and DPoP proof, then exchanges the token for the Google token server-side.
```

## Security

No `client_secret` in the SPA. Never request or store provider tokens in the browser
(`localStorage`, `sessionStorage`, cookies), and never log or hand-store the Auth0 access or
refresh token either — leave token caching to the SDK. Enable *Offline Access* on the connection's permissions
in the Dashboard. These names and options are accurate for auth0-spa-js 2.9.0+; do not grep
`node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/auth0-spa-js/blob/189007f161ebc10369a4e986fe2d7f133ea00766/examples/token-vault.md
