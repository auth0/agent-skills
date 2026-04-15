# auth0-api-python Integration Patterns

## Authentication Flow

```text
Client Request
    │
    ├── Authorization: Bearer <JWT>  ──→ verify_access_token(token)
    │                                         │
    └── Authorization: DPoP <JWT>   ──→ verify_request(headers, method, url)
        DPoP: <proof>                         │
                                              ▼
                                    Auth0 JWKS Endpoint
                                    (public key fetch + cache)
                                              │
                                              ▼
                                    Signature Validation
                                    Issuer + Audience Check
                                    Expiry Check
                                    (DPoP proof check if applicable)
                                              │
                                        ┌─────┴─────┐
                                        ▼           ▼
                                  claims dict    BaseAuthError
                                  (proceed)      (return 401/403)
```

---

## Flask Integration

### Basic Auth Decorator

```python
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
            # Flask is sync — use asyncio.run() outside async context
            g.claims = asyncio.run(api_client.verify_access_token(token))
        except BaseAuthError as e:
            return jsonify({"error": str(e)}), e.get_status_code()
        return f(*args, **kwargs)
    return decorated
```

> **Flask 2.0+ async support:** Flask 2.0+ supports `async def` route handlers. If using async views, you can `await` directly inside the route function, but the decorator wrapper is still sync. Use `asyncio.run()` in the decorator, or restructure using `before_request`.

### RBAC Permission Decorator

```python
def require_permission(permission):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Must be used after @require_auth
            permissions = g.claims.get("permissions", [])
            if permission not in permissions:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/api/admin")
@require_auth
@require_permission("admin:write")
def admin_action():
    return jsonify({"message": "Admin action performed"})
```

### Using verify_request (DPoP-aware)

```python
def require_auth_dpop(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            g.claims = asyncio.run(api_client.verify_request(
                headers=dict(request.headers),
                http_method=request.method,
                http_url=request.url
            ))
        except BaseAuthError as e:
            return jsonify({"error": str(e)}), e.get_status_code()
        return f(*args, **kwargs)
    return decorated
```

---

## FastAPI Integration

### Dependency-Based Auth

```python
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
        # FastAPI is async — await directly, no asyncio.run()
        return await api_client.verify_access_token(token)
    except BaseAuthError as e:
        raise HTTPException(
            status_code=e.get_status_code(),
            detail=str(e),
            headers=e.get_headers() if hasattr(e, "get_headers") else {}
        )
```

### Permission-Based Dependency

```python
def require_permission(permission: str):
    async def dependency(claims: dict = Depends(get_claims)) -> dict:
        if permission not in claims.get("permissions", []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return claims
    return dependency

@app.get("/api/private")
async def private(claims: dict = Depends(get_claims)):
    return {"sub": claims["sub"]}

@app.get("/api/admin")
async def admin(claims: dict = Depends(require_permission("admin:write"))):
    return {"sub": claims["sub"], "message": "Admin access granted"}
```

### DPoP with verify_request in FastAPI

```python
async def get_claims_dpop(request: Request) -> dict:
    try:
        return await api_client.verify_request(
            headers=dict(request.headers),
            http_method=request.method,
            http_url=str(request.url)
        )
    except BaseAuthError as e:
        raise HTTPException(status_code=e.get_status_code(), detail=str(e))
```

---

## CORS Configuration

CORS middleware **must be registered before authentication** so that browser `OPTIONS` preflight requests are handled without triggering token validation.

### Flask with flask-cors

```bash
pip install flask-cors
```

```python
from flask_cors import CORS

app = Flask(__name__)

# CORS before any auth logic
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "https://yourapp.com"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Authorization", "Content-Type"]
    }
})

# Auth decorators applied per route below
```

### FastAPI with CORSMiddleware

```python
from fastapi.middleware.cors import CORSMiddleware

# CORS middleware added before route definitions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourapp.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)
```

---

## DPoP Token Support

DPoP (Demonstrating Proof of Possession) cryptographically binds tokens to a specific HTTP request, preventing token theft and replay attacks.

### Allow Bearer or DPoP (recommended for transition)

```python
api_client = ApiClient(ApiClientOptions(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_enabled=True,   # Accept DPoP tokens
    dpop_required=False  # Still accept Bearer tokens
))
```

### Require DPoP Only

```python
api_client = ApiClient(ApiClientOptions(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_required=True  # Reject plain Bearer tokens
))
```

### DPoP with Timing Leeway

```python
api_client = ApiClient(ApiClientOptions(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    dpop_enabled=True,
    dpop_iat_leeway=30,   # 30 seconds leeway for clock skew
    dpop_iat_offset=300   # 5 minutes allowed offset
))
```

When using DPoP, always use `verify_request()` (not `verify_access_token()`) so the SDK can validate both the token and the DPoP proof together:

```python
claims = await api_client.verify_request(
    headers={
        "authorization": "DPoP eyJ0eXAiOiJKV1Q...",
        "dpop": "eyJ0eXAiOiJkcG9wK2p3dC..."
    },
    http_method="GET",
    http_url="https://api.example.com/resource"
)
```

---

