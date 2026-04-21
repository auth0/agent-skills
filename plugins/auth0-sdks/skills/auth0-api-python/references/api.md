# API Reference & Testing

## ApiClientOptions — Configuration Reference

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `domain` | `str` | Yes (or `domains`) | — | Auth0 tenant domain, e.g., `your-tenant.us.auth0.com`. No `https://` prefix. |
| `audience` | `str` | Yes | — | API audience (identifier URL), e.g., `https://my-python-api`. Must match exactly. |
| `domains` | `list[str]` or `callable` | No | — | Multi-custom domain list or resolver function. Replaces `domain` for token verification when set. |
| `client_id` | `str` | No | — | Required only for management operations (token exchange, connection access tokens). Not needed for JWT-only validation. |
| `client_secret` | `str` | No | — | Required only for management operations. Never needed for pure JWT validation. |
| `timeout` | `float` | No | Library default | HTTP timeout in seconds for Auth0 API calls. |
| `dpop_enabled` | `bool` | No | `False` | Accept both Bearer and DPoP tokens when `True`. |
| `dpop_required` | `bool` | No | `False` | Require DPoP tokens; reject plain Bearer tokens when `True`. Setting this implicitly enables DPoP. |
| `dpop_iat_leeway` | `int` | No | Library default | Leeway in seconds for DPoP `iat` claim validation. |
| `dpop_iat_offset` | `int` | No | Library default | Allowed offset in seconds for DPoP `iat` claim. |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain (no `https://`, no trailing slash) |
| `AUTH0_AUDIENCE` | Yes | API identifier URL (must match Auth0 Dashboard exactly) |

`.env` file template:
```ini
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://my-python-api
```

