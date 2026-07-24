# Auth0 ASP.NET Core Web App Integration

Add login, logout, and user profile to an ASP.NET Core MVC, Razor Pages, or Blazor Server application using `Auth0.AspNetCore.Authentication`.

> **Prerequisites & setup:** the shared prerequisites, when-NOT-to-use notes,
> and quick start for a basic MVC integration live in this group's hub index
> (already read on the way here). This file covers the Blazor Server and
> Razor Pages setup variants, tenant setup/provisioning, and advanced
> server-side patterns (protected routes, calling APIs, custom login, Blazor
> auth, error handling) — see the Setup and Integration Patterns sections
> below. Full API/configuration lookup lives in this group's api-reference
> leaf.

## Blazor Server Variant

For Blazor Server apps, use Razor Pages as auth endpoints - Blazor components cannot perform the HTTP redirects required by OAuth challenges.

### Additional Program.cs Setup

```csharp
using Auth0.AspNetCore.Authentication;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuth0WebAppAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.ClientId = builder.Configuration["Auth0:ClientId"];
    options.ClientSecret = builder.Configuration["Auth0:ClientSecret"];
});

builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

builder.Services.AddCascadingAuthenticationState();  // Required for Blazor auth state
builder.Services.AddRazorPages();                     // Required for auth endpoints

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapRazorPages();
app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
```

### Login Razor Page (Pages/Login.cshtml.cs)

```csharp
using Auth0.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

public class LoginModel : PageModel
{
    public async Task OnGet(string returnUrl = "/")
    {
        var authenticationProperties = new LoginAuthenticationPropertiesBuilder()
            .WithRedirectUri(returnUrl)
            .Build();

        await HttpContext.ChallengeAsync(Auth0Constants.AuthenticationScheme, authenticationProperties);
    }
}
```

### Logout Razor Page (Pages/Logout.cshtml.cs)

```csharp
using Auth0.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

public class LogoutModel : PageModel
{
    public async Task OnGet()
    {
        var authenticationProperties = new LogoutAuthenticationPropertiesBuilder()
            .WithRedirectUri(Url.Content("~/"))
            .Build();

        await HttpContext.SignOutAsync(Auth0Constants.AuthenticationScheme, authenticationProperties);
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }
}
```

### Profile Component (Components/Pages/Profile.razor)

```razor
@page "/profile"
@attribute [Authorize]
@using System.Security.Claims

<h1>Profile</h1>

<AuthorizeView>
    <Authorized>
        <div class="row">
            <div class="col-2">
                <img src="@context.User.FindFirst("picture")?.Value"
                     alt="Profile" class="img-fluid rounded-circle" />
            </div>
            <div class="col-10">
                <h3>@context.User.Identity?.Name</h3>
                <p><strong>Email:</strong> @context.User.FindFirst(ClaimTypes.Email)?.Value</p>
            </div>
        </div>

        <h4 class="mt-4">Claims</h4>
        <table class="table">
            <thead><tr><th>Type</th><th>Value</th></tr></thead>
            <tbody>
                @foreach (var claim in context.User.Claims)
                {
                    <tr><td>@claim.Type</td><td>@claim.Value</td></tr>
                }
            </tbody>
        </table>
    </Authorized>
</AuthorizeView>
```

### Update MainLayout.razor Navigation

```razor
@using Microsoft.AspNetCore.Components.Authorization

<AuthorizeView>
    <Authorized>
        <a href="/profile">@context.User.Identity?.Name</a>
        <a href="/Logout">Logout</a>
    </Authorized>
    <NotAuthorized>
        <a href="/Login">Login</a>
    </NotAuthorized>
</AuthorizeView>
```

### Routes.razor

Wrap the `Router` in `CascadingAuthenticationState` to enable authorization throughout the component tree:

```razor
<CascadingAuthenticationState>
    <Router AppAssembly="typeof(Program).Assembly">
        <Found Context="routeData">
            <AuthorizeRouteView RouteData="routeData" DefaultLayout="typeof(Layout.MainLayout)" />
            <FocusOnNavigate RouteData="routeData" Selector="h1" />
        </Found>
    </Router>
</CascadingAuthenticationState>
```

## Razor Pages Variant

