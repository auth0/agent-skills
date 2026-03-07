# Auth0 Cap'n Web Setup Guide

Setup instructions for Auth0 with Cap'n Web RPC.

---

## Quick Setup

### Step 1: Install Dependencies

```bash
npm install capnweb ws @auth0/auth0-spa-js jsonwebtoken jwks-rsa dotenv
```

### Step 2: Create Auth0 Resources

**Create Application (SPA):**
1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Create **Single Page Application**
3. Configure:
   - **Allowed Callback URLs**: `http://localhost:5173`
   - **Allowed Logout URLs**: `http://localhost:5173`
   - **Allowed Web Origins**: `http://localhost:5173`

**Create API:**
1. Navigate to **Applications** → **APIs**
2. Click **Create API**
3. Enter identifier: `https://your-api-identifier`

### Step 3: Configure Environment

```bash
# Client (.env)
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://your-api-identifier

# Server (.env)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
```

---

## Next Steps

- Return to [main skill guide](../SKILL.md)
- See [Integration Guide](integration.md)
