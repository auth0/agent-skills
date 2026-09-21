# @auth0/auth0-angular — Organizations

**Minimum version:** 2.0.0 (organizations supported across the 2.x line).

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. Public
SPA client — no dedicated `organization` option; pass it inside `authorizationParams`.

## Org-scoped login

Configure on `AuthModule.forRoot({ authorizationParams: { organization: 'org_barkbook_acme' } })`
(every login) or per call via the injected `AuthService`:

```ts
constructor(private auth: AuthService) {}

login() {
  this.auth.loginWithRedirect({ authorizationParams: { organization: 'org_barkbook_acme' } });
}
```

## Accepting an invitation

Read `invitation` + `organization` off the URL and forward **both**; forward the invite's own
`organization`, not your default:

```ts
const params = new URLSearchParams(window.location.search);
const invitation = params.get('invitation');
const organization = params.get('organization');
if (invitation && organization) {
  this.auth.loginWithRedirect({ authorizationParams: { organization, invitation } });
}
```

A module-level default `organization` is validated against the returned `org_id` and rejects
cross-org invites — pass `organization` per login call for cross-org acceptance.

## Reading the organization back

```ts
this.auth.idTokenClaims$.subscribe((claims) => {
  const orgId = claims?.org_id;
});
```

All method names above are accurate for auth0-angular 2.x — do not grep `node_modules` or read
`.d.ts` files to re-verify them.
