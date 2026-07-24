# Auth0 Go — reference hub

Protect Go HTTP API endpoints with JWT access token validation using github.com/auth0/go-jwt-middleware/v3.

<!-- Standalone hub: critical rules, version-fetch instruction, prerequisites,
     when-NOT-to-use, and an inline quick start that gets a basic integration
     working without a second read. The dispatch table below routes to the
     leaves for setup variants, deeper patterns, API reference, and migration. -->

## Critical rules

- Access token values must stay out of the agent's view. Capture a token into a shell variable inside a single command chain and use it there; print only its length, and discard the shell variable when the command ends. The token itself remains valid until normal expiry or revocation.
- To obtain a client secret, always have the user run `auth0 apps show <CLIENT_ID> --reveal-secrets` in their own terminal, rather than running `--reveal-secrets` from the agent.
- A Client ID is required to run `auth0 test token`; complete the M2M application setup first to obtain it.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/go-jwt-middleware/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below.

## Prerequisites

- Go 1.21 or higher
- Auth0 API configured (not Application - must be API resource)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Go server-rendered web applications** - Use `go-auth0` for session-based web apps
- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Mobile applications** - Use the Auth0 integration workflow for Swift, Android, or React Native
- **Non-Go backends** - Use the Auth0 integration workflow for ASP.NET Core (.NET), or `express-jwt` for Node.js

## Quick start

### 1. Install SDK

```bash
go get github.com/auth0/go-jwt-middleware/v3
go get github.com/joho/godotenv
```

### 2. Create Auth0 API

You need an **API** (not Application) in Auth0.

> **Agent instruction:** If the user's prompt already provides Auth0 credentials (domain and audience), use them directly — skip the setup choice question below and proceed to Step 3 to write the `.env` file.
>
> **STOP — ask the user before proceeding.**
>
> Ask exactly this question and wait for their answer before doing anything else:
>
> > "How would you like to create the Auth0 API resource?
> > 1. **Automated** — I'll use the Auth0 CLI to create the API resource and write the exact values to your .env file automatically.
> > 2. **Manual** — You create the API yourself in the Auth0 Dashboard (or via `auth0 apis create`) and provide me the Domain and Audience.
> >
> > Which do you prefer? (1 = Automated / 2 = Manual)"
>
> Do NOT proceed to any setup steps until the user has answered. Do NOT default to manual.

**If the user chose Automated**, follow the Auth0 Configuration steps in this group's integration guide (Setup section, "Initial Setup" steps 1–6). The automated path writes `.env` for you — skip Step 3 below and proceed directly to Step 4.

> **Agent instruction (Automated path checkpoints):**
>
> When following the automated path, you MUST complete these checkpoints in order. Do NOT skip any:
>
> 1. **Check Auth0 CLI** — verify `auth0` is installed.
> 2. **Check Auth0 login** — run `auth0 tenants list` to verify authentication.
> 3. **Confirm active tenant** — show the user which tenant is active and ask: _"Your active Auth0 tenant is `<domain>`. Is this the correct tenant?"_ Wait for confirmation. If they say no, ask them to run `auth0 tenants use <tenant>` in their terminal.
> 4. **Ask about API name and identifier** — use `AskUserQuestion`: _"What would you like to name your Auth0 API, and what identifier (audience) should it use? For example: Name: 'My Go API', Identifier: 'https://my-api.example.com'. The identifier is a logical URI that doesn't need to resolve — it just uniquely identifies your API."_ Wait for answer. If the user is unsure, suggest deriving the identifier from the project's module name in go.mod (e.g., `https://<module-name>`).
> 5. **Ask about scopes** — use `AskUserQuestion`: _"What scopes (permissions) does your API need? For example: `read:users`, `write:users`, `read:products`. If you're not sure yet, I can start with common defaults and you can add more later."_ Wait for answer.
> 6. **Check for existing API** — run `auth0 apis list` and check if an API with the intended identifier already exists. If it does, ask the user whether to reuse it or create a new one with a different identifier.
> 7. **Create the API resource** — using the name, identifier, and scopes from steps 4–5.
> 8. **Handle .env** — if a `.env` file already exists, ask before modifying it. Never read existing `.env` contents (may contain secrets). If no `.env` exists, write one with `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`.
> 9. **Add `.env` to `.gitignore`** — if not already present.
> 10. **Proceed to code integration** — skip Step 3 (already done) and go directly to Step 4 to write the middleware code.

