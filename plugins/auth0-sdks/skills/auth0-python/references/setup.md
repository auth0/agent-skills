# Auth0 Python Integration - Setup Guide

## Auth0 Configuration

> **Agent instruction:**
>
> **Credential check (always first):**
> If the user's prompt already contains Auth0 credentials (domain, client ID, client secret), use them directly — write the `.env` file and proceed. Do NOT call `AskUserQuestion` or run the bootstrap script.
>
> **If credentials are NOT in the prompt:**
> Use `AskUserQuestion`:
> "How would you like to configure Auth0 for this project?"
> - Option A: "Automatic setup (recommended)" — runs bootstrap script
> - Option B: "Manual setup" — provide credentials manually
>
> **If Automatic Setup:**
> 1. Pre-flight: Verify Node.js 20+ (`node --version`), Auth0 CLI (`auth0 --version`), active tenant (`auth0 tenants list --csv --no-input`)
> 2. Run: `cd scripts && npm install && node bootstrap.mjs <project-path>`
> 3. Script handles: project validation, app creation, database connection, .env writing, summary
>
> **If Manual Setup:**
> Ask for: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
> Generate AUTH0_SECRET: `openssl rand -hex 32`
> Write .env file

## Post-Setup Steps

- Verify .env file exists and has all required variables
- Ensure python-dotenv is installed and load_dotenv() is called
- Verify callback URL matches Auth0 Dashboard settings
- Add .env to .gitignore

## SDK Installation

### Using pip

```bash
pip install auth0-python authlib flask python-dotenv requests
```

### Using requirements.txt

Create a `requirements.txt` file:

**Flask:**
```txt
auth0-python>=5.2.0
authlib>=1.3.0
flask>=2.0.0
python-dotenv>=1.0.0
requests>=2.31.0
```

**Django:**
```txt
auth0-python>=5.2.0
django>=4.0.0
social-auth-app-django>=5.4.0
python-dotenv>=1.0.0
requests>=2.31.0
```

Then install:

```bash
pip install -r requirements.txt
```

## Secret Management

- **Development**: .env file (never committed)
- **Production**: environment variables (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET)
- Add `.env` to `.gitignore`
- Generate session secret: `openssl rand -hex 32`
- Never hardcode secrets in Python files

## Verification

1. **Verify .env loaded:**
   ```bash
   python -c "from dotenv import load_dotenv; load_dotenv(); import os; print(os.getenv('AUTH0_DOMAIN'))"
   ```

2. **Run Flask application:**
   ```bash
   flask run
   ```
   or
   ```bash
   python app.py
   ```

3. **Test the authentication flow:**
   - Visit http://localhost:5000 → should see home page
   - Click login → should redirect to Auth0
   - After login → should redirect to callback → then home with user info

## Auth0 Dashboard Configuration

Configure these settings in the Auth0 Dashboard under your application:

| Setting | Value |
|---------|-------|
| **Application Type** | Regular Web Application |
| **Allowed Callback URLs** | `http://localhost:5000/callback` |
| **Allowed Logout URLs** | `http://localhost:5000` |
| **Allowed Web Origins** | `http://localhost:5000` |

## .env File Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AUTH0_DOMAIN` | Yes | Auth0 tenant domain (hostname only) | `your-tenant.auth0.com` |
| `AUTH0_CLIENT_ID` | Yes | Application Client ID from Auth0 Dashboard | `abc123def456...` |
| `AUTH0_CLIENT_SECRET` | Yes | Application Client Secret (store securely) | `secret_xyz...` |
| `AUTH0_SECRET` | Yes | Flask session encryption secret | Generate: `openssl rand -hex 32` |
| `AUTH0_CALLBACK_URL` | No | Override default callback URL | `http://localhost:5000/callback` |

## Requirements

- Python >= 3.9
- pip package manager
- Auth0 account and application configured
- Callback URL configured: http://localhost:5000/callback
