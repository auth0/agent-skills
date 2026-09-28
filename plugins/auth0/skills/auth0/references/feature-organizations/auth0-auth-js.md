# @auth0/auth0-auth-js — Organizations

**Minimum version:** 1.10.0 (ID-token organization-claim validation was added in 1.10.0 — earlier 1.x releases do not have it).

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. This is
the low-level auth client (`AuthClient`) — you drive the authorization URL and code exchange
yourself. No hooks, no `useOrganization`.

## Org-scoped login

Pass `organization` inside `authorizationParams` when building the authorization URL — i.e. as
`authorizationParams.organization`, not a top-level or legacy option:

```ts
import { AuthClient } from '@auth0/auth0-auth-js';

const authClient = new AuthClient({ domain, clientId, clientSecret });

const { authorizationUrl } = await authClient.buildAuthorizationUrl({
  authorizationParams: { redirect_uri, organization: 'org_barkbook_acme' },
});
```

## Accepting an invitation

Read `invitation` + `organization` off the callback/login request URL and forward **both** inside
`authorizationParams` to `buildAuthorizationUrl`; forward the invite's own `organization`, not
the configured default. Never reject a valid invitation because its org differs from the default.

## Validation + reading org back

Exchange the code with `getTokenByCode`, passing the full callback URL plus the persisted
`codeVerifier` **and** the `organization` option in the same options object, so the SDK validates
the `org_id` claim of the returned ID token. Handle `OrganizationValidationError` (imported from
`@auth0/auth0-auth-js`) when the claim is missing or mismatched:

```ts
import { OrganizationValidationError } from '@auth0/auth0-auth-js';

try {
  const tokens = await authClient.getTokenByCode(callbackUrl, {
    codeVerifier,                       // the PKCE verifier persisted from buildAuthorizationUrl
    organization: 'org_barkbook_acme',  // validates org_id on the returned ID token
  });
  const orgId = tokens.claims?.org_id;
  const orgName = tokens.claims?.org_name; // human-readable name, when the tenant sets one
} catch (err) {
  if (err instanceof OrganizationValidationError) { /* reject / re-auth */ }
}
```

Use this Authorization Code flow for org login. Do **not** reach for `getTokenByPassword` (ROPC)
to add organizations — it is not the org login path and does not carry `authorizationParams`.

## Security

Keep the client ID/secret/domain in env vars, never in source. Do not use a React SDK or
`express-openid-connect` here.

All method and type names above are accurate for auth0-auth-js 1.x — do not read `node_modules`
to re-verify them.
