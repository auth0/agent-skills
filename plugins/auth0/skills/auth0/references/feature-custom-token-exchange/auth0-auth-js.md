# @auth0/auth0-auth-js — Custom Token Exchange

**Minimum version:** 1.2.0 (`AuthClient#exchangeToken`).

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. `@auth0/auth0-auth-js`
is the low-level building block; `AuthClient` is a confidential client (it takes a `clientSecret`).
Options are **camelCase**.

**Dual-purpose method, one trap:** `exchangeToken` is a **CTE profile exchange when `connection` is
absent**, and a Token Vault exchange when `connection` is present. For Custom Token Exchange, **omit
`connection`**. The deprecated `getTokenForConnection` is Token Vault only — never CTE.

## Exchange an external token

```ts
import { AuthClient } from '@auth0/auth0-auth-js';

const authClient = new AuthClient({
  domain: 'your-tenant.auth0.com',
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
});

const tokens = await authClient.exchangeToken({
  subjectToken: externalToken,
  subjectTokenType: 'urn:acme:legacy-token', // non-reserved URI; no `connection` for CTE
  audience: 'https://api.example.com',
  scope: 'openid profile read:data',
});

console.log(tokens.accessToken);
```

`ExchangeProfileOptions` (camelCase): `subjectTokenType`, `subjectToken` (required); `audience`,
`scope`, `requestedTokenType`, `organization`, `extra` (optional).
`TokenResponse`: `accessToken`, `idToken?`, `refreshToken?`, `expiresAt`, `scope?`, `claims?`,
`tokenType?`, `issuedTokenType?`, `act?`.

When `organization` is provided and an ID token is returned, its org claim is validated against the
requested value; a mismatch throws `OrganizationValidationError`.

## Security

`AuthClient` is confidential — the `clientSecret` loads from the environment and stays server-side,
never a source literal. The `subjectToken` is transport-only: do not log or persist it. Never
hand-build the `/oauth/token` POST.

Do **not** pass `connection` for CTE (that switches to Token Vault), and do **not** use
`getTokenForConnection` as if it were CTE. These names and options are accurate for auth0-auth-js
1.2.0+; do not grep `node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/auth0-auth-js/blob/42bace58b5467791b023337c1eb88bb43226b70c/packages/auth0-auth-js/examples/custom-token-exchange.md
