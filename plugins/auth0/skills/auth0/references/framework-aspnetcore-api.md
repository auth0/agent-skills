
# Auth0 ASP.NET Core Web API Integration

Protect ASP.NET Core Web API endpoints with JWT access token validation using Auth0.AspNetCore.Authentication.Api.

## Prerequisites

- .NET 8.0 SDK or higher
- Auth0 API configured (not Application - must be API resource)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Server-rendered web applications** - Use session-based auth (Auth0.AspNetCore.Authentication) for MVC/Razor Pages apps
- **Single Page Applications** - Use the Auth0 React, Vue, or Angular integration workflow for client-side auth
- **Mobile applications** - Use the Auth0 React Native integration workflow for React Native/Expo
- **Blazor WebAssembly** - Requires different auth approach (OIDC client-side)

## Quick Start Workflow

### 1. Install SDK

```bash
dotnet add package Auth0.AspNetCore.Authentication.Api
```

### 2. Create Auth0 API

You need an **API** (not Application) in Auth0.

> **STOP — ask the user before proceeding.**
>
> Ask exactly this question and wait for their answer before doing anything else:
>
> > "How would you like to create the Auth0 API resource?
> > 1. **Automated** — I'll run Auth0 CLI scripts that create the resource and write the exact values to your appsettings.json automatically.
> > 2. **Manual** — You create the API yourself in the Auth0 Dashboard (or via `auth0 apis create`) and provide me the Domain and Audience.
> >
> > Which do you prefer? (1 = Automated / 2 = Manual)"
>
> Do NOT proceed to any setup steps until the user has answered. Do NOT default to manual.

**If the user chose Automated**, follow the Setup Guide section below for complete CLI scripts. The automated path writes `appsettings.json` for you — skip Step 3 below and proceed directly to Step 4.

**If the user chose Manual**, follow the Setup Guide section below (Manual Setup) for full instructions including User Secrets and environment variable options. Then continue with Step 3 below.

Quick reference for manual API creation:

```bash
# Using Auth0 CLI
auth0 apis create \
  --name "My ASP.NET Core API" \
  --identifier https://my-api.example.com
```

Or create manually in Auth0 Dashboard → Applications → APIs

### 3. Configure appsettings.json

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "Audience": "https://my-api.example.com"
  }
}
```

**Important:** Domain must NOT include `https://`. The library constructs the authority URL automatically.

### 4. Configure Program.cs

```csharp
var builder = WebApplication.CreateBuilder(args);

// Register Auth0 JWT validation
builder.Services.AddAuth0ApiAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.JwtBearerOptions = new JwtBearerOptions
    {
        Audience = builder.Configuration["Auth0:Audience"]
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Middleware order matters: authentication before authorization
app.UseAuthentication();
app.UseAuthorization();

// Add your endpoints here (see Step 5)
app.MapGet("/api/public", () => Results.Ok(new { message = "Public" }));

app.Run();
```

### 5. Protect Endpoints

**Minimal API:**

```csharp
// Public endpoint - no authentication
app.MapGet("/api/public", () => Results.Ok(new { message = "Hello from a public endpoint!" }));

// Protected endpoint - requires valid JWT
app.MapGet("/api/private", (HttpContext ctx) =>
{
    var userId = ctx.User.FindFirst("sub")?.Value;
    return Results.Ok(new { message = "Hello from a protected endpoint!", userId });
}).RequireAuthorization();
```

**Controller-based:**

```csharp
[ApiController]
[Route("api")]
public class MessagesController : ControllerBase
{
    [HttpGet("public")]
    public IActionResult Public() =>
        Ok(new { message = "Hello from a public endpoint!" });

    [Authorize]
    [HttpGet("private")]
    public IActionResult Private() =>
        Ok(new { message = "Hello from a protected endpoint!", userId = User.FindFirst("sub")?.Value });
}
```

### 6. Test API

Test public endpoint:

```bash
curl http://localhost:5000/api/public
```

Test protected endpoint (requires access token):

```bash
curl http://localhost:5000/api/private \
  -H "Authorization: Bearer $TOKEN"
```

Get a test token via Client Credentials flow or Auth0 Dashboard → APIs → Test tab.
Capture the token into a shell variable (`TOKEN=$(...)`) and reference `$TOKEN`
rather than pasting the raw token inline — inline token values leak into shell
history and terminal scrollback.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Domain includes `https://` | Use `your-tenant.auth0.com` format only - no scheme prefix |
| Audience doesn't match API Identifier | Must exactly match the API Identifier set in Auth0 Dashboard |
| Created Application instead of API in Auth0 | Must create API resource in Auth0 Dashboard → Applications → APIs |
| Wrong middleware order | `UseAuthentication()` must come before `UseAuthorization()` |
| Using ID token instead of access token | Must use **access token** for API auth, not ID token |
| HTTPS certificate errors locally | Run `dotnet dev-certs https --trust` |

