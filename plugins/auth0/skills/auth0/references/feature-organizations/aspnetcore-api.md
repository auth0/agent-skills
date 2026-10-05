# aspnetcore-api (Auth0.AspNetCore.Authentication.Api) - Organizations (API side)

**Minimum version:** `Auth0.AspNetCore.Authentication.Api` 1.0.0+ (this reference documents the
current 1.0.1). Organization enforcement here is **framework-level** (ASP.NET Core authorization
policies), not a version-gated SDK feature - any release that ships `AddAuth0ApiAuthentication`
supports it.

Framework-specific surface only. The protocol shape, `org_id`-reading guidance, tenant config, and
common mistakes live in the shared Organizations reference. This SDK **validates** access tokens on
a resource API - it does not perform login, and it exposes **no organization-specific API**
(`Auth0ApiOptions` carries only `Domain` and `Audience`). Organizations here means: enforce the
`org_id` claim on the validated principal with a standard authorization policy.

## Enforce org membership

Keep the SDK's token validation (`AddAuth0ApiAuthentication`) and add an authorization **policy**
that requires the `org_id` claim, then guard the endpoint with it - do not add a bespoke
`AddJwtBearer` pipeline:

```csharp
builder.Services.AddAuth0ApiAuthentication(builder.Configuration.GetSection("Auth0"));

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("BelongsToAcme", policy =>
        policy.RequireClaim("org_id", builder.Configuration["ACME_ORG_ID"]!));
});

// Minimal API:
app.MapGet("/api/org/members", () => Results.Ok(/* ... */))
   .RequireAuthorization("BelongsToAcme");

// Controllers: [Authorize(Policy = "BelongsToAcme")]
```

A token whose `org_id` is missing or does not match yields a `403` (or `401` when unauthenticated)
before the handler runs. For a multi-org API, use `RequireAssertion` against a **set** of served
org IDs rather than a single `RequireClaim` value.

## Reading the organization back

`org_id` is a claim on the validated `ClaimsPrincipal` - read it with the raw claim type (no claim
mapping is configured):

```csharp
app.MapGet("/api/org/profile", (HttpContext ctx) =>
{
    var orgId = ctx.User.FindFirst("org_id")?.Value; // "org_barkbook_acme"
    return Results.Ok(new { org_id = orgId });
}).RequireAuthorization();
```

## Security / correctness

- Keep `Domain`/`Audience` in `appsettings.json` (or configuration/secrets), not hardcoded in `.cs`
  source; source the org id from configuration too.
- Do not hand-decode the token with `JwtSecurityTokenHandler` - the claim is on `ctx.User`.
- Do not swap in the web-app SDK (`AddAuth0WebAppAuthentication`) or a raw `AddAuthentication` +
  `AddJwtBearer` stack - `AddAuth0ApiAuthentication` already wires validation.

The APIs above are the current `Auth0.AspNetCore.Authentication.Api` 1.x surface plus standard
ASP.NET Core authorization - do not decompile the assembly to re-verify them.

> **No org-specific upstream example - by design.** The SDK has no organization feature; org
> enforcement is plain ASP.NET Core authorization on the validated `org_id` claim. `EXAMPLES.md`
> documents the endpoint-protection pattern this policy plugs into:
> https://raw.githubusercontent.com/auth0/aspnetcore-api/master/EXAMPLES.md#12-protecting-minimal-api-endpoints
