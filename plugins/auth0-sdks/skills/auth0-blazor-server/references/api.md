# Auth0 Blazor Server API Reference

API reference for Blazor Server authentication.

---

## Configuration

```csharp
builder.Services.AddAuth0WebAppAuthentication(options =>
{
    options.Domain = "your-tenant.auth0.com";
    options.ClientId = "your-client-id";
    options.ClientSecret = "your-client-secret";
});
```

---

## Components

### AuthorizeView

```razor
<AuthorizeView>
    <Authorized>
        @context.User.Identity.Name
    </Authorized>
    <NotAuthorized>
        Not logged in
    </NotAuthorized>
</AuthorizeView>
```

---

## References

- Return to [main skill guide](../SKILL.md)
