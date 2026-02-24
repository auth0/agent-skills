# Auth0 FastAPI API Reference

Complete API reference for auth0-fastapi SDK.

---

## Configuration

### Auth0Config

```python
from auth0_fastapi.config import Auth0Config

config = Auth0Config(
    domain="your-tenant.auth0.com",        # Required
    client_id="your-client-id",            # Required
    client_secret="your-client-secret",    # Required
    app_base_url="http://localhost:3000",  # Required
    secret="session-secret-key",           # Required
)
```

---

## AuthClient

### Initialization

```python
from auth0_fastapi.auth.auth_client import AuthClient

auth_client = AuthClient(config)
```

### Methods

**get_session()**
```python
store_options = {"request": request, "response": response}
session = await auth_client.client.get_session(store_options=store_options)
```

**get_user()**
```python
store_options = {"request": request, "response": response}
user = await auth_client.client.get_user(store_options=store_options)
# Returns: dict with user profile (sub, name, email, etc.)
```

---

## Route Registration

### register_auth_routes()

```python
from auth0_fastapi.server.routes import router, register_auth_routes

register_auth_routes(router, config)
app.include_router(router)
```

**Creates routes:**
- `/auth/login` - Initiate login
- `/auth/callback` - Auth0 callback
- `/auth/logout` - Log out user

---

## Decorators

### @requires_auth

```python
from auth0_fastapi.auth.dependencies import requires_auth

@app.get("/protected")
@requires_auth
async def protected_route(request: Request, response: Response):
    # Only accessible to authenticated users
    pass
```

---

## Dependencies

### get_current_user

```python
from fastapi import Depends
from auth0_fastapi.auth.dependencies import get_current_user

@app.get("/profile")
async def profile(user: dict = Depends(get_current_user)):
    return {"user": user}
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AUTH0_DOMAIN` | Your Auth0 tenant domain | `tenant.auth0.com` |
| `AUTH0_CLIENT_ID` | Application client ID | `abc123...` |
| `AUTH0_CLIENT_SECRET` | Application client secret | `xyz789...` |
| `SESSION_SECRET` | Session encryption key | `openssl rand -hex 64` |
| `APP_BASE_URL` | Base URL of your app | `http://localhost:3000` |

---

## Session Middleware

```python
from starlette.middleware.sessions import SessionMiddleware

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET"),
    max_age=3600  # Optional: session timeout in seconds
)
```

---

## Security Best Practices

1. **Use environment variables** - Never hardcode credentials
2. **Use HTTPS in production** - Required for secure cookies
3. **Rotate session secrets** - Change SESSION_SECRET periodically
4. **Set appropriate session timeouts** - Configure max_age in SessionMiddleware
5. **Validate on server** - Don't trust client-side validation alone

---

## References

- [Auth0 FastAPI SDK GitHub](https://github.com/auth0/auth0-fastapi)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Starlette Middleware](https://www.starlette.io/middleware/)
