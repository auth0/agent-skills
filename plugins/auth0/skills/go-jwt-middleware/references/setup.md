# Go JWT Middleware Setup Guide

Setup instructions for Go API applications.

---

## Auth0 Configuration

> **Agent instruction:**
>
> **Credential check (always first):**
> If the user's prompt already provides Auth0 credentials (domain and audience), use them directly. Write the `.env` file and proceed to integration. Do NOT call `AskUserQuestion` to re-confirm.
>
> **If credentials are NOT in the prompt:**
>
> Use `AskUserQuestion` to ask the user:
> "How would you like to configure Auth0 for this project?"
> - Option A: "Automatic setup (recommended)" — uses the Auth0 CLI to create the API resource
> - Option B: "Manual setup" — provide Auth0 credentials manually
>
> **If Automatic Setup:**
>
> **Important:** Do NOT run `auth0 login` from the agent — it is interactive and will hang. If the user needs to log in, ask them to run it in their terminal.
>
> 1. **Check Auth0 CLI**: Run `command -v auth0`. If missing, ask user to install (`brew install auth0/auth0-cli/auth0`) or switch to manual setup.
> 2. **Check Auth0 login**: Run `auth0 tenants list --csv --no-input 2>&1`. If it fails or returns empty:
>    - Tell the user: _"Please run `auth0 login` in your terminal and let me know when done."_
>    - Wait for the user to confirm, then re-run the check to verify.
> 3. **Confirm active tenant**: Parse the output to identify the active tenant domain. Tell the user: _"Your active Auth0 tenant is: `<domain>`. Is this the correct tenant?"_
>    - If yes, proceed.
>    - If no, ask the user to run `auth0 tenants use <tenant-domain>` in their terminal, then re-run step 2 to confirm the new active tenant.
> 4. **Create the Auth0 API resource**:
>    ```bash
>    auth0 apis create \
>      --name "My Go API" \
>      --identifier https://my-api.example.com \
>      --metadata "created_by=agent_skills" \
>      --json
>    ```
>    Parse the JSON output to extract the `identifier` (audience) value.
> 5. **Get the tenant domain**: Extract from the active tenant (from step 3).
> 6. **Write `.env` file**:
>    - **Never read the contents of an existing `.env` file** — it may contain sensitive secrets that should not be exposed in the LLM context.
>    - If a `.env` file already exists, ask the user for confirmation using `AskUserQuestion`: _"A `.env` file already exists in this project. Can I add the Auth0 configuration to it?"_
>    - If no `.env` exists, ask: _"This setup will create a `.env` file with your Auth0 credentials. OK to proceed?"_
>    - Write `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` to the file.
> 7. **Add `.env` to `.gitignore`** if not already present.
>
> **If Manual Setup:**
>
> Ask the user for:
> - Auth0 Domain (e.g., `your-tenant.auth0.com`)
> - API Audience (e.g., `https://my-api.example.com`)
>
> Write the `.env` file with provided values.

## Quick Setup (Automated)

Below uses the Auth0 CLI to create an Auth0 API resource and retrieve your credentials.

### Step 1: Install Auth0 CLI and create API resource

```bash
# Install Auth0 CLI (macOS)
brew install auth0/auth0-cli/auth0

# Login
auth0 login --no-input

# Create an Auth0 API resource
auth0 apis create \
  --name "My Go API" \
  --identifier https://my-api.example.com \
  --metadata "created_by=agent_skills" \
  --json
```

Note the `identifier` value - this is your Audience.

### Step 2: Add configuration

Once you have your Domain and Audience, create a `.env` file in your project root:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

Replace `your-tenant.auth0.com` with your Auth0 tenant domain and `https://my-api.example.com` with the identifier you used when creating the API resource.

---

## Manual Setup

### Install Dependencies

```bash
go get github.com/auth0/go-jwt-middleware/v3
go get github.com/joho/godotenv
```

### Create Auth0 API Resource

1. Go to Auth0 Dashboard → Applications → APIs
2. Click **Create API**
3. Set a **Name** and an **Identifier** (e.g., `https://my-api.example.com`)
4. Note the Identifier - this is your `Audience`

### Configure .env

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

**Important:** Domain format is `your-tenant.auth0.com` - do NOT include `https://`.

### Get Auth0 Configuration

- **Domain:** Auth0 Dashboard → Settings → Domain (or `auth0 tenants list`)
- **Audience:** The identifier you set when creating the API resource

---

## Post-Setup Steps

> **Agent instruction:** After setup, verify:
> 1. `.env` file exists with `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`
> 2. `go.mod` includes `github.com/auth0/go-jwt-middleware/v3` and `github.com/joho/godotenv`
> 3. Run `go build ./...` to verify compilation

---

## Secret Management

For Go BACKEND_API projects:
- **Development:** `.env` file loaded via `godotenv.Load()`
- **Production:** Environment variables (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`)
- **No client secret needed** - JWT validation uses JWKS public keys from Auth0's well-known endpoint

Add `.env` to `.gitignore` to prevent committing credentials:

```bash
echo ".env" >> .gitignore
```

---

## Getting a Test Token

### Via Auth0 Dashboard

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Test** tab
4. Click **Copy Token** to get a test access token

### Via Auth0 CLI (Client Credentials)

```bash
# Get access token for testing
auth0 test token \
  --audience https://my-api.example.com
```

### Via curl (Client Credentials Flow)

```bash
curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials"
  }'
```

---

## Verification

```bash
# Start server
go run main.go

# Test public endpoint (should return 200)
curl http://localhost:8080/api/public

# Test protected endpoint without token (should return 401)
curl http://localhost:8080/api/private

# Test protected endpoint with token (should return 200)
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8080/api/private
```

---

## Troubleshooting

**401 Unauthorized - "invalid_token":** Verify that the `AUTH0_AUDIENCE` in .env exactly matches your API Identifier in Auth0 Dashboard.

**401 Unauthorized - "invalid_issuer":** Ensure `AUTH0_DOMAIN` does not include `https://` - use `your-tenant.auth0.com` format only. Also ensure the issuer URL has a trailing slash (`https://domain/`).

**JWKS fetch fails:** Check network connectivity to `https://your-tenant.auth0.com/.well-known/jwks.json`. Verify the domain is correct.

**Token expired:** Test tokens from the Dashboard are short-lived. Request a fresh token.

**panic: nil pointer:** Always check the `err` return value from `jwtmiddleware.New()`, `validator.New()`, and `jwks.NewCachingProvider()`.

---

## Next Steps

- [Integration Guide](integration.md)
- [API Reference](api.md)
- [Main Skill](../SKILL.md)
