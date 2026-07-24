# Auth0 ASP.NET Core Web App — reference hub

Add login, logout, and user profile to an ASP.NET Core MVC, Razor Pages, or Blazor Server application using `Auth0.AspNetCore.Authentication`.

## Prerequisites

- ASP.NET Core application (.NET 8 or higher)
- Auth0 Regular Web Application configured (not an API - must be an Application)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **ASP.NET Core Web APIs with JWT Bearer validation** - Use the ASP.NET Core Web API integration workflow for JWT-protected REST APIs
- **Blazor WebAssembly** - Requires OIDC client-side auth; see the Auth0 Blazor WebAssembly quickstart
- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Next.js applications** - Use the Auth0 integration workflow for Next.js, which handles both client and server
- **Python web apps** - Use the Auth0 integration workflow for Flask or see the Django quickstart

---

## Quick start

### 1. Install SDK

```bash
dotnet add package Auth0.AspNetCore.Authentication
```

### 2. Configure Credentials

Add Auth0 settings to `appsettings.json`:

```json
{
  "Auth0": {
    "Domain": "your-tenant.us.auth0.com",
    "ClientId": "your_client_id",
    "ClientSecret": "your_client_secret"
  }
}
```

**For local development**, keep secrets out of source control - use `dotnet user-secrets` to avoid committing `ClientSecret`:

```bash
dotnet user-secrets set "Auth0:Domain" "your-tenant.us.auth0.com"
dotnet user-secrets set "Auth0:ClientId" "your_client_id"
dotnet user-secrets set "Auth0:ClientSecret" "your_client_secret"
```

`Auth0:Domain` is your tenant domain (without `https://`). `Auth0:ClientId` and `Auth0:ClientSecret` come from your Auth0 Application settings.

### 3. Configure Auth0 Dashboard

In your Auth0 Application settings:
- **Allowed Callback URLs**: `http://localhost:5000/callback`
- **Allowed Logout URLs**: `http://localhost:5000`
- **Allowed Web Origins**: `http://localhost:5000`

### 4. Register Auth0 in Program.cs

```csharp
using Auth0.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuth0WebAppAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.ClientId = builder.Configuration["Auth0:ClientId"];
    options.ClientSecret = builder.Configuration["Auth0:ClientSecret"];
});

builder.Services.AddControllersWithViews();

var app = builder.Build();

// Standard middleware...
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.UseAuthentication();    // Must come before UseAuthorization
app.UseAuthorization();     // Critical: order matters

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
```

**Critical:** `UseAuthentication()` must come before `UseAuthorization()`. Reversing these causes silent auth failures where protected routes are never challenged.

### 5. Create AccountController

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

        await HttpContext.ChallengeAsync(Auth0Constants.AuthenticationScheme, authenticationProperties);
    }

    [Authorize]
    public async Task Logout()
    {
        var authenticationProperties = new LogoutAuthenticationPropertiesBuilder()
            .WithRedirectUri(Url.Action("Index", "Home"))
            .Build();

        await HttpContext.SignOutAsync(Auth0Constants.AuthenticationScheme, authenticationProperties);
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }

    [Authorize]
    public IActionResult Profile()
    {
        return View();
    }
}
```

`Login` does not need `[Authorize]` - it is the entry point for unauthenticated users. `Logout` requires `[Authorize]` to ensure the sign-out only fires for authenticated sessions. **Always call both `SignOutAsync` methods** - signing out of only the Auth0 scheme leaves a local cookie; signing out of only the cookie scheme skips the Auth0 logout URL.

### 6. Create Profile View

Create `Views/Account/Profile.cshtml`:

```html
@{
    ViewData["Title"] = "User Profile";
}

<div class="row">
    <div class="col-md-2">
        <img src="@User.FindFirst(c => c.Type == "picture")?.Value"
             alt="Profile picture" class="img-fluid rounded-circle" />
    </div>
    <div class="col-md-10">
        <h3>@User.Identity.Name</h3>
        <p><strong>Email:</strong>
           @User.FindFirst(c => c.Type == System.Security.Claims.ClaimTypes.Email)?.Value</p>
        <p><strong>User ID:</strong>
           @User.FindFirst(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value</p>
    </div>
</div>

<h4 class="mt-4">Claims</h4>
<table class="table">
    <thead><tr><th>Claim Type</th><th>Claim Value</th></tr></thead>
    <tbody>
        @foreach (var claim in User.Claims)
        {
            <tr><td>@claim.Type</td><td>@claim.Value</td></tr>
        }
    </tbody>
</table>
```

### 7. Update Navigation (_Layout.cshtml)

Add login/logout/profile links to your nav bar inside `_Layout.cshtml`:

```html
@if (User.Identity.IsAuthenticated)
{
    <li class="nav-item">
        <a class="nav-link text-dark" asp-controller="Account" asp-action="Profile">@User.Identity.Name</a>
    </li>
    <li class="nav-item">
        <a class="nav-link text-dark" asp-controller="Account" asp-action="Logout">Logout</a>
    </li>
}
else
{
    <li class="nav-item">
        <a class="nav-link text-dark" asp-controller="Account" asp-action="Login">Login</a>
    </li>
}
```

### 8. Test the App

```bash
dotnet run
```

Visit `http://localhost:5000` and click Login to start the Auth0 login flow.

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-aspnetcore-auth/integrate.md` |

**Then, as needed for your task:**
- The quick start above gets a basic MVC integration working. For the Blazor Server and Razor Pages variants, tenant setup / app provisioning (CLI + manual, dashboard config), and advanced framework patterns (protected routes, calling APIs, custom login, Blazor auth, error handling): `Read: references/framework-aspnetcore-auth/integrate.md`
- Full API / configuration lookup (options, builders, claims, cookies, testing): `Read: references/framework-aspnetcore-auth/api-reference.md`
- Any other task (guidance, debugging, Organizations): start with `Read: references/framework-aspnetcore-auth/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
