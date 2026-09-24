# Integration & Enforcement — Python

How to wire org-aware login and — most importantly — enforce tenant isolation from the token in
Python apps. Full SDK setup lives in `auth0-fastapi-api` (FastAPI) and `auth0-flask` (Flask); this
file covers only the B2B additions: passing `organization`/`invitation` on login and `org_id`-scoped
enforcement.

## The enforcement contract (read this first)

On every protected request the backend MUST:

1. **Validate** the access token (signature, `iss`, `aud`, `exp`) — standard JWT validation.
2. **Read `org_id`** from the validated token. This is the active tenant.
3. **Scope all data access** to that `org_id` (tenant filter on every query).
4. **Check authorization relative to `org_id`** — roles/permissions in the token were issued for
   the org the user logged into; treat them as valid only for that org.

Never read the tenant from the URL, a path segment, a body field, or a client header. Those are
attacker-controlled. The token's `org_id` is the only trustworthy tenant statement.

---

## FastAPI (`auth0-fastapi-api`)

### Login: passing `organization` and `invitation`

FastAPI apps using `auth0-fastapi-api` are typically API-only backends; the login redirect is
handled by the frontend. Pass `organization` and `invitation` as query params to your login
endpoint and forward them to `/authorize`:

```python
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

router = APIRouter()

@router.get("/login")
async def login(request: Request, organization: str | None = None, invitation: str | None = None):
    params = {}
    if organization:
        params["organization"] = organization
    if invitation:
        params["invitation"] = invitation
    # Build the /authorize redirect (see auth0-fastapi-api for full SDK setup)
    return RedirectResponse(url=build_authorize_url(**params))
```

### Enforcement: `org_id`-scoped dependency

```python
from fastapi import Depends, HTTPException, status
from fastapi_plugin import Auth0FastAPI

auth0 = Auth0FastAPI(
    domain="your-tenant.us.auth0.com",
    audience="https://api.your-app.com",
)

NS = "https://your-app.com"

async def require_org(claims: dict = Depends(auth0.require_auth())) -> dict:
    org_id = claims.get("org_id")
    if not org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Org context required")
    return claims

@app.get("/api/members")
async def list_members(claims: dict = Depends(require_org)):
    org_id = claims["org_id"]                          # the ONLY source of tenant identity
    roles = claims.get(f"{NS}/roles", [])

    if "org-admin" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    members = await db.members.find_all(org_id=org_id)  # tenant filter
    return members
```

---

## Flask (`auth0-flask` / `auth0-server-python`)

Flask apps use a session-based flow — the user's claims arrive from the session after the OIDC
callback, not from a Bearer token. `org_id` lives inside the session user object.

### Login: passing `organization` and `invitation`

```python
from flask import request, redirect
from auth0_server_python.auth_server.server_client import ServerClient

auth0 = ServerClient(...)  # see auth0-flask for full setup

@app.route("/login")
async def login():
    organization = request.args.get("organization")
    invitation = request.args.get("invitation")
    params = {}
    if organization:
        params["organization"] = organization
    if invitation:
        params["invitation"] = invitation
    return await auth0.start_interactive_login(authorization_params=params)
```

### Enforcement: `org_id`-scoped route guard

```python
from functools import wraps
from flask import g, abort, jsonify

NS = "https://your-app.com"

def require_org(f):
    @wraps(f)
    async def decorated(*args, **kwargs):
        user = await auth0.get_user()
        if not user:
            abort(401)
        org_id = user.get("org_id")
        if not org_id:
            abort(403)
        g.org_id = org_id                              # the ONLY source of tenant identity
        g.roles = user.get(f"{NS}/roles", [])
        return await f(*args, **kwargs)
    return decorated

@app.route("/api/members")
@require_org
async def list_members():
    if "org-admin" not in g.roles:
        abort(403)

    members = await db.members.find_all(org_id=g.org_id)  # tenant filter
    return jsonify(members)
```

---

## Why `org_id`, not the user's membership list

A user can belong to many orgs. The Management API can list *all* their memberships, but that is
not the active tenant — the active tenant is whichever org they authenticated into, which Auth0
records as `org_id` in the issued token (or session). Authorizing against the membership list
instead of the token's `org_id` re-introduces the cross-tenant access bug this whole setup exists
to prevent.
