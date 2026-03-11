---
name: auth0-aspnet-webapi
description: Use when adding JWT authentication to ASP.NET Core Web APIs (protect endpoints, validate tokens, check scopes) - integrates Auth0.AspNetCore.Authentication.Api SDK for stateless API authentication
---

# Auth0 ASP.NET Core Web API Integration

Add JWT authentication to ASP.NET Core Web APIs using Auth0.AspNetCore.Authentication.Api SDK.

---

## Prerequisites

- .NET 6.0+ SDK installed
- ASP.NET Core Web API knowledge
- Auth0 account and API configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Web applications with sessions** - Use `auth0-aspnet-core` skill for MVC apps
- **Blazor Server** - Use `auth0-blazor-server` skill
- **Single Page Applications** - Use JavaScript SDK client-side

---

## Quick Start Workflow

### 1. Install SDK

```bash
dotnet add package Auth0.AspNetCore.Authentication.Api
```

### 2. Configure Environment

Update `appsettings.json`:

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "Audience": "your-api-identifier"
  }
}
```

### 3. Register Auth0 Services

Update `Program.cs`:

```csharp
using Auth0.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// Add Auth0 JWT validation
builder.Services
    .AddAuthentication()
    .AddJwtBearer(options =>
    {
        options.Authority = $"https://{builder.Configuration["Auth0:Domain"]}";
        options.Audience = builder.Configuration["Auth0:Audience"];
    });

var app = builder.Build();

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
```

### 4. Protect API Endpoints

Add `[Authorize]` to controllers or actions:

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class PrivateController : ControllerBase
{
    [HttpGet]
    [Authorize]
    public IActionResult GetPrivateData()
    {
        return Ok(new
        {
            Message = "This is private data",
            UserId = User.FindFirst("sub")?.Value
        });
    }
}
```

### 5. Check Scopes

Protect endpoints with specific scopes:

```csharp
[HttpGet("admin")]
[Authorize("read:admin")]
public IActionResult GetAdminData()
{
    return Ok("Admin data");
}
```

To enable scope checking, configure authorization policies:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("read:admin", policy =>
        policy.RequireClaim("scope", "read:admin"));
});
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing Audience | API requires audience parameter - set in appsettings.json |
| Wrong Auth0 resource type | Create "API" (not Application) in Auth0 Dashboard |
| Missing [Authorize] attribute | Add to controllers/actions that require authentication |
| Not checking scopes | Add authorization policies for scope-based access control |
| UseAuthentication() in wrong order | Call before UseAuthorization() |

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-aspnet-core` - For web applications with sessions
- `auth0-mfa` - Add Multi-Factor Authentication

---

## Quick Reference

**Core Methods:**
- `AddJwtBearer()` - Configure JWT validation
- `[Authorize]` - Protect endpoints
- `[Authorize("policy")]` - Require specific scope
- `User.FindFirst()` - Access token claims

**Common Use Cases:**
- Protect endpoints → See Step 4 above
- Scope-based authorization → See Step 5 above
- Access token claims → [Integration Guide](references/integration.md#claims)
- CORS configuration → [Integration Guide](references/integration.md#cors)

---

## References

- [Auth0.AspNetCore.Authentication.Api Documentation](https://github.com/auth0/auth0-aspnetcore-authentication)
- [Auth0 ASP.NET Core Web API Quickstart](https://auth0.com/docs/quickstart/backend/aspnet-core-webapi)
- [ASP.NET Core API Security](https://docs.microsoft.com/aspnet/core/security/authorization/)
