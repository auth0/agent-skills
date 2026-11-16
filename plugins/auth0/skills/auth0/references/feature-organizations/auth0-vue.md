# @auth0/auth0-vue — Organizations

**Minimum version:** 2.0.0 — organizations is supported since the initial 2.x release; `org_name` support was added in 2.3.0.

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. Public
SPA client — no dedicated `organization` option; pass it inside `authorizationParams`.

## Org-scoped login

Configure on the plugin (`createAuth0({ authorizationParams: { organization: 'org_barkbook_acme' } })`,
applies to every login) or per call:

```js
const { loginWithRedirect } = useAuth0();
loginWithRedirect({ authorizationParams: { organization: 'org_barkbook_acme' } });
```

## Accepting an invitation

Read `invitation` + `organization` off the URL and forward **both**; forward the invite's own
`organization`, not your default:

```js
const params = new URLSearchParams(window.location.search);
const invitation = params.get('invitation');
const organization = params.get('organization');
if (invitation && organization) {
  loginWithRedirect({ authorizationParams: { organization, invitation } });
}
```

A plugin-level default `organization` is validated against the returned `org_id` and rejects
cross-org invites — pass `organization` per login call for cross-org acceptance.

## Reading the organization back

```js
const { idTokenClaims } = useAuth0();
const orgId = idTokenClaims.value?.org_id; // reactive ref
```

All method names above are accurate for auth0-vue 2.x — do not grep `node_modules` or read
`.d.ts` files to re-verify them.
