# Auth0 FastAPI Backend API Reference

API reference for JWT validation in FastAPI.

---

## JWT Validation

```python
from jose import jwt

payload = jwt.decode(
    token,
    rsa_key,
    algorithms=["RS256"],
    audience=AUTH0_AUDIENCE,
    issuer=f"https://{AUTH0_DOMAIN}/"
)
```

---

## Dependency Injection

```python
from fastapi import Depends
from fastapi.security import HTTPBearer

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    # Validation logic
    return payload

@app.get("/protected")
def protected(token: dict = Depends(verify_token)):
    return {"user": token["sub"]}
```

---

## References

- [python-jose Documentation](https://python-jose.readthedocs.io/)
- Return to [main skill guide](../SKILL.md)
