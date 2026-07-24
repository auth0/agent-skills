# Go JWT Middleware Integration

Protect Go HTTP API endpoints with JWT access token validation using github.com/auth0/go-jwt-middleware/v3.

> **Prerequisites & setup:** the shared critical rules, version-fetch
> instruction, prerequisites, and when-NOT-to-use notes live in this group's
> hub index (already read on the way here). The quick start lives in this
> group's hub index too — this file holds tenant/API/M2M provisioning setup
> variants (automated vs. manual) and advanced framework patterns
> (permissions, CORS, DPoP, framework adapters, testing) (see the Setup and
> Integration Patterns sections below). The full API/configuration reference
> lives in this group's api-reference leaf.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Created Application instead of API in Auth0 | Must create API resource in Auth0 Dashboard → Applications → APIs |
| Audience doesn't match API Identifier | Must exactly match the API Identifier set in Auth0 Dashboard |
| Domain includes `https://` | Use `your-tenant.auth0.com` format only - the issuer URL is constructed automatically |
| Using v2 positional parameters instead of v3 options | v3 uses `validator.WithKeyFunc()`, `validator.WithAlgorithm()` etc. |
| Missing trailing slash on issuer URL | Issuer must be `https://domain/` with trailing slash |
| Checking `scope` claim instead of `permissions` for RBAC | Use custom claims struct with `Permissions []string` field |
| Missing `godotenv.Load()` call | Add `github.com/joho/godotenv` and call `godotenv.Load()` before reading env vars |
| Using `ContextKey{}` to access claims (v2 pattern) | Use `jwtmiddleware.GetClaims[T]()` type-safe generics instead |

## Scope-Based Authorization

See the Integration Patterns → Permission-Based Authorization section below for defining and enforcing scope and permission policies.

## CORS Configuration

For APIs called from browser-based SPAs, configure CORS before any auth middleware:

