# auth0-server-python — Custom Token Exchange

**Minimum version:** 1.0.0b8 (`custom_token_exchange` / `login_with_custom_token_exchange` on `ServerClient`).

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. This is a
**server-only, async** SDK. Options are passed as Pydantic objects (`CustomTokenExchangeOptions` /
`LoginWithCustomTokenExchangeOptions`), fields **snake_case**.

## Exchange without a session

`custom_token_exchange` returns the tokens and creates no session:

```python
from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import CustomTokenExchangeOptions

auth0 = ServerClient(
    domain="<AUTH0_DOMAIN>",
    client_id="<AUTH0_CLIENT_ID>",
    client_secret="<AUTH0_CLIENT_SECRET>",
    secret="<AUTH0_SECRET>",
)

response = await auth0.custom_token_exchange(
    CustomTokenExchangeOptions(
        subject_token="custom-token-from-external-system",
        subject_token_type="urn:acme:legacy-token",  # non-reserved URI
        audience="https://api.example.com",
        scope="read:data write:data",
    )
)
print(response.access_token)
```

## Exchange and establish a session

`login_with_custom_token_exchange` additionally writes the session (pass the framework's
`store_options`):

```python
from auth0_server_python.auth_types import LoginWithCustomTokenExchangeOptions

result = await auth0.login_with_custom_token_exchange(
    LoginWithCustomTokenExchangeOptions(
        subject_token="custom-token-from-external-system",
        subject_token_type="urn:acme:legacy-token",
        audience="https://api.example.com",
    ),
    store_options={"request": request, "response": response},
)
user = result.state_data["user"]
```

Options fields: `subject_token`, `subject_token_type` (required); `audience`, `scope`,
`organization`, `authorization_params` (optional). Errors: `CustomTokenExchangeError` with
`CustomTokenExchangeErrorCode` (`INVALID_TOKEN_FORMAT`, `TOKEN_EXCHANGE_FAILED`, `INVALID_RESPONSE`).

## Security

The `client_secret` loads from the environment and stays server-side, never a source literal. The
`subject_token` is transport-only — pass the **raw** token; the SDK rejects a `"Bearer "` prefix. Do
not log or persist it. Never hand-build the `/oauth/token` POST.

These names and options are accurate for auth0-server-python 1.0.0b8+; do not grep site-packages or
web-search to re-verify.

Example: https://github.com/auth0/auth0-server-python/blob/7694b8c4211b72b6c48787c0837280d5388e0c3f/examples/CustomTokenExchange.md
