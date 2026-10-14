# react-native-auth0 — Custom Token Exchange

**Minimum version:** 5.4.0 (`customTokenExchange` on `useAuth0()` and the `Auth0` class).

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. Options are
**camelCase** (`CustomTokenExchangeParameters`).

**Two entry points, different storage behavior:**
- The **`useAuth0()` hook** `customTokenExchange` auto-persists via the credentials manager and
  dispatches `LOGIN_COMPLETE` (so `user` updates). Prefer this in components.
- The **`Auth0` class** method returns `Credentials` but does **not** auto-store — you persist them.

## From the useAuth0() hook

```typescript
import { useAuth0 } from 'react-native-auth0';

function TokenExchangeScreen() {
  const { customTokenExchange, user } = useAuth0();

  const handleExchange = async () => {
    const credentials = await customTokenExchange({
      subjectToken: 'token-from-external-provider',
      subjectTokenType: 'urn:acme:legacy-system-token', // non-reserved URI
      scope: 'openid profile email',
      audience: 'https://api.example.com',
    });
    // credentials stored automatically; `user` updates
  };
}
```

## From the Auth0 class

```typescript
import Auth0 from 'react-native-auth0';

const auth0 = new Auth0({ domain: 'YOUR_AUTH0_DOMAIN', clientId: 'YOUR_CLIENT_ID' });

const credentials = await auth0.customTokenExchange({
  subjectToken: externalToken,
  subjectTokenType: 'urn:acme:legacy-system-token',
});
// NOT auto-stored — persist via the credentials manager yourself
```

`CustomTokenExchangeParameters`: `subjectToken`, `subjectTokenType` (required); `audience`, `scope`,
`organization` (optional). `Credentials`: `idToken`, `accessToken`, `tokenType`, `expiresAt`,
`refreshToken?`, `scope?`.

> Client-side the SDK only checks that `subjectTokenType` is a valid, non-empty URI; the
> documented "`https://`/`urn:` only" and reserved-namespace rules are **server-enforced**. Still
> use a non-reserved URI you control — the tenant will reject reserved ones.

## Security

Public mobile client: **no `client_secret`**. Prefer the hook path so credentials are stored by the
SDK's credentials manager; if you use the class API, persist via the credentials manager, never by
hand, and never log or persist the subject token. Never hand-build a `/oauth/token` POST.

These names and parameters are accurate for react-native-auth0 5.4.0+; do not grep `node_modules`
or web-search to re-verify.

Example: https://github.com/auth0/react-native-auth0/blob/7069a2bae1f236b367009bcef44a3fcd550d0205/EXAMPLES.md#custom-token-exchange-rfc-8693