For Razor Pages apps (without Blazor), use `AddRazorPages()` instead of `AddControllersWithViews()` in `Program.cs`. Auth endpoints are the same Login/Logout page models shown in the Blazor Server section. Replace navigation in `_Layout.cshtml` using the same `User.Identity.IsAuthenticated` check shown in the MVC section.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Hardcoding `Domain`, `ClientId`, or `ClientSecret` in source | Read from configuration - use `builder.Configuration["Auth0:Domain"]`; never embed credentials |
| Committing `ClientSecret` to source control | Use `dotnet user-secrets` or environment variables for the client secret - never commit it |
| `UseAuthorization()` before `UseAuthentication()` | Must call `UseAuthentication()` first - wrong order causes auth to never fire |
| Signing out of only one scheme | Always call both `SignOutAsync(Auth0Constants.AuthenticationScheme)` and `SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme)` |
| Adding `[Authorize]` to the `Login` action | `Login` must be accessible to unauthenticated users - only apply `[Authorize]` to `Logout` and `Profile` |
| Not configuring Callback URLs in Auth0 Dashboard | Must add `http://localhost:5000/callback` to Allowed Callback URLs |
| Passing `Domain` with `https://` prefix | `Domain` should be the bare domain, e.g., `my-tenant.us.auth0.com`, not `https://my-tenant.us.auth0.com` |
| Not adding `AddCascadingAuthenticationState()` in Blazor | Required for Blazor Server - without it, `AuthorizeView` and `[Authorize]` attributes have no auth context |
| Using Blazor components for login/logout redirects | Blazor components cannot perform HTTP redirects - use Razor Pages (`/Login`, `/Logout`) for auth endpoints |
| Not adding `AddRazorPages()` and `MapRazorPages()` in Blazor | Login and Logout Razor Pages won't be routed without these registrations |
| Using `Auth0.AspNetCore.Authentication.Api` for web apps | That package is for JWT-protected APIs - use `Auth0.AspNetCore.Authentication` for session-based web apps |
| Using `AddJwtBearer` instead of `AddAuth0WebAppAuthentication` | `AddJwtBearer` is for stateless API auth - session-based web apps require `AddAuth0WebAppAuthentication` |
| Not creating `Views/Account/` directory for Profile view | MVC requires the directory to exist before creating the view |

## Key SDK Methods

| Method/Property | Usage | Purpose |
|-----------------|-------|---------|
| `AddAuth0WebAppAuthentication` | `builder.Services.AddAuth0WebAppAuthentication(options => { ... })` | Registers Auth0 cookie-based authentication |
| `LoginAuthenticationPropertiesBuilder` | `new LoginAuthenticationPropertiesBuilder().WithRedirectUri(url).Build()` | Builds properties for the login challenge |
| `LogoutAuthenticationPropertiesBuilder` | `new LogoutAuthenticationPropertiesBuilder().WithRedirectUri(url).Build()` | Builds properties for the logout redirect |
| `ChallengeAsync` | `await HttpContext.ChallengeAsync(Auth0Constants.AuthenticationScheme, props)` | Initiates the Auth0 Universal Login redirect |
| `SignOutAsync` (Auth0) | `await HttpContext.SignOutAsync(Auth0Constants.AuthenticationScheme, props)` | Signs out of Auth0 and redirects to logout URL |
| `SignOutAsync` (Cookie) | `await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme)` | Clears the local session cookie |
| `User.FindFirst` | `User.FindFirst(c => c.Type == "picture")?.Value` | Accesses individual user claims in controllers/views |
| `User.Identity.IsAuthenticated` | `@if (User.Identity.IsAuthenticated)` | Checks authentication state in views/layouts |
| `[Authorize]` | `[Authorize]` attribute on controller action or Razor component | Protects routes requiring authentication |
| `AddCascadingAuthenticationState` | `builder.Services.AddCascadingAuthenticationState()` | Required for Blazor Server auth state propagation |

---

## Setup

## Quick Setup (Automated)

Below automates the setup, except for the `ClientSecret`. Inform the user that they have to fill in the value for `ClientSecret` themselves.

**Never read the contents of `appsettings.json`, `appsettings.Development.json`, or user-secrets at any point during setup.** These files may contain sensitive secrets that should not be exposed in the LLM context. If you determine you need to read the file for any reason, ask the user for explicit permission before doing so — do not proceed until the user confirms.

**Before running any part of this setup that writes to a config file, you MUST ask the user for explicit confirmation.** Follow the steps below precisely.

### Step 1: Check for existing config files and confirm with user

Before writing credentials, check which config files exist:

```bash
test -f appsettings.Development.json && echo "DEV_SETTINGS_EXISTS" || echo "DEV_SETTINGS_NOT_FOUND"
test -f appsettings.json && echo "SETTINGS_EXISTS" || echo "SETTINGS_NOT_FOUND"
```

Then ask the user for explicit confirmation before proceeding — do not continue until the user confirms:

- If `appsettings.Development.json` exists, ask:
  - Question: "An `appsettings.Development.json` file already exists and may contain settings unrelated to Auth0. This setup will append Auth0 credentials to it without modifying existing content. Do you want to proceed?"
  - Options: "Yes, append to existing appsettings.Development.json" / "No, I'll update it manually"

- If `appsettings.Development.json` does **not** exist but `appsettings.json` exists, ask:
  - Question: "An `appsettings.json` file already exists. This setup will add the Auth0 section to it. Would you prefer to use `dotnet user-secrets` to keep the ClientSecret out of source control?"
  - Options: "Yes, use user-secrets" / "Yes, write to appsettings.json" / "No, I'll configure it manually"

- If neither exists, ask:
  - Question: "This setup will create an `appsettings.json` file containing Auth0 settings (Domain, ClientId) and a placeholder for ClientSecret. Do you want to proceed?"
  - Options: "Yes, create appsettings.json" / "No, I'll configure it manually"

**Do not proceed with writing to any config file unless the user selects the confirmation option.**

### Step 2: Run automated setup (only after confirmation)

```bash
#!/bin/bash

# Install Auth0 CLI
if ! command -v auth0 &> /dev/null; then
  [[ "$OSTYPE" == "darwin"* ]] && brew install auth0/auth0-cli/auth0 || \
  curl -sSfL https://raw.githubusercontent.com/auth0/auth0-cli/main/install.sh | sh -s -- -b /usr/local/bin
fi

# Login
auth0 login 2>/dev/null || auth0 login

# Create/select app
auth0 apps list
read -p "Enter app ID (or Enter to create): " APP_ID

if [ -z "$APP_ID" ]; then
  APP_ID=$(auth0 apps create --name "${PWD##*/}-aspnetcore" --type regular \
    --callbacks "http://localhost:5000/callback,https://localhost:7000/callback" \
    --logout-urls "http://localhost:5000,https://localhost:7000" \
    --metadata "created_by=agent_skills" \
    --json-compact | jq -r '.client_id')
fi

# Get credentials
DOMAIN=$(auth0 apps show "$APP_ID" --json-compact | jq -r '.domain')
CLIENT_ID=$(auth0 apps show "$APP_ID" --json-compact | jq -r '.client_id')

echo "Auth0 Domain: $DOMAIN"
echo "Auth0 Client ID: $CLIENT_ID"
echo ""
echo "Add these to your appsettings.json or use dotnet user-secrets:"
echo ""
echo "  dotnet user-secrets set \"Auth0:Domain\" \"$DOMAIN\""
echo "  dotnet user-secrets set \"Auth0:ClientId\" \"$CLIENT_ID\""
echo "  dotnet user-secrets set \"Auth0:ClientSecret\" \"YOUR_CLIENT_SECRET\""
```

After the script runs, remind the user to:
1. Replace `YOUR_CLIENT_SECRET` with the actual client secret from Auth0.
2. For production, use environment variables or a secrets manager — never commit the client secret to source control.
3. Verify the HTTPS port in `Properties/launchSettings.json` and update the Auth0 callback/logout URLs if needed (ASP.NET Core assigns random HTTPS ports in the 7000-7300 range).

---

## Manual Setup

### Install Package

```bash
dotnet add package Auth0.AspNetCore.Authentication
```

### Configure appsettings.json

