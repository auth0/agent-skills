# Auth0 ASP.NET Core API Reference

Complete API reference for Auth0.AspNetCore.Authentication SDK.

---

## Configuration

### AddAuth0WebAppAuthentication()

```csharp
builder.Services.AddAuth0WebAppAuthentication(options =>
{
    options.Domain = "your-tenant.auth0.com";
    options.ClientId = "your-client-id";
    options.ClientSecret = "your-client-secret";
    options.Scope = "openid profile email";
});
```

---

## Authentication

### Login

```csharp
var authProperties = new LoginAuthenticationPropertiesBuilder()
    .WithRedirectUri("/")
    .Build();

await HttpContext.ChallengeAsync(
    Auth0Constants.AuthenticationScheme,
    authProperties);
```

### Logout

```csharp
var authProperties = new LogoutAuthenticationPropertiesBuilder()
    .WithRedirectUri("/")
    .Build();

await HttpContext.SignOutAsync(Auth0Constants.AuthenticationScheme, authProperties);
await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
```

---

## User Information

### Access User Claims

```csharp
var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
var email = User.FindFirst(ClaimTypes.Email)?.Value;
var name = User.Identity.Name;
```

---

## References

- [SDK GitHub Repository](https://github.com/auth0/auth0-aspnetcore-authentication)
- Return to [main skill guide](../SKILL.md)
