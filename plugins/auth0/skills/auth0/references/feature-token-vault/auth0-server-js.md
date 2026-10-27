# @auth0/auth0-server-js — Token Vault

**Minimum version:** 1.0.0 for `ServerClient#getAccessTokenForConnection(options, storeOptions)`;
the third `requestOptions` argument and the `fullResponse` overload need **1.13.0**.

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. This is the framework-agnostic server SDK
(Express, Fastify, Hono, …): it performs the **refresh-token exchange** using the refresh token in
the user's session. Options are **camelCase**. It has **no** Connected Accounts / My Account API
methods — do not hand-roll `/me/v1/connected-accounts` calls.

`ServerClient` needs client authentication (`clientSecret` or `clientAssertionSigningKey` — without
one the call throws `MissingClientAuthError`), a `transactionStore`, and a `stateStore` (the refresh
token and cached provider tokens live there). Keep `offline_access` in the login scope — it is in the
SDK's default scope; don't drop it if you override `authorizationParams.scope`.

## Get the provider token

```ts
import { ServerClient } from '@auth0/auth0-server-js';
// TokenForConnectionError is NOT re-exported by server-js — import it from auth0-auth-js.
import { TokenForConnectionError } from '@auth0/auth0-auth-js';

const auth0 = new ServerClient<StoreOptions>({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  authorizationParams: { redirect_uri: process.env.AUTH0_REDIRECT_URI! },
  transactionStore,
  stateStore,
});

// Express route — pass the same { request, response } store options the rest of the app uses.
app.get('/calendar', async (request, response) => {
  let googleToken: string;
  try {
    ({ accessToken: googleToken } = await auth0.getAccessTokenForConnection(
      { connection: 'google-oauth2' }, // optional loginHint
      { request, response },           // the store must be able to read AND write the session
    ));
  } catch (err) {
    if (err instanceof TokenForConnectionError) {
      // No session / no refresh token / Auth0 rejected the exchange → send the user back through login.
      return response.redirect('/auth/login');
    }
    throw err;
  }

  // Call the provider API server-side; return only the data, never the token.
  const google = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  if (!google.ok) return response.status(502).json({ error: 'calendar_unavailable' });
  response.json(await google.json());
});
```

Handle the failure — **don't let it crash the request**. `err.code` is `'token_for_connection_error'`
and `err.cause?.error` carries Auth0's reason; a missing refresh token means logging in again with
`offline_access`, and a 401 from Auth0 usually means the user has no connected account.

`AccessTokenForConnectionOptions`: `connection` (required), `loginHint`. The return value is a
**`ConnectionTokenSet` object**, not a string: `accessToken`, `expiresAt` (Unix **seconds**),
`scope`, `connection`, `loginHint?`. The SDK caches it in the session per connection and writes the
session on a miss, so pass `storeOptions` that can set the cookie/session.

## Errors

Catch **`TokenForConnectionError`** with `instanceof` or `err.code` — its `err.name` is
`'TokenForConnectionErrorCode'`, not the class name. (The method's JSDoc mentions an
`AccessTokenForConnectionError`; no such class exists — the code throws `TokenForConnectionError`.)
`MissingClientAuthError` is re-exported by server-js. In multi-custom-domain mode a missing or
mismatched session throws `MissingSessionError`.

## Security

Keep the client secret in the environment. Use the provider token only for server-side calls —
never return it to the browser, put it in a template, log it, or persist it yourself. If one user has
several accounts on the same connection, the cache is keyed by connection, so pass `loginHint` and
don't assume a cached token belongs to that hint.

These names and options are accurate for auth0-server-js 1.13.0+; do not grep `node_modules`/`.d.ts`
or web-search to re-verify.

Example: https://github.com/auth0/auth0-auth-js/blob/57234236a18f4d88d9709f12012a61bec8d8b855/packages/auth0-server-js/EXAMPLES.md#L2204-L2229
