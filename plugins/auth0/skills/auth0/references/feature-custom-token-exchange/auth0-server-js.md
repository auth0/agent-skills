# @auth0/auth0-server-js — Custom Token Exchange

**Minimum version:** 1.6.0 (`loginWithCustomTokenExchange` / `customTokenExchange` on `ServerClient`).

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. This is the stateful
server SDK that layers a StateStore over `@auth0/auth0-auth-js`. Options are **camelCase** (aliased
to `ExchangeProfileOptions`). Both methods take an optional second `storeOptions` argument.

## Exchange and establish a session

`loginWithCustomTokenExchange` persists the resulting tokens to the StateStore — the user is
effectively logged in, and `getUser()` / `getSession()` / `getAccessToken()` work afterward. It
forces the `openid` scope (injecting it if absent):

```ts
await serverClient.loginWithCustomTokenExchange({
  subjectToken: externalToken,
  subjectTokenType: 'urn:acme:legacy-token', // non-reserved URI
  audience: 'https://api.example.com',
  scope: 'openid profile email',
});
```

## Exchange without a session

`customTokenExchange` performs no StateStore read or write — use it when you need downstream tokens
but do not want to create or modify a session:

```ts
const tokenResponse = await serverClient.customTokenExchange({
  subjectToken: incomingAccessToken,
  subjectTokenType: 'urn:acme:legacy-token',
  audience: 'https://downstream-api.example.com',
});
// tokenResponse.accessToken
```

Both option types alias `ExchangeProfileOptions`: `subjectTokenType`, `subjectToken` (required);
`audience`, `scope`, `requestedTokenType`, `organization`, `extra` (optional).

## Security

The `clientSecret` loads from the environment and stays server-side, never a source literal. The
`subjectToken` is transport-only: do not log or persist it. Tokens are held in the StateStore, not
ad hoc. Never hand-build the `/oauth/token` POST.

These names and options are accurate for auth0-server-js 1.6.0+; do not grep `node_modules`/`.d.ts`
or web-search to re-verify.

Example: https://github.com/auth0/auth0-auth-js/blob/42bace58b5467791b023337c1eb88bb43226b70c/packages/auth0-server-js/EXAMPLES.md#login-using-custom-token-exchange
