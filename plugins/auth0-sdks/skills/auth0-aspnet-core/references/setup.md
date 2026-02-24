# Auth0 ASP.NET Core Setup Guide

Complete setup instructions for Auth0 with ASP.NET Core MVC.

---

## Quick Setup (Manual)

### Step 1: Install SDK

```bash
dotnet add package Auth0.AspNetCore.Authentication
```

### Step 2: Create Auth0 Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Applications**
3. Click **Create Application**
4. Choose:
   - Name: Your app name
   - Type: **Regular Web Applications**
5. Configure:
   - **Allowed Callback URLs**: `https://localhost:5001/callback`
   - **Allowed Logout URLs**: `https://localhost:5001/`
   - **Allowed Web Origins**: `https://localhost:5001`

### Step 3: Update appsettings.json

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "ClientId": "your-client-id",
    "ClientSecret": "your-client-secret"
  }
}
```

---

## Next Steps

1. Return to [main skill guide](../SKILL.md)
2. See [Integration Guide](integration.md) for protected routes
3. Check [API Reference](api.md) for complete SDK documentation
