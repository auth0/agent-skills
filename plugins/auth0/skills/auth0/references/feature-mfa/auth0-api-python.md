# auth0-api-python — MFA (API-side scope gate)

**Minimum version:** `auth0-api-python>=1.0.0b10`. Only `1.0.0` pre-releases are published (`1.0.0b1`–`1.0.0b10`); there is no stable release yet, so install with a pre-release-aware spec (e.g. `pip install "auth0-api-python>=1.0.0b10"` or `--pre`).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. This is a **resource-server** SDK: it does not run MFA. The tenant issues the step-up scope (e.g. `transfer:funds`) only after the user completes MFA, and the API's job is to enforce that a caller lacking that scope is rejected.

Import:

```python
from auth0_api_python import ApiClient, ApiClientOptions, VerifyAccessTokenError
```

Instantiate with `domain` and `audience` from environment variables — never hardcoded in source:

```python
client = ApiClient(
    ApiClientOptions(
        domain=AUTH0_DOMAIN,
        audience=AUTH0_AUDIENCE,
    )
)
```

**Token verification:**

- `await client.verify_access_token(access_token)` → decoded claims `dict`. Raises `VerifyAccessTokenError` on invalid/expired token.
- `await client.verify_request(headers)` → same; extracts the bearer token from `headers["authorization"]` automatically.

Both methods are `async` — always `await` them. On error, `VerifyAccessTokenError.get_status_code()` returns `401`.

**Scope gate pattern.** The step-up scope (`transfer:funds`) is a value inside the `scope` claim string, space-delimited. Split and check:

```python
scopes = claims.get("scope", "").split()
if "transfer:funds" not in scopes:
    return JSONResponse({"error": "insufficient_scope"}, status_code=403)
```

**Do NOT use `required_claims` for scope value enforcement.** `required_claims` only checks that the listed key exists in the claims dict — it does not validate the claim's value. `required_claims=["scope"]` passes if the `scope` key is present with any value (including an empty string). `required_claims=["transfer:funds"]` checks whether `"transfer:funds"` is a key in the claims dict (which it never is), not whether it appears in the scope string. The correct approach is string-splitting as shown above.

**Gate on `POST /api/transfers` (FastAPI example):**

```python
from fastapi import FastAPI, Header, HTTPException
from auth0_api_python import ApiClient, ApiClientOptions, VerifyAccessTokenError

app = FastAPI()
client = ApiClient(ApiClientOptions(domain=AUTH0_DOMAIN, audience=AUTH0_AUDIENCE))

@app.post("/api/transfers")
async def transfer_funds(authorization: str = Header(...)):
    try:
        claims = await client.verify_request({"authorization": authorization})
    except VerifyAccessTokenError as e:
        raise HTTPException(status_code=e.get_status_code(), detail="Unauthorized")

    scopes = claims.get("scope", "").split()
    if "transfer:funds" not in scopes:
        raise HTTPException(status_code=403, detail="insufficient_scope")

    # proceed with transfer logic
    return {"status": "ok"}
```

Apply the `transfer:funds` gate **only** to the sensitive endpoint — leave `GET /api/balance` requiring only `read:balance` (no MFA step-up needed).

**Note:** the SDK's own `EXAMPLES.md` covers `verify_access_token` and `verify_request` usage, but this file remains the authoritative reference for the MFA scope-gate pattern.
