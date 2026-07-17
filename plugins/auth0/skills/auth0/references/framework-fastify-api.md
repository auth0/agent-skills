
# Auth0 Fastify API Integration

Protect Fastify API endpoints with JWT access token validation using @auth0/auth0-fastify-api.


## Prerequisites

- Fastify API application (v5.x or newer)
- Node.js 20 LTS or newer
- Auth0 API configured (not Application - must be API resource)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Server-rendered web applications** - Use `@auth0/auth0-fastify` for session-based auth
- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Next.js applications** - Use the Auth0 integration workflow for Next.js
- **Mobile applications** - Use the Auth0 integration workflow for React Native/Expo


## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-fastify-api fastify dotenv
```

### 2. Create Auth0 API

You need an **API** (not Application) in Auth0:

```bash
# Using Auth0 CLI
auth0 apis create \
  --name "My Fastify API" \
  --identifier https://my-api.example.com
```

Or create manually in Auth0 Dashboard → Applications → APIs

### 3. Configure Environment

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://my-api.example.com
```

### 4. Configure Auth Plugin

Create your Fastify server (`server.js`):

```javascript
import 'dotenv/config';
import Fastify from 'fastify';
import fastifyAuth0Api from '@auth0/auth0-fastify-api';

const fastify = Fastify({ logger: true });

// Register Auth0 API plugin
await fastify.register(fastifyAuth0Api, {
  domain: process.env.AUTH0_DOMAIN,
  audience: process.env.AUTH0_AUDIENCE,
});

fastify.listen({ port: 3001 });
```

### 5. Protect Routes

```javascript
// Public route - no authentication
fastify.get('/api/public', async (request, reply) => {
  return {
    message: 'Hello from a public endpoint!',
    timestamp: new Date().toISOString(),
  };
});

// Protected route - requires valid JWT
fastify.get('/api/private', {
  preHandler: fastify.requireAuth()
}, async (request, reply) => {
  return {
    message: 'Hello from a protected endpoint!',
    user: request.user.sub,
    timestamp: new Date().toISOString(),
  };
});

// Protected route with user info
fastify.get('/api/profile', {
  preHandler: fastify.requireAuth()
}, async (request, reply) => {
  return {
    // Return only the fields the client needs. Returning the whole decoded
    // token (request.user) exposes every claim — permissions, custom
    // namespaces, and token metadata — to the client.
    profile: { sub: request.user.sub, scope: request.user.scope },
  };
});
```

### 6. Test API

Test public endpoint:

```bash
curl http://localhost:3001/api/public
```

Test protected endpoint (requires access token):

```bash
curl http://localhost:3001/api/private \
  -H "Authorization: Bearer $TOKEN"
```

> Capture the token into a shell variable (`TOKEN=$(...)`) and reference
> `$TOKEN` rather than pasting the raw token inline — inline token values leak
> into shell history and terminal scrollback.


## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Created Application instead of API in Auth0 | Must create API resource in Auth0 Dashboard → Applications → APIs |
| Missing Authorization header | Include `Authorization: Bearer <token>` in all protected endpoint requests |
| Wrong audience in token | Client must request token with matching `audience` parameter |
| Using ID token instead of access token | Must use **access token** for API auth, not ID token |
| Not handling 401/403 errors | Implement proper error handling for unauthorized/forbidden responses |


## Related Capabilities

- Basic Auth0 setup → set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Server-rendered Fastify web apps with sessions → use the Auth0 integration workflow for Fastify (session-based)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)


## Quick Reference

**Plugin Options:**
- `domain` - Auth0 tenant domain (required)
- `audience` - API identifier from Auth0 API settings (required)

**Request Properties:**
- `request.user` - Decoded JWT claims object
- `request.user.sub` - User ID (subject)

**Middleware:**
- `fastify.requireAuth()` - Protect route with JWT validation
- `fastify.requireAuth({ scopes: 'read:data' })` - Require specific scope
- `fastify.requireAuth({ scopes: ['read:data', 'write:data'] })` - Require specific scopes

**Common Use Cases:**
- Protect routes → Use `preHandler: fastify.requireAuth()` (see Step 5)
- Get user ID → `request.user.sub`
- Custom claims → Access via `request.user['namespace/claim']`


## References

- [Auth0 Fastify API Documentation](https://auth0.com/docs/quickstart/backend/fastify)
- [SDK GitHub Repository](https://github.com/auth0/auth0-fastify)
- [Access Tokens Guide](https://auth0.com/docs/secure/tokens/access-tokens)
