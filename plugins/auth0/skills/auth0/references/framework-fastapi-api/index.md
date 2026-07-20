
# Auth0 FastAPI API Integration

Protect FastAPI API endpoints with JWT access token validation using `auth0-fastapi-api`.

> **Note:** This SDK is currently in beta. The API surface may change before the stable 1.0 release. Check [PyPI](https://pypi.org/project/auth0-fastapi-api/) for the latest version. Requires Python >= 3.9 and FastAPI >= 0.115.11.

## Prerequisites

- FastAPI application (Python 3.9+)
- Auth0 API resource configured (not an Application — must be an API)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Server-rendered web applications** — Use a session-based login/logout flow instead
- **Single Page Applications** — Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Mobile applications** — Use the Auth0 integration workflow for React Native or Android
- **Issuing tokens** — This skill is for *validating* access tokens, not issuing them

## Quick Start Workflow

### 1. Install SDK

```bash
pip install auth0-fastapi-api python-dotenv
```

### 2. Create Auth0 API

You need an **API** (not Application) in Auth0.

> **STOP — ask the user before proceeding.**
>
> Ask exactly this question and wait for their answer before doing anything else:
>
> > "How would you like to create the Auth0 API resource?
> > 1. **Automated** — I'll run Auth0 CLI scripts that create the resource and write the exact values to your `.env` automatically.
> > 2. **Manual** — You create the API yourself in the Auth0 Dashboard (or via `auth0 apis create`) and provide me the Domain and Audience.
> >
> > Which do you prefer? (1 = Automated / 2 = Manual)"
>
> Do NOT proceed to any setup steps until the user has answered. Do NOT default to manual.

**If the user chose Automated**, follow the Setup Guide section below for complete CLI scripts. The automated path writes `.env` for you — skip Step 3 below and proceed directly to Step 4.

**If the user chose Manual**, follow the Setup Guide section below (Manual Setup) for full instructions. Then continue with Step 3 below.

Quick reference for manual API creation:

```bash
# Using Auth0 CLI
auth0 apis create \
  --name "My FastAPI API" \
  --identifier https://my-api.example.com
```

Or create manually in Auth0 Dashboard → Applications → APIs

### 3. Configure Environment

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://your-api.example.com
```

`AUTH0_DOMAIN` is your Auth0 tenant domain (without `https://`). `AUTH0_AUDIENCE` is the API identifier you set when creating the API resource in Auth0.

### 4. Initialize Auth0

```python
import os
from fastapi import FastAPI, Depends
from fastapi_plugin import Auth0FastAPI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
)
```

Create one `Auth0FastAPI` instance per application and reuse it across routes. Never hardcode the domain or audience — always use environment variables.

### 5. Protect Routes

```python
# Require any valid access token
@app.get("/api/private")
async def private(claims: dict = Depends(auth0.require_auth())):
    return {"user": claims["sub"]}

# No authentication required
@app.get("/api/public")
async def public():
    return {"message": "Public endpoint"}
```

The `require_auth()` dependency validates the Bearer token, verifies the issuer and audience, and returns the decoded JWT claims.

Error responses:
- **400** `invalid_request` — Missing or malformed Authorization header
- **401** `invalid_token` — Expired token, invalid signature, wrong issuer/audience
- **403** `insufficient_scope` — Valid token but missing required scopes
- **500** `internal_server_error` — Unexpected errors

Response body format: `{"detail": {"error": "...", "error_description": "..."}}`

### 6. Protect Routes with Scope Checks

```python
# Requires the read:messages scope
@app.get("/api/messages")
async def get_messages(claims: dict = Depends(auth0.require_auth(scopes="read:messages"))):
    return {"messages": []}

# Requires both read:data and write:data scopes
@app.post("/api/data")
async def write_data(claims: dict = Depends(auth0.require_auth(scopes=["read:data", "write:data"]))):
    return {"created": True}
```

`require_auth(scopes=...)` checks the `scope` claim in the JWT. All specified scopes must be present (AND logic). Missing scopes return **403**.

### 7. Access Token Claims

The decoded JWT claims are returned directly from the dependency:

```python
@app.get("/api/profile")
async def profile(claims: dict = Depends(auth0.require_auth())):
    return {
        "sub": claims["sub"],       # user ID
        "scope": claims.get("scope"),  # granted scopes
    }
```

Key claims:
- `claims["sub"]` — user/client ID
- `claims["scope"]` — space-separated granted scopes
- `claims["iss"]` — issuer (your Auth0 domain URL)
- `claims["aud"]` — audience
- `claims["exp"]` — expiration timestamp
- `claims["iat"]` — issued-at timestamp

### 8. Protect Routes Without Needing Claims

```python
@app.get("/api/protected", dependencies=[Depends(auth0.require_auth())])
async def protected():
    return {"message": "You need a valid access token to see this."}
```

### 9. Test the API

```bash
# No token — expect 401
curl http://localhost:8000/api/private

# With a valid access token
curl http://localhost:8000/api/private \
  -H "Authorization: Bearer $TOKEN"
```

Get a test token via Client Credentials flow or Auth0 Dashboard → APIs → Test tab.
Capture the token into a shell variable (`TOKEN=$(...)`) and reference `$TOKEN`
rather than pasting the raw token inline — inline token values leak into shell
history and terminal scrollback.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Hardcoding `domain` or `audience` in source | Always read from environment variables — never embed credentials in code |
| Using `python-jose` or `PyJWT` directly | Not needed; `auth0-fastapi-api` handles all validation via JWKS |
| Manually parsing `Authorization` header | The SDK extracts and validates the token automatically |
| Calling `jwt.decode()` manually | The SDK verifies tokens against the JWKS endpoint — do not verify yourself |
| Using `fastapi-users` for Auth0 JWT validation | That package is for user management, not Auth0 JWT verification |
| Created an Application instead of an API in Auth0 | Must create an **API** resource (Applications → APIs) — an Application doesn't issue access tokens with the right audience |
| Passing `domain` as full URL with `https://` | `domain` should be the bare domain, e.g. `my-tenant.us.auth0.com`, not `https://my-tenant.us.auth0.com` |
| Using an ID token instead of an access token | Must use the **access token** for API auth — ID tokens are for the client app, not for API authorization |
| Not configuring CORS for SPA clients | Add `CORSMiddleware` to allow requests from your frontend origin |
| `os.getenv()` returns `None` silently | Ensure `python-dotenv` is installed and `load_dotenv()` is called before `Auth0FastAPI()` initialization — or use `os.environ[]` to fail fast |

## DPoP Support

Built-in proof-of-possession token binding per RFC 9449. DPoP is enabled by default in mixed mode (accepts both Bearer and DPoP tokens). See the DPoP Support section below for configuration.

## Related Skills

- Auth0 setup and framework detection → set up Auth0 first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Managing Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**Auth0FastAPI configuration:**
```python
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),       # required (or use domains)
    audience=os.getenv("AUTH0_AUDIENCE"),    # required
    dpop_enabled=True,                       # default; set False for Bearer-only
    dpop_required=False,                     # default; set True to reject Bearer tokens
)
```

**Route protection:**
```python
Depends(auth0.require_auth())                    # any valid token
Depends(auth0.require_auth(scopes="read:res"))   # single scope
Depends(auth0.require_auth(scopes=["r", "w"]))   # all scopes required
```

**Accessing claims:**
```python
claims["sub"]           # user/client ID
claims["scope"]         # space-separated scopes
```

**Environment variables:**
- `AUTH0_DOMAIN` — your Auth0 tenant domain (e.g. `tenant.us.auth0.com`)
- `AUTH0_AUDIENCE` — your API identifier (e.g. `https://api.example.com`)

**Common Use Cases:**
- Protect routes → `Depends(auth0.require_auth())` (see Step 5)
- Scope enforcement → `Depends(auth0.require_auth(scopes="..."))` (see Step 6)
- DPoP token binding → see the DPoP Support section below
- Reverse proxy setup → see the Reverse Proxy Support section below
- Advanced configuration → see the API Reference section below

## References

- [auth0-fastapi-api GitHub](https://github.com/auth0/auth0-fastapi-api)
- [auth0-fastapi-api on PyPI](https://pypi.org/project/auth0-fastapi-api/)
- [Auth0 FastAPI API Quickstart](https://auth0.com/docs/quickstart/backend/fastapi)
- [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/)
- [Access Tokens Guide](https://auth0.com/docs/secure/tokens/access-tokens)

---

# Auth0 FastAPI API - API Reference

Complete reference for `auth0-fastapi-api` configuration options and methods.

---

## Auth0FastAPI

Main class for protecting FastAPI API routes with Auth0 JWT validation.

```python
from fastapi_plugin import Auth0FastAPI
```

### Constructor

```python
Auth0FastAPI(
    domain=None,
    audience="",
    domains=None,
    client_id=None,
    client_secret=None,
    custom_fetch=None,
    dpop_enabled=True,
    dpop_required=False,
    dpop_iat_leeway=30,
    dpop_iat_offset=300,
    cache_adapter=None,
    cache_ttl_seconds=600,
    cache_max_entries=100,
)
```

### Constructor Parameters

| Parameter | Type | Default | Required | Description |
|-----------|------|---------|----------|-------------|
| `domain` | `str` | `None` | Yes* | Auth0 tenant domain (e.g., `my-tenant.us.auth0.com`). No `https://` prefix. Required unless `domains` is provided. |
| `audience` | `str` | `""` | Yes | API identifier from Auth0 Dashboard. Must exactly match the API Identifier. |
| `domains` | `list[str]` or `Callable` | `None` | No | List of allowed domain strings or a callable resolver for multi-custom domain (MCD) mode. Optional if `domain` is provided. |
| `client_id` | `str` | `None` | No | Client ID for token exchange flows (e.g., `get_access_token_for_connection()`) |
| `client_secret` | `str` | `None` | No | Client secret for token exchange flows |
| `custom_fetch` | `Callable` | `None` | No | Optional HTTP fetch override. Signature: `async def custom_fetch(url, **kwargs)` |
| `dpop_enabled` | `bool` | `True` | No | Enable DPoP support. When `True`, accepts both Bearer and DPoP tokens (unless `dpop_required=True`). |
| `dpop_required` | `bool` | `False` | No | Require DPoP authentication and reject Bearer tokens. Only meaningful when `dpop_enabled=True`. |
| `dpop_iat_leeway` | `int` | `30` | No | Clock skew tolerance for DPoP proof `iat` claim in seconds. |
| `dpop_iat_offset` | `int` | `300` | No | Maximum DPoP proof age in seconds (5 minutes default). |
| `cache_adapter` | `CacheAdapter` | `None` | No | Custom cache backend. If `None`, uses `InMemoryCache`. |
| `cache_ttl_seconds` | `int` | `600` | No | Cache time-to-live in seconds (10 minutes default). |
| `cache_max_entries` | `int` | `100` | No | Maximum cache entries before LRU eviction. Ignored when `cache_adapter` is provided. |

**Raises:** `ValueError` if `audience` is empty or not provided.

---

## require_auth()

Returns a FastAPI dependency that validates the incoming request and returns decoded JWT claims.

```python
auth0.require_auth(scopes=None)
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `scopes` | `str` or `list[str]` or `None` | `None` | Optional scope(s) to validate. All specified scopes must be present (AND logic). |

### Return Value

Returns an async FastAPI dependency function (`async def _dependency(request: Request) -> dict`).

On success, the dependency returns a `dict` containing the decoded JWT claims (payload).

### Usage

```python
# No scope check
Depends(auth0.require_auth())

# Single scope
Depends(auth0.require_auth(scopes="read:data"))

# Multiple scopes — all required
Depends(auth0.require_auth(scopes=["read:data", "write:data"]))

# As route dependency (no claims in handler)
@app.get("/api/protected", dependencies=[Depends(auth0.require_auth())])
async def protected():
    return {"message": "Protected"}
```

### Error Responses

| Status | Error Code | Cause |
|--------|------------|-------|
| 400 | `invalid_request` | Missing or malformed Authorization header, unsupported auth scheme |
| 400 | `invalid_dpop_proof` | DPoP proof validation failure (missing proof, wrong algorithm, expired, thumbprint mismatch) |
| 401 | `invalid_token` | Expired token, invalid signature, wrong issuer, wrong audience, DPoP binding mismatch |
| 403 | `insufficient_scope` | Valid token but missing required scopes |
| 500 | `internal_server_error` | Unexpected error during verification |

All errors return:

```json
{
    "detail": {
        "error": "<error_code>",
        "error_description": "<human-readable message>"
    }
}
```

Errors on 400/401 may include `WWW-Authenticate` response headers.

---

## DPoP Configuration

### DPoP Modes

| Mode | `dpop_enabled` | `dpop_required` | Behavior |
|------|---------------|-----------------|----------|
| Mixed (default) | `True` | `False` | Accepts both Bearer and DPoP tokens |
| Required | `True` | `True` | Only DPoP tokens; rejects Bearer with 400 |
| Disabled | `False` | `False` | Bearer only; rejects DPoP tokens |

### DPoP Timing Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `dpop_iat_leeway` | `30` | Clock skew tolerance in seconds for DPoP proof `iat` claim |
| `dpop_iat_offset` | `300` | Maximum DPoP proof age in seconds (reject older proofs as potential replay) |

---

## Reverse Proxy Configuration

Enable `X-Forwarded-*` header trust for deployments behind reverse proxies:

```python
app.state.trust_proxy = True
```

| Setting | Default | Description |
|---------|---------|-------------|
| `app.state.trust_proxy` | `False` | When `True`, SDK uses `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Prefix` for URL reconstruction |

**Security:** Only enable when behind a trusted reverse proxy. The SDK includes path traversal protection for `X-Forwarded-Prefix`.

---

## Multiple Custom Domains (MCD)

### Static Allowlist

```python
auth0 = Auth0FastAPI(
    audience="<AUTH0_AUDIENCE>",
    domains=["brand1.auth.example.com", "brand2.auth.example.com"],
)
```

### Dynamic Domain Resolver

```python
from fastapi_plugin import DomainsResolverContext

def domains_resolver(context: DomainsResolverContext) -> list:
    request_url = context.get("request_url")
    # Map request to allowed issuer domains
    return ["brand1.auth.example.com"]

auth0 = Auth0FastAPI(
    audience="<AUTH0_AUDIENCE>",
    domains=domains_resolver,
)
```

The `DomainsResolverContext` dict contains:
- `request_url` — The reconstructed request URL
- `request_headers` — Request headers (lowercase keys)
- `unverified_iss` — Issuer from token before signature verification

### `domain` vs `domains`

- When both are set, `domains` is used exclusively for token verification
- `domain` is retained only for client flows (e.g., `get_access_token_for_connection()`)
- If `domains` is not set, `domain` is used for discovery and verification

---

## Cache Configuration

### Default Cache

The SDK uses an in-memory LRU cache with:
- `cache_ttl_seconds`: 600 (10 minutes)
- `cache_max_entries`: 100

### Custom In-Memory Cache

```python
auth0 = Auth0FastAPI(
    domain="<AUTH0_DOMAIN>",
    audience="<AUTH0_AUDIENCE>",
    cache_ttl_seconds=1200,     # 20 minutes
    cache_max_entries=200,
)
```

### Custom Cache Adapter

```python
from fastapi_plugin import CacheAdapter

class RedisCache(CacheAdapter):
    def __init__(self, redis_client):
        self.redis = redis_client

    def get(self, key: str):
        return self.redis.get(key)

    def set(self, key: str, value, ttl_seconds=None):
        self.redis.set(key, value, ex=ttl_seconds)

    def delete(self, key: str):
        self.redis.delete(key)

    def clear(self):
        self.redis.flushdb()

auth0 = Auth0FastAPI(
    domain="<AUTH0_DOMAIN>",
    audience="<AUTH0_AUDIENCE>",
    cache_adapter=RedisCache(redis_client),
    cache_ttl_seconds=1200,
)
```

---

## Exports

```python
from fastapi_plugin import (
    Auth0FastAPI,              # Main class
    CacheAdapter,              # Interface for custom cache implementations
    ConfigurationError,        # Raised when configuration is invalid
    DomainsResolver,           # Type alias for domain resolver functions
    DomainsResolverContext,    # Dict type for domain resolver context
    DomainsResolverError,      # Raised when domain resolver fails
    InMemoryCache,             # Default in-memory LRU cache
)
```

---

## api_client Property

The underlying `ApiClient` instance is accessible for advanced operations:

```python
# Token exchange for upstream IdP connections
connection_token = await auth0.api_client.get_access_token_for_connection({
    "connection": "my-connection",
    "access_token": user_access_token,
})
```

Requires `client_id` and `client_secret` to be set in the constructor.

---

## References

- [auth0-fastapi-api GitHub](https://github.com/auth0/auth0-fastapi-api)
- [auth0-fastapi-api on PyPI](https://pypi.org/project/auth0-fastapi-api/)

---

# Auth0 FastAPI API Integration Patterns

Advanced integration patterns for FastAPI API applications.

---

## Scope-Based Authorization

### Define Permissions in Auth0

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Permissions** tab
4. Add permissions matching the scopes you want to enforce (e.g., `read:messages`, `write:messages`)

### Protect Routes with Scopes

```python
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
)

# Single scope
@app.get("/api/messages")
async def get_messages(claims: dict = Depends(auth0.require_auth(scopes="read:messages"))):
    return {"messages": []}

# Multiple scopes — ALL must be present (AND logic)
@app.delete("/api/resource/{id}")
async def delete_resource(
    id: str,
    claims: dict = Depends(auth0.require_auth(scopes=["delete:data", "admin:access"]))
):
    return {"deleted": id}
```

### Request Tokens with Scopes

Clients must request tokens that include the required scopes:

```bash
curl -X POST https://your-tenant.us.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials",
    "scope": "read:messages write:messages"
  }'
```

---

## DPoP Support

DPoP (Demonstrating Proof of Possession, RFC 9449) binds tokens to a specific client key pair, preventing token theft and replay.

### DPoP Modes

| Mode | Configuration | Behavior |
|------|--------------|----------|
| Mixed (default) | `dpop_enabled=True, dpop_required=False` | Accept both DPoP and Bearer tokens |
| Required | `dpop_required=True` | Only accept DPoP tokens; reject Bearer |
| Disabled | `dpop_enabled=False` | Bearer tokens only; reject DPoP |

### Enable DPoP (Mixed Mode — Recommended for Migration)

```python
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_enabled=True,      # default
    dpop_required=False,    # default — accepts both Bearer and DPoP
)
```

### DPoP Required Mode

To reject standard Bearer tokens and accept only DPoP-bound tokens:

```python
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_required=True,     # rejects Bearer tokens
)
```

### Custom DPoP Timing

```python
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_enabled=True,
    dpop_iat_leeway=60,     # Clock skew tolerance in seconds (default: 30)
    dpop_iat_offset=600,    # Maximum DPoP proof age in seconds (default: 300)
)
```

### Bearer-Only Mode

Disable DPoP support entirely:

```python
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_enabled=False,     # Bearer tokens only
)
```

### Client Requirements

To use DPoP authentication, clients must:

1. Generate an **ES256 key pair** for DPoP proof signing
2. Include **two headers** in requests:
   - `Authorization: DPoP <access-token>` — The DPoP-bound access token
   - `DPoP: <proof-jwt>` — The DPoP proof JWT (ES256-signed)

```bash
# DPoP request example
curl -H "Authorization: DPoP $TOKEN" \
     -H "DPoP: $DPOP_PROOF_JWT" \
     http://localhost:8000/api/protected
