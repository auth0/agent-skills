# express-openid-connect — MFA (redirect step-up)

**Minimum version:** 2.17.0.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. This SDK is redirect-only — it has no MFA API client; step-up goes through Universal Login.

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
// Note: returnTo uses req.originalUrl. After MFA, Auth0 redirects the browser back via GET.
// A POST /transfer with a request body cannot be replayed by a redirect — store the pending
// action server-side (session or signed cookie) before calling res.oidc.login(), and read it
// back on the GET resume rather than re-reading req.body.
```

`login(options)` returns `Promise<void>` and issues the redirect itself — don't also call `res.redirect`. After Universal Login completes MFA it returns to `returnTo`, the gate re-runs, and `amr` now includes `mfa`.

**Verify off `req.oidc.idTokenClaims`, not `req.oidc.user`.** `req.oidc.user` is a *copy* of the ID-token claims with everything in `identityClaimFilter` deleted; `amr` is not in the default filter (so `user.amr` usually works), but a custom `identityClaimFilter` can silently drop it. `req.oidc.idTokenClaims` always carries the full, already-validated claim set — read `amr` there. A frontend check is UX only; this server-side gate is the enforcement.

**Verify the returned session with `afterCallback`.** After Universal Login completes MFA and redirects back, express-openid-connect processes the callback and updates the session. Add an `afterCallback` hook to confirm the new session actually contains MFA evidence before accepting it — this prevents a case where the user abandons MFA but the session is still updated.

The `session` argument passed to `afterCallback` is a **plain object** (`Object.assign({}, tokenSet)`) — it has the raw token fields (`id_token`, `access_token`, `token_type`, `expires_at`, `refresh_token`, `sid`) but **no `claims` property**. To read `amr`, decode the `id_token` payload directly (it's already signature-verified at this point — this is safe base64 parsing, not re-verification):

```js
const MFA_ACR = 'http://schemas.openid.net/pape/policies/2007/06/multi-factor';

const config = {
  // ... other config ...
  afterCallback: (req, res, session) => {
    // afterCallback fires on every OIDC callback — scope this check to step-up transactions only.
    // Decode the already-verified id_token payload — session.claims does NOT exist
    const payload = JSON.parse(
      Buffer.from(session.id_token.split('.')[1], 'base64url').toString()
    );
    // Only enforce MFA when the step-up ACR was requested; skip for normal logins
    if (payload.acr === MFA_ACR) {
      const amr = payload.amr;
      if (!Array.isArray(amr) || !amr.includes('mfa')) {
        throw new Error('MFA not completed');
      }
    }
    return session;
  },
};
```

Throwing from `afterCallback` aborts the callback and returns a 401, preventing a bypass where the user completes login without MFA. **Do not read node_modules to verify the session shape** — the structure above is confirmed from the express-openid-connect 2.19.x source (`context.js` lines 403-414).
