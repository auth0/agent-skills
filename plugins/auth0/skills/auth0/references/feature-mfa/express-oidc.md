# express-openid-connect — MFA (redirect step-up)

**Minimum version:** 2.17.0.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`. This SDK is redirect-only — it has no MFA API client; step-up goes through Universal Login.

Trigger step-up with `res.oidc.login()` (aliased on the request as `req.oidc.login()`) — pass the PAPE `acr_values` and `max_age: 0` under `authorizationParams`, and a `returnTo` for where Auth0 sends the user after MFA completes:

```js
const { requiresAuth } = require('express-openid-connect');

const MFA_ACR = 'http://schemas.openid.net/pape/policies/2007/06/multi-factor';

// Gate a sensitive route: verify amr server-side, else redirect to step up.
function requiresMfa(req, res, next) {
  const amr = req.oidc.idTokenClaims?.amr;
  if (Array.isArray(amr) && amr.includes('mfa')) return next();
  return res.oidc.login({
    authorizationParams: { acr_values: MFA_ACR, max_age: 0 }, // max_age:0 forces a fresh challenge
    returnTo: req.originalUrl,
  });
}

app.post('/transfer', requiresAuth(), requiresMfa, (req, res) => {
  // reached only after MFA — re-check req.oidc.idTokenClaims.amr before moving funds
});
```

`login(options)` returns `Promise<void>` and issues the redirect itself — don't also call `res.redirect`. After Universal Login completes MFA it returns to `returnTo`, the gate re-runs, and `amr` now includes `mfa`.

**Verify off `req.oidc.idTokenClaims`, not `req.oidc.user`.** `req.oidc.user` is a *copy* of the ID-token claims with everything in `identityClaimFilter` deleted; `amr` is not in the default filter (so `user.amr` usually works), but a custom `identityClaimFilter` can silently drop it. `req.oidc.idTokenClaims` always carries the full, already-validated claim set — read `amr` there. A frontend check is UX only; this server-side gate is the enforcement.

Source: https://github.com/auth0/express-openid-connect
