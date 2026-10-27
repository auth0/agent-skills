# @auth0/auth0-auth-js — Token Vault

**Minimum version:** 1.2.0 (`AuthClient#exchangeToken` with `connection`).

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. `@auth0/auth0-auth-js` is the low-level building
block; `AuthClient` must be a **confidential** client (`clientSecret`, or `clientAssertionSigningKey`)
— without client auth it throws `MissingClientAuthError`. Options are **camelCase**. This SDK does
the exchange only; it has **no** Connected Accounts / My Account API methods.

**Dual-purpose method, one trap:** `exchangeToken` is a **Token Vault exchange only when
`connection` is present**. Without `connection` it is Custom Token Exchange — a different grant.

## Exchange an access token (backend API)

Verify the incoming request **before** exchanging its token, with DPoP-aware validation: SPA
front ends that enable `useDpop` send DPoP-bound tokens, and claims-only checks would let a copied
DPoP-bound token through without its proof. For Express, `express-oauth2-jwt-bearer`'s `auth()`
verifies DPoP proofs by default (hybrid mode — plain Bearer tokens still pass). `auth0-auth-js`
does not verify requests itself.

**Add DPoP replay protection.** `auth()` checks the proof's signature and that its `jti` exists, but
does **not** reject a reused `jti`, so a captured proof can be replayed within its validity window.
In production, reject any `jti` already seen — keep seen values in a cache shared across instances
until the proof's `iat` window expires — before calling `exchangeToken`. The SDK's EXAMPLES.md
("DPoP jti Replay Prevention") shows the pattern.

```ts
import { AuthClient } from '@auth0/auth0-auth-js';

const authClient = new AuthClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,         // the Custom API Client
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});

// `auth0AccessToken` is the raw incoming token (Bearer or DPoP scheme), already verified —
// including its DPoP proof when the scheme is DPoP — by your JWT middleware.
const { accessToken: googleToken, expiresAt } = await authClient.exchangeToken({
  connection: 'google-oauth2',
  subjectToken: auth0AccessToken,
  subjectTokenType: 'urn:ietf:params:oauth:token-type:access_token',
  // loginHint: 'user@example.com', // only if the user has several accounts on this connection
});
```

## Exchange a refresh token (web/server app)

```ts
const { accessToken: googleToken } = await authClient.exchangeToken({
  connection: 'google-oauth2',
  subjectToken: auth0RefreshToken,
  subjectTokenType: 'urn:ietf:params:oauth:token-type:refresh_token', // REQUIRED — default is access_token
});
```

`TokenVaultExchangeOptions` (camelCase): `connection`, `subjectToken` (required); `subjectTokenType`
(defaults to the **access-token** type), `loginHint`, `requestedTokenType`, `extra`, and `scope`
— `scope` down-scoping is **Early Access**; omit it unless the tenant has that feature enabled.
`TokenResponse`: the provider token is `accessToken`; `expiresAt` is Unix **seconds**. The SDK does
not cache — reuse the token until `expiresAt` within the request, then exchange again.

## Error handling

```ts
import { TokenExchangeError, MissingClientAuthError } from '@auth0/auth0-auth-js';

try {
  await authClient.exchangeToken({ connection, subjectToken, subjectTokenType });
} catch (err) {
  if (err instanceof TokenExchangeError) {
    // err.cause?.error / error_description from Auth0; err.statusCode 401 = invalid/expired
    // subject token or bad client credentials, or the user has no connected account for `connection`
  } else if (err instanceof MissingClientAuthError) {
    // AuthClient was built without a client secret / assertion key
  }
}
```

## Security

The client secret loads from the environment and stays server-side. Never return `accessToken` (the
provider token) to the browser, and never log or persist it. Do not pass `audience` or `resource` —
the SDK throws for Token Vault — and do not prefix `subjectToken` with `"Bearer "`.

Use `exchangeToken`, not the deprecated `getTokenForConnection` / `TokenForConnectionError` (the
repo's `examples/tokens.md` still shows the deprecated API). These names and options are accurate
for auth0-auth-js 1.2.0+; do not grep `node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/auth0-auth-js/blob/cf3e4917cefe52fc73ce9dc231ef7130aedf50ca/packages/auth0-auth-js/README.md#L144-L197
