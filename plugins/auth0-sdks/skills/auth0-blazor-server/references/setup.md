# Auth0 Blazor Server Setup Guide

Setup instructions for Auth0 with Blazor Server.

---

## Quick Setup

### Step 1: Install SDK

```bash
dotnet add package Auth0.AspNetCore.Authentication
```

### Step 2: Configure appsettings.json

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "ClientId": "your-client-id",
    "ClientSecret": "your-client-secret"
  }
}
```

### Step 3: Create Auth0 Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Create **Regular Web Application**
3. Configure:
   - **Allowed Callback URLs**: `https://localhost:5001/callback`
   - **Allowed Logout URLs**: `https://localhost:5001/`

---

## Next Steps

- Return to [main skill guide](../SKILL.md)
- See [Integration Guide](integration.md)