```

Capture the token into a shell variable (`TOKEN=$(...)`) and reference `$TOKEN`
rather than pasting the raw token inline — inline token values leak into shell
history and terminal scrollback.

### Enable DPoP on Auth0 API

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Enable DPoP binding requirement

### Migration Strategy

Use mixed mode for gradual migration:

```python
# Phase 1: Accept both Bearer and DPoP (default)
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_enabled=True,
    dpop_required=False,
)

# Phase 2: Enforce DPoP-only after all clients have migrated
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_required=True,
)
```

### DPoP Error Responses

DPoP-specific validation failures return **400** with error code `invalid_dpop_proof`:

- Missing DPoP proof header
- Wrong algorithm (must be ES256)
- Expired proof (older than `dpop_iat_offset`)
- Thumbprint mismatch between proof and token binding

DPoP access token binding mismatches return **401** with `invalid_token`.

---

## Reverse Proxy Support

When deploying behind a reverse proxy (nginx, AWS ALB, Cloudflare CDN), you **must** enable proxy trust for DPoP validation to work correctly.

### Configuration

```python
from fastapi import FastAPI
from fastapi_plugin import Auth0FastAPI

app = FastAPI()

# Enable proxy trust — REQUIRED when behind a reverse proxy
app.state.trust_proxy = True

auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_enabled=True,
)
```

### Why This Matters

- DPoP validation requires matching the exact URL the client used
- Behind a proxy, your app sees internal URLs (e.g., `http://localhost:8000/api`)
- The client's DPoP proof contains the public URL (e.g., `https://api.example.com/api`)
- Without `trust_proxy=True`, DPoP validation will fail

### Supported Headers

When `trust_proxy=True`, the SDK reads:
- `X-Forwarded-Proto` — Overrides scheme (http/https)
- `X-Forwarded-Host` — Overrides host (handles comma-separated values for multiple proxies)
- `X-Forwarded-Prefix` — Prepends path prefix (with path traversal protection)

### Nginx Configuration Example

```nginx
location /api {
    proxy_pass http://backend:8000;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Prefix /api;
}
```

**Important:** Only enable `trust_proxy=True` when your app is actually behind a trusted reverse proxy. Never enable for direct internet-facing deployments — it allows header injection attacks.

---

## Accessing User Claims

### Standard Claims

```python
@app.get("/api/profile")
async def profile(claims: dict = Depends(auth0.require_auth())):
    return {
        "user_id": claims["sub"],
        "scopes": claims.get("scope", "").split(),
        "issuer": claims["iss"],
    }
```

### Custom Claims

If your tokens include custom claims (added via Auth0 Actions), access them directly:

```python
@app.get("/api/custom")
async def custom_claims(claims: dict = Depends(auth0.require_auth())):
    permissions = claims.get("permissions", [])
    role = claims.get("https://example.com/role")
    return {"permissions": permissions, "role": role}
```

Custom claims added via Auth0 Actions use namespaced keys, e.g., `https://example.com/role`.

### Common JWT Claims

| Claim | Description |
|-------|-------------|
| `sub` | User ID (subject) |
| `scope` | Space-separated list of granted scopes |
| `aud` | Audience (your API identifier) |
| `iss` | Issuer (your Auth0 tenant URL) |
| `exp` | Expiration timestamp |
| `iat` | Issued-at timestamp |

---

## Error Handling

### Standard Error Responses

| Status | Error Code | Cause | Fix |
|--------|------------|-------|-----|
| 400 | `invalid_request` | Missing or malformed Authorization header | Include valid `Authorization: Bearer <token>` header |
| 400 | `invalid_dpop_proof` | Invalid DPoP proof JWT (wrong algorithm, expired, missing) | Generate a valid ES256-signed DPoP proof |
| 401 | `invalid_token` | Expired token, invalid signature, wrong issuer/audience | Request a fresh access token with correct audience |
| 403 | `insufficient_scope` | Token lacks required scopes | Request token with required scopes |
| 500 | `internal_server_error` | Unexpected server error | Check server logs |