**If the user chose Manual**, follow the Manual Setup steps in this group's integration guide (Setup section) for full instructions. Then continue with Step 3 below.

Quick reference for manual API creation:

```bash
# Using Auth0 CLI
auth0 apis create \
  --name "My Go API" \
  --identifier https://my-api.example.com
```

Or create manually in Auth0 Dashboard → Applications → APIs

### 3. Configure .env

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

**Important:** Domain must NOT include `https://`. The middleware constructs the issuer URL automatically.

### 4. Configure main.go

> **Agent instruction (integrating with existing code):**
>
> Before writing code, determine whether you are:
> - **A) Adding auth to an existing project** — the user already has a `main.go` with routes defined. In this case, do NOT replace their file with the template below. Instead:
>   1. Add the necessary imports (`jwtmiddleware`, `jwks`, `validator`, `godotenv`, `net/url`, `os`, `context`, `strings`).
>   2. Add the `CustomClaims` struct and methods.
>   3. Add the middleware setup code (issuer URL, JWKS provider, validator, middleware) near the top of `main()`.
>   4. Ask which endpoints to protect (see below).
>   5. Wrap the specified handlers with `middleware.CheckJWT()`.
>
> - **B) Creating a new project from scratch** — use the full template below as a starting point.
>
> **STOP — ask which endpoints to protect:**
>
> If the user's request does NOT explicitly specify which endpoints to protect, ask:
>
> > "Which endpoints should require authentication? For example:
> > - **All except health/public** — protect everything, leave only specific public routes open
> > - **Specific routes** — tell me which routes need auth
> >
> > Also, do any endpoints need specific scope/permission checks (e.g., `write:users` for POST/DELETE), or is a valid JWT sufficient for all?"
>
> Wait for the answer. If the user says "all" or "everything except health", protect all routes except `/health` (or whatever they specify as public). If they specify scope requirements per endpoint, implement per-route scope checks using `customClaims.HasScope()`.

```go
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v3"
	"github.com/auth0/go-jwt-middleware/v3/jwks"
	"github.com/auth0/go-jwt-middleware/v3/validator"
	"github.com/joho/godotenv"
)

// CustomClaims contains custom data we want from the token.
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

func main() {
	if err := godotenv.Load(); err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	issuerURL, err := url.Parse("https://" + os.Getenv("AUTH0_DOMAIN") + "/")
	if err != nil {
		log.Fatalf("Failed to parse issuer URL: %v", err)
	}

	provider, err := jwks.NewCachingProvider(
		jwks.WithIssuerURL(issuerURL),
	)
	if err != nil {
		log.Fatalf("Failed to set up JWKS provider: %v", err)
	}

	jwtValidator, err := validator.New(
		validator.WithKeyFunc(provider.KeyFunc),
		validator.WithAlgorithm(validator.RS256),
		validator.WithIssuer(issuerURL.String()),
		validator.WithAudience(os.Getenv("AUTH0_AUDIENCE")),
		validator.WithCustomClaims(func() validator.CustomClaims {
			return &CustomClaims{}
		}),
	)
	if err != nil {
		log.Fatalf("Failed to set up JWT validator: %v", err)
	}

	middleware, err := jwtmiddleware.New(
		jwtmiddleware.WithValidator(jwtValidator),
	)
	if err != nil {
		log.Fatalf("Failed to set up JWT middleware: %v", err)
	}

	mux := http.NewServeMux()

	// Public endpoint - no authentication
	mux.HandleFunc("/api/public", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"message": "Hello from a public endpoint!"})
	})

	// Protected endpoint - requires valid JWT
	mux.Handle("/api/private", middleware.CheckJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
		if err != nil {
			http.Error(w, `{"message":"Failed to get token claims."}`, http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Hello from a private endpoint!",
			"userId":  claims.RegisteredClaims.Subject,
		})
	})))

	// Protected + scoped endpoint - requires JWT with specific scope
	mux.Handle("/api/private-scoped", middleware.CheckJWT(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
		if err != nil {
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
	})))

	log.Println("Server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
```

### 5. Protect Endpoints

Use `middleware.CheckJWT()` to wrap handlers that require authentication:

