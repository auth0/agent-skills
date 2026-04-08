---
name: auth0-python
description: Use when adding Auth0 authentication to Python Flask or Django web applications - integrates auth0-python SDK for server-side authentication, user management, and Management API access
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
---

# Auth0 Python SDK Integration

The auth0-python SDK (v5.x) provides server-side authentication and Management API access for Flask and Django web applications. This skill covers OAuth 2.0 login flows, protected routes, user management, and secure token handling with automatic credential management.

## Agent Instruction: Version Detection

Fetch the latest auth0-python version:
```bash
gh api repos/auth0/auth0-python/releases/latest --jq '.tag_name'
```

Use this to validate the current version and recommend updates if the project is using an outdated version.

## Prerequisites

- **Python >= 3.9** (auth0-python v5 requires Python 3.9+)
- **pip** package manager
- **Flask 2.0+** or **Django 4.0+** for web framework
- **Node.js 20+** (optional, for Auth0 CLI bootstrap if using auth0-python bootstrap tools)
- Active **Auth0 tenant** with a Regular Web Application configured
- Local environment with **http://localhost:5000** accessible during development

## When NOT to Use

| Scenario | Use This Instead | Reason |
|----------|------------------|--------|
| Building a Single Page Application (React, Vue, Angular) | auth0-spa-js | Client-side SDKs handle browser-based auth differently |
| Building a native mobile app (iOS) | auth0-swift | Mobile platforms have platform-specific requirements |
| Building a native mobile app (Android) | auth0-android | Android requires Android-specific libraries |
| Building a backend-only API (no web UI) | auth0-python with GetToken (Client Credentials) | Use Client Credentials flow instead of OAuth authorization code flow |
| Only calling Management API from backend | auth0-python with ManagementClient | Same SDK, different initialization pattern |

## Quick Start Workflow

### Step 1: Install auth0-python

```bash
pip install auth0-python flask python-dotenv authlib requests
```

- **auth0-python**: Core SDK for authentication and Management API
- **flask**: Web framework
- **python-dotenv**: Load environment variables from .env
- **authlib**: Handle OAuth 2.0 authorization code flow
- **requests**: HTTP client (dependency of auth0-python)

**Agent Instruction**: Verify installation with `pip show auth0-python` and check version against latest release.

### Step 2: Configure Auth0 Application

Create a `.env` file in your project root:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id_here
AUTH0_CLIENT_SECRET=your_client_secret_here
AUTH0_SECRET=your_session_secret_here
AUTH0_CALLBACK_URL=http://localhost:5000/callback
```

**Important**: 
- DOMAIN: hostname only (no https://)
- SECRET: generate with `openssl rand -hex 32`
- Never commit .env to git

**Agent Instruction**: 
- If credentials are provided in the prompt, use them directly in the .env file
- If credentials are not provided, offer either:
  1. Manual setup (user provides values from Auth0 dashboard)
  2. Automatic setup via bootstrap script: `cd scripts && npm install && node bootstrap.mjs <project-path>` (requires Node.js 20+ and Auth0 CLI)

### Step 3: Set Up Authentication Routes

Create a Flask app with Authlib integration for OAuth 2.0:

```python
from flask import Flask, redirect, session, url_for
from authlib.integrations.flask_client import OAuth
from dotenv import load_dotenv
import os

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

### Step 4: Add Login, Callback, and Logout Routes

```python
@app.route("/login")
def login():
    return auth0.authorize_redirect(
        redirect_uri=url_for("callback", _external=True)
    )

@app.route("/callback")
def callback():
    token = auth0.authorize_access_token()
    session["user"] = token.get("userinfo")
    return redirect("/")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(
        f'https://{os.getenv("AUTH0_DOMAIN")}/v2/logout?'
        f'returnTo={url_for("home", _external=True)}&'
        f'client_id={os.getenv("AUTH0_CLIENT_ID")}'
    )

@app.route("/")
def home():
    user = session.get("user")
    if user:
        return f"Hello {user.get('name', 'User')}! <a href='/logout'>Logout</a>"
    return f"<a href='/login'>Login</a>"
```

### Step 5: Protect Routes

Create a decorator to require login:

```python
from functools import wraps

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

@app.route("/profile")
@login_required
def profile():
    user = session.get("user")
    return f"Profile: {user}"
```

### Step 6: Verify the Integration

1. Run the Flask development server:
   ```bash
   FLASK_APP=app.py flask run
   ```

2. Visit http://localhost:5000 in your browser

3. Click "Login" and verify redirect to Auth0 login page

4. Enter credentials and verify callback to http://localhost:5000/callback

5. Verify user session data displays on home page

6. Click "Logout" and verify session is cleared

**Agent Instruction**: Provide a test script that validates all steps and reports any configuration issues.

## Detailed Documentation

For comprehensive setup and advanced topics, see:

- **Setup Guide**: [references/setup.md](references/setup.md) - Environment configuration, application creation, credentials
- **Integration Patterns**: [references/integration.md](references/integration.md) - Flask vs Django, route protection, session management
- **API Reference**: [references/api.md](references/api.md) - Complete API documentation, code examples, troubleshooting

## Common Mistakes

| Mistake | Correct Approach |
|---------|-----------------|
| App type set to "Single Page Application" | Must be "Regular Web Application" in Auth0 dashboard |
| Missing python-dotenv installation | Install with `pip install python-dotenv` and call `load_dotenv()` before accessing env vars |
| Domain includes https:// prefix | Use hostname only: `your-tenant.auth0.com` (not `https://your-tenant.auth0.com`) |
| Client secret stored in code or committed to git | Use .env file, add .env to .gitignore, never commit secrets |
| Callback URL not registered in Auth0 dashboard | Register exact URL: `http://localhost:5000/callback` in Application Settings > Allowed Callback URLs |
| Using v4 import paths (e.g., `from auth0.management import Auth0`) | v5 uses `from auth0.management import ManagementClient` - auth0-python is Fern-generated in v5 |
| Missing or weak session secret | Generate with `openssl rand -hex 32` (32 bytes minimum for security) |
| Not handling token expiry in Management API calls | ManagementClient v5 auto-refreshes tokens - no manual refresh needed |

## Related Skills

- **auth0-quickstart**: Official Auth0 quickstart guides for multiple frameworks
- **auth0-spa-js**: For Single Page Applications (React, Vue, Angular)
- **auth0-android**: For native Android applications
- **auth0-swift**: For native iOS applications

## Quick Reference

| API | Import | Usage |
|-----|--------|-------|
| **GetToken** | `from auth0.authentication import GetToken` | `token_client = GetToken(domain, client_id, client_secret)` for client credentials flow |
| **ManagementClient** | `from auth0.management import ManagementClient` | `client = ManagementClient(domain, client_id, client_secret)` for user management and API access |
| **TokenVerifier** | `from auth0.authentication import TokenVerifier` | `verifier = TokenVerifier(domain, client_id)` for validating ID tokens server-side |
| **ApiError** | `from auth0.management.core.api_error import ApiError` | Catch in try/except blocks; has `.status_code` and `.body` attributes |

## References

- **GitHub Repository**: https://github.com/auth0/auth0-python
- **PyPI Package**: https://pypi.org/project/auth0-python/
- **Auth0 Python Documentation**: https://auth0.com/docs/quickstart/backend/python
- **Auth0 Python SDK Changelog**: https://github.com/auth0/auth0-python/releases