## Scope-Based Authorization

See the Scope-Based Authorization section below for defining and enforcing scope policies.

## DPoP Support

Built-in proof-of-possession token binding per RFC 9449. See the DPoP Support section below for configuration.

## Related Capabilities

- Basic Auth0 setup → set up Auth0 with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**Configuration Options:**
- `options.Domain` - Auth0 tenant domain, no `https://` prefix (required)
- `options.JwtBearerOptions.Audience` - API Identifier from Auth0 API settings (required)
- `options.JwtBearerOptions` - Full access to underlying Microsoft JWT Bearer options

**User Claims:**
- `ctx.User.FindFirst("sub")?.Value` - User ID (subject)
- `ctx.User.FindFirst("scope")?.Value` - Space-separated scopes
- `ctx.User.FindAll("scope")` - All scope claims

**Common Use Cases:**
- Protect Minimal API routes → `.RequireAuthorization()` (see Step 5)
- Protect controller actions → `[Authorize]` attribute (see Step 5)
- Scope enforcement → see the Scope-Based Authorization section below
- DPoP token binding → see the DPoP Support section below
- Advanced JWT Bearer config → see the API Reference section below

## References

- [Auth0 ASP.NET Core Web API Quickstart](https://auth0.com/docs/quickstart/backend/aspnet-core-webapi)
- [SDK GitHub Repository](https://github.com/auth0/aspnetcore-api)
- [API Documentation](https://auth0.github.io/aspnetcore-api)
- [Access Tokens Guide](https://auth0.com/docs/secure/tokens/access-tokens)

---

# Auth0 ASP.NET Core Web API - API Reference

Complete reference for Auth0.AspNetCore.Authentication.Api configuration options and extension methods.

---

## Extension Methods

### `AddAuth0ApiAuthentication`

Registers Auth0 JWT Bearer authentication with the dependency injection container.

```csharp
builder.Services.AddAuth0ApiAuthentication(options =>
{
    options.Domain = "your-tenant.auth0.com";
    options.JwtBearerOptions = new JwtBearerOptions
    {
        Audience = "https://my-api.example.com"
    };
});
```

---

## Auth0ApiAuthenticationOptions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `Domain` | `string` | Yes | Auth0 tenant domain. Format: `your-tenant.auth0.com` (no `https://` prefix) |
| `JwtBearerOptions` | `JwtBearerOptions` | Yes | Microsoft JWT Bearer options. Set `Audience` here. |

### `Domain`

Your Auth0 tenant domain. The library constructs the authority URL as `https://{Domain}/`.

```csharp
options.Domain = builder.Configuration["Auth0:Domain"];
// e.g., "dev-abc123.us.auth0.com"
```

### `JwtBearerOptions`

Full access to the underlying [Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerOptions](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.authentication.jwtbearer.jwtbeareroptions).

Key sub-properties:

| Property | Type | Description |
|----------|------|-------------|
| `Audience` | `string` | API Identifier from Auth0. Must exactly match. |
| `TokenValidationParameters` | `TokenValidationParameters` | Additional token validation rules |
| `Events` | `JwtBearerEvents` | Hooks into authentication lifecycle |
| `SaveToken` | `bool` | Whether to save the raw token in the auth properties |
| `RequireHttpsMetadata` | `bool` | Defaults to `true` in production |
| `IncludeErrorDetails` | `bool` | Include error details in 401/403 responses |

---

## Auth0ApiAuthenticationBuilder

Returned by `AddAuth0ApiAuthentication`. Fluent builder for additional configuration.

### `.WithDPoP()`

Enables DPoP token validation with default settings (Allowed mode).

```csharp
builder.Services.AddAuth0ApiAuthentication(options => { ... })
    .WithDPoP();
```

### `.WithDPoP(Action<DPoPOptions> configureDPoP)`

Enables DPoP with custom configuration.

```csharp
builder.Services.AddAuth0ApiAuthentication(options => { ... })
    .WithDPoP(dpop =>
    {
        dpop.Mode = DPoPModes.Required;
        dpop.IatOffset = 300;
        dpop.Leeway = 30;
    });
```

---

## DPoPOptions

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `Mode` | `DPoPModes` | `Allowed` | Controls which token types are accepted |
| `IatOffset` | `int` | `0` | Allowed clock skew in seconds for the `iat` claim |
| `Leeway` | `int` | `0` | Additional leeway in seconds for token time validation |

### DPoPModes Enum

| Value | Description |
|-------|-------------|
| `DPoPModes.Allowed` | Accept both DPoP-bound and standard Bearer tokens |
| `DPoPModes.Required` | Only accept DPoP-bound tokens; reject standard Bearer |
| `DPoPModes.Disabled` | Disable DPoP; standard JWT Bearer only |

---

## ASP.NET Core Authorization

Auth0 does not provide custom authorization attributes. Use standard ASP.NET Core authorization:

### Policy-Based Authorization

```csharp
// Register policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("read:messages", policy =>
        policy.RequireClaim("scope", "read:messages"));
});

// Apply to Minimal API
app.MapGet("/endpoint", handler).RequireAuthorization("read:messages");

// Apply to controller action
[Authorize(Policy = "read:messages")]
public IActionResult GetMessages() { ... }
```

### Attribute-Based Authorization

```csharp
// Require any authenticated user
[Authorize]
public IActionResult Private() { ... }

// Require specific policy
[Authorize(Policy = "read:messages")]
public IActionResult Messages() { ... }

// Allow anonymous on an otherwise protected controller
[AllowAnonymous]
public IActionResult Public() { ... }
```

---

## JwtBearerEvents Hooks

Configure callbacks for authentication lifecycle events:

| Event | When | Common Use |
|-------|------|------------|
| `OnTokenValidated` | After token is validated | Extract custom claims, enrich identity |
| `OnAuthenticationFailed` | Token validation fails | Custom logging, error responses |
| `OnChallenge` | 401 response about to be sent | Customize 401 response body |
| `OnForbidden` | 403 response about to be sent | Customize 403 response body |
| `OnMessageReceived` | Before token extraction | Extract token from non-standard location |

**Example - Custom 401 response:**

```csharp
options.JwtBearerOptions = new JwtBearerOptions
{
    Audience = "...",
    Events = new JwtBearerEvents
    {
        OnChallenge = context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            return context.Response.WriteAsJsonAsync(new
            {
                error = "unauthorized",
                error_description = "A valid access token is required."
            });
        }
    }
};
```

---

## References

- [Auth0 ASP.NET Core Web API Quickstart](https://auth0.com/docs/quickstart/backend/aspnet-core-webapi)
- [SDK GitHub Repository](https://github.com/auth0/aspnetcore-api)
- [Microsoft JWT Bearer Documentation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/jwtbearer)

---

# Auth0 ASP.NET Core Web API Integration Patterns

Advanced integration patterns for ASP.NET Core Web API applications.

---

## Scope-Based Authorization

### Define Authorization Policies

In `Program.cs`, add policies that map to Auth0 API permissions:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("read:messages", policy =>
        policy.RequireClaim("scope", "read:messages"));

    options.AddPolicy("write:messages", policy =>
        policy.RequireClaim("scope", "write:messages"));

    options.AddPolicy("manage:orders", policy =>
    {
        policy.RequireClaim("scope", "read:orders");
        policy.RequireClaim("scope", "write:orders");
    });
});
```

### Apply Policies to Endpoints

**Minimal API:**

```csharp
app.MapGet("/api/messages", (HttpContext ctx) =>
{
    return Results.Ok(new { messages = new[] { "Hello", "World" } });
}).RequireAuthorization("read:messages");

app.MapPost("/api/messages", (HttpContext ctx) =>
{
    return Results.Created("/api/messages/1", new { id = 1 });
}).RequireAuthorization("write:messages");
```

**Controller-based:**

```csharp
[ApiController]
[Route("api/messages")]
public class MessagesController : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "read:messages")]
    public IActionResult GetMessages() =>
        Ok(new { messages = new[] { "Hello", "World" } });

    [HttpPost]
    [Authorize(Policy = "write:messages")]
    public IActionResult CreateMessage() =>
        Created("/api/messages/1", new { id = 1 });
}
```

### Define Permissions in Auth0

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Permissions** tab
4. Add permissions matching your policy names (e.g., `read:messages`, `write:messages`)

### Request Tokens with Scopes

Clients must request tokens that include the required scopes:

```bash
# Client Credentials with specific scopes
curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials",
    "scope": "read:messages write:messages"
  }'