## Multi-Custom Domain Support

Use when your Auth0 tenant serves multiple custom domains (e.g., white-labeling or multi-region deployments).

### Static Domain List

```python
api_client = ApiClient(ApiClientOptions(
    domains=[
        "tenant.auth0.com",
        "auth.example.com",
        "auth.acme.org"
    ],
    audience="https://my-python-api"
))
```

### Dynamic Resolver (runtime-determined domains)

```python
from auth0_api_python import DomainsResolverContext

def resolve_domains(context: DomainsResolverContext) -> list[str]:
    # Map request-derived values to a FIXED allowlist — never trust input directly
    host = (context.get("request_headers") or {}).get("host", "")
    domain_map = {
        "api.us.example.com": ["us-tenant.auth0.com", "auth.us.example.com"],
        "api.eu.example.com": ["eu-tenant.auth0.com", "auth.eu.example.com"],
    }
    return domain_map.get(host, ["default-tenant.auth0.com"])

api_client = ApiClient(ApiClientOptions(
    domains=resolve_domains,
    audience="https://my-python-api"
))
```

Async resolvers are supported — the SDK automatically awaits them:

```python
async def resolve_domains_async(context: DomainsResolverContext) -> list[str]:
    allowed = await fetch_allowed_domains_from_db(context["unverified_iss"])
    return allowed
```

> **Security:** Never pass request-derived values directly to the resolver's return value. Always map to a known allowlist.

---

## Connection Access Token Exchange

Requires `client_id` and `client_secret` in `ApiClientOptions`.

```python
api_client = ApiClient(ApiClientOptions(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET")
))

# Exchange a user's access token for a connection-scoped token
connection_token = await api_client.get_access_token_for_connection({
    "connection": "google-oauth2",
    "access_token": user_access_token
})
```

---

## Custom Token Exchange

For custom token exchange flows (requires `client_id` and `client_secret`):

```python
result = await api_client.get_token_by_exchange_profile(
    subject_token=incoming_token,
    subject_token_type="urn:example:subject-token",
    audience="https://target-api.example.com",
    scope="openid profile email",
    requested_token_type="urn:ietf:params:oauth:token-type:access_token"
)
```

With extra parameters:

```python
result = await api_client.get_token_by_exchange_profile(
    subject_token=incoming_token,
    subject_token_type="urn:example:subject-token",
    audience="https://target-api.example.com",
    extra={
        "device_id": "device-12345",
        "session_id": "sess-abc"
    }
)
```

Error handling for token exchange:

```python
from auth0_api_python.errors import GetTokenByExchangeProfileError, ApiError

try:
    result = await api_client.get_token_by_exchange_profile(...)
except GetTokenByExchangeProfileError as e:
    print(f"Validation error: {e}")
except ApiError as e:
    print(f"API error: {e.code} - {e.message} (status: {e.status_code})")
```

---

## Error Handling

All validation errors inherit from `BaseAuthError`:

```python
from auth0_api_python.errors import BaseAuthError, ApiError, GetTokenByExchangeProfileError

try:
    claims = await api_client.verify_access_token(token)
except BaseAuthError as e:
    # e.get_status_code() → 401 (invalid token) or 403 (insufficient claims)
    # e.get_headers()    → dict of response headers (e.g., WWW-Authenticate)
    # str(e)             → human-readable error message
    return {"error": str(e)}, e.get_status_code()
```

Flask error handler (global):

```python
from auth0_api_python.errors import BaseAuthError

@app.errorhandler(BaseAuthError)
def handle_auth_error(e):
    return jsonify({"error": str(e)}), e.get_status_code()
```

FastAPI exception handler (global):

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from auth0_api_python.errors import BaseAuthError

@app.exception_handler(BaseAuthError)
async def auth_error_handler(request: Request, exc: BaseAuthError):
    return JSONResponse(
        status_code=exc.get_status_code(),
        content={"error": str(exc)}
    )
```

---

## Testing with M2M Tokens

For integration testing without a frontend, use a Machine-to-Machine application:

1. Auth0 Dashboard → Applications → Create Application → Machine to Machine
2. Authorize it against your API (select the API and grant permissions)
3. Use the Test tab or the `/oauth/token` endpoint to get a token:

```bash
curl -X POST https://YOUR_DOMAIN/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-python-api",
    "grant_type": "client_credentials"
  }'
```

Use the returned `access_token` in your `Authorization: Bearer` header for testing.

---

## Reading User Claims

```python
claims = await api_client.verify_access_token(token)

# Standard claims
user_id = claims["sub"]           # e.g., "auth0|abc123" or "google-oauth2|xyz"
issuer = claims["iss"]            # e.g., "https://your-tenant.auth0.com/"
audience = claims["aud"]          # your API identifier (string or list)
expires_at = claims["exp"]        # Unix timestamp

# RBAC
permissions = claims.get("permissions", [])   # ["read:data", "write:data"]
scope = claims.get("scope", "")               # "openid profile email"

# M2M tokens
grant_type = claims.get("gty")     # "client-credentials" for M2M
client_id = claims.get("azp")      # Authorized party (client that requested token)
```
