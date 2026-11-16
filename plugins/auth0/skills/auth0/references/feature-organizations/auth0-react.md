# @auth0/auth0-react — Organizations

**Minimum version:** 2.0.0 — organizations first landed in 1.4.0 and is supported across the entire 2.x line.

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. This
is a public SPA client — there is **no** dedicated `organization` prop; pass it inside
`authorizationParams`. There is **no `useOrganization` hook**.

## Org-scoped login

Set `organization` inside `authorizationParams`, on `Auth0Provider` (every login) or on the
`loginWithRedirect` call:

```jsx
<Auth0Provider
  domain="YOUR_DOMAIN"
  clientId="YOUR_CLIENT_ID"
  authorizationParams={{ redirect_uri: window.location.origin, organization: 'org_barkbook_acme' }}
>

// or per login
const { loginWithRedirect } = useAuth0();
loginWithRedirect({ authorizationParams: { organization: 'org_barkbook_acme' } });
```

## Accepting an invitation

The invite lands as `?invitation={ticket}&organization={org_id}`. Read **both** off the URL and
forward **both** — forward the invite's own `organization`, not your configured default:

```jsx
const params = new URLSearchParams(window.location.search);
const invitation = params.get('invitation');
const organization = params.get('organization');
if (invitation && organization) {
  loginWithRedirect({ authorizationParams: { organization, invitation } });
}
```

A default `organization` on `Auth0Provider` is validated against the returned `org_id` at login
completion and **rejects** invites to other orgs — pass `organization` per login call when you
accept cross-org invitations.

## Reading the organization back

`org_id` is on the ID token after an org login. Use the hook's accessors — never hand-decode:

```jsx
const { user, getIdTokenClaims } = useAuth0();
const orgId = user?.org_id;
const orgName = user?.org_name; // human-readable name, when the tenant sets one
// or: const claims = await getIdTokenClaims(); claims?.org_id;
```

To display a human-readable organization name, read `org_name` from the claim (present when the
tenant assigns names) rather than hardcoding a display string mapped from the `org_id`. Use
`org_id` for any membership check.

## Security

Public client: **no `client_secret`**. Do not persist tokens in `localStorage`/`sessionStorage`
by hand; leave token storage to the SDK.

All prop and method names above are accurate for auth0-react 2.x — do not grep `node_modules`
or read `.d.ts` files to re-verify them.
