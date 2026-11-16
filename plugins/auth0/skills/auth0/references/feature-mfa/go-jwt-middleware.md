# go-jwt-middleware — MFA (API-side scope gate)

**Minimum version:** `github.com/auth0/go-jwt-middleware/v2` v2.2.1.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. This is a **resource-server** SDK: it does not run MFA. The tenant issues the step-up scope (e.g. `transfer:funds`) only after the user completes MFA, and the API's job is to enforce that a caller lacking that scope is rejected with `403 insufficient_scope`. Gating a sensitive route on the step-up scope *is* the enforcement.

Import the **v2** module — `github.com/auth0/go-jwt-middleware/v2` (plus `/v2/jwks` and `/v2/validator`). The bare path ending `go-jwt-middleware"` is the deprecated v1; do not hand-parse tokens with `golang-jwt/jwt` or the abandoned `dgrijalva/jwt-go`.

Model the private claims and a `HasScope` helper on a type implementing `validator.CustomClaims`, then read the SDK-validated claims off the request context — never re-parse the `Authorization` header:

```go
type CustomClaims struct {
	Scope string `json:"scope"`
}

func (c CustomClaims) Validate(ctx context.Context) error { return nil }

func (c CustomClaims) HasScope(expected string) bool {
	for _, s := range strings.Split(c.Scope, " ") {
		if s == expected {
			return true
		}
	}
	return false
}

// requireScope rejects with 403 insufficient_scope unless the validated token
// carries the given scope. Reads *validator.ValidatedClaims off the context
// under jwtmiddleware.ContextKey{} — the SDK-validated claims, not a re-decode.
func requireScope(scope string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value(jwtmiddleware.ContextKey{}).(*validator.ValidatedClaims)
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		custom := claims.CustomClaims.(*CustomClaims)
		if !custom.HasScope(scope) {
			w.WriteHeader(http.StatusForbidden)
			json.NewEncoder(w).Encode(map[string]string{"error": "insufficient_scope"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

Wire the validator with `validator.WithCustomClaims(func() validator.CustomClaims { return &CustomClaims{} })`, then chain `requireScope` inside `middleware.CheckJWT`. To add the step-up gate, require **both** scopes on the transfer route — keep the existing `write:transfers` check and add `transfer:funds` (chain `requireScope` twice, or check both in one guard):

```go
mux.Handle("POST /api/transfers", middleware.CheckJWT(
	requireScope("write:transfers",
		requireScope("transfer:funds", http.HandlerFunc(transferHandler)))))
```

Apply the `transfer:funds` gate **only** to `POST /api/transfers` — leave `GET /api/balance` requiring `read:balance`. Read the issuer domain and audience from the `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` environment variables (write them to `.env`), never hardcoded in source.
