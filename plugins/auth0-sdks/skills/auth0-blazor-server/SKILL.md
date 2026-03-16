---
name: auth0-blazor-server
description: Use when adding authentication to Blazor Server applications (login, logout, user sessions, protected pages) - integrates Auth0.AspNetCore.Authentication SDK for server-side Blazor apps
---

# Auth0 Blazor Server Integration

Add authentication to Blazor Server applications using Auth0.AspNetCore.Authentication SDK.

---

## Prerequisites

- .NET 6.0+ SDK installed
- Blazor Server knowledge
- Auth0 account and application configured
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **Blazor WebAssembly** - Use client-side authentication with @auth0/auth0-spa-js
- **ASP.NET Core MVC** - Use `auth0-aspnet-core` skill
- **Web APIs** - Use `auth0-aspnet-webapi` skill for JWT validation

---

## Quick Start Workflow

### 1. Install SDK

```bash
dotnet add package Auth0.AspNetCore.Authentication
```

### 2. Configure Environment

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

builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

// Add Auth0 authentication
builder.Services.AddAuth0WebAppAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.ClientId = builder.Configuration["Auth0:ClientId"];
    options.ClientSecret = builder.Configuration["Auth0:ClientSecret"];
});

var app = builder.Build();

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();
```

### 4. Add Login/Logout Pages

Create `Pages/Account/Login.cshtml`:

```cshtml
@page
@using Auth0.AspNetCore.Authentication
@using Microsoft.AspNetCore.Authentication

@{
    await HttpContext.ChallengeAsync(Auth0Constants.AuthenticationScheme,
        new LoginAuthenticationPropertiesBuilder()
            .WithRedirectUri("/")
            .Build());
}
```

Create `Pages/Account/Logout.cshtml`:

```cshtml
@page
@using Auth0.AspNetCore.Authentication
@using Microsoft.AspNetCore.Authentication
@using Microsoft.AspNetCore.Authentication.Cookies

@{
    await HttpContext.SignOutAsync(Auth0Constants.AuthenticationScheme,
        new LogoutAuthenticationPropertiesBuilder()
            .WithRedirectUri("/")
            .Build());
    await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
}
```

### 5. Protect Blazor Components

Use `<AuthorizeView>` in components:

```razor
<AuthorizeView>
    <Authorized>
        <p>Hello, @context.User.Identity.Name!</p>
        <a href="/Account/Logout">Logout</a>
    </Authorized>
    <NotAuthorized>
        <a href="/Account/Login">Login</a>
    </NotAuthorized>
</AuthorizeView>
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot callback URL | Add `https://localhost:5001/callback` to Auth0 Dashboard |
| Missing ClientSecret | Blazor Server requires client secret in appsettings.json |
| Wrong app type | Use "Regular Web Application" in Auth0 Dashboard |
| UseAuthentication() missing | Call before UseAuthorization() in Program.cs |

---

## Related Skills

- `auth0-aspnet-core` - For ASP.NET Core MVC
- `auth0-aspnet-webapi` - For Web APIs

---

## References

- [Auth0.AspNetCore.Authentication Documentation](https://github.com/auth0/auth0-aspnetcore-authentication)
- [Blazor Server Security](https://docs.microsoft.com/aspnet/core/blazor/security/server/)
