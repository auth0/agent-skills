# @auth0/auth0-spa-js — Token Vault (Connected Accounts)

**Minimum version:** 2.9.0 (`connectAccountWithRedirect` with the top-level `scopes` option).

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. A SPA is a **public client — it never receives the
provider token.** It only *links* the provider account (Connected Accounts); your backend API then
exchanges the SPA's Auth0 access token for the provider token (the access-token exchange). There is
no Token Vault exchange method in spa-js — do not hand-roll one.

## Configure the client

```js
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0 = new Auth0Client({
  domain: '<AUTH0_DOMAIN>',
  clientId: '<AUTH0_CLIENT_ID>',
  useRefreshTokens: true, // adds offline_access
  useMrrt: true,          // lets the SDK mint a My Account API (/me/) token silently
  useDpop: true,
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

// On the callback page — note `connect_code`, not `code`:
const query = new URLSearchParams(window.location.search);
if ((query.has('connect_code') || query.has('error')) && query.has('state')) {
  const result = await auth0.handleRedirectCallback();
  if (result.response_type === 'connect_code') {
    // result.connection, result.scopes
  }
}
```

`handleRedirectCallback` returns a login result **or** a connect result — narrow on `response_type`.
A provider-side failure throws `ConnectError` (`connection`, `appState`); a failed My Account call
throws `MyAccountApiError`.

## Call your API

```js
const token = await auth0.getTokenSilently(); // Auth0 access token for your API
await fetch('/api/calendar', { headers: { Authorization: `Bearer ${token}` } });
// The API verifies it and exchanges it for the Google token server-side.
```

## Security

No `client_secret` in the SPA. Never request or store provider tokens in the browser
(`localStorage`, `sessionStorage`, cookies). Enable *Offline Access* on the connection's permissions
in the Dashboard. These names and options are accurate for auth0-spa-js 2.9.0+; do not grep
`node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/auth0-spa-js/blob/189007f161ebc10369a4e986fe2d7f133ea00766/examples/token-vault.md
