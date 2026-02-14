# Auth0 FastAPI Backend Integration Guide

Advanced patterns for FastAPI backend authentication.

---

## Permission-Based Access

```python
from fastapi import HTTPException

def require_permission(permission: str):
    def check_permission(token: dict = Depends(verify_token)):
        permissions = token.get("permissions", [])
        if permission not in permissions:
            raise HTTPException(
                status_code=403,
                detail=f"Missing required permission: {permission}"
            )
        return token
    return check_permission

@app.get("/api/admin")
def admin_endpoint(token: dict = Depends(require_permission("read:admin"))):
    return {"message": "Admin data"}
```

---

## Custom Claims

```python
@app.get("/api/user")
def user_info(token: dict = Depends(verify_token)):
    return {
        "user_id": token.get("sub"),
        "email": token.get("email"),
        "custom_claim": token.get("https://your-namespace/custom_claim")
    }
```

---

## CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## References

- Return to [main skill guide](../SKILL.md)
