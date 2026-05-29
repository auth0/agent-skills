---
name: auth0-fastify
description: "Use when adding authentication to Fastify web applications — integrates @auth0/auth0-fastify for session-based login, logout, OAuth callback handling, user profile retrieval, and access token management. Registers /auth/login, /auth/logout, and /auth/callback routes automatically. For stateless Fastify APIs receiving JWT Bearer tokens, use auth0-fastify-api instead."
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F510"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0 Fastify Integration

Add session-based authentication to Fastify web applications using @auth0/auth0-fastify.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```
> gh api repos/auth0/auth0-fastify/releases/latest --jq '.tag_name'
> ```

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-fastify fastify @fastify/view ejs dotenv
```

### 2. Configure Environment

**For automated setup with Auth0 CLI**, see [Setup Guide](references/setup.md).

**For manual setup**, create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
SESSION_SECRET=<openssl-rand-hex-64>
APP_BASE_URL=http://localhost:3000
```

Generate secret: `openssl rand -hex 64`

**Verify before proceeding:** In the Auth0 Dashboard, confirm the application is set to **Regular Web Application** (not SPA) and that `http://localhost:3000/auth/callback` is listed in Allowed Callback URLs, `http://localhost:3000` in Allowed Logout URLs and Allowed Web Origins.

### 3. Configure Auth Plugin

Create your Fastify server (`server.js`):

```javascript
import 'dotenv/config';
import Fastify from 'fastify';
import fastifyAuth0 from '@auth0/auth0-fastify';
import fastifyView from '@fastify/view';
import ejs from 'ejs';

const fastify = Fastify({ logger: true });

await fastify.register(fastifyView, {
  engine: { ejs },
  root: './views',
});

await fastify.register(fastifyAuth0, {
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl: process.env.APP_BASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
});

fastify.listen({ port: 3000 });
```

This automatically registers:
- `/auth/login` — Redirects to Auth0 Universal Login
- `/auth/logout` — Clears session and redirects to Auth0 logout
- `/auth/callback` — Handles OAuth callback and creates session

### 4. Add Routes

```javascript
// Public route
fastify.get('/', async (request, reply) => {
  const session = await fastify.auth0Client.getSession({ request, reply });
  return reply.view('views/home.ejs', {
    isAuthenticated: !!session,
  });
});

// Protected route
fastify.get('/profile', {
  preHandler: async (request, reply) => {
    const session = await fastify.auth0Client.getSession({ request, reply });
    if (!session) {
      return reply.redirect('/auth/login');
    }
  }
}, async (request, reply) => {
  const user = await fastify.auth0Client.getUser({ request, reply });
  return reply.view('views/profile.ejs', { user });
});
```

### 5. Test Authentication

```bash
node server.js
```

Visit `http://localhost:3000` and verify:
1. Clicking login redirects to Auth0 Universal Login
2. After login, you are redirected back with a valid session
3. `/profile` shows user info when authenticated
4. Logout clears the session and redirects home

If login redirects fail, check the server logs for callback URL mismatch errors — the most common cause is a missing or incorrect Allowed Callback URL in the Auth0 Dashboard.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Callback URL mismatch | Add `http://localhost:3000/auth/callback` to Allowed Callback URLs in Auth0 Dashboard |
| App created as SPA type | Must be **Regular Web Application** for server-side session auth |
| Weak SESSION_SECRET | Generate with `openssl rand -hex 64` — minimum 64 characters |
| Not awaiting `fastify.register` | Fastify v4+ requires `await` on plugin registration |

---

## Detailed Documentation

- **[Setup Guide](references/setup.md)** — Automated setup with Auth0 CLI, environment configuration
- **[Integration Guide](references/integration.md)** — Protected routes with preHandlers, calling APIs with access tokens, error handling
- **[API Reference](references/api.md)** — Plugin options, client methods, session management

---

## References

- [Auth0 Fastify Documentation](https://auth0.com/docs/quickstart/webapp/fastify)
- [SDK GitHub Repository](https://github.com/auth0/auth0-fastify)
