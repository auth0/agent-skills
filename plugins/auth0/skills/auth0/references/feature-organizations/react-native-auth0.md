# react-native-auth0 — Organizations

**Minimum version:** 5.0.0 (organizations supported across the current 5.x line).

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference. This is
a public mobile client — org login goes through `webAuth.authorize`.

## Org-scoped login

Pass a dedicated **`organization`** option to `authorize`:

```js
const { authorize } = useAuth0();
await authorize({ organization: 'org_barkbook_acme' });
```

## Accepting an invitation

The invite link carries `invitation` + `organization`. Pass the **whole inbound URL** as
`invitationUrl` — the SDK extracts both params itself; do not hand-parse them:

```js
await authorize({ invitationUrl: 'https://myapp.com/login?invitation=inv123&organization=org_barkbook_acme' });
```

Forward the invite's own URL as-is; do not substitute your configured default org.

## Reading the organization back

`org_id` is on the ID token. Read it off the decoded user from the hook — no manual decode:

```js
const { user } = useAuth0(); // decoded ID-token claims
const orgId = user?.org_id;
```

## Security

Public mobile client: **no `client_secret`**. Let the SDK's credentials manager store tokens;
do not persist raw tokens by hand.

All option and method names above are accurate for react-native-auth0 5.x — do not grep
`node_modules` or read `.d.ts` files to re-verify them.
