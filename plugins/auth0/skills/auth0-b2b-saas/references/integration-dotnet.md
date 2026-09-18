# Integration & Enforcement — .NET (ASP.NET Core)

How to wire org-aware login and enforce tenant isolation from the token in ASP.NET Core apps. Full
SDK setup lives in `auth0-aspnetcore-api`; this file covers only the B2B additions: passing
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

ASP.NET Core MVC/Razor apps that handle the login redirect forward `organization` and `invitation`
to `/authorize`:

```csharp
[HttpGet("login")]
public IActionResult Login([FromQuery] string? organization, [FromQuery] string? invitation)
{
    var properties = new AuthenticationProperties
    {
        RedirectUri = Url.Action("Callback")
    };

    if (!string.IsNullOrEmpty(organization))
        properties.Items["organization"] = organization;
    if (!string.IsNullOrEmpty(invitation))
        properties.Items["invitation"] = invitation;

    return Challenge(properties, "Auth0");
}
```

---

## Enforcement: `org_id`-scoped middleware

### Service registration

```csharp
builder.Services.AddAuth0ApiAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.JwtBearerOptions = new JwtBearerOptions
    {
        Audience = builder.Configuration["Auth0:Audience"]
    };
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireOrg", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.FindFirst("org_id")?.Value is { Length: > 0 }));

    options.AddPolicy("OrgAdmin", policy =>
        policy.RequireAssertion(ctx =>
        {
            var orgId = ctx.User.FindFirst("org_id")?.Value;
            var roles = ctx.User.FindFirst("https://your-app.com/roles")?.Value?
                .Split(',', StringSplitOptions.RemoveEmptyEntries) ?? [];
            return orgId is { Length: > 0 } && roles.Contains("org-admin");
        }));
});
```

### Minimal API: extracting `org_id` and scoping data

```csharp
const string NS = "https://your-app.com";

app.MapGet("/api/members", async (HttpContext ctx, IMemberRepository db) =>
{
    var orgId = ctx.User.FindFirst("org_id")?.Value;    // the ONLY source of tenant identity
    if (string.IsNullOrEmpty(orgId))
        return Results.Forbid();

    var rawRoles = ctx.User.FindFirst($"{NS}/roles")?.Value ?? "";
    var roles = rawRoles.Split(',', StringSplitOptions.RemoveEmptyEntries);
    if (!roles.Contains("org-admin"))
        return Results.Forbid();

    var members = await db.FindByOrgIdAsync(orgId);      // tenant filter
    return Results.Ok(members);

}).RequireAuthorization("RequireOrg");
```

### Controller API: extracting `org_id` and scoping data

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "RequireOrg")]
public class MembersController : ControllerBase
{
    private const string NS = "https://your-app.com";
    private readonly IMemberRepository _db;

    public MembersController(IMemberRepository db) => _db = db;

    [HttpGet]
    [Authorize(Policy = "OrgAdmin")]
    public async Task<IActionResult> List()
    {
        var orgId = User.FindFirst("org_id")!.Value;     // the ONLY source of tenant identity
        var members = await _db.FindByOrgIdAsync(orgId); // tenant filter
        return Ok(members);
    }
}
```

### Reusable org context via a scoped service

For layered apps, inject a scoped `OrgContext` so the service layer reads org identity without
accepting it as a parameter from controllers — preventing callers from supplying a different org id:

```csharp
public class OrgContext
{
    public string OrgId { get; private set; } = string.Empty;

    public void Initialize(ClaimsPrincipal user)
    {
        OrgId = user.FindFirst("org_id")?.Value
            ?? throw new UnauthorizedAccessException("Org context required");
    }
}

// Register as scoped
builder.Services.AddScoped<OrgContext>();

// Populate in middleware
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var orgCtx = context.RequestServices.GetRequiredService<OrgContext>();
        orgCtx.Initialize(context.User);
    }
    await next();
});

// Use in any service
public class MemberService(OrgContext orgCtx, IMemberRepository db)
{
    public Task<List<Member>> ListAsync() =>
        db.FindByOrgIdAsync(orgCtx.OrgId);   // never accepts orgId as a parameter
}
```

---

## Why `org_id`, not the user's membership list

A user can belong to many orgs. The Management API can list *all* their memberships, but that is
not the active tenant — the active tenant is whichever org they authenticated into, which Auth0
records as `org_id` in the issued token. Authorizing against the membership list instead of the
token's `org_id` re-introduces the cross-tenant access bug this whole setup exists to prevent.