```go
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

Apply it as the outermost handler wrapping your mux:

```go
handler := corsMiddleware(mux)
log.Fatal(http.ListenAndServe(":8080", handler))
```

See the Integration Patterns → CORS Configuration section below for detailed CORS patterns.

## DPoP Support

Built-in proof-of-possession token binding per RFC 9449. See the Integration Patterns → DPoP Support section below for configuration.

---

## Setup

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
> ---
> **INITIAL SETUP (steps 1–6) — always run during automated setup:**
>
> 1. **Check Auth0 CLI**: Run `command -v auth0`. If missing, ask user to install (`brew install auth0/auth0-cli/auth0`) or switch to manual setup.
> 2. **Check Auth0 login**: Run `auth0 tenants list --csv --no-input 2>&1`. If it fails or returns empty:
>    - Tell the user: _"Please run `auth0 login` in your terminal and let me know when done."_
>    - Wait for the user to confirm, then re-run the check to verify.
> 3. **Confirm active tenant**: Parse the output to identify the active tenant domain. Tell the user: _"Your active Auth0 tenant is: `<domain>`. Is this the correct tenant?"_
>    - If yes, proceed.
>    - If no, ask the user to run `auth0 tenants use <tenant-domain>` in their terminal, then re-run step 2 to confirm the new active tenant.
> 4. **Create the Auth0 API resource**: Ask for the API name, identifier, and scopes (see this group's quick start Automated path checkpoints 4–5 for exact prompts).
>    **Before creating**, check if an API with the same identifier already exists:
>    ```bash
>    auth0 apis list --json 2>&1 | grep -c "<INTENDED_IDENTIFIER>"
>    ```
>    If it already exists, ask the user: _"An API with identifier `<ID>` already exists. Would you like to reuse it, or should I create a new one with a different identifier?"_
>    If creating new:
>    ```bash
>    auth0 apis create \
>      --name "<API_NAME>" \
>      --identifier <API_IDENTIFIER> \
>      --scopes "<COMMA_SEPARATED_SCOPES>" \
>      --no-input --json
>    ```
>    If creation fails with a conflict/duplicate error, inform the user and ask how to proceed.
>    Parse the JSON output to extract the `identifier` (audience) value.
> 5. **Write `.env` file**:
>    - **Never read the contents of an existing `.env` file** — it may contain sensitive secrets that should not be exposed in the LLM context.
>    - If a `.env` file already exists, ask the user for confirmation using `AskUserQuestion`: _"A `.env` file already exists in this project. Can I add the Auth0 configuration to it?"_
>    - If no `.env` exists, create it with `AUTH0_DOMAIN` (from the active tenant in step 3) and `AUTH0_AUDIENCE` (from step 4).
> 6. **Add `.env` to `.gitignore`** if not already present.
>
> After step 6, proceed to code integration (this group's quick start Step 4).
>
> ---
> **TESTING SETUP (steps 7–8) — only run when user agrees to test (this group's quick start Step 6):**
>
> 7. **M2M application setup**: Use `AskUserQuestion` to ask:
>    _"Would you like me to create a new Machine-to-Machine application to test your API, or do you have an existing application you'd like to authorize?"_
>    - **Option A: "Create a new M2M app"** — Create a new M2M application and authorize it against the API:
>      ```bash
>      auth0 apps create \
>        --name "<PROJECT_NAME> (Test App)" \
>        --type m2m \
>        --no-input --json
>      ```
>      Parse the JSON output to extract the `client_id`. **Do NOT use `--reveal-secrets`** — instead, rather than handling client secrets in agent context, tell the user: _"Your M2M app has been created. To get the client secret, run `auth0 apps show <CLIENT_ID> --reveal-secrets` in your terminal."_
>      Then create a client grant to authorize the app for the API:
>      ```bash
>      auth0 api post "client-grants" --data '{
>        "client_id": "<CLIENT_ID>",
>        "audience": "<API_IDENTIFIER>",
>        "scope": ["<SCOPES>"]
>      }'
>      ```
>    - **Option B: "Use an existing application"** — Ask the user for the `client_id` of their existing application. Then create a client grant to authorize it for this API:
>      ```bash
>      auth0 api post "client-grants" --data '{
>        "client_id": "<CLIENT_ID>",
>        "audience": "<API_IDENTIFIER>",
>        "scope": ["<SCOPES>"]
>      }'
>      ```
>      If the grant already exists (409 conflict), that's fine — the app is already authorized.
>
> 8. **Test endpoints (TOKEN ISOLATION — CRITICAL)**:
>    The agent MUST NEVER directly see or display access token values.
>
>    **If the user explicitly asks to test**, use the secure single-command chain pattern.
>    The token is captured into a shell variable via `$(...)`, never printed, and dies when the command ends:
>    ```bash
>    TEST_TOKEN=$(auth0 test token <CLIENT_ID> --audience <API_IDENTIFIER> --scopes <SCOPE1,SCOPE2> 2>/dev/null | grep -o 'ey[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*') && \
>    [ -n "$TEST_TOKEN" ] && echo "Token acquired (${#TEST_TOKEN} chars)" && \
>    curl -s http://localhost:8080/<ENDPOINT> -H "Authorization: Bearer $TEST_TOKEN"
>    ```
>    Security guarantees:
>    - Token goes into `$TEST_TOKEN` — stdout is consumed, not displayed
>    - Only the token LENGTH is echoed (e.g., "Token acquired (834 chars)")
>    - Shell variable dies at end of command chain — no persistence between calls
>    - Agent sees only: confirmation line + API response JSON
>    - No file written, no env exported
>
>    Rules:
>    - ONLY use when user explicitly asks to test
>    - Always chain token capture + all curls in a SINGLE `&&` command
>    - NEVER echo/print/log the raw token value
>    - NEVER split into multiple Bash calls (variable won't persist)
>    - **Client ID is REQUIRED** — `auth0 test token` needs the M2M app's `client_id` as the first argument. If the M2M setup step (step 7) has not been completed, do NOT attempt to run this. Complete M2M setup first to obtain the Client ID.
>
>    **If the user does NOT ask to test**, provide the manual commands:
>    ```bash
>    auth0 test token <CLIENT_ID> \
>      --audience <API_IDENTIFIER> \
>      --scopes <SCOPE1,SCOPE2>
>    ```
>    Then:
>    ```bash
>    curl -H "Authorization: Bearer <PASTE_TOKEN_HERE>" http://localhost:8080/<ENDPOINT>
>    ```
>
>    The agent MAY always verify unauthenticated behavior:
>    - Public/health endpoints return 200
>    - Protected endpoints return 401 without a token
>
> ---
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
  --no-input --json
```

