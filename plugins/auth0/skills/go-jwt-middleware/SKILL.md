---
name: go-jwt-middleware
description: Use when securing Go HTTP API endpoints with JWT Bearer token validation, scope/permission checks, or stateless auth. Integrates github.com/auth0/go-jwt-middleware/v3 for REST APIs receiving access tokens from frontends or mobile apps. Also handles DPoP proof-of-possession token binding. Triggers on jwtmiddleware, go-jwt-middleware, Go API auth, JWT validation, CheckJWT.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
---

# Go JWT Middleware Integration

Protect Go HTTP API endpoints with JWT access token validation using github.com/auth0/go-jwt-middleware/v3.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/go-jwt-middleware/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below.

---

## Prerequisites

- Go 1.21 or higher
- Auth0 API configured (not Application - must be API resource)
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Go server-rendered web applications** - Use `go-auth0` for session-based web apps
- **Single Page Applications** - Use `auth0-react`, `auth0-vue`, or `auth0-angular` for client-side auth
- **Mobile applications** - Use `auth0-swift`, `auth0-android`, or `auth0-react-native`
- **Non-Go backends** - Use `auth0-aspnetcore-api` for .NET, `express-jwt` for Node.js

---

## Quick Start Workflow

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

**If the user chose Automated**, follow the [Setup Guide](references/setup.md) for complete Auth0 CLI instructions. The automated path writes `.env` for you — skip Step 3 below and proceed directly to Step 4.

**If the user chose Manual**, follow the [Setup Guide](references/setup.md) (Manual Setup section) for full instructions. Then continue with Step 3 below.

Quick reference for manual API creation:

```bash
# Using Auth0 CLI
auth0 apis create \
  --name "My Go API" \
  --identifier https://my-api.example.com \
  --metadata "created_by=agent_skills"
```

Or create manually in Auth0 Dashboard → Applications → APIs

### 3. Configure .env

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

**Important:** Domain must NOT include `https://`. The middleware constructs the issuer URL automatically.

### 4. Configure main.go

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

Test public endpoint:

```bash
curl http://localhost:8080/api/public
```

Test protected endpoint (requires access token):

```bash
curl http://localhost:8080/api/private \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Get a test token via Client Credentials flow or Auth0 Dashboard → APIs → Test tab.

---

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

---

## Scope-Based Authorization

See [Integration Guide](references/integration.md) for defining and enforcing scope and permission policies.

---

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

See [Integration Guide](references/integration.md) for detailed CORS patterns.

---

## DPoP Support

Built-in proof-of-possession token binding per RFC 9449. See [Integration Guide](references/integration.md) for configuration.

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-mfa` - Add Multi-Factor Authentication

---

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
- Protect routes → `middleware.CheckJWT(handler)` (see Step 5)
- Permission enforcement → [Integration Guide](references/integration.md)
- DPoP token binding → [Integration Guide](references/integration.md)
- Framework adapters (Gin, Echo) → [Integration Guide](references/integration.md)
- Advanced JWT config → [API Reference](references/api.md)

---

## Detailed Documentation

- **[Setup Guide](references/setup.md)** - Auth0 CLI setup, environment configuration
- **[Integration Guide](references/integration.md)** - Scope policies, DPoP, framework adapters, error handling
- **[API Reference](references/api.md)** - Complete configuration options and validator/middleware reference

---

## References

- [Auth0 Go API Quickstart](https://auth0.com/docs/quickstart/backend/golang/interactive)
- [SDK GitHub Repository](https://github.com/auth0/go-jwt-middleware)
- [Go Package Documentation](https://pkg.go.dev/github.com/auth0/go-jwt-middleware/v3)
- [Access Tokens Guide](https://auth0.com/docs/secure/tokens/access-tokens)
- [Migration Guide (v2 to v3)](https://github.com/auth0/go-jwt-middleware/blob/master/MIGRATION_GUIDE.md)
