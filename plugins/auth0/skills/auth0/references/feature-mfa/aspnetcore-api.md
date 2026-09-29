# ASP.NET Core API (Auth0.AspNetCore.Authentication.Api) — MFA (API-side scope gate)

**Minimum version:** `Auth0.AspNetCore.Authentication.Api` 1.0.1.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. This is a **resource-server** SDK: it does not run MFA. The tenant issues the step-up scope (e.g. `transfer:funds`) only after the user completes MFA, and the API's job is to reject a caller lacking that scope with a `403`. Gating a sensitive endpoint on the step-up scope *is* the enforcement.

Use `Auth0.AspNetCore.Authentication.Api` — the API SDK. Its `using` ends in `.Api`; the web-app SDK `Auth0.AspNetCore.Authentication` (`AddAuth0WebAppAuthentication`) is for MVC/Blazor server apps and is the wrong tool. There is no `Auth0.AspNetCore.Api` package. Do not hand-decode tokens with `System.IdentityModel.Tokens.Jwt` / `JwtSecurityTokenHandler`, and do not split the scope string manually inside the endpoint — enforce through the authorization pipeline.

Register token validation with `AddAuth0ApiAuthentication`, then a scope-based policy backed by `HasScopeRequirement`/`HasScopeHandler` (the quickstart classes, which read the space-delimited `scope` claim):

```csharp
using Auth0.AspNetCore.Authentication.Api;

builder.Services.AddAuth0ApiAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.Audience = builder.Configuration["Auth0:Audience"];
});

var issuer = $"https://{builder.Configuration["Auth0:Domain"]}/";

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("read:balance", policy =>
        policy.Requirements.Add(new HasScopeRequirement("read:balance", issuer)));
    options.AddPolicy("write:transfers", policy =>
        policy.Requirements.Add(new HasScopeRequirement("write:transfers", issuer)));
    // Step-up gate — the scope the tenant issues only after MFA.
    options.AddPolicy("transfer:funds", policy =>
        policy.Requirements.Add(new HasScopeRequirement("transfer:funds", issuer)));
});

builder.Services.AddSingleton<IAuthorizationHandler, HasScopeHandler>();
```

Each `.RequireAuthorization("<policy>")` adds one requirement, and a route with several requires **all** of them — so keep the existing `write:transfers` policy on the transfer route and add the `transfer:funds` gate alongside it:

```csharp
app.MapGet("/api/balance", () => Results.Ok(new { balance = 4200 }))
    .RequireAuthorization("read:balance");

app.MapPost("/api/transfers", () => Results.Created("/api/transfers", new { status = "transferred" }))
    .RequireAuthorization("write:transfers")
    .RequireAuthorization("transfer:funds");
```

Apply the `transfer:funds` gate **only** to `POST /api/transfers` — leave `GET /api/balance` on `read:balance`. Read `Domain` and `Audience` from the `Auth0` section of `appsettings.json`, never hardcoded in source.
