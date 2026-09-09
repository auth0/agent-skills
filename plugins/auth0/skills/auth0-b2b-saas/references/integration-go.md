# Integration & Enforcement — Go

How to wire org-aware login and enforce tenant isolation from the token in Go apps. Full SDK setup
lives in `go-jwt-middleware`; this file covers only the B2B additions: passing
`organization`/`invitation` on login and `org_id`-scoped enforcement.

## The enforcement contract (read this first)

On every protected request the backend MUST:

1. **Validate** the access token (signature, `iss`, `aud`, `exp`) — standard JWT validation.
2. **Read `org_id`** from the validated token. This is the active tenant.
3. **Scope all data access** to that `org_id` (tenant filter on every query).
4. **Check authorization relative to `org_id`** — roles/permissions in the token were issued for
   the org the user logged into; treat them as valid only for that org.

Never read the tenant from the URL, a path segment, a body field, or a client header. Those are
attacker-controlled. The token's `org_id` is the only trustworthy tenant statement.

---

## Login: passing `organization` and `invitation`

Go apps that serve the login redirect forward `organization` and `invitation` to `/authorize`:

```go
func loginHandler(w http.ResponseWriter, r *http.Request) {
    organization := r.URL.Query().Get("organization")
    invitation := r.URL.Query().Get("invitation")

    params := url.Values{
        "client_id":     {os.Getenv("AUTH0_CLIENT_ID")},
        "redirect_uri":  {os.Getenv("AUTH0_CALLBACK_URL")},
        "response_type": {"code"},
        "scope":         {"openid profile email"},
    }
    if organization != "" {
        params.Set("organization", organization)
    }
    if invitation != "" {
        params.Set("invitation", invitation)
    }

    authorizeURL := fmt.Sprintf("https://%s/authorize?%s", os.Getenv("AUTH0_DOMAIN"), params.Encode())
    http.Redirect(w, r, authorizeURL, http.StatusFound)
}
```

---

## Enforcement: `org_id`-scoped middleware

### Custom claims struct

Declare a struct for the B2B-specific claims so the middleware validates and types them:

```go
import (
    jwtmiddleware "github.com/auth0/go-jwt-middleware/v3"
    "github.com/auth0/go-jwt-middleware/v3/jwks"
    "github.com/auth0/go-jwt-middleware/v3/validator"
    "context"
    "net/http"
    "os"
)

const NS = "https://your-app.com"

type B2BClaims struct {
    OrgID       string   `json:"org_id"`
    Permissions []string `json:"permissions"`
    Roles       []string `json:"https://your-app.com/roles"`
}

func (c *B2BClaims) Validate(_ context.Context) error {
    if c.OrgID == "" {
        return fmt.Errorf("org_id claim required")
    }
    return nil
}
```

### Middleware setup

```go
func newJWTMiddleware() (*jwtmiddleware.JWTMiddleware, error) {
    issuerURL, _ := url.Parse("https://" + os.Getenv("AUTH0_DOMAIN") + "/")
    provider, _ := jwks.NewCachingProvider(jwks.WithIssuerURL(issuerURL))

    jwtValidator, _ := validator.New(
        validator.WithKeyFunc(provider.KeyFunc),
        validator.WithAlgorithm(validator.RS256),
        validator.WithIssuer(issuerURL.String()),
        validator.WithAudience(os.Getenv("AUTH0_AUDIENCE")),
        validator.WithCustomClaims(func() validator.CustomClaims {
            return &B2BClaims{}
        }),
    )

    return jwtmiddleware.New(jwtmiddleware.WithValidator(jwtValidator))
}
```

### Handler: extracting `org_id` and scoping data

```go
func listMembersHandler(w http.ResponseWriter, r *http.Request) {
    validatedClaims, _ := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
    b2b := validatedClaims.CustomClaims.(*B2BClaims)

    orgID := b2b.OrgID                              // the ONLY source of tenant identity
    // B2BClaims.Validate() already rejected tokens without org_id

    if !contains(b2b.Roles, "org-admin") {
        http.Error(w, "Forbidden", http.StatusForbidden)
        return
    }

    members, err := db.Members.FindByOrgID(r.Context(), orgID)  // tenant filter
    if err != nil {
        http.Error(w, "Internal Server Error", http.StatusInternalServerError)
        return
    }

    json.NewEncoder(w).Encode(members)
}

// Wire up
mux.Handle("/api/members", jwtMiddleware.CheckJWT(http.HandlerFunc(listMembersHandler)))
```

### Convenience: org context helper

For deep call stacks, propagate `orgID` via context rather than threading it through every
function signature:

```go
type contextKey string

const orgIDKey contextKey = "orgID"

func withOrgID(ctx context.Context, orgID string) context.Context {
    return context.WithValue(ctx, orgIDKey, orgID)
}

func orgIDFromContext(ctx context.Context) (string, bool) {
    v, ok := ctx.Value(orgIDKey).(string)
    return v, ok
}
```

Set it in a thin middleware that runs after JWT validation, then call `orgIDFromContext` in service
functions — service code never accepts org IDs from callers directly.

---

## Why `org_id`, not the user's membership list

A user can belong to many orgs. The Management API can list *all* their memberships, but that is
not the active tenant — the active tenant is whichever org they authenticated into, which Auth0
records as `org_id` in the issued token. Authorizing against the membership list instead of the
token's `org_id` re-introduces the cross-tenant access bug this whole setup exists to prevent.
