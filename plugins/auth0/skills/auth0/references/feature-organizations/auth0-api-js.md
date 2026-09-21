# @auth0/auth0-api-js — Organizations (API side)

**Minimum version:** 1.0.0 (organizations supported across the current 1.x line).

Framework-specific surface only. The protocol shape, `org_id`-reading guidance, tenant config,
and common mistakes live in the shared Organizations reference. This SDK **verifies** access
tokens on a resource API — it does not perform login. Organizations here means: verify and
enforce the `org_id` claim on the incoming access token to prevent cross-tenant access.

## Verify the token and require org_id

Create an `ApiClient` and call `verifyAccessToken`; require `org_id` via `requiredClaims` so a
token missing the claim is rejected before your handler runs:

```ts
import { ApiClient } from '@auth0/auth0-api-js';

const apiClient = new ApiClient({ domain: process.env.AUTH0_DOMAIN, audience: process.env.AUTH0_AUDIENCE });

const claims = await apiClient.verifyAccessToken({
  accessToken,
  requiredClaims: ['org_id'],
});
```

## Enforce the specific org

`requiredClaims` only asserts presence — also compare the value against the expected org (or a
known set) and reject with 403 on a mismatch:

```ts
if (claims.org_id !== process.env.ACME_ORG_ID) {
  // respond 403 — token belongs to another organization
}
const orgId = claims.org_id; // read from the verified claims, never from the raw token
```

## Security / correctness

- Keep domain/audience in env vars, never hardcoded in source.
- Read `org_id` from the object `verifyAccessToken` returns — do **not** hand-decode the JWT
  (splitting on dots, `Buffer.from` base64, importing `jose`/`jsonwebtoken`/`jwt-decode`).
- Do not add `express-oauth2-jwt-bearer` or `jwks-rsa` — this SDK handles JWKS internally.

All method names above are accurate for auth0-api-js 1.x — do not read `node_modules` to
re-verify them.
