# auth0-api-python — Custom Token Exchange (server-side / OBO)

**Minimum version:** 1.0.0b6 (`get_token_by_exchange_profile`; `get_token_on_behalf_of` landed 1.0.0b9).

Framework-specific surface only. The protocol shape, token-type rules, security invariants, tenant
config, and common mistakes live in the shared Custom Token Exchange reference. This is the
**resource-server / confidential** SDK: an API exchanges a token server-side, authenticating with
HTTP Basic client auth. Methods are **async**, arguments **snake_case**.

**Pick the right method:**
- `get_token_by_exchange_profile(...)` — a **profile exchange** where *the caller supplies*
  `subject_token_type`. Use this for Custom Token Exchange.
- `get_token_on_behalf_of(access_token, audience, ...)` — the OBO case; it **hardcodes** the subject
  and requested token types to `urn:ietf:params:oauth:token-type:access_token` and cannot carry a
  partner `subject_token_type`. Not CTE.

## Exchange by profile

```python
subject_token = "..."  # the external token the request carries

result = await api_client.get_token_by_exchange_profile(
    subject_token=subject_token,
    subject_token_type="urn:example:subject-token",  # non-reserved URI; matches a tenant profile
    audience="https://api.example.com",              # optional
    scope="openid profile email",                    # optional
    requested_token_type="urn:ietf:params:oauth:token-type:access_token",  # optional
)
# result holds access_token, expires_in, expires_at; id_token/refresh_token/scope are profile-dependent
```

**Return only the access token to your caller.** `result` is the full token set and can also carry
`id_token`/`refresh_token`; hand back `result["access_token"]`, not the whole dict. In an async
handler:

```python
try:
    result = await api_client.get_token_by_exchange_profile(
        subject_token=partner_token,
        subject_token_type="urn:example:subject-token",
        audience="https://api.example.com",
    )
except (GetTokenByExchangeProfileError, ApiError):
    return 400, {"error": "exchange_failed"}
return 200, {"access_token": result["access_token"]}
```

Signature: `get_token_by_exchange_profile(subject_token, subject_token_type, audience=None,
scope=None, requested_token_type=None, extra=None) -> dict[str, Any]`.

Extra form fields go in `extra` — but **reserved OAuth parameter names** (`grant_type`, `client_id`,
`scope`, …) raise `GetTokenByExchangeProfileError`, and arrays are capped at 20 values per key.

## Error handling

```python
from auth0_api_python import GetTokenByExchangeProfileError, ApiError

try:
    result = await api_client.get_token_by_exchange_profile(
        subject_token=subject_token,
        subject_token_type="urn:example:subject-token",
    )
except GetTokenByExchangeProfileError as e:
    ...  # blank/whitespace token, "Bearer " prefix, reserved params, missing client_id/secret
except ApiError as e:
    ...  # token-endpoint errors: e.code, e.message, e.status_code
```

## Security

Confidential client: `client_id` / `client_secret` are sent via **HTTP Basic** (not the form body)
and load from the environment — never a source literal. Pass the **raw** `subject_token`; the SDK
rejects a `"Bearer "` prefix (case-insensitive). Keep secrets and sensitive data out of `extra` — it
is sent as form fields and may appear in logs. Never hand-build the `/oauth/token` POST.

Use `get_token_by_exchange_profile` for a profile exchange — **not** `get_token_on_behalf_of`, whose
token types are hardcoded. These names and signatures are accurate for auth0-api-python 1.0.0b6+; do
not grep site-packages or web-search to re-verify.

Example: https://github.com/auth0/auth0-api-python/blob/1a0a4c6e9aa160dd893e8e5c776c7f4d975bf188/README.md
