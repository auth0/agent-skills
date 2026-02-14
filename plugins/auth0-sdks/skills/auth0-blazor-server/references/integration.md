# Auth0 Blazor Server Integration Guide

Advanced patterns for Blazor Server authentication.

---

## Protected Components

### Using AuthorizeView

```razor
<AuthorizeView>
    <Authorized>
        <h3>Welcome @context.User.Identity.Name</h3>
    </Authorized>
    <NotAuthorized>
        <p>Please log in</p>
    </NotAuthorized>
</AuthorizeView>
```

### Authorize Attribute on Pages

```razor
@page "/profile"
@attribute [Authorize]

<h3>User Profile</h3>
```

---

## Access User Claims

```razor
@inject AuthenticationStateProvider AuthenticationStateProvider

@code {
    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthenticationStateProvider.GetAuthenticationStateAsync();
        var user = authState.User;

        if (user.Identity.IsAuthenticated)
        {
            var email = user.FindFirst("email")?.Value;
        }
    }
}
```

---

## References

- Return to [main skill guide](../SKILL.md)