```

---

## DPoP Support

DPoP (Demonstrating Proof of Possession, RFC 9449) binds tokens to a specific client key pair, preventing token theft.

### Enable DPoP

```csharp
builder.Services.AddAuth0ApiAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.JwtBearerOptions = new JwtBearerOptions
    {
        Audience = builder.Configuration["Auth0:Audience"]
    };
})
.WithDPoP(); // Accept both DPoP and Bearer tokens (Allowed mode)
```

### DPoP Required Mode

To reject standard Bearer tokens and accept only DPoP-bound tokens:

```csharp
.WithDPoP(dpopOptions =>
{
    dpopOptions.Mode = DPoPModes.Required;
});
```

Optionally configure clock skew tolerance:

```csharp
.WithDPoP(dpopOptions =>
{
    dpopOptions.Mode = DPoPModes.Required;
    dpopOptions.IatOffset = 300;  // Allow 5-minute clock skew for iat claim
    dpopOptions.Leeway = 30;      // 30-second leeway for token validation
});
```

### DPoP Modes

| Mode | Behavior |
|------|----------|
| `DPoPModes.Allowed` (default) | Accept both DPoP-bound and standard Bearer tokens |
| `DPoPModes.Required` | Only accept DPoP-bound tokens; reject standard Bearer |
| `DPoPModes.Disabled` | Standard JWT Bearer only, DPoP disabled |

### Enable DPoP on Auth0 API

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Enable **Allow Skipping User Consent** and enable DPoP binding requirement

---

## Accessing User Claims

### From HttpContext in Minimal API

```csharp
app.MapGet("/api/profile", (HttpContext ctx) =>
{
    var userId = ctx.User.FindFirst("sub")?.Value;
    var email = ctx.User.FindFirst("https://example.com/email")?.Value; // custom claim
    var scopes = ctx.User.FindFirst("scope")?.Value?.Split(' ') ?? [];

    return Results.Ok(new { userId, scopes });
}).RequireAuthorization();
```

### From Controller

```csharp
[Authorize]
[HttpGet("profile")]
public IActionResult GetProfile()
{
    var userId = User.FindFirst("sub")?.Value;
    var scopes = User.FindFirst("scope")?.Value?.Split(' ') ?? [];

    return Ok(new { userId, scopes });
}
```

### Common JWT Claims

| Claim | Description |
|-------|-------------|
| `sub` | User ID (subject) |
| `scope` | Space-separated list of granted scopes |
| `aud` | Audience (your API identifier) |
| `iss` | Issuer (your Auth0 tenant URL) |
| `exp` | Expiration timestamp |
| `iat` | Issued-at timestamp |

Custom claims added via Auth0 Actions use namespaced keys, e.g., `https://example.com/role`.