```go
// Public endpoint - no authentication
mux.HandleFunc("/api/public", publicHandler)

// Protected endpoint - requires valid JWT
mux.Handle("/api/private", middleware.CheckJWT(http.HandlerFunc(privateHandler)))

// Protected + scoped - requires JWT with specific permission
mux.Handle("/api/private-scoped", middleware.CheckJWT(http.HandlerFunc(privateScopedHandler)))
```

### 6. Test API

> **Agent instruction:** After writing the code, verify the build compiles:
> ```bash
> go build ./...
> ```
> If compilation fails, diagnose the error and fix it. Repeat up to 5-6 times.
>
> **Failcheck:** If the build still fails after 5-6 fix attempts, stop and ask the user using `AskUserQuestion`:
> _"The build is still failing after several fix attempts. How would you like to proceed?"_
> - **Let me continue fixing iteratively**
> - **Fix it manually** — I'll show the remaining errors
> - **Skip build verification** — proceed without a successful build
>
> Repeat this check after every 5-6 iterations if errors persist.

> **Agent instruction: STOP — ask after build succeeds.**
>
> Once the build compiles successfully, ask the user:
>
> > "Your API is set up and compiles successfully. Would you like me to help you set up testing?
> > 1. **Yes** — I'll help you configure an M2M application to get test tokens.
> > 2. **No** — I'm done for now.
> >
> > Which do you prefer?"
>
> Do NOT proceed with testing setup unless the user says yes. If they say no, summarize what was done and stop.

> **Agent instruction (M2M app setup — only if user wants testing):**
>
> If the user chose to set up testing, ask:
>
> > "To test your protected endpoints, you need a Machine-to-Machine (M2M) application authorized to request tokens for this API.
> > 1. **Create new** — I'll create a new M2M application and authorize it for this API.
> > 2. **Use existing** — You already have an M2M application. Provide the Client ID and I'll authorize it for this API.
> >
> > Which do you prefer? (1 = Create new / 2 = Use existing)"
>
> Do NOT proceed until the user answers. Do NOT silently pick an existing application from the tenant.
>
> **If the user chose "Create new":**
> ```bash
> auth0 apps create \
>   --name "<PROJECT_NAME> (Test App)" \
>   --type m2m \
>   --no-input --json
> ```
> Parse the JSON to extract `client_id`. Do NOT use `--reveal-secrets` — instead, if the client secret is needed, have the user run `auth0 apps show <CLIENT_ID> --reveal-secrets` in their own terminal so secrets stay out of the agent context.
> Then create a client grant:
> ```bash
> auth0 api post "client-grants" --data '{
>   "client_id": "<CLIENT_ID>",
>   "audience": "<API_IDENTIFIER>",
>   "scope": ["<SCOPES>"]
> }'
> ```
>
> **If the user chose "Use existing":**
> Ask for the Client ID. Then create a client grant to authorize it for this API:
> ```bash
> auth0 api post "client-grants" --data '{
>   "client_id": "<USER_PROVIDED_CLIENT_ID>",
>   "audience": "<API_IDENTIFIER>",
>   "scope": ["<SCOPES>"]
> }'
> ```
> If the grant already exists (409 conflict), that's fine — the app is already authorized.

