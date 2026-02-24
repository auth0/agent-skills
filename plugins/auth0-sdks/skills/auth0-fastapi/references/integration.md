# Auth0 FastAPI Integration Guide

Advanced patterns for Auth0 integration in FastAPI.

---

## Protected Routes

### Using Decorator

```python
from auth0_fastapi.auth.dependencies import requires_auth

@app.get("/api/protected")
@requires_auth
async def protected_endpoint(request: Request, response: Response):
    store_options = {"request": request, "response": response}
    user = await auth_client.client.get_user(store_options=store_options)

    return {"message": "Protected data", "user": user}
```

### Using Dependency

```python
from fastapi import Depends
from auth0_fastapi.auth.dependencies import get_current_user

@app.get("/api/profile")
async def profile(user: dict = Depends(get_current_user)):
    return {"user": user}
```

---

## API Endpoints

### JSON API with Session Auth

```python
@app.get("/api/data")
@requires_auth
async def get_data(request: Request, response: Response):
    store_options = {"request": request, "response": response}
    user = await auth_client.client.get_user(store_options=store_options)

    # Fetch user-specific data
    data = fetch_user_data(user["sub"])

    return {"data": data}
```

---

## Error Handling

### Custom Error Handler

```python
from fastapi import HTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def custom_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 401:
        return RedirectResponse(url="/auth/login")

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": str(exc.detail)}
    )
```

---

## User Management

### Get User Profile

```python
@app.get("/profile")
@requires_auth
async def user_profile(request: Request, response: Response):
    store_options = {"request": request, "response": response}
    user = await auth_client.client.get_user(store_options=store_options)

    return {
        "name": user.get("name"),
        "email": user.get("email"),
        "picture": user.get("picture"),
        "sub": user.get("sub")
    }
```

---

## Session Management

### Check Session Status

```python
async def get_session_status(request: Request, response: Response):
    store_options = {"request": request, "response": response}
    session = await auth_client.client.get_session(store_options=store_options)

    return {"authenticated": session is not None}
```

---

## Custom Login/Logout

### Custom Login Redirect

```python
@app.get("/custom-login")
async def custom_login():
    return RedirectResponse(
        url="/auth/login?returnTo=/dashboard"
    )
```

---

## Testing

### Mock Authentication

```python
# test_app.py
from fastapi.testclient import TestClient

client = TestClient(app)

def test_protected_route():
    # Mock authenticated session
    with client.websocket_connect("/") as session:
        response = client.get("/protected")
        assert response.status_code == 200
```

---

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Auth0 FastAPI SDK](https://github.com/auth0/auth0-fastapi)
- Return to [main skill guide](../SKILL.md)