Note the `client_id` from the JSON output. Then authorize it for your API by creating a client grant:

```bash
auth0 api post "client-grants" --data '{
  "client_id": "YOUR_M2M_CLIENT_ID",
  "audience": "https://my-api.example.com",
  "scope": ["read:messages"]
}'
```

To retrieve the client secret for manual token requests, run in your terminal:
```bash
auth0 apps show YOUR_M2M_CLIENT_ID --reveal-secrets
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
  --no-input --json
```

Note the `client_id` from the output. To get the client secret, run `auth0 apps show <CLIENT_ID> --reveal-secrets` in your terminal. Then authorize the app for your API:

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
  --scopes read:messages,write:messages
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

## Integration Patterns

## Permission-Based Authorization

### Define Custom Claims

```go
type CustomClaims struct {
	Scope       string   `json:"scope"`
	Permissions []string `json:"permissions"`
}

func (c CustomClaims) Validate(ctx context.Context) error {
	return nil
}

func (c CustomClaims) HasScope(expectedScope string) bool {
	for _, scope := range strings.Split(c.Scope, " ") {
		if scope == expectedScope {
			return true
		}
	}
	return false
}

func (c CustomClaims) HasPermission(expectedPermission string) bool {
	for _, p := range c.Permissions {
		if p == expectedPermission {
			return true
		}
	}
	return false
}
```

### Register Custom Claims with Validator

```go
jwtValidator, err := validator.New(
	validator.WithKeyFunc(provider.KeyFunc),
	validator.WithAlgorithm(validator.RS256),
	validator.WithIssuer(issuerURL.String()),
	validator.WithAudience(os.Getenv("AUTH0_AUDIENCE")),
	validator.WithCustomClaims(func() validator.CustomClaims {
		return &CustomClaims{}
	}),
)
```

### Check Permissions in Handlers

```go
func privateScopedHandler(w http.ResponseWriter, r *http.Request) {
	claims, err := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		http.Error(w, `{"message":"Failed to get token claims."}`, http.StatusInternalServerError)
		return
	}

	customClaims := claims.CustomClaims.(*CustomClaims)
	if !customClaims.HasScope("read:messages") {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{"message": "Insufficient scope."})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Hello from a scoped endpoint!"})
}
```

### Define Permissions in Auth0

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Permissions** tab
4. Add permissions matching your scope names (e.g., `read:messages`, `write:messages`)

### Request Tokens with Scopes

Clients must request tokens that include the required scopes:

```bash
curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials",
    "scope": "read:messages write:messages"
  }'
```

---

## CORS Configuration

For APIs called from browser-based SPAs, configure CORS before the JWT middleware. CORS must handle preflight OPTIONS requests before auth:

```go
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
```

Apply CORS before JWT middleware:

```go
mux := http.NewServeMux()
mux.HandleFunc("/api/public", publicHandler)
mux.Handle("/api/private", middleware.CheckJWT(http.HandlerFunc(privateHandler)))

// CORS wraps the entire mux — must be outermost
handler := corsMiddleware(mux)
log.Fatal(http.ListenAndServe(":8080", handler))
```

For production, replace the hardcoded origin with your SPA domain. Use the `rs/cors` package for more advanced CORS configuration:

```bash
go get github.com/rs/cors
```

```go
import "github.com/rs/cors"

c := cors.New(cors.Options{
	AllowedOrigins:   []string{"https://your-spa.example.com"},
	AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE"},
	AllowedHeaders:   []string{"Authorization", "Content-Type"},
	AllowCredentials: true,
})

handler := c.Handler(mux)
```

---

## DPoP Support

DPoP (Demonstrating Proof of Possession, RFC 9449) binds tokens to a specific client key pair, preventing token theft.

### Enable DPoP

```go
middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithDPoPMode(jwtmiddleware.DPoPAllowed),
)
```

### DPoP Required Mode