> **Never store client secrets in `.env` committed to source control.** For management operations requiring `client_secret`, use environment variables injected at runtime (e.g., via your deployment platform's secrets manager).

---

## ApiClient Methods

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `verify_access_token` | `async (access_token: str, required_claims: list[str] = None) -> dict` | Decoded claims dict | Validates JWT signature, issuer, audience, expiry, and optional required claims |
| `verify_request` | `async (headers: dict, http_method: str = None, http_url: str = None) -> dict` | Decoded claims dict | Auto-detects Bearer vs DPoP from `authorization` header and validates accordingly |
| `verify_dpop_proof` | `async (access_token: str, proof: str, http_method: str, http_url: str) -> dict` | DPoP proof claims | Validates a DPoP proof JWT independently |
| `get_access_token_for_connection` | `async (params: dict) -> str` | Access token string | Fetches a connection-scoped access token (requires `client_id` + `client_secret`) |
| `get_token_by_exchange_profile` | `async (**kwargs) -> dict` | Token response dict | Custom token exchange (requires `client_id` + `client_secret`) |

---

## Claims Reference

Standard OIDC and Auth0-specific claims in a validated access token:

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | Subject — unique user or M2M client identifier |
| `iss` | string | Issuer — Auth0 tenant URL (`https://your-tenant.auth0.com/`) |
| `aud` | string or array | Audience — your API identifier; validated against `audience` option |
| `exp` | int | Expiry — Unix timestamp; validated automatically |
| `iat` | int | Issued at — Unix timestamp |
| `azp` | string | Authorized party — client ID of the application that requested the token |
| `scope` | string | Space-separated list of requested scopes (e.g., `openid profile`) |
| `permissions` | array of strings | RBAC permissions assigned to the user/role (e.g., `["read:data", "write:data"]`). Requires RBAC enabled on the API in Auth0 Dashboard. |
| `gty` | string | Grant type (e.g., `client-credentials` for M2M tokens) |

> **RBAC note:** The `permissions` claim is populated only when:
> 1. "Enable RBAC" is toggled on in Auth0 Dashboard → APIs → Your API → Settings
> 2. "Add Permissions in the Access Token" is enabled on the same screen
> 3. The user or M2M client has roles/permissions assigned

---

## Complete Code Examples

### Minimal Flask API

```python
# requirements.txt
# auth0-api-python>=1.0.0b8
# flask>=3.0
# python-dotenv

import os
import asyncio
from functools import wraps
from dotenv import load_dotenv
from flask import Flask, request, jsonify, g
from auth0_api_python import ApiClient, ApiClientOptions
from auth0_api_python.errors import BaseAuthError

load_dotenv()

app = Flask(__name__)

api_client = ApiClient(ApiClientOptions(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE")
))

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing authorization header"}), 401
        token = auth_header.split(" ", 1)[1]
        try:
            g.claims = asyncio.run(api_client.verify_access_token(token))
        except BaseAuthError as e:
            return jsonify({"error": str(e)}), e.get_status_code()
        return f(*args, **kwargs)
    return decorated

def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            permissions = g.claims.get("permissions", [])
            if permission not in permissions:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/api/public")
def public():
    return jsonify({"message": "Public endpoint"})

@app.route("/api/private")
@require_auth
def private():
    return jsonify({"message": "Authenticated", "sub": g.claims["sub"]})

@app.route("/api/private-scoped")
@require_auth
@require_permission("read:data")
def private_scoped():
    return jsonify({"message": "Authorized", "sub": g.claims["sub"]})

if __name__ == "__main__":
    app.run(port=5000)
```

### FastAPI Integration

```python
# requirements.txt
# auth0-api-python>=1.0.0b8
# fastapi>=0.110
# uvicorn
# python-dotenv

import os
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request
from auth0_api_python import ApiClient, ApiClientOptions
from auth0_api_python.errors import BaseAuthError

load_dotenv()

app = FastAPI()

api_client = ApiClient(ApiClientOptions(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE")
))

async def get_claims(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = auth_header.split(" ", 1)[1]
    try:
        return await api_client.verify_access_token(token)
    except BaseAuthError as e:
        raise HTTPException(status_code=e.get_status_code(), detail=str(e))

def require_permission(permission: str):
    async def dependency(claims: dict = Depends(get_claims)) -> dict:
        if permission not in claims.get("permissions", []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return claims
    return dependency

@app.get("/api/public")
def public():
    return {"message": "Public endpoint"}

@app.get("/api/private")
async def private(claims: dict = Depends(get_claims)):
    return {"message": "Authenticated", "sub": claims["sub"]}

@app.get("/api/private-scoped")
async def private_scoped(claims: dict = Depends(require_permission("read:data"))):
    return {"message": "Authorized", "sub": claims["sub"]}
```

---

## Testing Checklist

- [ ] `curl http://localhost:5000/api/public` returns `200`
- [ ] `curl http://localhost:5000/api/private` returns `401` (no token)
- [ ] `curl -H "Authorization: Bearer INVALID" http://localhost:5000/api/private` returns `401`
- [ ] `curl -H "Authorization: Bearer <valid_test_token>" http://localhost:5000/api/private` returns `200`
- [ ] `curl -H "Authorization: Bearer <token_without_permission>" http://localhost:5000/api/private-scoped` returns `403`
- [ ] `curl -H "Authorization: Bearer <token_with_permission>" http://localhost:5000/api/private-scoped` returns `200`
- [ ] Expired token returns `401`
- [ ] Token with wrong audience returns `401`
- [ ] CORS preflight (`OPTIONS`) succeeds before auth middleware fires
- [ ] M2M client-credentials token works for machine-to-machine testing

**Getting a test token:**
1. Auth0 Dashboard → Applications → APIs → Your API → Test tab
2. Click "Copy Token" — this is a short-lived M2M token for testing
3. For user tokens, use an M2M application with `client_credentials` grant or test via a frontend app

```bash
# Test with the token
export TOKEN="eyJ..."
curl -H "Authorization: Bearer $TOKEN" http://localhost:5000/api/private
```

---

## Common Issues

| Issue | Symptom | Fix |
|-------|---------|-----|
| `InvalidAudienceError` | 401 on all requests | `AUTH0_AUDIENCE` doesn't match the API Identifier in Auth0 Dashboard exactly |
| `InvalidIssuerError` | 401 on all requests | `AUTH0_DOMAIN` has `https://` prefix or trailing slash — use hostname only |
| `TokenExpiredError` | 401 after a few minutes | Expected behavior — refresh the test token or implement token refresh in the client |
| `MissingPermissionsError` / 403 on scoped routes | RBAC not returning `permissions` | Enable RBAC + "Add Permissions in the Access Token" on the API in Auth0 Dashboard |
| `asyncio.run()` error in async framework | `RuntimeError: This event loop is already running` | In FastAPI/async context, use `await` directly instead of `asyncio.run()` |
| CORS 403 on preflight | `OPTIONS` blocked before auth check | Add CORS middleware before authentication (see integration.md) |
| `BaseAuthError.get_status_code()` not found | `AttributeError` | Import from `auth0_api_python.errors`, not the base Python `Exception` |

---

## Security Considerations

- **JWKS validation:** The SDK validates JWT signatures using the public JWKS endpoint (`https://{domain}/.well-known/jwks.json`). No secrets are needed or stored.
- **Audience validation:** Always set `audience` — without it, any valid Auth0 JWT could pass validation.
- **No token logging:** Never log access tokens or the decoded claims dict. Log only `claims["sub"]` if needed.
- **RBAC via `permissions` claim:** Prefer the `permissions` claim over the `scope` claim for authorization decisions. `scope` reflects what was requested; `permissions` reflects what the user/role is granted.
- **DPoP binding:** When using `verify_request()` with DPoP, the token is cryptographically bound to the HTTP method and URL — include both for correct validation.
- **Multi-domain security:** When using dynamic domain resolvers, never trust request-derived values directly. Map them to a fixed allowlist only.
- **Client secret protection:** `client_id` and `client_secret` are only needed for management operations (token exchange). Inject them via environment variables — never hardcode in source.
- **CORS ordering:** Place CORS middleware before authentication middleware so browser preflight `OPTIONS` requests are handled before token validation runs.
