# Auth0 Express API SDK Setup Guide

Setup instructions for Express.js API applications using `@auth0/auth0-express-api`.

---

## Step 1: Register an API in Auth0

You need an **API** (Resource Server) in Auth0, not just an Application.

**Using Auth0 CLI:**

```bash
# Install Auth0 CLI if needed
brew install auth0/auth0-cli/auth0  # macOS
# or: npm install -g @auth0/auth0-cli

auth0 login

# Create an API
auth0 apis create \
  --name "My Express API" \
  --identifier "https://my-express-api" \
  --scopes "read:data,write:data"
```

**Using Auth0 Dashboard:**

1. Go to [Auth0 Dashboard](https://manage.auth0.com) → Applications → APIs
2. Click **Create API**
3. Set **Name** (e.g. "My Express API")
4. Set **Identifier** (e.g. `https://my-express-api`) — this is your audience
5. Click **Create**

---

## Step 2: Configure Environment

**Never read the contents of `.env` or `.env.local` during setup.** The file may contain sensitive secrets.

Create `.env`:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://your-api-identifier
```

Get your domain from Auth0 Dashboard → Settings, or run:

```bash
auth0 tenants list
```

---

## Step 3: Install and Configure

```bash
npm install @auth0/auth0-express-api@beta dotenv
```

```javascript
import 'dotenv/config';
import express from 'express';
import { createAuth0Api } from '@auth0/auth0-express-api';

const app = express();

app.use(createAuth0Api());
```

---

## Migration from express-oauth2-jwt-bearer

| Old | New |
|-----|-----|
| `import { auth } from 'express-oauth2-jwt-bearer'` | `import { createAuth0Api } from '@auth0/auth0-express-api'` |
| `app.use(auth())` | `app.use(createAuth0Api())` |
| `import { requiredScopes } from 'express-oauth2-jwt-bearer'` | `import { scopesInclude } from '@auth0/auth0-express-api'` |
| `requiredScopes('read:data write:data')` | `scopesInclude('read:data write:data', { match: 'all' })` |
| `req.auth.payload.sub` | `req.auth0.user.sub` |
| `ISSUER_BASE_URL=https://...` | `AUTH0_DOMAIN=your-tenant.auth0.com` |
| `AUDIENCE=https://...` | `AUTH0_AUDIENCE=https://...` |

> Legacy env var names `ISSUER_BASE_URL` and `AUDIENCE` are still supported for compatibility.

---

## Obtaining Test Tokens

For manual testing, get a token from Auth0 Dashboard:

1. Go to Auth0 Dashboard → Applications → APIs → your API → **Test** tab
2. Copy the access token shown in the curl example

Or use the Auth0 CLI:

```bash
auth0 test token --audience "https://your-api-identifier" --scopes "read:data"
```

---

## Troubleshooting

**`401 Unauthorized` — "Audience mismatch"**
The `AUTH0_AUDIENCE` value doesn't match the API Identifier exactly. Copy it from Auth0 Dashboard → APIs → your API.

**`Error: Invalid URL` at startup**
Check that `AUTH0_DOMAIN` is just the domain (e.g. `tenant.auth0.com`) without `https://`.

**`.env` not loading**
Add `import 'dotenv/config'` as the **first line** of your entry file.

---

## Next Steps

- [Integration Patterns](integration.md)
- [API Reference](api.md)
- [Main Skill](../SKILL.md)
