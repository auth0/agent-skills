---
name: auth0-fastapi
description: Use when adding authentication to FastAPI web applications (login, logout, user sessions, protected routes) - integrates auth0-fastapi SDK for Python server-side apps
---

# Auth0 FastAPI Integration

Add authentication to FastAPI web applications using the auth0-fastapi SDK.

---

## Prerequisites

- Python 3.8+ installed
- FastAPI knowledge
- Auth0 account and application configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **REST APIs without sessions** - Use JWT validation instead (`python-jose` with FastAPI dependencies)
- **Flask applications** - Use `flask-openid-connect` instead
- **Django applications** - Use `django-auth0` or `python-social-auth`
- **Single-page applications** - Use `@auth0/auth0-spa-js` client-side SDK

---

## Quick Start Workflow

### 1. Install SDK

```bash
# Activate virtual environment first
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install auth0-fastapi "uvicorn[standard]" python-dotenv itsdangerous
```

**Note:** Quote `"uvicorn[standard]"` to prevent shell glob expansion.

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see [Setup Guide](references/setup.md) for complete scripts.

**For manual setup:**

Create `.env` file:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
SESSION_SECRET=$(openssl rand -hex 64)
APP_BASE_URL=http://localhost:3000
```

### 3. Create FastAPI Application

Create `main.py`:

```python
import os
from fastapi import FastAPI, Depends, Request, Response
from fastapi.responses import HTMLResponse
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

from auth0_fastapi.config import Auth0Config
from auth0_fastapi.auth.auth_client import AuthClient
from auth0_fastapi.server.routes import router, register_auth_routes

# Load environment variables
load_dotenv()

app = FastAPI(title="Auth0 FastAPI Example")

# Add Session Middleware - required for cookie handling
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET"))

# Create Auth0Config
config = Auth0Config(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
    app_base_url=os.getenv("APP_BASE_URL", "http://localhost:3000"),
    secret=os.getenv("SESSION_SECRET"),
)

# Instantiate the AuthClient
auth_client = AuthClient(config)

# Attach to FastAPI app state
app.state.config = config
app.state.auth_client = auth_client

# Register authentication routes
register_auth_routes(router, config)
app.include_router(router)


@app.get("/", response_class=HTMLResponse)
async def home(request: Request, response: Response):
    """Home page with login/logout buttons"""
    store_options = {"request": request, "response": response}
    session = await auth_client.client.get_session(store_options=store_options)

    if session:
        user = await auth_client.client.get_user(store_options=store_options)
        return f"""
        <html>
        <body>
            <h1>Welcome, {user.get('name')}!</h1>
            <p>Email: {user.get('email')}</p>
            <a href="/auth/logout">Logout</a>
        </body>
        </html>
        """
    else:
        return """
        <html>
        <body>
            <h1>Auth0 FastAPI Example</h1>
            <a href="/auth/login">Login</a>
        </body>
        </html>
        """
```

### 4. Create Protected Route

Add protected endpoint:

```python
from auth0_fastapi.auth.dependencies import requires_auth

@app.get("/protected")
@requires_auth
async def protected(request: Request, response: Response):
    """Protected route - requires authentication"""
    store_options = {"request": request, "response": response}
    user = await auth_client.client.get_user(store_options=store_options)

    return {
        "message": "This is a protected route",
        "user": user
    }
```

### 5. Run Application

```bash
uvicorn main:app --reload --port 3000
```

Visit `http://localhost:3000` and test authentication.

---

## Detailed Documentation

- **[Setup Guide](references/setup.md)** - Automated setup scripts, CLI commands, manual configuration
- **[Integration Guide](references/integration.md)** - Protected routes, API endpoints, error handling, advanced patterns
- **[API Reference](references/api.md)** - Complete SDK API, configuration options, testing strategies

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add callback URL in Auth0 Dashboard | Add `http://localhost:3000/auth/callback` to Allowed Callback URLs in Auth0 Dashboard |
| Missing SessionMiddleware | Add `app.add_middleware(SessionMiddleware, secret_key=...)` before registering routes |
| Not quoting uvicorn[standard] | Use quotes: `pip install "uvicorn[standard]"` |
| Missing itsdangerous dependency | Install: `pip install itsdangerous` |
| Virtual environment not activated | Run `source venv/bin/activate` before pip install |
| Wrong application type | Use "Regular Web Application" not "Single Page Application" in Auth0 Dashboard |
| Missing CLIENT_SECRET | Server-side apps require client secret - ensure it's in .env |

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-migration` - Migrate from another auth provider
- `auth0-mfa` - Add Multi-Factor Authentication

---

## Quick Reference

**Core Components:**
- `Auth0Config` - Configuration object
- `AuthClient` - Authentication client
- `register_auth_routes()` - Add /auth/login, /auth/callback, /auth/logout routes
- `@requires_auth` - Decorator for protected routes

**Built-in Routes:**
- `/auth/login` - Initiate login
- `/auth/callback` - Auth0 callback endpoint
- `/auth/logout` - Log out user

**Common Use Cases:**
- Login/Logout buttons → See Step 3 above
- Protected routes → See Step 4 above
- API endpoints → [Integration Guide](references/integration.md#api-endpoints)
- Error handling → [Integration Guide](references/integration.md#error-handling)

---

## References

- [Auth0 FastAPI SDK Documentation](https://github.com/auth0/auth0-fastapi)
- [Auth0 FastAPI Quickstart](https://auth0.com/docs/quickstart/webapp/fastapi)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