### Response Format

All error responses follow this structure:

```json
{
    "detail": {
        "error": "invalid_token",
        "error_description": "Token has expired"
    }
}
```

Responses on 400/401 errors may include `WWW-Authenticate` headers with error details.

### Custom Error Handling

Wrap protected routes with try/except for application-level error handling:

```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request, exc):
    if exc.status_code in (401, 403):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.detail.get("error", "unauthorized"),
                "message": exc.detail.get("error_description", "Authentication required"),
            },
            headers=exc.headers or {},
        )
    raise exc
```

---

## Mixed Public and Protected Endpoints

```python
from fastapi import FastAPI, Depends
from fastapi_plugin import Auth0FastAPI

app = FastAPI()
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
)

# Public — no auth needed
@app.get("/api/public")
async def public():
    return {"message": "Public endpoint"}

# Protected — requires valid JWT
@app.get("/api/private")
async def private(claims: dict = Depends(auth0.require_auth())):
    return {"message": "Private endpoint", "user_id": claims["sub"]}

# Protected with scope
@app.get("/api/messages")
async def messages(claims: dict = Depends(auth0.require_auth(scopes="read:messages"))):
    return {"messages": []}
```

---

## CORS Configuration

When your API receives requests from a browser-based SPA, configure CORS:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://spa.example.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "DPoP"],
)
```

---

## Testing

### Basic Testing with FastAPI TestClient

```python
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from fastapi_plugin import Auth0FastAPI

