# express-oauth2-jwt-bearer — Organizations (API side)

**Minimum version:** 1.0.0 (`claimEquals`/`claimCheck` have existed since the SDK's first release; current major is 1.x).

Framework-specific surface only. The protocol shape, `org_id`-reading guidance, tenant config,
and common mistakes live in the shared Organizations reference. This SDK **validates** bearer
tokens on a resource API — it does not perform login. Organizations here means: enforce the
`org_id` claim on the verified access token to prevent cross-tenant access.

## Enforce org membership

Protect the route with `auth()` for JWT validation, then gate on `org_id` with the SDK's claim
helpers — never a manual comparison in the handler:

```js
const { auth, claimEquals, claimCheck } = require('express-oauth2-jwt-bearer');

app.use(auth()); // issuer/audience from ISSUER_BASE_URL / AUDIENCE

// Single-org: require an exact org_id
app.get('/api/org/members', claimEquals('org_id', process.env.ACME_ORG_ID), (req, res) => { /* ... */ });

// Multi-org: validate against a known set
const allowed = new Set(process.env.ALLOWED_ORG_IDS.split(','));
app.get('/api/org/data', claimCheck((payload) => allowed.has(payload.org_id)), handler);
```

A missing or mismatched `org_id` yields a 401/403 from the middleware. Do **not** hardcode a
single `!== defaultOrg` check when the API serves multiple orgs.

## Reading the organization back

Claims live on `req.auth.payload` (**not** `req.user`):

```js
const orgId = req.auth.payload.org_id;
```

## Security / correctness

- Keep issuer/audience/org ID in env vars (`ISSUER_BASE_URL`, `AUDIENCE`, `ACME_ORG_ID`), not in
  source.
- Use `org_id` (stable identifier) for enforcement, not `org_name` (display slug).
- Do not decode the JWT by hand (`jsonwebtoken`, `jwt-decode`) — `auth()` already verifies it.
- Do not invent helpers like `requiresOrg()` / `requiresOrganization()` — they do not exist.

All helper names above are accurate for express-oauth2-jwt-bearer 1.x — do not read
`node_modules` to re-verify them.
