# go-jwt-middleware — Organizations (API side)

**Minimum version:** `github.com/auth0/go-jwt-middleware/v3` — the `org_id`/`org_name` registered
claims and `WithRegisteredClaimsValidator` are on the v3 line (target v3.0.0+; this reference
documents the current v3.3.0 API).

Framework-specific surface only. The protocol shape, `org_id`-reading guidance, tenant config, and
common mistakes live in the shared Organizations reference. This SDK **validates** bearer tokens on
a resource API — it does not perform login. Organizations here means: enforce the `org_id` claim on
the verified access token to prevent cross-tenant access.

## Enforce org membership

`org_id`/`org_name` are auto-parsed into `RegisteredClaims`, so enforce them with
`WithRegisteredClaimsValidator` when building the validator — never by hand-parsing the token:

```go
jwtValidator, err := validator.New(
    validator.WithKeyFunc(provider.KeyFunc),
    validator.WithAlgorithm(validator.RS256),
    validator.WithIssuer(issuerURL.String()),
    validator.WithAudience(os.Getenv("AUTH0_AUDIENCE")),
    // Reject a token whose org_id is missing or not one this API serves.
    validator.WithRegisteredClaimsValidator(func(claims validator.RegisteredClaims) error {
        if claims.OrgID != os.Getenv("ACME_ORG_ID") {
            return errors.New("token is not for a served organization")
        }
        return nil
    }),
)
```

A returned error makes `CheckJWT` respond `401`, so a missing or mismatched `org_id` is rejected
before the handler runs. For a multi-org API, validate against a **set** of served org IDs, not a
single `!=` check.

## Reading the organization back

Inside a protected handler, read the validated claims with the v3 generic helper — the org id is a
typed field, not a map lookup:

```go
claims, _ := jwtmiddleware.GetClaims[*validator.ValidatedClaims](r.Context())
orgID := claims.RegisteredClaims.OrgID // "org_barkbook_acme"
```

## Security / correctness

- Keep issuer/audience/org id in the environment (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `ACME_ORG_ID`),
  not hardcoded in `.go` source.
- Use `OrgID` (stable identifier) for enforcement, not `OrgName` (display slug).
- Do not parse the JWT by hand with `golang-jwt` — the validator already verified it and parsed the
  registered claims.
- There is no `WithExpectedOrgID` option — enforce with `WithRegisteredClaimsValidator`.

The symbols above are accurate for go-jwt-middleware v3.x — do not read the SDK source to re-verify
them.

> **No org-specific upstream example yet.** The repo's `examples/` show generic `CustomClaims`, not
> organization enforcement. The closest maintained reference is the README's Custom Claims section,
> which documents the claim-validation mechanism and the `RegisteredClaims.OrgID` field:
> https://raw.githubusercontent.com/auth0/go-jwt-middleware/master/README.md#custom-claims