To reject standard Bearer tokens and accept only DPoP-bound tokens:

```go
middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithDPoPMode(jwtmiddleware.DPoPRequired),
)
```

### DPoP Modes

| Mode | Behavior |
|------|----------|
| `jwtmiddleware.DPoPDisabled` | Standard JWT Bearer only, DPoP disabled |
| `jwtmiddleware.DPoPAllowed` | Accept both DPoP-bound and standard Bearer tokens |
| `jwtmiddleware.DPoPRequired` | Only accept DPoP-bound tokens; reject standard Bearer |

### Trusted Proxy Configuration

For APIs behind a reverse proxy (e.g., nginx, AWS ALB):

```go
middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithDPoPMode(jwtmiddleware.DPoPRequired),
	jwtmiddleware.WithStandardProxy(),
)
```

---

## Accessing Claims

### Type-Safe Claims Retrieval (v3)

```go
claims, err := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
if err != nil {
	http.Error(w, "Failed to get claims", http.StatusInternalServerError)
	return
}

userId := claims.RegisteredClaims.Subject
issuer := claims.RegisteredClaims.Issuer
customClaims := claims.CustomClaims.(*CustomClaims)
```

### Common JWT Claims

| Claim | Go Access Pattern | Description |
|-------|-------------------|-------------|
| `sub` | `claims.RegisteredClaims.Subject` | User ID (subject) |
| `iss` | `claims.RegisteredClaims.Issuer` | Token issuer (your Auth0 tenant URL) |
| `aud` | `claims.RegisteredClaims.Audience` | Audience (your API identifier) |
| `exp` | `claims.RegisteredClaims.Expiry` | Expiration timestamp |
| `iat` | `claims.RegisteredClaims.IssuedAt` | Issued-at timestamp |
| `scope` | `customClaims.Scope` | Space-separated list of granted scopes |
| `permissions` | `customClaims.Permissions` | Permission strings (RBAC) |

Custom claims added via Auth0 Actions use namespaced keys. Add them to your `CustomClaims` struct:

```go
type CustomClaims struct {
	Scope       string   `json:"scope"`
	Permissions []string `json:"permissions"`
	Email       string   `json:"https://example.com/email"`
}
```

---

## Error Handling

### Custom Error Handler

```go
func customErrorHandler(w http.ResponseWriter, r *http.Request, err error) {
	w.Header().Set("Content-Type", "application/json")

	if errors.Is(err, jwtmiddleware.ErrJWTMissing) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "missing_token",
			"message": "Authorization header with Bearer token is required.",
		})
		return
	}

	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]string{
		"error":   "invalid_token",
		"message": "The provided token is invalid.",
	})
}

middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithErrorHandler(customErrorHandler),
)
```

### Standard Error Responses

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid token | Include valid `Authorization: Bearer <token>` header |
| 401 | Expired token | Request a fresh access token |
| 401 | Wrong audience | Token's `aud` claim must match your API Identifier |
| 403 | Insufficient scope | Token must include required scopes/permissions |

---

## Mixed Public and Protected Endpoints

```go
mux := http.NewServeMux()

// Public - no auth needed
mux.HandleFunc("/api/public", publicHandler)

// Protected - requires valid JWT
mux.Handle("/api/private", middleware.CheckJWT(http.HandlerFunc(privateHandler)))

// Protected with scope - requires JWT + specific permission
mux.Handle("/api/private-scoped", middleware.CheckJWT(http.HandlerFunc(privateScopedHandler)))
```

---

## Optional Credentials Mode

Allow endpoints to work for both authenticated and unauthenticated users:

```go
middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithCredentialsOptional(true),
)
```

In your handler, check if claims exist:

```go
func handler(w http.ResponseWriter, r *http.Request) {
	if jwtmiddleware.HasClaims(r.Context()) {
		claims, _ := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
		// Authenticated user
	} else {
		// Anonymous user
	}
}
```

---

## URL Exclusions

Skip JWT validation for specific paths:

```go
middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithExclusionUrls([]string{"/health", "/metrics", "/api/public"}),
)
```

---

## Framework Adapters

### Gin

