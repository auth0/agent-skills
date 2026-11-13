# auth0-server-python — Enterprise Connect

**Minimum version:** `1.0.0b17` (every release so far is a pre-release, so
pin it explicitly, e.g. `auth0-server-python>=1.0.0b17`).

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. FastAPI shown; the SDK is
async-only, so `await` every call. The SDK itself is framework-agnostic: it passes `store_options`
unchanged to your `TransactionStore`, which decides what it needs. A cookie-backed store reads
`request` and writes `response`, so pass the **same** response object you finally send, or the
transaction cookie never reaches the browser. In another framework, pass that framework's
request and response objects the same way.

## Enable relay mode

`enterprise_connect=True` makes the client write no Auth0 session. Only `start_interactive_login`,
`start_enterprise_login`, `complete_interactive_login`, `logout`, `custom_token_exchange`, and
`handle_backchannel_logout` (a no-op) work; every other public method, including `get_session()`,
`get_user()`, and `get_access_token()`, raises `EnterpriseConnectError` (code
`enterprise_connect_not_supported`). A `transaction_store` is required; no `state_store` is needed.

Construct one `ServerClient` with the B2B Integration's credentials (if the app already has one,
edit that call - do not construct a second client). Pass `enterprise_connect=True` **as a
constructor argument**: the restrictions are applied in `__init__`, so setting an attribute
afterwards has no effect. In the same call, drop `state_store`, `offline_access` (no refresh token
is issued; the SDK only warns), any static `organization` (ignored; Auth0 resolves it from the
email), and any `audience`; keep the existing `transaction_store`:

```python
import os
from auth0_server_python.auth_server import ServerClient

auth0 = ServerClient(
    domain=os.environ["AUTH0_DOMAIN"],
    client_id=os.environ["AUTH0_CLIENT_ID"],          # the B2B Integration's
    client_secret=os.environ["AUTH0_CLIENT_SECRET"],
    secret=os.environ["AUTH0_SECRET"],                # encrypts the login-transaction cookie
    redirect_uri=f"{os.environ['APP_BASE_URL']}/auth/callback",
    transaction_store=your_transaction_store,  # concrete auth0_server_python.store.TransactionStore
    enterprise_connect=True,
    authorization_params={"scope": "openid profile email"},  # no offline_access
)
```

## Discover and start login

`start_enterprise_login(StartEnterpriseLoginOptions(email=...), store_options=...)` returns the
authorize URL (with `login_hint`) or `None` when the domain is not federated. Discovery
(WebFinger) fails closed: a network error, rate limit, or unexpected status also returns `None`.
It raises `MissingRequiredArgumentError` for an empty email and `InvalidArgumentError` for a
malformed one. The store writes the transaction cookie onto the response you pass in:

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
    # None: domain is not federated, handle with your own login -
    # replace '/login?mode=password' with your existing login route
    # (URL-encode an email in its query with urllib.parse.quote)
    response.headers["location"] = auth_url or "/login?mode=password"
    return response
```

To check a domain alone (uncached): `from auth0_server_python.auth_server import
is_federated_domain`, then `await is_federated_domain(auth0_domain, email_domain)` → `bool`.

## Callback: create the app's own session

`complete_interactive_login` returns a plain **dict** - `user`, `token_set`, `id_token`, `domain`,
and `app_state` when one was passed. `result["user"]` is itself a **dict of claims**: read it by
key (`user["sub"]`, `user.get("org_id")`), not by attribute. There is no `state_data` key in this
mode. Create the app session with the app's existing session helper if it has one; the inline
version below shows the required shape (signed, `HttpOnly`, no Auth0 tokens). Sign it with a secret
separate from the SDK's `AUTH0_SECRET` (reuse the app's existing session secret if it has one):

```python
import base64, hashlib, hmac, json, time
from auth0_server_python.error import Auth0Error

_secret = os.environ["APP_SESSION_SECRET"].encode()
SESSION_SECONDS = 8 * 60 * 60

@app.get("/auth/callback")
async def callback(request: Request):
    response = RedirectResponse("/", status_code=303)
    try:
        result = await auth0.complete_interactive_login(
            str(request.url), store_options={"request": request, "response": response}
        )
    except Auth0Error:  # ApiError, MissingTransactionError, org/issuer validation failures
        response.headers["location"] = "/login?error=callback"
        return response

    user = result["user"]
    app_session = {"sub": user["sub"], "email": user.get("email"), "name": user.get("name"),
                   "org_id": user.get("org_id") or "", "exp": int(time.time()) + SESSION_SECONDS}
    body = base64.urlsafe_b64encode(json.dumps(app_session).encode()).decode().rstrip("=")
    sig = hmac.new(_secret, body.encode(), hashlib.sha256).hexdigest()
    response.set_cookie("app_session", f"{body}.{sig}", httponly=True, max_age=SESSION_SECONDS,
                        secure=os.environ.get("ENV") == "production", samesite="lax", path="/")
    response.headers["location"] = (result.get("app_state") or {}).get("return_to", "/dashboard")
    return response
```

## Protect routes

Read `request.cookies.get("app_session")`, recompute the HMAC, compare with
`hmac.compare_digest`, then decode the body and check `exp > time.time()`; redirect to `/login`
when any check fails. Never call `auth0.get_session()` / `get_user()` here - they raise.

## Federated logout

`LogoutOptions.federated` **defaults to `False`** (unlike the JS server SDKs) - pass
`federated=True` or the enterprise IdP session survives (the SDK warns otherwise). `return_to`
must be in Allowed Logout URLs. `logout()` returns the URL to redirect to. Put this in the app's
existing sign-out route, so every sign-out path ends the IdP session:

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

All calls above are accurate for `auth0-server-python` 1.0.0b17+ (b16 and earlier lack Enterprise
Connect) - do not read the SDK source to re-verify them.
