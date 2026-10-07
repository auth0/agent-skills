# @auth0/auth0-spa-js — Custom Token Exchange

**Minimum version:** 2.14.0 for `loginWithCustomTokenExchange`; the session-free `customTokenExchange` requires **2.20.0**. (The earlier `exchangeToken` alias is deprecated.)

Framework-specific surface only. The protocol shape, the token-type rules, the security
invariants, tenant config, and the common mistakes live in the shared Custom Token Exchange
reference. Options are **snake_case**.

## Exchange and establish a session

`loginWithCustomTokenExchange` performs the exchange and stores the tokens + session, the way a
login does:

```js
const auth0 = await createAuth0Client({
  domain: '<AUTH0_DOMAIN>',
  clientId: '<AUTH0_CLIENT_ID>',
  authorizationParams: { audience: 'https://your-api.example.com' },
});

const tokenResponse = await auth0.loginWithCustomTokenExchange({
  subject_token: externalToken,
  subject_token_type: 'urn:acme:legacy-token', // your own non-reserved URI
  scope: 'openid profile email',
  // audience defaults to the client config; pass it here to override
  // organization: '<org_id_or_name>',
});

const user = await auth0.getUser(); // the user is now signed in
```

## Exchange without side effects

`customTokenExchange` (spa-js **2.20.0+**) returns the same `TokenEndpointResponse` but does
**not** touch the session — use it when you only need the tokens (e.g. one principal acting for
another), not a signed-in state. With `useRefreshTokensWorker` enabled the worker strips any
`refresh_token`; otherwise the raw response may include one, so discard it yourself:

```js
const tokenResponse = await auth0.customTokenExchange({
  subject_token: externalToken,
  subject_token_type: 'urn:acme:legacy-token',
  audience: 'https://your-api.example.com',
});
```

`CustomTokenExchangeOptions`: `subject_token`, `subject_token_type` (required); `audience`,
`scope`, `organization` (optional).

## Security

SPA = public client: **no `client_secret`**. Let the SDK hold the session; never put the returned
tokens or the `subject_token` in `localStorage`, `sessionStorage`, or a cookie yourself. Read
`domain` / `clientId` / `audience` from config, not source literals.

Use `loginWithCustomTokenExchange` / `customTokenExchange` — **not** the deprecated `exchangeToken`
alias, and never hand-build the `/oauth/token` token-exchange POST. These names and options are
accurate for auth0-spa-js 2.14.0+; do not grep `node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/auth0-spa-js/blob/90a53b3069e68d6c4c5c09d8fd51a01cc073d323/examples/custom-token-exchange.md
