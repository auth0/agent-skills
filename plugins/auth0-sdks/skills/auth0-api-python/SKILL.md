---
name: auth0-api-python
description: Use when adding Auth0 token validation to Python APIs - integrates auth0-api-python SDK to protect Flask, FastAPI, and other Python framework endpoints with JWT Bearer and DPoP token validation.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
---

# Auth0 API Python Integration

This skill integrates the `auth0-api-python` SDK into Python API projects. The SDK is framework-agnostic and provides async JWT Bearer token validation, automatic DPoP token support, RBAC via the `permissions` claim, multi-custom domain support, and connection access token exchange. Use this skill when protecting Python API endpoints (Flask, FastAPI, Django REST, or any ASGI/WSGI framework) — not for server-side web apps with login/logout flows.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/auth0-api-python/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below. If the command fails (beta releases may not appear), use PyPI: `pip index versions auth0-api-python 2>/dev/null | head -1`.

## Prerequisites

- Python 3.9+
- pip or Poetry
- An Auth0 account with an **API** (resource server) registered — not an Application
- Node.js 20+ (for bootstrap script automation only)
- Auth0 CLI (`brew install auth0` / `npm install -g @auth0/auth0-cli`) (for bootstrap script only)

## When NOT to Use

| Use Case | Recommended Skill |
|----------|------------------|
| Flask or Django web app with login/logout UI | `auth0-python` |
| FastAPI web app with login/logout UI | `auth0-fastapi` |
| Django REST API using authlib | `auth0-django-api` |
| ASP.NET Core Web API | `auth0-aspnetcore-api` |
| Node.js / Express API | `express-jwt` or `node-auth0` |
| React / Angular / Vue SPA calling an API | `auth0-react`, `auth0-angular`, `auth0-vue` |
| Go API | `go-jwt-middleware` |
| Spring Security API (Java) | `auth0-spring-security-api` |

## Quick Start Workflow

> **Agent instruction:** Follow these steps to integrate auth0-api-python into a Python API project.
>
> 1. **Fetch latest version** (see instruction above) and use it in requirements.txt
>
> 2. **Set up Auth0** (credentials check first):
>    - If the user's prompt already provides `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`, write `.env` directly and skip to step 3.
>    - Otherwise, offer two options via `AskUserQuestion`:
>      - **Option A — Automatic:** Run `cd scripts && npm install && node bootstrap.mjs <project-path>` (requires Node.js 20+, Auth0 CLI)
>      - **Option B — Manual:** Ask for Auth0 Domain and API Audience (identifier URL), then write `.env`
>
> 3. **Install the SDK:**
>    ```bash
>    pip install auth0-api-python python-dotenv
>    ```
>    Or add to `requirements.txt`:
>    ```
>    auth0-api-python>=1.0.0b8
>    python-dotenv
>    ```
>
> 4. **Initialize the client** in your app entry point:
>    ```python
>    import os
>    from dotenv import load_dotenv
>    from auth0_api_python import ApiClient, ApiClientOptions
>
>    load_dotenv()
>
>    api_client = ApiClient(ApiClientOptions(
>        domain=os.getenv("AUTH0_DOMAIN"),
>        audience=os.getenv("AUTH0_AUDIENCE")
>    ))
>    ```
>
> 5. **Create an auth decorator** (for sync frameworks like Flask):
>    ```python
>    from functools import wraps
>    import asyncio
>    from flask import request, jsonify, g
>    from auth0_api_python.errors import BaseAuthError
>
>    def require_auth(f):
>        @wraps(f)
>        def decorated(*args, **kwargs):
>            auth_header = request.headers.get("Authorization", "")
>            if not auth_header.startswith("Bearer "):
>                return jsonify({"error": "Missing or invalid authorization header"}), 401
>            token = auth_header.split(" ", 1)[1]
>            try:
>                g.claims = asyncio.run(api_client.verify_access_token(token))
>            except BaseAuthError as e:
>                return jsonify({"error": str(e)}), e.get_status_code()
>            return f(*args, **kwargs)
>        return decorated
>    ```
>    For FastAPI (native async), use a dependency instead — see [integration.md](./references/integration.md).
>
> 6. **Protect endpoints:**
>    ```python
>    @app.route("/api/private")
>    @require_auth
>    def private():
>        return jsonify({"message": "Authenticated", "sub": g.claims["sub"]})
>    ```
>
> 7. **Verify setup** — run the app and test with curl:
>    ```bash
>    # Should return 401
>    curl http://localhost:5000/api/private
>
>    # Should return 200 (get test token from Auth0 Dashboard → APIs → Test tab)
>    curl -H "Authorization: Bearer <test_token>" http://localhost:5000/api/private
>    ```
>
> 8. **Iterate** — if tests fail after 5–6 attempts, use `AskUserQuestion` to align with the user on what's wrong.

