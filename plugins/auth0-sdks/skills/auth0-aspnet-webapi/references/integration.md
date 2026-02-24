# Auth0 ASP.NET Core Web API Integration Guide

Advanced patterns for Web API authentication.

---

## Access Token Claims

```csharp
[Authorize]
[HttpGet]
public IActionResult GetUserInfo()
{
    var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var scopes = User.FindAll("scope").Select(c => c.Value);

    return Ok(new { UserId = userId, Scopes = scopes });
}
```

---

## Scope-Based Authorization

### Define Policies

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("read:messages", policy =>
        policy.RequireClaim("scope", "read:messages"));

    options.AddPolicy("write:messages", policy =>
        policy.RequireClaim("scope", "write:messages"));
});
```

### Use Policies

```csharp
[HttpGet]
[Authorize("read:messages")]
public IActionResult GetMessages() => Ok(messages);

[HttpPost]
[Authorize("write:messages")]
public IActionResult CreateMessage([FromBody] Message msg) => Created("", msg);
```

---

## CORS Configuration

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSPA", builder =>
    {
        builder.WithOrigins("http://localhost:3000")
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

app.UseCors("AllowSPA");
```

---

## References

- Return to [main skill guide](../SKILL.md)