app = FastAPI()
auth0 = Auth0FastAPI(domain="my-tenant.us.auth0.com", audience="my-api")

@app.get("/public")
async def public():
    return {"message": "No token required"}

@app.get("/secure")
async def secure(claims: dict = Depends(auth0.require_auth())):
    return {"message": f"Hello {claims['sub']}"}

def test_public_route():
    client = TestClient(app)
    response = client.get("/public")
    assert response.status_code == 200

def test_protected_route_without_token():
    client = TestClient(app)
    response = client.get("/secure")
    assert response.status_code == 400  # Missing Authorization header
```

### Integration Testing with Real Tokens

```bash
# Get a test token via Auth0 CLI
auth0 test token --audience https://my-api.example.com
```

```python
def test_protected_route_with_token():
    client = TestClient(app)
    response = client.get(
        "/secure",
        headers={"Authorization": "Bearer YOUR_TEST_TOKEN"},
    )
    assert response.status_code == 200
```

### Mocking Authentication

For unit tests without hitting Auth0's JWKS endpoints, use `pytest-httpx` or mock the verification method:

```python
from unittest.mock import AsyncMock, patch

@patch.object(auth0.api_client, "verify_request", new_callable=AsyncMock)
async def test_with_mocked_auth(mock_verify):
    mock_verify.return_value = {"sub": "user123", "scope": "read:data"}
    client = TestClient(app)
    response = client.get(
        "/secure",
        headers={"Authorization": "Bearer mock-token"},
    )
    assert response.status_code == 200