```go
import "github.com/gin-gonic/gin"

r := gin.Default()

r.GET("/api/public", func(c *gin.Context) {
	c.JSON(200, gin.H{"message": "public"})
})

r.GET("/api/private", gin.WrapH(middleware.CheckJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	claims, _ := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"userId": claims.RegisteredClaims.Subject})
}))))
```

### Echo

```go
import "github.com/labstack/echo/v4"

e := echo.New()

e.GET("/api/public", func(c echo.Context) error {
	return c.JSON(200, map[string]string{"message": "public"})
})

e.GET("/api/private", echo.WrapHandler(middleware.CheckJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	claims, _ := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"userId": claims.RegisteredClaims.Subject})
}))))
```

---

## Structured Logging

```go
import "log/slog"

middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithLogger(slog.Default()),
)
```

---

## Custom Token Extraction

### From Cookie

```go
middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithTokenExtractor(jwtmiddleware.CookieTokenExtractor("jwt")),
)
```

### From Query Parameter

```go
middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithTokenExtractor(jwtmiddleware.ParameterTokenExtractor("token")),
)
```

### Multiple Sources

```go
middleware, err := jwtmiddleware.New(
	jwtmiddleware.WithValidator(jwtValidator),
	jwtmiddleware.WithTokenExtractor(jwtmiddleware.MultiTokenExtractor(
		jwtmiddleware.AuthHeaderTokenExtractor,
		jwtmiddleware.CookieTokenExtractor("jwt"),
	)),
)
```

---

## Testing

### Unit Testing with httptest

```go
func TestPublicEndpoint_Returns200(t *testing.T) {
	mux := setupRouter() // your function that sets up routes
	req := httptest.NewRequest("GET", "/api/public", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestPrivateEndpoint_WithoutToken_Returns401(t *testing.T) {
	mux := setupRouter()
	req := httptest.NewRequest("GET", "/api/private", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}
```

### Testing with a Real Token

```bash
# Get a token via Auth0 CLI (uses client credentials for M2M apps)
TOKEN=$(auth0 test token <M2M_CLIENT_ID> --audience https://my-api.example.com --scopes "read:messages" --json | jq -r '.access_token')

# Test private endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/private
```

## Related Skills

- Auth0 setup → set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Multi-factor authentication → ask for MFA (feature:mfa)

## Quick Reference

**Configuration Options:**
- `validator.WithKeyFunc(provider.KeyFunc)` - JWKS key function for signature verification (required)
- `validator.WithAlgorithm(validator.RS256)` - Expected signing algorithm (required)
- `validator.WithIssuer(url)` - Token issuer URL with trailing slash (required)
- `validator.WithAudience(aud)` - API Identifier from Auth0 API settings (required)
- `validator.WithCustomClaims(fn)` - Factory for custom claims struct
- `validator.WithAllowedClockSkew(d)` - Clock skew tolerance

**Claims Access:**
- `jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())` - Type-safe claims retrieval
- `claims.RegisteredClaims.Subject` - User ID (sub)
- `claims.CustomClaims.(*CustomClaims).Scope` - Space-separated scopes
- `claims.CustomClaims.(*CustomClaims).Permissions` - Permission strings

**Common Use Cases:**
- Protect routes → `middleware.CheckJWT(handler)` (see this group's quick start Protect Endpoints step)
- Permission enforcement → see the Integration Patterns → Permission-Based Authorization section below
- DPoP token binding → see the Integration Patterns → DPoP Support section below
- Framework adapters (Gin, Echo) → see the Integration Patterns → Framework Adapters section below
- Advanced JWT config → see this group's api-reference leaf

## References

- [Auth0 Go API Quickstart](https://auth0.com/docs/quickstart/backend/golang/interactive)
- [SDK GitHub Repository](https://github.com/auth0/go-jwt-middleware)
- [Go Package Documentation](https://pkg.go.dev/github.com/auth0/go-jwt-middleware/v3)
- [Access Tokens Guide](https://auth0.com/docs/secure/tokens/access-tokens)
- [Migration Guide (v2 to v3)](https://github.com/auth0/go-jwt-middleware/blob/master/MIGRATION_GUIDE.md)
