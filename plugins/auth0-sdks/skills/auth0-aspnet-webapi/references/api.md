# Auth0 ASP.NET Core Web API API Reference

API reference for JWT authentication in Web APIs.

---

## Configuration

```csharp
builder.Services
    .AddAuthentication()
    .AddJwtBearer(options =>
    {
        options.Authority = $"https://{domain}";
        options.Audience = audience;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true
        };
    });
```

---

## Authorization

### Protect Endpoints

```csharp
[Authorize]
[HttpGet]
public IActionResult Protected() => Ok("Protected");
```

### Require Scopes

```csharp
[Authorize("read:admin")]
[HttpGet("admin")]
public IActionResult AdminOnly() => Ok("Admin");
```

---

## References

- Return to [main skill guide](../SKILL.md)