```

---

## Security Considerations

- **Never hardcode Domain or Audience** — Always use environment variables or configuration files
- **Use HTTPS in production** — Auth0 requires HTTPS for token validation
- **Use minimal scopes** — Only request and enforce scopes your API actually needs
- **Keep packages updated** — Regularly update `auth0-fastapi-api` for security patches
- **Only enable `trust_proxy` behind trusted proxies** — Never for direct internet-facing deployments
- **Validate access tokens, not ID tokens** — ID tokens are for the client app, access tokens are for API authorization

---

---

# Auth0 FastAPI API Setup Guide

Setup instructions for FastAPI API applications.

---

## Quick Setup (Automated)

Below uses the Auth0 CLI to create an Auth0 API resource and retrieve your credentials.

### Step 1: Install Auth0 CLI and create API resource

```bash
# Install Auth0 CLI (macOS)
brew install auth0/auth0-cli/auth0

# Login
auth0 login --no-input

# Create an Auth0 API resource
auth0 apis create \
  --name "My FastAPI API" \
  --identifier https://my-api.example.com \
  --json
```

Note the `identifier` value — this is your Audience.

### Step 2: Get your domain

```bash
# List tenants to get your domain
auth0 tenants list
```

### Step 3: Add configuration

Once you have your Domain and Audience, create a `.env` file:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

Replace `your-tenant.us.auth0.com` with your Auth0 tenant domain and `https://my-api.example.com` with the identifier you used when creating the API resource.