---

## Error Handling

### Return Problem Details for Auth Errors

```csharp
builder.Services.AddProblemDetails();

// Customize auth error responses
builder.Services.AddAuth0ApiAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.JwtBearerOptions = new JwtBearerOptions
    {
        Audience = builder.Configuration["Auth0:Audience"],
        Events = new JwtBearerEvents
        {
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = 401;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsJsonAsync(new
                {
                    error = "unauthorized",
                    error_description = "A valid access token is required."
                });
            },
            OnForbidden = context =>
            {
                context.Response.StatusCode = 403;
                context.Response.ContentType = "application/json";
                return context.Response.WriteAsJsonAsync(new
                {
                    error = "insufficient_scope",
                    error_description = "The access token does not have the required scopes."
                });
            }
        }
    };
});
```

### Standard Error Responses

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid token | Include valid `Authorization: Bearer <token>` header |
| 401 | Expired token | Request a fresh access token |
| 401 | Wrong audience | Token's `aud` claim must match your API Identifier |
| 403 | Insufficient scope | Token must include required scopes |

---

## Mixed Public and Protected Endpoints

```csharp
// Public - no auth needed
app.MapGet("/api/public", () =>
    Results.Ok(new { message = "Public endpoint" }));

// Protected - requires valid JWT
app.MapGet("/api/private", (HttpContext ctx) =>
    Results.Ok(new { message = "Private endpoint", userId = ctx.User.FindFirst("sub")?.Value }))
    .RequireAuthorization();

// Protected with scope
app.MapGet("/api/messages", (HttpContext ctx) =>
    Results.Ok(new { messages = Array.Empty<string>() }))
    .RequireAuthorization("read:messages");
```

---

## Custom Token Validation

For advanced scenarios, configure additional JWT validation parameters:

```csharp
builder.Services.AddAuth0ApiAuthentication(options =>
{
    options.Domain = builder.Configuration["Auth0:Domain"];
    options.JwtBearerOptions = new JwtBearerOptions
    {
        Audience = builder.Configuration["Auth0:Audience"],
        TokenValidationParameters = new TokenValidationParameters
        {
            NameClaimType = "sub",  // Map sub claim to User.Identity.Name
            ClockSkew = TimeSpan.FromSeconds(30)
        }
    };
});
```