Add the `Auth0` section:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "Auth0": {
    "Domain": "your-tenant.us.auth0.com",
    "ClientId": "your-client-id",
    "ClientSecret": "your-client-secret"
  }
}
```

**For local development**, use `dotnet user-secrets` to keep the client secret out of source control:

```bash
dotnet user-secrets init
dotnet user-secrets set "Auth0:Domain" "your-tenant.us.auth0.com"
dotnet user-secrets set "Auth0:ClientId" "your-client-id"
dotnet user-secrets set "Auth0:ClientSecret" "your-client-secret"
```

User secrets override `appsettings.json` in the Development environment. In production, use environment variables:

```bash
export Auth0__Domain="your-tenant.us.auth0.com"
export Auth0__ClientId="your-client-id"
export Auth0__ClientSecret="your-client-secret"
```

Note: Environment variable names use double underscores (`__`) to represent the `:` separator in .NET configuration keys.

### Get Auth0 Credentials

CLI: `auth0 apps show <app-id> --reveal-secrets`

Dashboard: Create a Regular Web Application, then copy Domain, Client ID, and Client Secret from the Settings tab.

### Configure Auth0 Dashboard

In your Auth0 Application settings:
- **Allowed Callback URLs**: `http://localhost:5000/callback, https://localhost:{HTTPS_PORT}/callback`
- **Allowed Logout URLs**: `http://localhost:5000, https://localhost:{HTTPS_PORT}`
- **Allowed Web Origins**: `http://localhost:5000, https://localhost:{HTTPS_PORT}`

> Check `Properties/launchSettings.json` for your project's actual HTTPS port (ASP.NET Core assigns a random port in the 7000-7300 range).

Application type must be **Regular Web Application** (not SPA or Native).

---

## Troubleshooting

**"IDX20803: Unable to obtain configuration" error:** Verify `Auth0:Domain` is the bare domain (e.g., `your-tenant.us.auth0.com`) without `https://`. The SDK prepends the protocol automatically.

**"Callback URL mismatch" error:** The Allowed Callback URLs in Auth0 Dashboard must exactly match your app's callback URL. Check for trailing slashes or http vs https mismatches.

**Client secret required:** ASP.NET Core apps use Regular Web Application type — ensure the app was created as regular, not SPA or Native. SPA apps do not have client secrets.

**Middleware order error (auth not working):** Ensure `app.UseAuthentication()` is called before `app.UseAuthorization()` in `Program.cs`.

**User-secrets not loading:** User secrets only load in the `Development` environment (`ASPNETCORE_ENVIRONMENT=Development`). Verify the environment variable is set correctly.

**SignOut not clearing session:** Ensure both `SignOutAsync(Auth0Constants.AuthenticationScheme)` and `SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme)` are called in the `Logout` action.

---

## Integration Patterns

## Protected Routes

### Using [Authorize] Attribute on Controller Actions

```csharp
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

public class DashboardController : Controller
{
    [Authorize]
    public IActionResult Index()
    {
        var userName = User.Identity.Name;
        return View("Index", userName);
    }
}
```

### Using [Authorize] on an Entire Controller

```csharp
[Authorize]
public class AdminController : Controller
{
    public IActionResult Dashboard()
    {
        return View();
    }

    public IActionResult Settings()
    {
        return View();
    }
}
```

### Manual Check in Action

```csharp
public IActionResult Dashboard()
{
    if (!User.Identity.IsAuthenticated)
    {
        return RedirectToAction("Login", "Account");
    }
    return View();
}
```

### Policy-Based Authorization

```csharp
// Register policy in Program.cs
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireEmail", policy =>
        policy.RequireClaim(System.Security.Claims.ClaimTypes.Email));
});

// Apply to action
[Authorize(Policy = "RequireEmail")]
public IActionResult AdminOnly()
{
    return View();
}
```

### Razor Pages Protection

```csharp
// Program.cs - protect all Razor Pages under /Admin
builder.Services.AddRazorPages(options =>
{
    options.Conventions.AuthorizeFolder("/Admin");
    options.Conventions.AllowAnonymousToPage("/Admin/Login");
});
```

---

## Calling External APIs

### Get Access Token in Controller

```csharp
using Microsoft.AspNetCore.Authentication;

public class ApiController : Controller
{
    private readonly IHttpClientFactory _httpClientFactory;

    public ApiController(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    [Authorize]
    public async Task<IActionResult> CallApi()
    {
        var accessToken = await HttpContext.GetTokenAsync("access_token");
        if (string.IsNullOrEmpty(accessToken))
        {
            return Unauthorized("No access token available");
        }

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        var response = await client.GetAsync("https://api.example.com/data");
        var content = await response.Content.ReadAsStringAsync();

        return Ok(content);
    }
}
```

### Configure Audience for API Calls

Update `Program.cs` to request an access token for a specific audience:

```csharp
builder.Services.AddAuth0WebAppAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.ClientId = builder.Configuration["Auth0:ClientId"];
    options.ClientSecret = builder.Configuration["Auth0:ClientSecret"];
})
.WithAccessToken(options =>
{
    options.Audience = builder.Configuration["Auth0:Audience"]; // e.g., https://your-api-identifier
    options.UseRefreshTokens = true;
});
```

