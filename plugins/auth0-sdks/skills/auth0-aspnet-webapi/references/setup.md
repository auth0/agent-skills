# Auth0 ASP.NET Core Web API Setup Guide

Setup instructions for Auth0 with ASP.NET Core Web API.

---

## Quick Setup

### Step 1: Install SDK

```bash
dotnet add package Auth0.AspNetCore.Authentication.Api
```

### Step 2: Create Auth0 API

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **APIs**
3. Click **Create API**
4. Enter:
   - **Name**: Your API name
   - **Identifier**: `https://your-api-identifier` (this is your audience)
5. Click **Create**

### Step 3: Configure appsettings.json

```json
{
  "Auth0": {
    "Domain": "your-tenant.auth0.com",
    "Audience": "https://your-api-identifier"
  }
}
```

---

## Next Steps

- Return to [main skill guide](../SKILL.md)
- See [Integration Guide](integration.md) for scopes
