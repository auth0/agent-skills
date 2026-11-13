# @auth0/auth0-api-js — Token Vault (API / access-token exchange)

**Minimum version:** 1.1.0 (`ApiClient#getAccessTokenForConnection`); DPoP verification in
`verifyAccessToken` needs **1.4.0**; `getToken` with the `DPoP` scheme needs **1.6.1**.

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. This is a **resource-server** SDK: it exchanges
the **incoming Auth0 access token** for the provider token. Options are **camelCase**. It has no
Connected Accounts methods — the user links the account in the front-end app. The method is
stateless and does **not** cache.

`ApiClient` must carry the **Custom API Client** credentials: `clientId` plus `clientSecret` (or
`clientAssertionSigningKey`), and a single `domain` — a `domains`-only (multi-custom-domain) config
cannot use Token Vault.

## Verify the request, then exchange

```ts
import { ApiClient, getToken } from '@auth0/auth0-api-js';
// TokenForConnectionError is NOT re-exported by api-js — import it from auth0-auth-js.
import { TokenForConnectionError } from '@auth0/auth0-auth-js';

const apiClient = new ApiClient({
  domain: process.env.AUTH0_DOMAIN!,
  audience: process.env.AUTH0_AUDIENCE!,
  clientId: process.env.AUTH0_CLIENT_ID!,         // Custom API Client
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});

app.get('/api/calendar', async (req, res) => {
  // 1. Get the raw token (Authorization Bearer/DPoP, query, or form body) and verify it —
  //    including the DPoP proof when the client sent a DPoP-bound token. Invalid → 401.
  let accessToken: string;
  try {
    accessToken = getToken(req.headers, req.query, req.body);
    const isDpop = req.headers.authorization?.split(' ')[0]?.toLowerCase() === 'dpop';
    await apiClient.verifyAccessToken({
      accessToken,
      ...(isDpop
        ? {
            scheme: 'dpop',
            dpopProof: req.headers.dpop as string,
            httpMethod: req.method,
            httpUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
          }
        : {}),
    });
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }

  // 2. Exchange the verified token. A failed exchange is not a crash and never echoes a token.
  let googleToken: string;
  try {
    ({ accessToken: googleToken } = await apiClient.getAccessTokenForConnection({
      connection: 'google-oauth2',
      accessToken,
      // loginHint: '...', // only if the user has several accounts on this connection
    }));
  } catch (err) {
    // TokenForConnectionError with statusCode 401 → user has no connected account (or bad credentials)
    const status = err instanceof TokenForConnectionError && err.statusCode === 401 ? 403 : 502;
    return res.status(status).json({ error: 'token_vault_exchange_failed' });
  }

  // 3. Call the provider API server-side; return only the data, never the token.
  const google = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  if (!google.ok) return res.status(502).json({ error: 'calendar_unavailable' });
  res.json(await google.json());
});
```

`AccessTokenForConnectionOptions`: `connection`, `accessToken` (required, the raw token — no
`"Bearer "` prefix, no surrounding whitespace); `loginHint`. The return value is a
**`ConnectionTokenSet` object**: `accessToken`, `expiresAt` (Unix **seconds**), `scope`,
`connection`, `loginHint?`. Cache it yourself until `expiresAt` if you call it often.

**Add DPoP replay protection.** `verifyAccessToken` checks the proof's signature, binding, and
claims (including that `jti` is a string), but does not reject a reused `jti`. In production, reject
any proof `jti` already seen — keep seen values in a cache shared across instances until the proof's
`iat` window expires — before exchanging.

## Errors

Catch **`TokenForConnectionError`** with `instanceof` or `err.code` (`'token_for_connection_error'`)
— its `err.name` is `'TokenForConnectionErrorCode'`. It is also thrown when `clientId` is missing.
A missing secret throws `MissingClientAuthError`; verification failures throw
`VerifyAccessTokenError` (401) / `InvalidDpopProofError` (400); `getToken` throws
`InvalidRequestError`.

## Security

Verify before exchanging, keep the client secret in the environment, and use the provider token only
for the outbound call — never return it to the caller, log it, or persist it.

These names and options are accurate for auth0-api-js 1.6.1+; do not grep `node_modules`/`.d.ts` or
web-search to re-verify.

Example: https://github.com/auth0/auth0-auth-js/blob/57234236a18f4d88d9709f12012a61bec8d8b855/packages/auth0-api-js/EXAMPLES.md#L601-L636