> **Agent instruction (token isolation — critical):**
>
> The agent must never directly see or display access token values. Token security rules:
> - Do NOT run `auth0 test token` on its own — it outputs the token to stdout
> - Do NOT run `curl` commands to the `/oauth/token` endpoint on their own
> - Do NOT ask the user to paste their token into the conversation
> - Do NOT echo, print, or log the token value
> - Do NOT store the token in a file
>
> **Secure testing approach (single-command chain):**
>
> If the user explicitly asks to test the protected endpoints, the agent MAY use a single-command chain that captures the token into a shell variable and immediately uses it — the token value is never printed or visible to the agent:
>
> ```bash
> TEST_TOKEN=$(auth0 test token <CLIENT_ID> --audience <AUDIENCE> --scopes <SCOPE1,SCOPE2> 2>/dev/null | grep -o 'ey[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*') && \
> [ -n "$TEST_TOKEN" ] && echo "Token acquired (${#TEST_TOKEN} chars)" && \
> curl -s http://localhost:8080/<ENDPOINT> -H "Authorization: Bearer $TEST_TOKEN"
> ```
>
> **Security guarantees of this approach:**
> - `$(...)` captures stdout — the token is consumed into the variable, not displayed
> - `grep -o` extracts only the JWT pattern (ey...) — no surrounding output leaks
> - `echo "Token acquired (${#TEST_TOKEN} chars)"` confirms success by printing LENGTH only, never the value
> - The shell variable `$TEST_TOKEN` exists only for the duration of that single command chain — it dies immediately after
> - Agent sees only: `"Token acquired (834 chars)"` + the API response body (JSON)
> - No file is written, no env is exported, nothing persists
>
> **Rules for using this pattern:**
> 1. ONLY use when the user explicitly asks to test (e.g., "test it", "run the tests", "verify endpoints work")
> 2. Always chain token acquisition + curl in a SINGLE `&&` command — never separate them into two Bash calls
> 3. To test multiple endpoints, chain multiple curls in the same command:
>    ```bash
>    TEST_TOKEN=$(auth0 test token <CLIENT_ID> --audience <AUDIENCE> --scopes <SCOPE1,SCOPE2> 2>/dev/null | grep -o 'ey[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*') && \
>    [ -n "$TEST_TOKEN" ] && echo "Token acquired (${#TEST_TOKEN} chars)" && \
>    echo "=== GET /users ===" && \
>    curl -s http://localhost:8080/users -H "Authorization: Bearer $TEST_TOKEN" && \
>    echo "" && echo "=== POST /users ===" && \
>    curl -s -X POST http://localhost:8080/users -H "Authorization: Bearer $TEST_TOKEN" -d '{"id":"99","name":"Test","email":"test@example.com"}' && \
>    echo "" && echo "=== GET /products ===" && \
>    curl -s http://localhost:8080/products -H "Authorization: Bearer $TEST_TOKEN"
>    ```
> 4. Do not add `echo $TEST_TOKEN`, `printf $TEST_TOKEN`, or any command that would print the raw token value — keep the value inside the variable only
> 5. If the token acquisition fails (empty variable), the `[ -n "$TEST_TOKEN" ]` check will halt the chain — report to the user that the M2M app may not be authorized
> 6. **Client ID is required** — the `auth0 test token` command requires a Client ID to be passed as the first argument. This must be the `client_id` obtained from the M2M app setup step (create new or use existing). If the M2M step has not been completed yet (no Client ID available), do NOT attempt to run the test token command. Instead, ask the user: _"I need an M2M application Client ID to get a test token. Would you like me to create one or do you have an existing one?"_ — then complete the M2M setup first.
>
> **If the user does NOT ask to test**, just provide the commands for them to run manually:
>
> ```
> auth0 test token <CLIENT_ID> --audience <AUDIENCE> --scopes <SCOPE1,SCOPE2>
> curl http://localhost:8080/<endpoint> -H "Authorization: Bearer <PASTE_TOKEN_HERE>"
> ```

After M2M setup is complete:
1. Start the server with `go run .` in the background
2. Verify public endpoints return 200 and protected endpoints return 401 (no token needed)
3. If the user asked to test: use the secure single-command chain above for authenticated requests
4. If the user did NOT ask to test: provide the manual commands and tell them to run in their terminal

Test public endpoint:

```bash
curl http://localhost:8080/api/public
```

Test protected endpoint without token (should return 401):

```bash
curl http://localhost:8080/api/private
```

Test protected endpoint with token (secure single-command chain):

```bash
TEST_TOKEN=$(auth0 test token <M2M_CLIENT_ID> --audience https://my-api.example.com --scopes <SCOPE1,SCOPE2> 2>/dev/null | grep -o 'ey[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*') && \
[ -n "$TEST_TOKEN" ] && echo "Token acquired (${#TEST_TOKEN} chars)" && \
curl -s http://localhost:8080/api/private -H "Authorization: Bearer $TEST_TOKEN"
```

---

## Choose your task

You arrived here for a specific intent. After reading the shared prerequisites
above, read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-go/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic integration working. For tenant setup, API + M2M provisioning, and advanced framework patterns (permissions, CORS, DPoP, framework adapters, testing): `Read: references/framework-go/integrate.md`
- Full API / configuration lookup, testing checklist, security considerations: `Read: references/framework-go/api-reference.md`
- Any other task (guidance, debugging, scope enforcement): start with `Read: references/framework-go/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
