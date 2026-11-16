# express-openid-connect — Organizations

**Minimum version:** 2.0.0 — `organization` is forwarded via `authorizationParams`, so it works across the 2.x and 3.x lines with no dedicated feature version to gate on.

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
const orgName = req.oidc.idTokenClaims?.org_name; // human-readable name, when the tenant sets one
```

To show a human-readable organization name, read `org_name` from the claim (present when the
tenant assigns names) rather than hardcoding a display string mapped from the `org_id`. Use
`org_id` for any membership check.

Validating `org_id` in an `afterCallback` hook (decoding the already-verified `id_token` and
checking `claims.org_id`) is an acceptable, good-practice way to enforce membership.

## Security

Confidential client. Keep **every** tenant value in env vars, never as a string literal in a
`.js`/`.ts` file: the issuer/client ID/secret (`ISSUER_BASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`)
**and the API `audience`** if you request one for an access token (read it from e.g.
`process.env.AUDIENCE`, do not write `audience: 'api.example.com'` inline). Do not use the API
bearer-token SDK (`express-oauth2-jwt-bearer`) or Passport here.

All method names above are accurate for express-openid-connect 2.x — do not read `node_modules`
to re-verify them.