## Detailed Documentation

- **[Setup Guide](./references/setup.md)** — Auth0 API registration, bootstrap script, manual setup, .env configuration, and secret management
- **[Integration Patterns](./references/integration.md)** — Flask and FastAPI patterns, RBAC with `permissions` claim, DPoP, multi-domain, connection token exchange, error handling
- **[API Reference & Testing](./references/api.md)** — Full `ApiClientOptions` reference, claims table, curl testing, common issues, security considerations

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Created **Application** instead of **API** in Auth0 Dashboard | Create an API (resource server) under Applications → APIs. The audience is the API Identifier URL. |
| Audience doesn't match API identifier exactly | `AUTH0_AUDIENCE` must be the exact identifier string set in the Auth0 Dashboard (e.g., `https://my-python-api`) |
| Domain includes `https://` prefix | Use hostname only: `your-tenant.auth0.com` — no scheme or trailing slash |
| Checking `scope` claim instead of `permissions` for RBAC | Use the `permissions` claim (`claims.get("permissions", [])`) — requires RBAC enabled on the API and assigned roles |
| Using `asyncio.run()` inside a running async event loop | In FastAPI/async handlers, `await` directly instead of wrapping in `asyncio.run()` |
| Missing `python-dotenv` dependency | Add `python-dotenv` to requirements and call `load_dotenv()` before accessing env vars |
| CORS not configured before auth middleware | Add CORS headers (via `flask-cors` or FastAPI's `CORSMiddleware`) before authentication so preflight requests pass |
| Not handling `BaseAuthError` | Catch `BaseAuthError` and return `e.get_status_code()` + appropriate JSON body |

## Related Skills

- **[auth0-python](../auth0-python)** — Flask/Django web apps with login/logout (WEB_REGULAR)
- **[auth0-fastapi](../auth0-fastapi)** — FastAPI web apps with login/logout (WEB_REGULAR)
- **[auth0-django-api](../auth0-django-api)** — Django REST API using authlib (BACKEND_API)
- **[auth0-aspnetcore-api](../auth0-aspnetcore-api)** — ASP.NET Core Web API (BACKEND_API reference)
- **[express-jwt](../express-jwt)** — Node.js Express API (BACKEND_API)

## Quick Reference

```python
# ---- Import ----
from auth0_api_python import ApiClient, ApiClientOptions, DomainsResolverContext
from auth0_api_python.errors import BaseAuthError, ApiError, GetTokenByExchangeProfileError

# ---- Initialize (JWT validation only — no secret needed) ----
api_client = ApiClient(ApiClientOptions(
    domain=os.getenv("AUTH0_DOMAIN"),   # e.g., "your-tenant.us.auth0.com"
    audience=os.getenv("AUTH0_AUDIENCE") # e.g., "https://my-python-api"
))

# ---- Validate Bearer token ----
claims = await api_client.verify_access_token(access_token)

# ---- Validate with required claims ----
claims = await api_client.verify_access_token(
    access_token, required_claims=["email", "my_custom_claim"]
)

# ---- Auto-detect Bearer or DPoP (recommended) ----
claims = await api_client.verify_request(
    headers={"authorization": "Bearer ...", ...},
    http_method="GET",
    http_url="https://api.example.com/resource"
)

# ---- DPoP allowed mode (Bearer or DPoP) ----
api_client = ApiClient(ApiClientOptions(
    domain=..., audience=...,
    dpop_enabled=True, dpop_required=False
))

# ---- DPoP required mode ----
api_client = ApiClient(ApiClientOptions(
    domain=..., audience=...,
    dpop_required=True
))

# ---- Multi-custom domain (static) ----
api_client = ApiClient(ApiClientOptions(
    domains=["tenant.auth0.com", "auth.example.com"],
    audience="https://my-python-api"
))

# ---- RBAC: check permissions claim ----
permissions = claims.get("permissions", [])
if "read:data" not in permissions:
    return {"error": "Insufficient permissions"}, 403

# ---- Error handling ----
try:
    claims = await api_client.verify_access_token(token)
except BaseAuthError as e:
    return {"error": str(e)}, e.get_status_code()
except ApiError as e:
    return {"error": e.message}, e.status_code
```

## References

- [GitHub Repository](https://github.com/auth0/auth0-api-python)
- [Auth0 Python API Quickstart](https://auth0.com/docs/quickstart/backend/python/interactive)
- [Auth0 API Documentation](https://auth0.com/docs)
- [Token Vault](https://auth0.com/docs/secure/tokens/token-vault)
- [Custom Token Exchange](https://auth0.com/docs/authenticate/custom-token-exchange)
- [Multiple Custom Domains](https://github.com/auth0/auth0-api-python/blob/main/docs/MultipleCustomDomain.md)
- [Issue Tracker](https://github.com/auth0/auth0-server-python/issues)
