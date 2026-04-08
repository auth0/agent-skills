# Auth0 Python Integration - Code Patterns

## Authentication Flow (Flask + Authlib)

Full Flask app setup using Authlib for OAuth2 flow with auth0-python for backend API calls:

```python
import os
from flask import Flask, redirect, session, url_for, render_template
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("AUTH0_SECRET")

oauth = OAuth(app)
auth0 = oauth.register(
    "auth0",
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
    client_kwargs={"scope": "openid profile email"},
    server_metadata_url=f'https://{os.getenv("AUTH0_DOMAIN")}/.well-known/openid-configuration',
)
```

## Login Route

```python
@app.route("/login")
def login():
    return auth0.authorize_redirect(
        redirect_uri=url_for("callback", _external=True)
    )
```

## Callback Route

```python
@app.route("/callback")
def callback():
    token = auth0.authorize_access_token()
    session["user"] = token.get("userinfo")
    session["access_token"] = token.get("access_token")
    return redirect("/")
```

## Logout Route

```python
@app.route("/logout")
def logout():
    session.clear()
    return redirect(
        f'https://{os.getenv("AUTH0_DOMAIN")}/v2/logout?'
        f'returnTo={url_for("home", _external=True)}'
        f'&client_id={os.getenv("AUTH0_CLIENT_ID")}'
    )
```

## Protected Routes

```python
from functools import wraps
from flask import redirect, session, url_for

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

@app.route("/profile")
@login_required
def profile():
    return render_template("profile.html", user=session["user"])
```

## User Claims Access

```python
@app.route("/profile")
@login_required
def profile():
    user = session["user"]
    return {
        "name": user.get("name"),
        "email": user.get("email"),
        "picture": user.get("picture"),
        "sub": user.get("sub"),  # Auth0 user ID
    }
```

## Role-Based Authorization

```python
def requires_role(role):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = session.get("user", {})
            roles = user.get("https://your-namespace/roles", [])
            if role not in roles:
                return {"error": "Insufficient permissions"}, 403
            return f(*args, **kwargs)
        return decorated
    return decorator

@app.route("/admin")
@login_required
@requires_role("admin")
def admin():
    return "Admin panel"
```

**Note:** Roles require Auth0 Action to add to ID token. Create an Auth0 Action with the following code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://your-namespace';
  if (event.authorization) {
    const roles = event.authorization.roles || [];
    api.idToken.setCustomClaim(`${namespace}/roles`, roles);
  }
};
```

## Management API Integration

```python
from auth0.management import ManagementClient

mgmt = ManagementClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
)

# List users
users = mgmt.users.list()

# Get user by ID
user = mgmt.users.get("auth0|123456")

# Update user metadata
mgmt.users.update("auth0|123456", body={"user_metadata": {"preferred_color": "blue"}})

# Assign roles
mgmt.users.roles.add("auth0|123456", body={"roles": ["rol_abc123"]})
```

## Async Support

```python
import asyncio
from auth0.management import AsyncManagementClient

async_mgmt = AsyncManagementClient(
    domain=os.getenv("AUTH0_DOMAIN"),
    client_id=os.getenv("AUTH0_CLIENT_ID"),
    client_secret=os.getenv("AUTH0_CLIENT_SECRET"),
)

async def get_users():
    users = await async_mgmt.users.list()
    return users
```

## Token Verification

```python
from auth0.authentication import TokenVerifier
from auth0.authentication.token_verifier import (
    AsymmetricSignatureVerifier,
)

domain = os.getenv("AUTH0_DOMAIN")
client_id = os.getenv("AUTH0_CLIENT_ID")

sv = AsymmetricSignatureVerifier(f"https://{domain}/.well-known/jwks.json")
tv = TokenVerifier(
    signature_verifier=sv,
    issuer=f"https://{domain}/",
    audience=client_id,
)

decoded = tv.verify(id_token)
```

## Error Handling

```python
from auth0.management.core.api_error import ApiError

try:
    user = mgmt.users.get("auth0|nonexistent")
except ApiError as e:
    print(f"Status: {e.status_code}")
    print(f"Error: {e.body}")
    if e.status_code == 404:
        print("User not found")
    elif e.status_code == 429:
        print("Rate limited - retry after delay")
```

## Django Integration

### Django Settings Configuration

```python
INSTALLED_APPS = [
    # ...
    'django.contrib.auth',
    'social_django',
]

AUTHENTICATION_BACKENDS = [
    'social_core.backends.auth0.Auth0OAuthv2Backend',
    'django.contrib.auth.backends.ModelBackend',
]

SOCIAL_AUTH_AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
SOCIAL_AUTH_AUTH0_KEY = os.getenv("AUTH0_CLIENT_ID")
SOCIAL_AUTH_AUTH0_SECRET = os.getenv("AUTH0_CLIENT_SECRET")

LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/'
```

### Django Views with Social Auth

```python
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from social_django.utils import psa

@login_required
def profile(request):
    return render(request, 'profile.html', {'user': request.user})

def logout_view(request):
    from django.contrib.auth import logout
    logout(request)
    domain = os.getenv("AUTH0_DOMAIN")
    client_id = os.getenv("AUTH0_CLIENT_ID")
    return_to = request.build_absolute_uri('/')
    return redirect(
        f'https://{domain}/v2/logout?'
        f'returnTo={return_to}&client_id={client_id}'
    )
```

### Django Middleware for Auth0

Add to `MIDDLEWARE`:

```python
MIDDLEWARE = [
    # ...
    'social_django.middleware.SocialAuthExceptionMiddleware',
]
```

## Testing Patterns

```python
import pytest
from unittest.mock import patch, MagicMock

def test_login_redirect(client):
    response = client.get("/login")
    assert response.status_code == 302
    assert "auth0.com" in response.location

@patch("app.auth0")
def test_callback(mock_auth0, client):
    mock_auth0.authorize_access_token.return_value = {
        "userinfo": {"name": "Test User", "email": "test@example.com"}
    }
    response = client.get("/callback")
    assert response.status_code == 302

def test_protected_route_redirect(client):
    response = client.get("/profile")
    assert response.status_code == 302
    assert "/login" in response.location

@patch("app.session")
def test_protected_route_authenticated(mock_session, client):
    with client.session_transaction() as sess:
        sess["user"] = {"name": "Test User", "email": "test@example.com"}
    response = client.get("/profile")
    assert response.status_code == 200
```
