# auth0-api-python — Token Vault (API / access-token exchange)

**Minimum version:** 1.0.0b5 (`ApiClient#get_access_token_for_connection`).

Framework-specific surface only. The protocol shape, tenant config, security invariants, and common
mistakes live in the shared Token Vault reference. This is a **resource-server** SDK: it exchanges
the **incoming Auth0 access token** for the provider token. It has no Connected Accounts methods —
the user links the account in the front-end app. The method is **async**, stateless, and does not
cache.

`ApiClient` must carry the **Custom API Client** credentials (`client_id` + `client_secret`; only
client-secret auth is supported). They are checked at call time, not construction.

## Exchange the incoming access token

```python
import os
from auth0_api_python import ApiClient, ApiClientOptions

api_client = ApiClient(ApiClientOptions(
    domain=os.environ["AUTH0_DOMAIN"],
    audience=os.environ["AUTH0_AUDIENCE"],
    client_id=os.environ["AUTH0_CLIENT_ID"],         # Custom API Client
    client_secret=os.environ["AUTH0_CLIENT_SECRET"],
))

# 1. Verify the whole request first — the token's signature, iss, aud, exp, and, when the
#    scheme is DPoP, the DPoP proof and its key binding. verify_access_token alone skips DPoP.
headers = {k.lower(): v for k, v in request.headers.items()}
claims = await api_client.verify_request(
    headers, http_method=request.method, http_url=str(request.url)
)
access_token = headers["authorization"].split(None, 1)[1]  # raw token, Bearer or DPoP scheme

# 2. Exchange the verified token.
result = await api_client.get_access_token_for_connection({
    "connection": "google-oauth2",
    "access_token": access_token,   # the raw incoming Auth0 access token
    # "login_hint": "...",          # only if the user has several accounts on this connection
})
google_token = result["access_token"]   # also result["expires_at"], result["scope"]
```

The return value is a **dict** — index `["access_token"]`; don't print or log the whole result.

**Add DPoP replay protection.** `verify_request` checks the DPoP proof's signature, binding, and
required claims (including that `jti` is present), but does not reject a reused `jti`. In
production, reject any proof `jti` already seen — keep seen values in a cache shared across
instances until the proof's `iat` window expires — before calling `get_access_token_for_connection`.

## Error handling

```python
from auth0_api_python.errors import ApiError, MissingRequiredArgumentError, GetAccessTokenForConnectionError

try:
    result = await api_client.get_access_token_for_connection({...})
except GetAccessTokenForConnectionError:
    ...  # client_id / client_secret not configured
except ApiError as e:
    ...  # e.code / e.status_code from Auth0 (401 → user has no connected account) or a transport error
```

## Security

Verify the incoming request with `verify_request` before exchanging its token (front ends that
enable DPoP send DPoP-bound tokens), keep the client secret in the environment, and use
the provider token only for the outbound call — never return it to the caller or persist it.

These names and options are accurate for auth0-api-python 1.0.0b5+; do not grep site-packages or
web-search to re-verify.

Example: https://github.com/auth0/auth0-api-python/blob/fae6405acbccb6046c63f09184b8ef0bef3a97eb/README.md#L98-L123
