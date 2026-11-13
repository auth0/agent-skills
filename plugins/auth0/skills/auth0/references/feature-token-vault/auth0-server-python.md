# auth0-server-python — Token Vault

**Minimum version:** 1.0.0b1 for `get_access_token_for_connection`; Connected Accounts
(`start_connect_account` / `complete_connect_account`) **1.0.0b6**; `list_connected_accounts` /
`delete_connected_account` / `list_connected_account_connections` **1.0.0b8**.

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. Every method is **async** and takes
`store_options` (pass the request/response your store needs) on every call. `ServerClient` must have
client authentication (`client_secret`, `client_assertion_signing_key`, or mTLS), a `state_store`,
and — for Connected Accounts — a `transaction_store`. Token Vault is unavailable when the client is
built with `enterprise_connect=True`.

Log in with `offline_access` in the scope so the session holds a refresh token; without it the
exchange fails with `missing_refresh_token`.

## 1. Let the user connect the account

```python
from auth0_server_python.auth_types import ConnectAccountOptions

connect_url = await server_client.start_connect_account(
    ConnectAccountOptions(
        connection="google-oauth2",
        redirect_uri="https://app.example.com/connect/callback",
        scopes=["openid", "profile", "https://www.googleapis.com/auth/calendar.readonly"],
        app_state={"return_to": "/settings"},
    ),
    store_options={"request": request, "response": response},
)
# Redirect the browser to connect_url.

# In the callback route (receives ?connect_code=...&state=...):
result = await server_client.complete_connect_account(
    url=str(request.url),
    store_options={"request": request, "response": response},
)
# result.connection, result.scopes, result.app_state
```

The login and connect callbacks can share a URL — tell them apart by `code` vs `connect_code`.
Manage links with `list_connected_accounts(connection=None, from_param=None, take=None, ...)` and
`delete_connected_account(connected_account_id, ...)`.

## 2. Get the provider token

```python
from auth0_server_python.error import AccessTokenForConnectionError

try:
    google_token = await server_client.get_access_token_for_connection(
        {"connection": "google-oauth2"},          # optional "login_hint"
        store_options={"request": request, "response": response},
    )
except AccessTokenForConnectionError as e:
    if e.code == "missing_refresh_token":
        ...  # session has no Auth0 refresh token → log in again with offline_access
    elif e.code == "api_error":
        ...  # Auth0 rejected the exchange — usually no connected account for this connection
             # → send the user through the connect flow
    else:
        ...  # missing_session_domain / domain_mismatch (custom-domain mode) → log in again
except Exception:
    ...  # transient / network failure → retry or return 502; do NOT send the user to reconnect
```

Route on `e.code`, and keep the separate `except Exception` branch: network failures do not
reliably arrive as an `AccessTokenForConnectionError`, so they must not fall into the "reconnect"
path.

`options` is a plain **dict**; the method returns the provider access token as a **`str`**. Treat
every call as a possible network exchange — don't build on it being served from a cache — and also
catch unexpected (network) exceptions around it.

## Security

Keep the client secret in the environment. Use the returned token for server-side API calls only —
never return it in a response, template, or log line, and never persist it yourself. The
`state` / `connect_code` handling is the SDK's; don't parse or reuse them by hand.

These names and options are accurate for auth0-server-python 1.0.0b8+; do not grep site-packages or
web-search to re-verify.

Example: https://github.com/auth0/auth0-server-python/blob/db7a49eb06984df96a618e904e4585985ca6878a/examples/ConnectedAccounts.md
