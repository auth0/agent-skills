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
> 4. **Create the Auth0 API resource**: Use `AskUserQuestion` to ask:
>    _"What scopes (permissions) does your API need? For example: `read:messages`, `write:messages`, `read:users`. If you're not sure yet, I can start with `read:messages` and you can add more later."_
>    Use the scopes the user provides (or default to `read:messages` if they say they're unsure) when creating the API:
>    ```bash
>    auth0 apis create \
>      --name "My Go API" \
>      --identifier https://my-api.example.com \
>      --scopes "<COMMA_SEPARATED_SCOPES>" \
>      --no-input --json
>    ```
>    Parse the JSON output to extract the `identifier` (audience) value.
> 5. **Authorize an application for token generation**: Use `AskUserQuestion` to ask:
>    _"Would you like me to create a new Machine-to-Machine application to test your API, or do you have an existing application you'd like to authorize?"_
>    - **Option A: "Create a new M2M app"** — Create a new M2M application and authorize it against the API:
>      ```bash
>      auth0 apps create \
>        --name "My Go API (Test App)" \
>        --type m2m \
>        --no-input --json
>      ```
>      Parse the JSON output to extract the `client_id`. **Do NOT use `--reveal-secrets`** — the agent must never handle client secrets. Tell the user: _"Your M2M app has been created. To get the client secret, run `auth0 apps show <CLIENT_ID> --reveal-secrets` in your terminal."_
>      Then create a client grant to authorize the app for the API (use the scopes from step 4):
>      ```bash
>      auth0 api post "client-grants" --data '{
>        "client_id": "<CLIENT_ID>",
>        "audience": "https://my-api.example.com",
>        "scope": ["read:messages", "write:messages"]
>      }'
>      ```
>    - **Option B: "Use an existing application"** — Ask the user for the `client_id` of their existing application. Then create a client grant to authorize it for this API (use the scopes from step 4):
>      ```bash
>      auth0 api post "client-grants" --data '{
>        "client_id": "<CLIENT_ID>",
>        "audience": "https://my-api.example.com",
>        "scope": ["read:messages", "write:messages"]
>      }'
>      ```
>      Without this step, the application cannot request tokens for this audience.
> 6. **Get the tenant domain**: Extract from the active tenant (from step 3).
> 7. **Write `.env` file**:
>    - **Never read the contents of an existing `.env` file** — it may contain sensitive secrets that should not be exposed in the LLM context.
>    - If a `.env` file already exists, ask the user for confirmation using `AskUserQuestion`: _"A `.env` file already exists in this project. Can I add the Auth0 configuration to it?"_
>    - If no `.env` exists, ask: _"This setup will create a `.env` file with your Auth0 credentials. OK to proceed?"_
>    - Write `AUTH0_DOMAIN` and `AUTH0_AUDIENCE` to the file.
> 8. **Add `.env` to `.gitignore`** if not already present.
> 9. **Provide test token command**: Tell the user to run this command themselves in their terminal to get a test token:
>    ```bash
>    auth0 test token <CLIENT_ID> \
>      --audience <API_IDENTIFIER> \
>      --scopes "<COMMA_SEPARATED_SCOPES>"
>    ```
>    Replace `<CLIENT_ID>` with the M2M app's client ID from step 5, `<API_IDENTIFIER>` with the audience, and scopes with those from step 4. For M2M apps this uses the client credentials grant automatically.
>    **Important:** Do NOT run this command from the agent — it is interactive and outputs sensitive credentials. Ask the user to run it in their terminal.
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

# Login (opens browser for authentication)
auth0 login

# Create an Auth0 API resource
auth0 apis create \
  --name "My Go API" \
  --identifier https://my-api.example.com \
  --json
```

Note the `identifier` value - this is your Audience.

### Step 1b: Create or authorize an application for token generation

To test your API, you need an application authorized to request tokens for this API:

```bash
# Create a Machine-to-Machine application
auth0 apps create \
  --name "My Go API (Test App)" \
  --type m2m \
  --reveal-secrets --json
```

Note the `client_id` and `client_secret`. Then authorize it for your API by creating a client grant:

```bash
auth0 api post "client-grants" --data '{
  "client_id": "YOUR_M2M_CLIENT_ID",
  "audience": "https://my-api.example.com",
  "scope": ["read:messages"]
}'
```

If you already have an application you'd like to use, run the same `auth0 api post "client-grants"` command with your existing app's `client_id` to authorize it for this API.

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

To test your protected API, you need an access token issued for your API's audience. You can use an existing authorized application or create a new Machine-to-Machine (M2M) app.

### Create an M2M Application (if you don't have one)

```bash
# Create a new M2M application
auth0 apps create \
  --name "My Go API (Test App)" \
  --type m2m \
  --reveal-secrets --json
```

Note the `client_id` and `client_secret` from the output. Then authorize the app for your API:

```bash
auth0 api post "client-grants" --data '{
  "client_id": "YOUR_M2M_CLIENT_ID",
  "audience": "https://my-api.example.com",
  "scope": ["read:messages"]
}'
```

### Via Auth0 CLI

```bash
auth0 test token <M2M_CLIENT_ID> \
  --audience https://my-api.example.com \
  --scopes "read:messages"
```

For M2M apps, this uses the client credentials grant automatically and returns the access token.

### Via curl (Client Credentials Flow)

```bash
curl -s -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials"
  }'
```

The response JSON contains an `access_token` field — use it in the `Authorization: Bearer <token>` header.

### Via Auth0 Dashboard

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Test** tab
4. Click **Copy Token** to get a test access token

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
