# @auth0/auth0-react — Custom Token Exchange

**Minimum version:** 2.13.0 for `loginWithCustomTokenExchange`; the session-free `customTokenExchange` requires **2.17.0**. (The `exchangeToken` alias, added 2.10.0, is deprecated.)

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. This SDK delegates
to `@auth0/auth0-spa-js`; options are **snake_case**. Call the method **off the `useAuth0()`
hook** — calling the spa-js client directly bypasses React's auth-state dispatch, so `user` /
`isAuthenticated` never update.

## Exchange and establish a session

```jsx
import { useAuth0 } from '@auth0/auth0-react';

function TokenExchange({ externalToken }) {
  const { loginWithCustomTokenExchange } = useAuth0();

  const handleExchange = async () => {
    await loginWithCustomTokenExchange({
      subject_token: externalToken,
      subject_token_type: 'urn:your-company:legacy-system-token', // non-reserved URI
      audience: 'https://api.example.com/',
      scope: 'openid profile email',
    });
    // isAuthenticated / user update via the SDK's state dispatch
  };

  return <button onClick={handleExchange}>Sign in with partner token</button>;
}
```

## Exchange without side effects

`customTokenExchange` (also from `useAuth0()`, react **2.17.0+**) returns the tokens without
updating the session or `isAuthenticated` / `user` — for acting-on-behalf-of cases where you only
need the tokens:

```jsx
const { customTokenExchange } = useAuth0();
const tokenResponse = await customTokenExchange({
  subject_token: externalToken,
  subject_token_type: 'urn:acme:legacy-token',
  audience: 'https://api.example.com',
});
```

`CustomTokenExchangeOptions` / `TokenEndpointResponse` are re-exported from spa-js.

## Security

SPA = public client: **no `client_secret`**. Let the SDK manage the session; never persist the
returned tokens or the `subject_token` in `localStorage` / `sessionStorage` / a cookie. Read
`domain` / `clientId` / `audience` from config, not source literals.

Use the `useAuth0()` methods — **not** a directly instantiated spa-js client, **not** the deprecated
`exchangeToken`, and never a hand-built `/oauth/token` POST. These names and options are accurate
for auth0-react 2.13.0+; do not grep `node_modules`/`.d.ts` or web-search to re-verify.

Example: https://github.com/auth0/auth0-react/blob/66d0c34d0a3060d5e3c39a116b1f9ad0c3de55cf/EXAMPLES.md#custom-token-exchange