Add the audience to `appsettings.json`:

```json
{
  "Auth0": {
    "Domain": "your-tenant.us.auth0.com",
    "ClientId": "your_client_id",
    "Audience": "https://your-api-identifier"
  }
}
```

> Store `ClientSecret` in user-secrets (`dotnet user-secrets set "Auth0:ClientSecret" "your_client_secret"`) or environment variables — never commit secrets to source control.

---

## Custom Login Options

### Force a Specific Connection

```csharp
public async Task LoginWithGoogle(string returnUrl = "/")
{
    var authenticationProperties = new LoginAuthenticationPropertiesBuilder()
        .WithRedirectUri(returnUrl)
        .WithParameter("connection", "google-oauth2")
        .Build();

    await HttpContext.ChallengeAsync(Auth0Constants.AuthenticationScheme, authenticationProperties);
}
```

### Prompt for Signup

```csharp
public async Task Signup(string returnUrl = "/")
{
    var authenticationProperties = new LoginAuthenticationPropertiesBuilder()
        .WithRedirectUri(returnUrl)
        .WithParameter("screen_hint", "signup")
        .Build();

    await HttpContext.ChallengeAsync(Auth0Constants.AuthenticationScheme, authenticationProperties);
}
```

### Custom Logout Return URL

```csharp
[Authorize]
public async Task LogoutToGoodbye()
{
    var authenticationProperties = new LogoutAuthenticationPropertiesBuilder()
        .WithRedirectUri(Url.Action("Goodbye", "Home"))
        .Build();

    await HttpContext.SignOutAsync(Auth0Constants.AuthenticationScheme, authenticationProperties);
    await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
}
```

---

## Accessing User Information

### In Controllers

```csharp
[Authorize]
public IActionResult Profile()
{
    var name = User.Identity.Name;
    var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
    var picture = User.FindFirst(c => c.Type == "picture")?.Value;
    var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

    var model = new ProfileViewModel
    {
        Name = name,
        Email = email,
        Picture = picture,
        UserId = userId,
        Claims = User.Claims.ToList()
    };

    return View(model);
}
```

### In Views (Razor)

```html
@if (User.Identity.IsAuthenticated)
{
    <p>Welcome, @User.Identity.Name!</p>
    <img src='@User.FindFirst(c => c.Type == "picture")?.Value' alt="Profile" />
}
```

### In Blazor Components

```razor
@using Microsoft.AspNetCore.Components.Authorization
@inject AuthenticationStateProvider AuthStateProvider

<AuthorizeView>
    <Authorized>
        <p>Welcome, @context.User.Identity?.Name!</p>
        <img src='@context.User.FindFirst("picture")?.Value' alt="Profile" />
    </Authorized>
    <NotAuthorized>
        <p>Please <a href="/Login">log in</a>.</p>
    </NotAuthorized>
</AuthorizeView>
```

---

## Injecting User into All Views

Use a base controller or view imports to make the user available everywhere:

```csharp
// BaseController.cs
public abstract class BaseController : Controller
{
    protected string CurrentUserName => User.Identity.Name ?? "Guest";
    protected bool IsAuthenticated => User.Identity.IsAuthenticated;
}

// DashboardController.cs
public class DashboardController : BaseController
{
    [Authorize]
    public IActionResult Index()
    {
        ViewBag.UserName = CurrentUserName;
        return View();
    }
}
```

Or use `ViewData` in `_ViewStart.cshtml` via a filter:

```csharp
// AuthUserFilter.cs - inject user into all views automatically
public class AuthUserFilter : IActionFilter
{
    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (context.Controller is Controller controller)
        {
            controller.ViewData["CurrentUser"] = controller.User.Identity.Name;
        }
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}

// Program.cs
builder.Services.AddControllersWithViews(options =>
{
    options.Filters.Add<AuthUserFilter>();
});
```

---

## Error Handling

### Global Unauthorized Redirect

```csharp
// Program.cs - redirect 401/403 to login page
app.UseStatusCodePages(async statusCodeContext =>
{
    var response = statusCodeContext.HttpContext.Response;
    if (response.StatusCode == 401)
    {
        response.Redirect("/Account/Login");
    }
    else if (response.StatusCode == 403)
    {
        response.Redirect("/Home/AccessDenied");
    }
});
```

