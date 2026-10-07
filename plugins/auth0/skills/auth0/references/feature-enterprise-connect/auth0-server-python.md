# auth0-server-python — Enterprise Connect

**Minimum version:** `1.0.0b17` (every release so far is a pre-release, so
pin it explicitly, e.g. `auth0-server-python>=1.0.0b17`).

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. FastAPI shown; the SDK is
async-only, so `await` every call.

## Enable relay mode

`enterprise_connect=True` makes the client write no Auth0 session; `get_session()`,
`get_user()`, `get_access_token()` raise `EnterpriseConnectError` (code
`enterprise_connect_not_supported`). Only a `transaction_store` is needed - no `state_store`.

Edit the app's **existing** `ServerClient(...)` call in place - do not construct a second client.
Pass `enterprise_connect=True` **as a constructor argument**: the relay-mode restrictions are
applied in `__init__`, so assigning `auth0.enterprise_connect = True` afterwards leaves the client
in normal mode. In the same call, drop `state_store`, `offline_access`, and any `audience`; keep
the existing `transaction_store`:

```python
import os
from auth0_server_python.auth_server import ServerClient

auth0 = ServerClient(
    domain=os.environ["AUTH0_DOMAIN"],
    client_id=os.environ["AUTH0_CLIENT_ID"],          # the B2B Integration's
    client_secret=os.environ["AUTH0_CLIENT_SECRET"],
    secret=os.environ["SESSION_SECRET"],
    redirect_uri=f"{os.environ['APP_BASE_URL']}/auth/callback",
    transaction_store=your_transaction_store,  # concrete auth0_server_python.store.TransactionStore
    enterprise_connect=True,
    authorization_params={"scope": "openid profile email"},  # no offline_access
)
```

## Discover and start login

`start_enterprise_login(StartEnterpriseLoginOptions(email=...), store_options=...)` returns the
authorize URL (with `login_hint`) or `None` when the domain is not federated. It raises
`MissingRequiredArgumentError` / `InvalidArgumentError` for an empty or malformed email. The
store writes the transaction cookie onto the response you pass in:

```python
from fastapi import FastAPI, Request, Form
from fastapi.responses import RedirectResponse
from auth0_server_python.auth_types import StartEnterpriseLoginOptions
from auth0_server_python.error import MissingRequiredArgumentError, InvalidArgumentError

@app.post("/login")
async def login(request: Request, email: str = Form(...)):
    response = RedirectResponse("/", status_code=303)
    try:
        auth_url = await auth0.start_enterprise_login(
            StartEnterpriseLoginOptions(email=email, app_state={"return_to": "/dashboard"}),
            store_options={"request": request, "response": response},
        )
    except (MissingRequiredArgumentError, InvalidArgumentError):
        auth_url = None
    response.headers["location"] = auth_url or "/login?mode=password"  # None: your existing login
    return response
```

To check a domain alone: `from auth0_server_python.auth_server import is_federated_domain`,
then `await is_federated_domain(domain, email_domain)` → `bool`.

## Callback: create the app's own session

`complete_interactive_login` returns a plain **dict** - `user`, `token_set`, `id_token`, `domain`,
and `app_state` when one was passed. `result["user"]` is itself a **dict of claims**: read it by
key (`user["sub"]`, `user.get("org_id")`), not by attribute. There is no `state_data` key in this
mode:

```python
import base64, hashlib, hmac, json
from auth0_server_python.error import ApiError

_secret = os.environ["SESSION_SECRET"].encode()

@app.get("/auth/callback")
async def callback(request: Request):
    response = RedirectResponse("/", status_code=303)
    try:
        result = await auth0.complete_interactive_login(
            str(request.url), store_options={"request": request, "response": response}
        )
    except ApiError as e:
        response.headers["location"] = f"/login?error={e.code}"
        return response

    user = result["user"]
    app_session = {"sub": user["sub"], "email": user.get("email"), "name": user.get("name"),
                   "org_id": user.get("org_id") or ""}
    body = base64.urlsafe_b64encode(json.dumps(app_session).encode()).decode().rstrip("=")
    sig = hmac.new(_secret, body.encode(), hashlib.sha256).hexdigest()
    response.set_cookie("app_session", f"{body}.{sig}", httponly=True,
                        secure=os.environ.get("ENV") == "production", samesite="lax", path="/")
    response.headers["location"] = (result.get("app_state") or {}).get("return_to", "/dashboard")
    return response
```

## Protect routes

Read `request.cookies.get("app_session")`, recompute the HMAC, compare with
`hmac.compare_digest`, then decode the body; redirect to `/login` when it fails. Never call
`auth0.get_session()` / `get_user()` here - they raise.

## Federated logout

`LogoutOptions.federated` **defaults to `False`** (unlike the JS server SDKs) - pass
`federated=True` or the enterprise IdP session survives. `return_to` must be in Allowed Logout URLs:

```python
from auth0_server_python.auth_types import LogoutOptions

@app.get("/logout")
async def logout(request: Request):
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie("app_session", httponly=True,
                           secure=os.environ.get("ENV") == "production", samesite="lax", path="/")
    response.headers["location"] = await auth0.logout(
        LogoutOptions(return_to=f"{os.environ['APP_BASE_URL']}/login", federated=True),
        store_options={"request": request, "response": response},
    )
    return response
```

## Security

Secrets come from the environment. Do not keep `result["token_set"]` or `result["id_token"]`;
store only the claims you need. Do not `jwt.decode` the ID token - the SDK already verified it.
Maintained example:
https://raw.githubusercontent.com/auth0/auth0-server-python/main/examples/EnterpriseConnect.md

All calls above are accurate for `auth0-server-python` 1.0.0b17+ — do not read the SDK source to
re-verify them.