---

## Testing

### Integration Testing with WebApplicationFactory

```csharp
public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiTests(WebApplicationFactory<Program> factory) =>
        _factory = factory;

    [Fact]
    public async Task PublicEndpoint_Returns200()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/public");
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task ProtectedEndpoint_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/private");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpoint_WithValidToken_Returns200()
    {
        // Option 1: Real token from Auth0 CLI (requires network, good for integration tests)
        //   auth0 test token --audience https://my-api.example.com
        //
        // Option 2: Mock JWT for fast unit tests — override auth in WebApplicationFactory:
        //   _factory.WithWebHostBuilder(b => b.ConfigureTestServices(services =>
        //   {
        //       services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, o =>
        //       {
        //           o.TokenValidationParameters = new TokenValidationParameters
        //           {
        //               ValidateIssuer = false,
        //               ValidateAudience = false,
        //               ValidateLifetime = false,
        //               SignatureValidator = (token, _) => new JwtSecurityToken(token)
        //           };
        //       });
        //   }));
        //   Then generate a token with: new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(...))
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "YOUR_TEST_TOKEN");

        var response = await client.GetAsync("/api/private");
        response.EnsureSuccessStatusCode();
    }
}
```

---

## Security Considerations

- **Never hardcode Domain or Audience** - Always use configuration (appsettings, User Secrets, environment variables)
- **Use HTTPS in production** - Auth0 requires HTTPS for token validation
- **Use minimal scopes** - Only request and enforce scopes your API actually needs
- **Keep packages updated** - Regularly update `Auth0.AspNetCore.Authentication.Api` for security patches

---

---

# Auth0 ASP.NET Core Web API Setup Guide

Setup instructions for ASP.NET Core Web API applications.

---

## Quick Setup (Automated)

Below uses the Auth0 CLI to create an Auth0 API resource and retrieve your credentials.

### Step 1: Install Auth0 CLI and create API resource

```bash
# Install Auth0 CLI (macOS)
brew install auth0/auth0-cli/auth0

# Login
auth0 login --no-input

# Create an Auth0 API resource
auth0 apis create \
  --name "My ASP.NET Core API" \
  --identifier https://my-api.example.com \
  --json
```

Note the `identifier` value - this is your Audience.

### Step 2: Add configuration

Once you have your Domain and Audience, add the following to `appsettings.json`:

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "Audience": "https://my-api.example.com"
  }
}
```

Replace `your-tenant.auth0.com` with your Auth0 tenant domain and `https://my-api.example.com` with the identifier you used when creating the API resource.

---

## Manual Setup

### Install Package

```bash
dotnet add package Auth0.AspNetCore.Authentication.Api
```

### Create Auth0 API Resource

1. Go to Auth0 Dashboard → Applications → APIs
2. Click **Create API**
3. Set a **Name** and an **Identifier** (e.g., `https://my-api.example.com`)
4. Note the Identifier - this is your `Audience`

### Configure appsettings.json

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "Audience": "https://my-api.example.com"
  }
}
```

**Important:** Domain format is `your-tenant.auth0.com` - do NOT include `https://`.

### Get Auth0 Configuration

- **Domain:** Auth0 Dashboard → Settings → Domain (or `auth0 tenants list`)
- **Audience:** The identifier you set when creating the API resource

### Using Environment Variables

For production/containers, set environment variables (these override appsettings.json):

```bash
export Auth0__Domain=your-tenant.auth0.com
export Auth0__Audience=https://my-api.example.com
```

Note the double underscore `__` separator for nested config in environment variables.

---

## Getting a Test Token

### Via Auth0 Dashboard

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Test** tab
4. Click **Copy Token** to get a test access token

### Via Auth0 CLI (Client Credentials)

```bash
# Get access token for testing
auth0 test token \
  --audience https://my-api.example.com
```

### Via curl (Client Credentials Flow)

```bash
curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-api.example.com",
    "grant_type": "client_credentials"
  }'
```

---

## Troubleshooting

**401 Unauthorized - "invalid_token":** Verify that the `Audience` in config exactly matches your API Identifier in Auth0 Dashboard.

**401 Unauthorized - "invalid_issuer":** Ensure `Domain` does not include `https://` - use `your-tenant.auth0.com` format only.

**HTTPS certificate errors locally:** Run `dotnet dev-certs https --trust` to trust the development certificate.

**Token expired:** Test tokens from the Dashboard are short-lived. Request a fresh token.

---
