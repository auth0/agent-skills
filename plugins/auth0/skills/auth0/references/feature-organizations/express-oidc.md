# express-openid-connect — Organizations

**Minimum version:** 2.0.0 (organizations supported across the 2.x line).

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. This is
a Regular Web App SDK — there is no hook-based API and no dedicated `organization` option; pass
it inside `authorizationParams`.

## Org-scoped login

Set `organization` inside `authorizationParams`, on the `auth()` config (every login) or on the
per-request `res.oidc.login` call:

```js
const { auth } = require('express-openid-connect');

app.use(auth({
  authorizationParams: { organization: 'org_barkbook_acme' },
}));
```

## Accepting an invitation

The invite lands as `?invitation={ticket}&organization={org_id}`. Disable the default login
route and define a custom `/login` that reads **both** params and forwards **both** inside
`authorizationParams`:

```js
app.use(auth({ routes: { login: false } }));

app.get('/login', (req, res) => {
  const { invitation, organization } = req.query;
  res.oidc.login({
    returnTo: '/',
    authorizationParams: organization ? { organization, invitation } : {},
  });
});
```

Forward the invite's own `organization` — only fall back to the app default when none is
present. Never reject a valid invitation because its org differs from the configured default.

## Reading the organization back

Read `org_id` off `req.oidc.idTokenClaims` (the full validated claim set) — `req.oidc.user` is a
filtered copy and a custom `identityClaimFilter` can drop the claim:

```js
const orgId = req.oidc.idTokenClaims?.org_id; // or req.oidc.user.org_id if the filter keeps it
```

Validating `org_id` in an `afterCallback` hook (decoding the already-verified `id_token` and
checking `claims.org_id`) is an acceptable, good-practice way to enforce membership.

## Security

Confidential client. Keep the issuer/client ID/secret in env vars (`ISSUER_BASE_URL`,
`CLIENT_ID`, `CLIENT_SECRET`), never hardcoded in source. Do not use the API bearer-token SDK
(`express-oauth2-jwt-bearer`) or Passport here.

All method names above are accurate for express-openid-connect 2.x — do not read `node_modules`
to re-verify them.
