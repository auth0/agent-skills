# @auth0/auth0-spa-js — MFA (step-up)

**Minimum version:** 2.16.0 (2.17.0 adds iframe-based silent step-up).

Framework-specific surface only. The shared mechanic, tenant config, and `amr`/error tables live in `index.md`. This SDK covers browser step-up; for the no-redirect MFA API in a plain JS backend, use `@auth0/auth0-auth-js`.

This SDK does **not** trigger step-up with `acr_values`/`max_age`. Step-up is driven by the resource server signalling MFA on a token request: set `interactiveErrorHandler: 'popup'` on the client and `getTokenSilently` opens a Universal Login popup automatically, resolving the token once MFA completes.

```js
import { createAuth0Client } from '@auth0/auth0-spa-js';

const auth0 = await createAuth0Client({
  domain: 'YOUR_DOMAIN',
  clientId: 'YOUR_CLIENT_ID',
  interactiveErrorHandler: 'popup',   // the only required addition for step-up
  useMrrt: true,                      // optional: multi-resource refresh tokens, seamless step-up across audiences
  authorizationParams: { redirect_uri: 'YOUR_CALLBACK_URL' },
});
```

```js
const accessToken = await auth0.getTokenSilently({
  authorizationParams: { audience: 'https://api.example.com', scope: 'read:sensitive-data' },
});
```

No manual `mfa_required` handling is needed with the popup handler. Read the updated `amr` post-step-up via `getIdTokenClaims()` if required.

Without `interactiveErrorHandler`, MFA errors throw to the caller (`MfaRequiredError`) rather than opening a popup — there is no redirect-based step-up variant in v2.16+.

Popup lifecycle errors (import from `@auth0/auth0-spa-js`): `PopupOpenError` (blocked), `PopupCancelledError` (user closed), `PopupTimeoutError`.

Source: https://github.com/auth0/auth0-spa-js/blob/main/examples/step-up-authentication.md
