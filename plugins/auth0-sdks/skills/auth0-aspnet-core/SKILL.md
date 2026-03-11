---
name: auth0-aspnet-core
description: Use when adding authentication to ASP.NET Core MVC web applications (login, logout, user sessions, protected routes) - integrates Auth0.AspNetCore.Authentication SDK for server-rendered apps
---

# Auth0 ASP.NET Core MVC Integration

Add authentication to ASP.NET Core MVC web applications using Auth0.AspNetCore.Authentication SDK.

---

## Prerequisites

- .NET 6.0+ SDK installed
- ASP.NET Core MVC knowledge
- Auth0 account and application configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Blazor Server apps** - Use `auth0-blazor-server` skill
- **Web APIs without sessions** - Use `auth0-aspnet-webapi` skill for JWT validation
- **Blazor WebAssembly** - Use client-side authentication approach
- **Single Page Applications** - Use JavaScript SDK instead

---

## Quick Start Workflow

### 1. Install SDK

```bash
dotnet add package Auth0.AspNetCore.Authentication
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see [Setup Guide](references/setup.md) for complete scripts.

**For manual setup:**

Update `appsettings.json`:

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "ClientId": "your-client-id",
    "ClientSecret": "your-client-secret"
  }
}
```

### 3. Register Auth0 Services

Update `Program.cs`:

```csharp
using Auth0.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);

// Add Auth0 authentication
builder.Services
    .AddAuth0WebAppAuthentication(options =>
    {
        options.Domain = builder.Configuration["Auth0:Domain"];
        options.ClientId = builder.Configuration["Auth0:ClientId"];
        options.ClientSecret = builder.Configuration["Auth0:ClientSecret"];
    });

builder.Services.AddControllersWithViews();

var app = builder.Build();

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

// Enable authentication middleware
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
```

### 4. Add Login/Logout Controller

Create `AccountController.cs`:

```csharp
using Auth0.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

public class AccountController : Controller
{
    public async Task Login(string returnUrl = "/")
    {
        var authenticationProperties = new LoginAuthenticationPropertiesBuilder()
            .WithRedirectUri(returnUrl)
            .Build();

        await HttpContext.ChallengeAsync(
            Auth0Constants.AuthenticationScheme,
            authenticationProperties);
    }

    [Authorize]
    public async Task Logout()
    {
        var authenticationProperties = new LogoutAuthenticationPropertiesBuilder()
            .WithRedirectUri(Url.Action("Index", "Home"))
            .Build();

        await HttpContext.SignOutAsync(
            Auth0Constants.AuthenticationScheme,
            authenticationProperties);

        await HttpContext.SignOutAsync(
            CookieAuthenticationDefaults.AuthenticationScheme);
    }

    [Authorize]
    public IActionResult Profile()
    {
        return View(new
        {
            Name = User.Identity.Name,
            EmailAddress = User.Claims.FirstOrDefault(c => c.Type == "email")?.Value,
            ProfileImage = User.Claims.FirstOrDefault(c => c.Type == "picture")?.Value
        });
    }
}
```

### 5. Test Authentication

Run your application:

```bash
dotnet run
```

Visit `https://localhost:5001/Account/Login` to test authentication.

---

## Detailed Documentation

- **[Setup Guide](references/setup.md)** - Automated setup scripts, CLI commands, manual configuration
- **[Integration Guide](references/integration.md)** - Protected routes, claims, authorization policies
- **[API Reference](references/api.md)** - Complete SDK API, configuration options

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add callback URL in Auth0 Dashboard | Add `https://localhost:5001/callback` to Allowed Callback URLs |
| Missing ClientSecret | Regular Web Applications require client secret - ensure it's in appsettings.json |
| Wrong application type | Use "Regular Web Application" not "Single Page Application" in Auth0 Dashboard |
| UseAuthentication() in wrong order | Call `UseAuthentication()` before `UseAuthorization()` |
| Missing [Authorize] attribute | Add `[Authorize]` to controllers/actions that require authentication |
| Not calling SignOutAsync twice | Must sign out from both Auth0 and Cookie schemes |

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-migration` - Migrate from another auth provider
- `auth0-mfa` - Add Multi-Factor Authentication
- `auth0-blazor-server` - For Blazor Server apps
- `auth0-aspnet-webapi` - For Web APIs

---

## Quick Reference

**Core Methods:**
- `AddAuth0WebAppAuthentication()` - Register Auth0 services
- `ChallengeAsync()` - Initiate login
- `SignOutAsync()` - Log out user
- `[Authorize]` - Protect controllers/actions

**User Claims:**
- `User.Identity.Name` - User's name
- `User.Claims` - All user claims
- `User.IsInRole()` - Check role membership

**Common Use Cases:**
- Login/Logout → See Step 4 above
- Protected routes → [Integration Guide](references/integration.md#protected-routes)
- Custom claims → [Integration Guide](references/integration.md#claims)
- Authorization policies → [Integration Guide](references/integration.md#policies)

---

## References

- [Auth0.AspNetCore.Authentication Documentation](https://github.com/auth0/auth0-aspnetcore-authentication)
- [Auth0 ASP.NET Core Quickstart](https://auth0.com/docs/quickstart/webapp/aspnet-core)
- [ASP.NET Core Security Documentation](https://docs.microsoft.com/aspnet/core/security/)
