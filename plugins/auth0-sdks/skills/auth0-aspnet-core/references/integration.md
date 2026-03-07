# Auth0 ASP.NET Core Integration Guide

Advanced patterns for Auth0 in ASP.NET Core MVC.

---

## Protected Routes

### Using [Authorize] Attribute

```csharp
[Authorize]
public class DashboardController : Controller
{
    public IActionResult Index()
    {
        return View();
    }
}
```

### Protect Specific Actions

```csharp
public class HomeController : Controller
{
    public IActionResult Index() => View();

    [Authorize]
    public IActionResult Profile()
    {
        return View();
    }
}
```

---

## Working with Claims

### Access User Claims

```csharp
[Authorize]
public IActionResult Profile()
{
    var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    var email = User.FindFirst(ClaimTypes.Email)?.Value;
    var name = User.Identity.Name;

    return View(new ProfileViewModel
    {
        UserId = userId,
        Email = email,
        Name = name
    });
}
```

---

## Authorization Policies

### Define Policies

```csharp
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireAdminRole", policy =>
        policy.RequireRole("Admin"));
});
```

### Use Policies

```csharp
[Authorize(Policy = "RequireAdminRole")]
public IActionResult AdminDashboard()
{
    return View();
}
```

---

## References

- Return to [main skill guide](../SKILL.md)
- [ASP.NET Core Authorization](https://docs.microsoft.com/aspnet/core/security/authorization/)
