# auth0-server-python — Organizations

**Minimum version:** 1.0.0b11 (organization support landed in 1.0.0b11 — not present in 1.0.0b10 or earlier betas).

Framework-specific surface only. The protocol shape, invitation flow, `org_id`-reading
guidance, tenant config, and common mistakes live in the shared Organizations reference.
`store_options` is always `{"request": request, "response": response}`.

**The scaffold already provides a configured `ServerClient`.** Import it and call
`start_interactive_login` / `complete_interactive_login` / `get_user` directly — do not
construct a new client or read site-packages to confirm signatures.

## Org-scoped login

Pass `organization` on `StartInteractiveLoginOptions` (preferred), or configure a default
`organization` on the `ServerClient` constructor:

```python
from auth0_server_python.auth_types import StartInteractiveLoginOptions

url = await server_client.start_interactive_login(
    StartInteractiveLoginOptions(organization="org_barkbook_acme"),
    store_options={"request": request, "response": response},
)
```

Passing a raw dict (`start_interactive_login({"authorization_params": {...}})`) is a failure — a
non-empty dict is not a `StartInteractiveLoginOptions` and raises `AttributeError` at runtime.
`authorization_params={"organization": ...}` on the options object is the fallback when no typed
field exists.

## Accepting an invitation

Read `invitation` + `organization` off the request URL and forward **both** on the options
object; forward the invite's own `organization`, not the configured default:

```python
StartInteractiveLoginOptions(organization=organization, invitation=invitation)
```

## Reading the organization back

After `complete_interactive_login`, read `org_id` through the SDK — `get_user()` or the
completion result — never by decoding the raw token:

```python
user = await server_client.get_user(store_options=store_options)
org_id = user.get("org_id")
```

## Security

Keep the client secret in `.env`, never in source. Do not decode tokens by hand (`jwt.decode`,
`base64.b64decode`) — read claims through the SDK. Do not import the `auth0` Management SDK for
this (wrong package).

All method names above are accurate for auth0-server-python 1.0.0bXX — do not read site-packages
to re-verify them.
