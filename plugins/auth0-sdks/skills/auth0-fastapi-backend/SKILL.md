---
name: auth0-fastapi-backend
description: Use when adding JWT authentication to FastAPI backend APIs (protect endpoints, validate tokens, check permissions) - uses python-jose for stateless API authentication with Auth0
---

# Auth0 FastAPI Backend API Integration

Add JWT authentication to FastAPI backend APIs using python-jose for token validation.

---

## Prerequisites

- Python 3.8+ installed
- FastAPI knowledge
- Auth0 account and API configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Web applications with sessions** - Use `auth0-fastapi` skill for session-based auth
- **Single Page Applications** - Use JavaScript SDK client-side
- **Express APIs** - Use express-jwt middleware

---

## Quick Start Workflow

### 1. Install Dependencies

```bash
pip install "fastapi[all]" python-jose[cryptography] python-dotenv requests
```

### 2. Configure Environment

Create `.env` file:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=your-api-identifier
```

### 3. Create JWT Validation

Create `auth.py`:

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import requests
import os
from functools import lru_cache

security = HTTPBearer()

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
ALGORITHMS = ["RS256"]

@lru_cache()
def get_jwks():
    """Get JSON Web Key Set from Auth0"""
    jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    return requests.get(jwks_url).json()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify and decode JWT token"""
    token = credentials.credentials

    try:
        # Get signing key
        jwks = get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}

        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }

        if rsa_key:
            # Validate token
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=ALGORITHMS,
                audience=AUTH0_AUDIENCE,
                issuer=f"https://{AUTH0_DOMAIN}/"
            )
            return payload

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to validate credentials"
    )
```

### 4. Protect API Endpoints

Create `main.py`:

```python
from fastapi import FastAPI, Depends
from dotenv import load_dotenv
from auth import verify_token

load_dotenv()

app = FastAPI()

@app.get("/api/public")
def public():
    return {"message": "Public endpoint"}

@app.get("/api/private")
def private(token: dict = Depends(verify_token)):
    return {
        "message": "Private endpoint",
        "user_id": token.get("sub")
    }

@app.get("/api/admin")
def admin(token: dict = Depends(verify_token)):
    # Check for specific permission
    permissions = token.get("permissions", [])
    if "read:admin" not in permissions:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    return {"message": "Admin endpoint"}
```

### 5. Run Application

```bash
uvicorn main:app --reload
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing Audience | Set AUTH0_AUDIENCE environment variable |
| Wrong Auth0 resource type | Create "API" (not Application) in Auth0 Dashboard |
| Not caching JWKS | Use `@lru_cache()` decorator on get_jwks() |
| Missing permissions in token | Enable RBAC and add permissions to API in Auth0 Dashboard |
| Virtual environment not activated | Run `source venv/bin/activate` before pip install |

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-fastapi` - For web applications with sessions
- `auth0-mfa` - Add Multi-Factor Authentication

---

## Quick Reference

**Core Functions:**
- `verify_token()` - Validate JWT and return payload
- `Depends(verify_token)` - Protect endpoints
- `token.get("permissions")` - Check permissions

**Common Use Cases:**
- Protect endpoints → See Step 4 above
- Permission-based access → [Integration Guide](references/integration.md#permissions)
- Custom claims → [Integration Guide](references/integration.md#claims)
- CORS configuration → [Integration Guide](references/integration.md#cors)

---

## References

- [python-jose Documentation](https://python-jose.readthedocs.io/)
- [Auth0 FastAPI Backend Quickstart](https://auth0.com/docs/quickstart/backend/fastapi)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