### Handling Token Expiry (with .WithAccessToken)

```csharp
.WithAccessToken(options =>
{
    options.Audience = builder.Configuration["Auth0:Audience"];
    options.UseRefreshTokens = true;
    options.Events = new Auth0WebAppWithAccessTokenEvents
    {
        OnMissingRefreshToken = async (context) =>
        {
            // Refresh token missing - force re-login
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            context.Response.Redirect("/Account/Login");
        }
    };
});
```

---

## Blazor Server: Auth in Components

### AuthorizeView Component

```razor
<AuthorizeView>
    <Authorized>
        <!-- Only shown to authenticated users -->
        <p>Welcome, @context.User.Identity?.Name!</p>
    </Authorized>
    <NotAuthorized>
        <!-- Only shown to unauthenticated users -->
        <a href="/Login">Please log in</a>
    </NotAuthorized>
    <Authorizing>
        <!-- Shown while auth state is loading -->
        <p>Loading...</p>
    </Authorizing>
</AuthorizeView>
```

### Programmatic Auth State in Blazor

```razor
@inject AuthenticationStateProvider AuthStateProvider

@code {
    private bool isAuthenticated;
    private string userName = "";

    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthStateProvider.GetAuthenticationStateAsync();
        var user = authState.User;
        isAuthenticated = user.Identity?.IsAuthenticated ?? false;
        userName = user.Identity?.Name ?? "";
    }
}
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Callback URL mismatch" | Ensure the callback URL in Auth0 Dashboard matches exactly (include both `http://localhost:5000/callback` and `https://localhost:{HTTPS_PORT}/callback` — check `Properties/launchSettings.json` for the actual port) |
| User not authenticated after login | Verify `UseAuthentication()` is before `UseAuthorization()` in `Program.cs` |
| Claims are `null` or missing | Check `Scope` includes `openid profile email` in configuration |
| Access token is empty | Configure `.WithAccessToken()` with `Audience` in `Program.cs` |
| Blazor `[Authorize]` not working | Add `AddCascadingAuthenticationState()` and `AddRazorPages()` to `Program.cs` |
| Redirect loop on login | Verify `Login` action does not have `[Authorize]` attribute |
| Logout does not end Auth0 session | Must call `SignOutAsync(Auth0Constants.AuthenticationScheme)` - calling only the cookie scheme skips Auth0 |

## Related Workflows

- ASP.NET Core Web APIs with JWT Bearer token validation → ask for the ASP.NET Core Web API integration
- Server-rendered Express web apps with login/logout sessions → ask for the Express integration
- Flask web applications with session-based auth → ask for the Flask integration

## Quick Reference

**SDK registration:**
```csharp
builder.Services.AddAuth0WebAppAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];        // required
    options.ClientId = builder.Configuration["Auth0:ClientId"];    // required
    options.ClientSecret = builder.Configuration["Auth0:ClientSecret"]; // required
});
```

**Login action:**
```csharp
var props = new LoginAuthenticationPropertiesBuilder().WithRedirectUri(returnUrl).Build();
await HttpContext.ChallengeAsync(Auth0Constants.AuthenticationScheme, props);
```

**Logout action (always call both):**
```csharp
var props = new LogoutAuthenticationPropertiesBuilder().WithRedirectUri(Url.Action("Index", "Home")).Build();
await HttpContext.SignOutAsync(Auth0Constants.AuthenticationScheme, props);
await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
```

**Route protection:**
```csharp
[Authorize]
public IActionResult Profile() { return View(); }
```

**appsettings.json configuration keys:**
- `Auth0:Domain` - Auth0 tenant domain (e.g., `tenant.us.auth0.com`)
- `Auth0:ClientId` - Application client ID
- `Auth0:ClientSecret` - Application client secret (use user-secrets in development)

## References

- [Auth0.AspNetCore.Authentication on NuGet](https://www.nuget.org/packages/Auth0.AspNetCore.Authentication)
- [Auth0 ASP.NET Core MVC Quickstart](https://auth0.com/docs/quickstart/webapp/aspnet-core)
- [Auth0 ASP.NET Core Blazor Server Quickstart](https://auth0.com/docs/quickstart/webapp/aspnet-core-blazor-server)
- [ASP.NET Core Documentation](https://learn.microsoft.com/en-us/aspnet/core)
