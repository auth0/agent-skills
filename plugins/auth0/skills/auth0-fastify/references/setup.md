# Setup Guide

## Automated Setup with Auth0 CLI

```bash
# 1. Authenticate
auth0 login

# 2. Create a Regular Web Application
auth0 apps create \
  --name "My Fastify App" \
  --type regular \
  --callbacks "http://localhost:3000/auth/callback" \
  --logout-urls "http://localhost:3000" \
  --origins "http://localhost:3000" \
  --reveal-secrets

# 3. Copy the Domain, Client ID, and Client Secret from the output into .env
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AUTH0_DOMAIN` | Auth0 tenant domain (e.g. `dev-abc123.us.auth0.com`) — no `https://` prefix |
| `AUTH0_CLIENT_ID` | Application Client ID from Auth0 Dashboard |
| `AUTH0_CLIENT_SECRET` | Application Client Secret — never commit to source control |
| `SESSION_SECRET` | Encryption key for session cookies — generate with `openssl rand -hex 64` |
| `APP_BASE_URL` | Full application URL including protocol and port (e.g. `http://localhost:3000`) |

## Production Configuration

Update `.env` for production:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-production-client-id
AUTH0_CLIENT_SECRET=your-production-client-secret
SESSION_SECRET=<new-production-secret>
APP_BASE_URL=https://your-production-domain.com
```

Update the Auth0 Dashboard to include your production callback URL (`https://your-production-domain.com/auth/callback`) in Allowed Callback URLs and your production domain in Allowed Logout URLs and Allowed Web Origins.
