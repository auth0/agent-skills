# Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **Check if credentials are already provided first.** If the user's prompt already contains `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` (or an API identifier URL), use them directly — write `.env` immediately and skip to "Post-Setup Steps". Do NOT call `AskUserQuestion` to re-confirm provided credentials.
>
> If credentials are NOT in the prompt, offer two options via `AskUserQuestion`:
> "How would you like to configure Auth0 for this project?"
> - **Option A: Automatic setup (recommended)** — uses the bootstrap script
> - **Option B: Manual setup** — provide Auth0 credentials manually
>
> ---
>
> **If Automatic Setup:**
>
> 1. **Pre-flight checks:**
>    - Verify Node.js 20+ is installed: `node --version`
>    - Verify Auth0 CLI is installed: `auth0 --version`
>    - Verify logged in to a tenant: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide user to install/login, or fall back to manual setup
>
> 2. **Run bootstrap script:**
>    ```bash
>    cd auth0-api-python/scripts && npm install && node bootstrap.mjs <project-path>
>    ```
>    The script will:
>    - Validate the Python API project structure (detects `requirements.txt` or `pyproject.toml`)
>    - Discover existing Auth0 APIs on the active tenant
>    - Show a change plan (CREATE/SKIP) and ask for confirmation
>    - Create the Auth0 API resource server with an `https://` identifier URL
>    - Write `.env` with `AUTH0_DOMAIN` + `AUTH0_AUDIENCE`
>    - Print a summary with domain, audience, and remaining manual steps
>
> ---
>
> **If Manual Setup:**
>
> Ask the user for:
> - **Auth0 Domain** (e.g., `your-tenant.us.auth0.com`) — find in Auth0 Dashboard → Settings
> - **API Audience** (e.g., `https://my-python-api`) — the API Identifier URL you created in Auth0 Dashboard → Applications → APIs
>
> Then write `.env`:
> ```ini
> AUTH0_DOMAIN=your-tenant.us.auth0.com
> AUTH0_AUDIENCE=https://my-python-api
> ```
>
> **Note:** For pure JWT validation, no `client_id` or `client_secret` is needed. Only add these if using `get_access_token_for_connection` or `get_token_by_exchange_profile`.

## Creating an Auth0 API (One-time manual step)

If no API exists in Auth0 yet, create one:

1. Go to [Auth0 Dashboard](https://manage.auth0.com/) → Applications → APIs
2. Click **+ Create API**
3. Fill in:
   - **Name:** e.g., `My Python API`
   - **Identifier:** e.g., `https://my-python-api` (this becomes `AUTH0_AUDIENCE`)
   - **Signing Algorithm:** RS256 (default, recommended)
4. Click **Create**
5. (Optional) Enable RBAC: Settings tab → Enable RBAC → Enable "Add Permissions in the Access Token"
6. (Optional) Add permissions: Permissions tab → e.g., `read:data`, `write:data`

Or use the Auth0 CLI directly:
```bash
auth0 apis create --name "My Python API" --identifier "https://my-python-api" --json --no-input
```

> The **Identifier** is permanent and cannot be changed after creation. Choose a URL-format string that represents your API.

## Post-Setup Steps

After the bootstrap script or manual setup completes:

1. **Verify `.env` exists** in the project root with both `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`
2. **Confirm domain format** — should be `your-tenant.us.auth0.com` (no `https://`, no trailing slash)
3. **Confirm audience format** — should match the API Identifier exactly (case-sensitive URL)
4. **Set up CORS** before authentication middleware if clients are browser-based
5. **Test with curl** using the test token from Auth0 Dashboard → APIs → Your API → Test tab

## SDK Installation

```bash
pip install auth0-api-python python-dotenv
```

Or add to `requirements.txt`:
```text
auth0-api-python>=1.0.0b8
python-dotenv
```

For Poetry:
```bash
poetry add auth0-api-python python-dotenv
```

**Python version:** 3.9+ required.

**Framework-specific additional dependencies:**

| Framework | Additional Install |
|-----------|-------------------|
| Flask | `pip install flask>=3.0` |
| FastAPI | `pip install fastapi uvicorn` |
| Django REST | `pip install djangorestframework` |
| Async (general) | No additional needed — SDK is async-first |

## Secret Management

The `auth0-api-python` SDK **does not require a client secret** for JWT validation. The SDK validates tokens using the public JWKS endpoint — no secrets are involved.

**Standard setup (JWT validation only):**

`.env` (development):
```ini
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://my-python-api
```

**Production:**
Inject as environment variables via your deployment platform:
```bash
# Example: set directly in shell / CI
export AUTH0_DOMAIN=your-tenant.us.auth0.com
export AUTH0_AUDIENCE=https://my-python-api
```

**If using management operations** (`get_access_token_for_connection`, `get_token_by_exchange_profile`):

These require `client_id` and `client_secret`. Add to `.env` for development (never commit to source control):
```ini
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://my-python-api
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
```

Add `.env` to `.gitignore`:
```gitignore
.env
*.env
```

In production, use your platform's secrets manager (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Heroku Config Vars, etc.) — never commit secrets to source control.

## Verification

```bash
# 1. Start the app
python app.py  # or: uvicorn app:app --reload (FastAPI)

# 2. Test public endpoint
curl http://localhost:5000/api/public
# Expected: 200 OK

# 3. Test protected endpoint without token (should fail)
curl http://localhost:5000/api/private
# Expected: 401 Unauthorized

# 4. Get test token from Auth0 Dashboard → APIs → Your API → Test tab
# Then test protected endpoint with token
curl -H "Authorization: Bearer <test_token>" http://localhost:5000/api/private
# Expected: 200 OK with {"sub": "..."}

# 5. Test wrong audience (should fail)
# Use a token from a different API or modify audience temporarily
# Expected: 401 Unauthorized
```