> **Important:** Never read the contents of `.env` at any point during setup. The file may contain sensitive secrets that should not be exposed in the LLM context.

---

## Manual Setup

### Install Package

```bash
pip install auth0-fastapi-api python-dotenv
```

If you're using Poetry:

```bash
poetry add auth0-fastapi-api python-dotenv
```

### Create Auth0 API Resource

1. Go to Auth0 Dashboard → Applications → APIs
2. Click **Create API**
3. Set a **Name** and an **Identifier** (e.g., `https://my-api.example.com`)
4. Note the Identifier — this is your `Audience`

### Configure .env

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

**Important:** Domain format is `your-tenant.us.auth0.com` — do NOT include `https://`.

### Get Auth0 Configuration

- **Domain:** Auth0 Dashboard → Settings → Domain (or `auth0 tenants list`)
- **Audience:** The identifier you set when creating the API resource

### Using Environment Variables in Production

For production/containers, export environment variables directly:

```bash
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export AUTH0_AUDIENCE=https://my-api.example.com
```

When using `os.environ[]` instead of `os.getenv()`, missing values will raise `KeyError` immediately — this is safer for production.

---

## Getting a Test Token

### Via Auth0 Dashboard

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Test** tab
4. Click **Copy Token** to get a test access token

### Via Auth0 CLI

```bash
# Get access token for testing
auth0 test token \
  --audience https://my-api.example.com
```

### Via curl (Client Credentials Flow)

```bash
curl -X POST https://your-tenant.us.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials"
  }'
```

### Request Tokens with Specific Scopes

```bash
curl -X POST https://your-tenant.us.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials",
    "scope": "read:messages write:messages"
  }'
```

---

## Troubleshooting

**401 Unauthorized — "invalid_token":** Verify that the `AUTH0_AUDIENCE` in `.env` exactly matches your API Identifier in Auth0 Dashboard.

**401 Unauthorized — "invalid_issuer":** Ensure `AUTH0_DOMAIN` does not include `https://` — use `your-tenant.us.auth0.com` format only.

**`os.getenv()` returns `None`:** Ensure `python-dotenv` is installed and `load_dotenv()` is called before `Auth0FastAPI()` initialization. In production, use `os.environ[]` to fail fast on missing values.

**Token expired:** Test tokens from the Dashboard are short-lived. Request a fresh token.

**`ValueError: audience is required.`:** The `audience` parameter cannot be empty. Ensure your `.env` file is loaded and the value is set.

---
