---
name: auth0-fastapi-api
description: Use when securing FastAPI API endpoints with JWT Bearer token validation, scope/permission checks, or stateless auth - integrates auth0-fastapi-api for REST APIs receiving access tokens from SPAs, mobile apps, or other clients.
---

# Auth0 FastAPI API Integration

Protect FastAPI API endpoints with JWT access token validation using `auth0-fastapi-api`.

---

## Prerequisites

- FastAPI application
- Auth0 API resource configured (not an Application — must be an API)
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Server-rendered web applications** — Use a session-based login/logout flow instead

---

## Quick Start Workflow

### 1. Install SDK

```bash
pip install auth0-fastapi-api python-dotenv
```

### 2. Configure Environment

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://your-api.example.com
```

`AUTH0_DOMAIN` is your Auth0 tenant domain (without `https://`). `AUTH0_AUDIENCE` is the API identifier you set when creating the API resource in Auth0.

### 3. Configure Auth Middleware

```python
import os
from fastapi import FastAPI, Depends
from auth0_fastapi_api import Auth0FastAPI
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),
    audience=os.getenv("AUTH0_AUDIENCE"),
)
```

Create one `Auth0FastAPI` instance per application and reuse it across routes. Never hardcode the domain or audience — always use environment variables.

### 4. Protect Routes

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

The `require_auth()` dependency validates the Bearer token, verifies the issuer and audience, and returns the decoded JWT claims. Requests without a valid Bearer token receive **401**.

### 5. Protect Routes with Scope Checks

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

`require_auth(scopes=...)` checks the `scope` claim in the JWT. Missing scopes return **403**.

### 6. Access Token Claims

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

### 7. Protect Routes Without Needing Claims

```python
from fastapi import Depends

@app.get("/api/protected", dependencies=[Depends(auth0.require_auth())])
async def protected():
    return {"message": "You need a valid access token to see this."}
```

### 8. Test the API

```bash
# No token — expect 401
curl http://localhost:8000/api/private

# With a valid access token
curl http://localhost:8000/api/private \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

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

---

## Quick Reference

**Auth0FastAPI configuration:**
```python
auth0 = Auth0FastAPI(
    domain=os.getenv("AUTH0_DOMAIN"),       # required
    audience=os.getenv("AUTH0_AUDIENCE"),   # required
)
```

**Route protection:**
```python
Depends(auth0.require_auth())                    # any valid token
Depends(auth0.require_auth(scopes="read:res"))   # single scope
Depends(auth0.require_auth(scopes=["r", "w"]))  # all scopes required
```

**Accessing claims:**
```python
claims["sub"]           # user/client ID
claims["scope"]         # space-separated scopes
```

**Environment variables:**
- `AUTH0_DOMAIN` — your Auth0 tenant domain (e.g. `tenant.us.auth0.com`)
- `AUTH0_AUDIENCE` — your API identifier (e.g. `https://api.example.com`)

---

## References

- [auth0-fastapi-api GitHub](https://github.com/auth0/auth0-fastapi-api)
- [auth0-fastapi-api on PyPI](https://pypi.org/project/auth0-fastapi-api/)
- [Auth0 FastAPI API Quickstart](https://auth0.com/docs/quickstart/backend/fastapi)
- [FastAPI Dependency Injection](https://fastapi.tiangolo.com/tutorial/dependencies/)
