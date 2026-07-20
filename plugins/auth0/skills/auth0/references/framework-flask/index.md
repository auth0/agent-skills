
# Auth0 Flask Web App Integration

Add login, logout, and user profile to a Flask web application using `auth0-server-python`.

## Prerequisites

- Flask application
- Auth0 Regular Web Application configured (not an API — must be an Application)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Python APIs with JWT Bearer validation** — Use `auth0-fastapi-api` for FastAPI, or see the [Django REST Framework quickstart](https://auth0.com/docs/quickstart/backend/django)
- **FastAPI web app with login/logout UI** — No dedicated skill yet; see the [FastAPI quickstart](https://auth0.com/docs/quickstart/webapp/python)
- **Single Page Applications** — Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Next.js applications** — Use the Auth0 integration workflow for Next.js, which handles both client and server
- **Node.js web apps** — Use the Auth0 integration workflow for Express or Fastify for session-based auth

## Quick Start Workflow

### 1. Install SDK

```bash
pip install auth0-server-python "flask[async]" python-dotenv
```

**Critical:** You must install `flask[async]` (not just `flask`). The `[async]` extra installs `asgiref` which is required for Flask 2.0+ to support `async def` route handlers. Without it, async routes will not work. In `requirements.txt`, use `flask[async]>=2.0.0`.

### 2. Configure Environment

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_SECRET=your_generated_app_secret
AUTH0_REDIRECT_URI=http://localhost:5000/callback
```

`AUTH0_DOMAIN` is your Auth0 tenant domain (without `https://`). `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` come from your Auth0 Application settings. `AUTH0_SECRET` is used for encrypting session data — generate with `openssl rand -hex 64`.

### 3. Configure Auth0 Dashboard

In your Auth0 Application settings:
- **Allowed Callback URLs**: `http://localhost:5000/callback`
- **Allowed Logout URLs**: `http://localhost:5000`

### 4. Create Auth Module

Create `auth.py` to initialize the `ServerClient` with Flask session-based stores. The stores use Flask's built-in `session` (cookie-based by default) for a **stateless** setup — no external database needed:

```python
import os
from flask import session as flask_session
from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import StateData, TransactionData
from auth0_server_python.store import StateStore, TransactionStore
from dotenv import load_dotenv

load_dotenv()  # Uses .env by default; pass load_dotenv(".env.local") if credentials are in .env.local

class FlaskSessionStateStore(StateStore):
    """State store that uses Flask's session for persistence."""

    def __init__(self, secret: str):
        super().__init__({"secret": secret})

    async def set(self, identifier, state, remove_if_expires=False, options=None):
        data = state.dict() if hasattr(state, "dict") else state
        flask_session[identifier] = self.encrypt(identifier, data)

    async def get(self, identifier, options=None):
        data = flask_session.get(identifier)
        if data is None:
            return None
        decrypted = self.decrypt(identifier, data)
        # Ensure to not return a dict, as the underlying SDK expects a StateData instance, not a dict
        return StateData(**decrypted) if isinstance(decrypted, dict) else decrypted

    async def delete(self, identifier, options=None):
        flask_session.pop(identifier, None)

    async def delete_by_logout_token(self, claims, options=None):
        pass

class FlaskSessionTransactionStore(TransactionStore):
    """Transaction store that uses Flask's session for persistence."""

    def __init__(self, secret: str):
        super().__init__({"secret": secret})

    async def set(self, identifier, state, remove_if_expires=False, options=None):
        data = state.dict() if hasattr(state, "dict") else state
        flask_session[identifier] = self.encrypt(identifier, data)

    async def get(self, identifier, options=None):
        data = flask_session.get(identifier)
        if data is None:
            return None
        decrypted = self.decrypt(identifier, data)
        # Ensure to not return a dict, as the underlying SDK expects a TransactionData instance, not a dict
        return TransactionData(**decrypted) if isinstance(decrypted, dict) else decrypted

    async def delete(self, identifier, options=None):
        flask_session.pop(identifier, None)

secret = os.getenv("AUTH0_SECRET")

auth0 = ServerClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
    secret=secret,
    redirect_uri=os.getenv("AUTH0_REDIRECT_URI"),
    state_store=FlaskSessionStateStore(secret=secret),
    transaction_store=FlaskSessionTransactionStore(secret=secret),
    authorization_params={"scope": "openid profile email"},
)
```

Create one `ServerClient` instance and reuse it. Never hardcode credentials — always use environment variables.

**How this works:** Flask's default session is cookie-based (stateless). The SDK encrypts session data (tokens, user profile) with JWE before storing it in the session, so data is both signed and encrypted in the cookie. No server-side database is required.

**No `store_options` or `before_request` needed:** The SDK supports passing `store_options` (e.g. request/response objects) to store methods. Since these stores use `flask.session` — which is globally available during a request — they don't need anything from `store_options`, so you can call SDK methods without passing it. If you implement a custom store that manages cookies directly (instead of using `flask.session`), you would need to reintroduce `store_options` with `{"request": request, "response": response}`.

**Cookie size note:** Stateless sessions store all data in a cookie (~4KB limit). For most apps this is sufficient. If you store large amounts of session data or hit cookie size limits, switch to [stateful setup](#stateful-setup-with-redis).

### 5. Configure Flask App

In `app.py`, set up Flask with the secret key and session configuration:

```python
import os
from flask import Flask, redirect, request
from auth import auth0
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("AUTH0_SECRET")
app.config.update(
    SESSION_COOKIE_SECURE=False,  # Set to True in production (requires HTTPS)
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
```

**Critical:** `app.secret_key` must be set for Flask session management. Without it, sessions won't work.

**For production:** Set `SESSION_COOKIE_SECURE=True` when deploying with HTTPS. Leaving it as `False` in production allows session cookies to be sent over unencrypted connections.

### 6. Add Home Route

```python
@app.route("/")
async def home():
    user = await auth0.get_user()
    if user:
        return f"Hello, {user['name']}! <a href='/profile'>Profile</a> | <a href='/logout'>Logout</a>"
    return "Welcome! <a href='/login'>Login</a>"
```

### 7. Add Login Route

```python
@app.route("/login")
async def login():
    authorization_url = await auth0.start_interactive_login()
    return redirect(authorization_url)
```

`start_interactive_login()` returns a URL string pointing to Auth0's Universal Login page. You must wrap it in `redirect()`. Authorization params (scope, redirect_uri) are already configured on the `ServerClient`.

### 8. Add Callback Route

```python
@app.route("/callback")
async def callback():
    try:
        await auth0.complete_interactive_login(str(request.url))
        return redirect("/")
    except Exception as e:
        return f"Authentication error: {str(e)}", 400
```

Pass `str(request.url)` as the first argument — this is the full callback URL including the authorization code query parameters. Always wrap in try/except since the token exchange can fail (e.g. expired code, CSRF mismatch).

### 9. Add Profile Route (Protected)

```python
@app.route("/profile")
async def profile():
    user = await auth0.get_user()
    if user is None:
        return redirect("/login")
    return (
        f"<h1>{user['name']}</h1>"
        f"<p>Email: {user['email']}</p>"
        f"<img src='{user['picture']}' alt='{user['name']}' width='100' />"
        f"<p><a href='/logout'>Logout</a></p>"
    )
```

`get_user()` returns the user's profile from the session, or `None` if not logged in.

### 10. Add Logout Route

```python
@app.route("/logout")
async def logout():
    url = await auth0.logout()
    return redirect(url)
```

`logout()` returns the Auth0 logout URL. Redirect the user to it.

### 11. Test the App

```bash
flask run
```

Visit `http://localhost:5000/login` to start the login flow.

## Stateful Setup with Redis

For production apps or when session data exceeds cookie size limits, use **Flask-Session** with Redis to store sessions server-side. Only a session ID is stored in the cookie.

### 1. Install Dependencies

```bash
pip install flask-session redis
```

### 2. Configure Flask-Session

Update `app.py` to use Redis-backed sessions:

```python
import os
from flask import Flask, redirect, request
from flask_session import Session
from auth import auth0
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("AUTH0_SECRET")
app.config.update(
    SESSION_TYPE="redis",
    SESSION_PERMANENT=True,
    SESSION_KEY_PREFIX="auth0:",
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
Session(app)
```

### 3. No Store Changes Needed

The same `FlaskSessionStateStore` and `FlaskSessionTransactionStore` from `auth.py` work without modification. Flask-Session transparently switches the `flask.session` backend from cookies to Redis — the stores continue to use `flask.session` as before.

**Routes are identical** to the stateless setup — no code changes needed.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Hardcoding `domain`, `client_id`, or `client_secret` in source | Always read from environment variables — never embed credentials in code |
| Using `Authlib` or `python-jose` directly | Not needed; `auth0-server-python` handles all OAuth/OIDC flows |
| Using `Flask-Login` or `Flask-Dance` | Not needed; the SDK manages sessions and authentication |
| Manually parsing JWTs with `jwt.decode()` | The SDK handles token validation internally |
| Installing `flask` without `[async]` extra | Must use `flask[async]>=2.0.0` in requirements.txt — without it, async route handlers silently fail |
| Using synchronous route handlers | All routes calling SDK methods must be `async def` and use `await` |
| Forgetting `app.secret_key` | Required for Flask session management — without it, sessions silently fail |
| Using `auth0-fastapi-api` in Flask | That package is for FastAPI APIs — use `auth0-server-python` for Flask |
| Passing `domain` as full URL with `https://` | `domain` should be the bare domain, e.g. `my-tenant.us.auth0.com`, not `https://my-tenant.us.auth0.com` |
| Not configuring callback URL in Auth0 Dashboard | Must add `http://localhost:5000/callback` to Allowed Callback URLs |
| Returning `start_interactive_login()` directly | It returns a URL string, not a response — must wrap in `redirect()` |
| Not handling errors in `/callback` | `complete_interactive_login()` can fail — always wrap in try/except |
| Calling SDK methods without `await` | All SDK methods are async — forgetting `await` returns a coroutine instead of the result |
| Passing options positionally to `logout()` | Use `logout(store_options=...)` — the first positional parameter is `LogoutOptions`, not store options |
| Expecting backchannel logout to work | Not supported with cookie-based sessions — `delete_by_logout_token` is a no-op. Use standard `/logout` route |
| Deploying with `SESSION_COOKIE_SECURE=False` | Must set to `True` in production — cookies are sent over HTTP otherwise |

## Key SDK Methods

All methods are async:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `start_interactive_login` | `await auth0.start_interactive_login()` | Returns authorization URL string — wrap in `redirect()` |
| `complete_interactive_login` | `await auth0.complete_interactive_login(str(request.url))` | Processes the callback URL, exchanges code for tokens |
| `get_user` | `await auth0.get_user()` | Returns current session user dict or `None` |
| `get_access_token` | `await auth0.get_access_token()` | Returns the access token for calling external APIs |
| `logout` | `await auth0.logout()` | Returns Auth0 logout URL string |

## Related Skills

- Server-rendered Node.js web apps with login/logout sessions → the Auth0 integration workflow for Express or Fastify
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**ServerClient configuration:**
```python
auth0 = ServerClient(
    domain=os.getenv("AUTH0_DOMAIN"),                    # required
    client_id=os.getenv("AUTH0_CLIENT_ID"),              # required
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),      # required
    secret=os.getenv("AUTH0_SECRET"),                    # required (encryption secret)
    redirect_uri=os.getenv("AUTH0_REDIRECT_URI"),        # required
    state_store=FlaskSessionStateStore(secret=secret),   # required
    transaction_store=FlaskSessionTransactionStore(secret=secret),  # required
    authorization_params={"scope": "openid profile email"},  # recommended
)
```

**Route protection pattern:**
```python
user = await auth0.get_user()
if user is None:
    return redirect("/login")
```

**Environment variables:**
- `AUTH0_DOMAIN` — your Auth0 tenant domain (e.g. `tenant.us.auth0.com`)
- `AUTH0_CLIENT_ID` — your Application's client ID
- `AUTH0_CLIENT_SECRET` — your Application's client secret
- `AUTH0_SECRET` — encryption and session secret key
- `AUTH0_REDIRECT_URI` — callback URL (e.g. `http://localhost:5000/callback`)

## References

- [auth0-server-python on PyPI](https://pypi.org/project/auth0-server-python/)
- [auth0-server-python GitHub](https://github.com/auth0/auth0-server-python)
- [Auth0 Flask Quickstart](https://auth0.com/docs/quickstart/webapp/python)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Flask-Session Documentation](https://flask-session.readthedocs.io/)

---

# Auth0 Flask API Reference

Complete configuration and API reference for Flask authentication.

---

## ServerClient Configuration

### Complete Configuration Options

```python
from auth0_server_python.auth_server.server_client import ServerClient

secret = os.getenv("AUTH0_SECRET")

auth0 = ServerClient(
    domain=os.getenv("AUTH0_DOMAIN"),                    # required: tenant domain (without https://)
    client_id=os.getenv("AUTH0_CLIENT_ID"),              # required: app client ID
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),      # required: app client secret
    secret=secret,                                       # required: encryption secret (min 32 chars)
    redirect_uri=os.getenv("AUTH0_REDIRECT_URI"),        # required: callback URL
    state_store=FlaskSessionStateStore(secret=secret),   # required: state persistence
    transaction_store=FlaskSessionTransactionStore(secret=secret),  # required: transaction persistence
    authorization_params={                                # optional: OAuth params
        "scope": "openid profile email",
        "audience": "https://your-api-identifier",
    },
)
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `domain` | Yes | Auth0 tenant domain (e.g., `tenant.us.auth0.com`) — without `https://` |
| `client_id` | Yes | Application client ID from Auth0 Dashboard |
| `client_secret` | Yes | Application client secret from Auth0 Dashboard |
| `secret` | Yes | Encryption secret for JWE — generate with `openssl rand -hex 64` |
| `redirect_uri` | Yes | Callback URL (e.g., `http://localhost:5000/callback`) |
| `state_store` | Yes | Store implementation for session state |
| `transaction_store` | Yes | Store implementation for OAuth transaction data |
| `authorization_params` | No | Default OAuth parameters (scope, audience, connection) |

---

## Flask Session Configuration

### Cookie-Based Sessions (Stateless)

```python
app = Flask(__name__)
app.secret_key = os.getenv("AUTH0_SECRET")
app.config.update(
    SESSION_COOKIE_SECURE=False,       # Set to True in production (requires HTTPS)
    SESSION_COOKIE_HTTPONLY=True,       # Prevents JavaScript access to cookie
    SESSION_COOKIE_SAMESITE="Lax",     # CSRF protection
)
```

| Option | Default | Description |
|--------|---------|-------------|
| `SESSION_COOKIE_SECURE` | `False` | Only send cookie over HTTPS — **must be `True` in production** |
| `SESSION_COOKIE_HTTPONLY` | `True` | Prevent JavaScript access to session cookie |
| `SESSION_COOKIE_SAMESITE` | `None` | CSRF protection — use `"Lax"` for auth flows |
| `PERMANENT_SESSION_LIFETIME` | 31 days | Session expiration (accepts `timedelta`) |

Cookie size limit: ~4KB. Sufficient for most apps with `openid profile email` scopes.

### Redis-Based Sessions (Stateful)

```python
from flask_session import Session

app = Flask(__name__)
app.secret_key = os.getenv("AUTH0_SECRET")
app.config.update(
    SESSION_TYPE="redis",
    SESSION_PERMANENT=True,
    SESSION_KEY_PREFIX="auth0:",
    SESSION_COOKIE_SECURE=False,       # Set to True in production
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
Session(app)
```

No store code changes needed — Flask-Session transparently switches the `flask.session` backend from cookies to Redis. The same `FlaskSessionStateStore` and `FlaskSessionTransactionStore` work without modification.

---

## ServerClient Methods

All methods are async and must be called with `await`.

### start_interactive_login()

Initiates the OAuth login flow and returns an authorization URL.

```python
authorization_url = await auth0.start_interactive_login()
return redirect(authorization_url)
```

**Returns:** URL string — must wrap in `redirect()`.

**With options:**

```python
from auth0_server_python.auth_types import StartInteractiveLoginOptions

authorization_url = await auth0.start_interactive_login(
    options=StartInteractiveLoginOptions(
        authorization_params={
            "connection": "google-oauth2",
            "screen_hint": "signup",
        }
    )
)
```

### complete_interactive_login(url)

Processes the callback URL, exchanges the authorization code for tokens, and stores session state.

```python
await auth0.complete_interactive_login(str(request.url))
```

**Parameters:**
- `url` (string): Full callback URL including query parameters

**Raises:** Exception on state mismatch (CSRF), missing parameters, or token exchange failures.

### get_user()

Retrieves the current authenticated user from the session.

```python
user = await auth0.get_user()
```

**Returns:** User dict or `None` if not authenticated.

**User dict keys:**
- `sub` — Auth0 user ID (e.g., `google-oauth2|123456`)
- `name` — Display name
- `email` — Email address
- `picture` — Avatar URL
- `email_verified` — Boolean

### get_access_token()

Retrieves the access token for calling external APIs. Handles token refresh automatically if a refresh token is available and the access token is expired.

```python
access_token = await auth0.get_access_token()
```

**Returns:** Access token string. **Raises** on failure (e.g. expired token without refresh token).

**Requires:** `audience` parameter in `authorization_params` during ServerClient initialization.

### logout()

Clears the session and returns the Auth0 logout URL.

```python
url = await auth0.logout()
return redirect(url)
```

**Returns:** Auth0 logout URL string — must wrap in `redirect()`.

**With options:**

```python
from auth0_server_python.auth_types import LogoutOptions

url = await auth0.logout(
    options=LogoutOptions(return_to="http://localhost:5000/goodbye")
)
```

---

## Store Implementation

Both stores use Flask's built-in `session` object. Since `flask.session` is a context-local available during any request, the stores don't need `store_options` — they access the session directly.

### FlaskSessionStateStore

Stores OAuth state (user profile, tokens) in Flask session, encrypted with JWE.

```python
from flask import session as flask_session
from auth0_server_python.auth_types import StateData
from auth0_server_python.store import StateStore

class FlaskSessionStateStore(StateStore):
    """State store that uses Flask's session for persistence."""

    def __init__(self, secret: str):
        super().__init__({"secret": secret})

    async def set(self, identifier, state, remove_if_expires=False, options=None):
        data = state.dict() if hasattr(state, "dict") else state
        flask_session[identifier] = self.encrypt(identifier, data)

    async def get(self, identifier, options=None):
        data = flask_session.get(identifier)
        if data is None:
            return None
        decrypted = self.decrypt(identifier, data)
        return StateData(**decrypted) if isinstance(decrypted, dict) else decrypted

    async def delete(self, identifier, options=None):
        flask_session.pop(identifier, None)

    async def delete_by_logout_token(self, claims, options=None):
        pass  # Not supported with stateless cookie sessions
```

### FlaskSessionTransactionStore

Stores transaction data (PKCE code_verifier, nonce, state) during the login flow, encrypted with JWE.

```python
from flask import session as flask_session
from auth0_server_python.auth_types import TransactionData
from auth0_server_python.store import TransactionStore

class FlaskSessionTransactionStore(TransactionStore):
    """Transaction store that uses Flask's session for persistence."""

    def __init__(self, secret: str):
        super().__init__({"secret": secret})

    async def set(self, identifier, state, remove_if_expires=False, options=None):
        data = state.dict() if hasattr(state, "dict") else state
        flask_session[identifier] = self.encrypt(identifier, data)

    async def get(self, identifier, options=None):
        data = flask_session.get(identifier)
        if data is None:
            return None
        decrypted = self.decrypt(identifier, data)
        return TransactionData(**decrypted) if isinstance(decrypted, dict) else decrypted

    async def delete(self, identifier, options=None):
        flask_session.pop(identifier, None)
```

**Why no `store_options`:** The SDK passes `store_options` (typically `{"request": request, "response": response}`) to store methods. Since Flask's `session` is a context-local that's automatically available during any request, the stores don't need request/response objects passed in — they access `flask_session` directly. The SDK passes `None` through without error.

---

## Security Considerations

### SESSION_COOKIE_SECURE

```python
# Development (localhost HTTP)
SESSION_COOKIE_SECURE=False

# Production (HTTPS required)
SESSION_COOKIE_SECURE=True
```

Setting `SESSION_COOKIE_SECURE=False` in production is a security risk — session cookies will be sent over unencrypted HTTP connections, exposing them to interception.

### Backchannel Logout Limitation

Backchannel logout (Auth0 sending a server-to-server logout token) is **not supported** with Flask session stores. The `delete_by_logout_token` method is a no-op because there is no server-side session store to query and delete from — session data lives in the user's browser cookie.

**Impact:** If a user logs out from another application in the same Auth0 tenant, their Flask session will not be automatically revoked. The session persists until the user makes a new request and the app clears it, or the cookie expires.

**Workaround:** For enterprise scenarios requiring federated logout, switch to Redis-backed sessions where you can implement `delete_by_logout_token` to scan and delete matching sessions.

### Cookie Size Limits

Stateless cookie sessions are limited to ~4KB by browsers. The SDK encrypts tokens and user profile with JWE before storing in the session. For typical apps with `openid profile email` scopes, this is well within limits.

**When it breaks:** Large custom claims, multiple audience tokens, or extensive user metadata can exceed the limit. The browser silently truncates or rejects the cookie, causing mysterious session loss.

**Fix:** Switch to Redis-backed sessions (see [Flask Session Configuration](#redis-based-sessions-stateful)).

### Best Practices

- **Keep secrets secure** — Never commit `.env` to version control
- **Use HTTPS in production** — `SESSION_COOKIE_SECURE=True` requires HTTPS
- **Rotate secrets regularly** — Update `AUTH0_SECRET` periodically
- **Validate audience** — For API calls, always configure `audience` parameter
- **Handle errors** — Always wrap `complete_interactive_login` in try/except

---

## Testing

### Local Testing

1. Start your app: `flask run`
2. Visit `http://localhost:5000/login`
3. Complete Auth0 login flow
4. Verify redirect to callback and session established
5. Visit protected route (e.g., `/profile`)
6. Click logout and verify session cleared

---

# Auth0 Flask Integration Patterns

Server-side authentication patterns for Flask.

---

## Protected Routes

### Using Decorator Pattern

```python
from functools import wraps
from flask import redirect, render_template
from auth import auth0

def require_auth(f):
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        user = await auth0.get_user()
        if user is None:
            return redirect("/login")
        return await f(*args, **kwargs)
    return decorated_function

@app.route("/admin")
@require_auth
async def admin():
    user = await auth0.get_user()
    return render_template("admin.html", user=user)
```

### Manual Check in Route

```python
@app.route("/dashboard")
async def dashboard():
    user = await auth0.get_user()
    if user is None:
        return redirect("/login")
    return render_template("dashboard.html", user=user)
```

### Blueprint Protection

```python
from flask import Blueprint, redirect, render_template
from auth import auth0

admin = Blueprint("admin", __name__, url_prefix="/admin")

@admin.before_request
async def check_auth():
    user = await auth0.get_user()
    if user is None:
        return redirect("/login")

@admin.route("/settings")
async def settings():
    user = await auth0.get_user()
    return render_template("settings.html", user=user)

app.register_blueprint(admin)
```

---

## Calling External APIs

### Get Access Token

```python
import httpx
from flask import jsonify, redirect
from auth import auth0

@app.route("/api-call")
async def api_call():
    user = await auth0.get_user()
    if user is None:
        return redirect("/login")

    try:
        access_token = await auth0.get_access_token()
    except Exception as e:
        return f"Access token error: {e}", 401

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.example.com/data",
            headers={"Authorization": f"Bearer {access_token}"}
        )

    return jsonify(response.json())
```

### Configure Audience

Update the `ServerClient` initialization in `auth.py` to include `audience`:

```python
auth0 = ServerClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
    secret=secret,
    redirect_uri=os.getenv("AUTH0_REDIRECT_URI"),
    state_store=FlaskSessionStateStore(secret=secret),
    transaction_store=FlaskSessionTransactionStore(secret=secret),
    authorization_params={
        "scope": "openid profile email",
        "audience": "https://your-api-identifier",  # Add this
    },
)
```

---

## Custom Login/Logout

### Custom Login with Connection

```python
from auth0_server_python.auth_types import StartInteractiveLoginOptions

@app.route("/login-google")
async def login_google():
    authorization_url = await auth0.start_interactive_login(
        options=StartInteractiveLoginOptions(
            authorization_params={"connection": "google-oauth2"}
        )
    )
    return redirect(authorization_url)
```

### Custom Logout with Return URL

```python
from auth0_server_python.auth_types import LogoutOptions

@app.route("/logout")
async def logout():
    url = await auth0.logout(
        options=LogoutOptions(return_to="http://localhost:5000/goodbye")
    )
    return redirect(url)
```

---

## Session Management

### Access User Information

```python
@app.route("/user-info")
async def user_info():
    user = await auth0.get_user()

    if user is None:
        return jsonify({"authenticated": False})

    return jsonify({
        "authenticated": True,
        "user": user,
    })
```

### Store Custom Session Data

```python
from flask import session as flask_session

@app.route("/callback")
async def callback():
    try:
        await auth0.complete_interactive_login(str(request.url))
        user = await auth0.get_user()

        # Store custom data alongside Auth0 session
        flask_session["user_role"] = "admin"

        return redirect("/")
    except Exception as e:
        return f"Authentication error: {str(e)}", 400
```

### Inject User via before_request

Make user available in all templates using a `before_request` hook (Flask supports async for `before_request` but not for `context_processor`):

```python
@app.before_request
async def load_user():
    g.user = await auth0.get_user()
```

Then in any template:

```html
{% if g.user %}
  <p>Welcome, {{ g.user.name }}!</p>
  <a href="/logout">Logout</a>
{% else %}
  <a href="/login">Login</a>
{% endif %}
```

---

## Error Handling

### Callback Error Handling

```python
@app.route("/callback")
async def callback():
    try:
        await auth0.complete_interactive_login(str(request.url))
        return redirect("/")
    except Exception as e:
        # State validation, token exchange, or other authentication errors
        return f"Authentication error: {str(e)}", 400
```

### Global Error Handler

```python
@app.errorhandler(401)
def unauthorized(error):
    return redirect("/login")
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Callback URL mismatch" | Ensure `AUTH0_REDIRECT_URI` matches Allowed Callback URLs in Auth0 Dashboard exactly |
| Session data lost on page reload | Check `app.secret_key` is set and Flask session is configured |
| Access token is None | Configure `audience` in ServerClient `authorization_params` |
| "Invalid state" error | Regenerate `AUTH0_SECRET` — it may be corrupted or too short |
| Async routes not working | Use `flask[async]>=2.0.0` (not just `flask`) |
| Redirect loop on login | Check that `/login` route is not itself protected by `require_auth` |

---

---

# Auth0 Flask Setup Guide

Setup instructions for Flask applications.

---

## Quick Setup (Automated)

Below automates the setup, except for the CLIENT_SECRET. Inform the user that they have to fill in the value for the CLIENT_SECRET themselves.

**Never read the contents of `.env.local` or `.env` at any point during setup.** The file may contain sensitive secrets that should not be exposed in the LLM context. If you determine you need to read the file for any reason, ask the user for explicit permission before doing so — do not proceed until the user confirms.

**Before running any part of this setup that writes to an env file, you MUST ask the user for explicit confirmation.** Follow the steps below precisely.

### Step 1: Check for existing env files and confirm with user

Before writing credentials, check which env files exist:

```bash
test -f .env.local && echo "ENV_LOCAL_EXISTS" || echo "ENV_LOCAL_NOT_FOUND"
test -f .env && echo "ENV_EXISTS" || echo "ENV_NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding — do not continue until the user confirms:

- If `.env.local` exists, ask:
  - Question: "A `.env.local` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env.local" / "No, I'll update it manually"

- If `.env.local` does **not** exist but `.env` exists, ask:
  - Question: "A `.env` file already exists and may contain secrets unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing .env" / "No, I'll update it manually"

- If neither exists, ask:
  - Question: "This setup will create a `.env` file containing Auth0 credentials (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_SECRET) and a placeholder for AUTH0_CLIENT_SECRET. Do you want to proceed?"
  - Options: "Yes, create .env" / "No, I'll configure it manually"

**Do not proceed with writing to any env file unless the user selects the confirmation option.**

### Step 2: Run automated setup (only after confirmation)

```bash
#!/bin/bash

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  [[ "$OSTYPE" == "darwin"* ]] && brew install auth0/auth0-cli/auth0 || \
  curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
fi

# Login
auth0 login 2>/dev/null || auth0 login

# Create/select app
auth0 apps list
read -p "Enter app ID (or Enter to create): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create --name "${PWD##*/}-flask" --type regular \
    --callbacks "http://localhost:5000/callback" \
    --logout-urls "http://localhost:5000" \
    --metadata "created_by=agent_skills" \
    --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
fi

# Get credentials
DOMAIN=$(auth0 apps show "$APP_ID" --json | grep -o '"domain":"[^"]*' | cut -d'"' -f4)
CLIENT_ID=$(auth0 apps show "$APP_ID" --json | grep -o '"client_id":"[^"]*' | cut -d'"' -f4)
SECRET=$(openssl rand -hex 64)

# Determine target env file
if [ -f .env.local ]; then
  TARGET_FILE=".env.local"
elif [ -f .env ]; then
  TARGET_FILE=".env"
else
  TARGET_FILE=".env"
fi

# Append Auth0 credentials
cat >> "$TARGET_FILE" << ENVEOF
AUTH0_DOMAIN=$DOMAIN
AUTH0_CLIENT_ID=$CLIENT_ID
AUTH0_CLIENT_SECRET='YOUR_CLIENT_SECRET'
AUTH0_SECRET=$SECRET
AUTH0_REDIRECT_URI=http://localhost:5000/callback
ENVEOF

echo "Auth0 credentials written to $TARGET_FILE"
```

After the script runs, remind the user to:
1. Open the env file that was written and replace `YOUR_CLIENT_SECRET` with the actual client secret from Auth0.
2. Ensure the env file is listed in `.gitignore` to avoid accidentally committing secrets.

---

## Manual Setup

### Install Packages

```bash
pip install auth0-server-python "flask[async]" python-dotenv
```

**Critical:** You must install `flask[async]` (not just `flask`). The `[async]` extra installs `asgiref` which is required for Flask 2.0+ to support `async def` route handlers.

### Create .env

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_SECRET=<openssl-rand-hex-64>
AUTH0_REDIRECT_URI=http://localhost:5000/callback
```

Generate secret: `openssl rand -hex 64`

### Get Auth0 Credentials

CLI: `auth0 apps show <app-id> --reveal-secrets`

Dashboard: Create Regular Web Application, copy credentials

### Configure Auth0 Dashboard

In your Auth0 Application settings:
- **Allowed Callback URLs**: `http://localhost:5000/callback`
- **Allowed Logout URLs**: `http://localhost:5000`

---

## Troubleshooting

**"Missing AUTH0_SECRET" error:** Ensure `AUTH0_SECRET` is set and at least 32 characters long. Generate with `openssl rand -hex 64`.

**"Invalid redirect_uri" error:** Add `http://localhost:5000/callback` to Allowed Callback URLs in Auth0 Dashboard.

**Callback URL mismatch:** URL must match exactly between `AUTH0_REDIRECT_URI` in `.env` and the Allowed Callback URLs in Auth0 Dashboard.

**Client secret required:** Flask uses Regular Web Application type — ensure the app was created as `--type regular`, not SPA or Native.

**Async routes not working:** Ensure you installed `flask[async]` (not just `flask`). Without the `[async]` extra, async route handlers silently fail.

---
