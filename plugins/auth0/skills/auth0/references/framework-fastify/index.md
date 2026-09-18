
# Auth0 Fastify Integration

Add authentication to Fastify web applications using @auth0/auth0-fastify.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
>
> ```bash
> gh api repos/auth0/auth0-fastify/releases --jq '[.[] | select(.tag_name | startswith("auth0-fastify-v")) | .tag_name | ltrimstr("auth0-fastify-v")] | .[0]'
> ```
>
> Use the returned version in all `package.json` dependency lines instead of any hardcoded version below. Do **not** use `releases/latest` — that endpoint can return the sibling `auth0-fastify-api-v*` package's version instead.

## Critical rules

- **You MUST ask the user for explicit confirmation before running any setup step that writes to `.env`.** Never read the contents of `.env` during setup; if you believe you need to, ask the user for explicit permission first and wait for confirmation.
- To obtain a client secret, always have the user run `auth0 apps show <CLIENT_ID> --reveal-secrets` in their own terminal, rather than running `--reveal-secrets` from the agent — this keeps secrets out of agent context.

## Prerequisites

- Fastify application (v5.x or newer)
- Node.js 20 LTS or newer
- Auth0 **Regular Web Application** configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Next.js applications** - Use the Auth0 integration workflow for Next.js which handles both client and server
- **Mobile applications** - Use the Auth0 integration workflow for React Native/Expo
- **Stateless APIs** - Use `@auth0/auth0-fastify-api` instead for JWT validation without sessions
- **Microservices** - Use JWT validation for service-to-service auth

## Quick Start Workflow

### 1. Install SDK

```bash
npm install @auth0/auth0-fastify fastify @fastify/view ejs dotenv
```

### 2. Configure Environment

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
SESSION_SECRET=<openssl-rand-hex-64>
APP_BASE_URL=http://localhost:3000
```

Generate secret: `openssl rand -hex 64`

> `AUTH0_DOMAIN` is the bare hostname — no `https://` prefix and no trailing slash.

### 3. Configure Auth Plugin

Create your Fastify server (`server.js`):

```javascript
import 'dotenv/config';
import Fastify from 'fastify';
import fastifyAuth0 from '@auth0/auth0-fastify';
import fastifyView from '@fastify/view';
import ejs from 'ejs';

const fastify = Fastify({ logger: true });

// Register view engine
await fastify.register(fastifyView, {
  engine: { ejs },
  root: './views',
});

// Configure Auth0 plugin
await fastify.register(fastifyAuth0, {
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl: process.env.APP_BASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
});

fastify.listen({ port: 3000 });
```

This automatically registers (because `mountRoutes` defaults to `true`):

- `GET /auth/login` - redirects to Auth0 Universal Login. Accepts a `?returnTo=` query param, which the SDK sanitises against `appBaseUrl` before use.
- `GET /auth/callback` - handles the OAuth callback, creates the session, and redirects to the `returnTo` captured at login.
- `GET /auth/logout` - clears the session and redirects to the Auth0 logout endpoint.
- `POST /auth/backchannel-logout` - receives OIDC back-channel logout tokens from Auth0.

Set `mountRoutes: false` to register none of them and roll your own.

### 4. Add Routes

```javascript
// Public route
fastify.get('/', async (request, reply) => {
  const session = await fastify.auth0Client.getSession({ request, reply });
  return reply.viewAsync('home.ejs', {
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
  return reply.viewAsync('profile.ejs', { user });
});
```

### 5. Test Authentication

```bash
node server.js
```

Visit `http://localhost:3000` and verify each of these in order:

1. Clicking login redirects to the Auth0 Universal Login page.
2. After authenticating, you land back on the app with a session established.
3. `/profile` renders the user's name and email; visiting it while logged out redirects to login.
4. Logout clears the session and returns you to the home page in a logged-out state.

If step 1 or 2 fails, read the server logs before changing code — a callback URL mismatch is by far the most common cause, and it reports itself explicitly. Confirm the URL Auth0 rejected matches an entry in Allowed Callback URLs exactly, including scheme, port, and path.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Callback URL mismatch | The redirect URI is `<appBaseUrl>` + the `callback` route path (`/auth/callback` by default). Add that exact URL (note the `/auth/` prefix) to Allowed Callback URLs in the Auth0 Dashboard |
| App created as SPA or Native type | Must be **Regular Web Application** — other types have no usable client secret for the code exchange |
| Session secret exposed in code | Always use environment variables, never hardcode secrets |
| `https://` prefix or trailing slash in `AUTH0_DOMAIN` | Use the bare hostname (`your-tenant.auth0.com`) |
| Wrong `appBaseUrl` for production | Update `APP_BASE_URL` to match your production origin — it drives both the redirect URI and the post-logout return URL |
| Reading `fastify.auth0Client` before the plugin loads | Fastify defers plugin registration until `ready()`/`listen()`. Route handlers always see the decorator; setup-time code needs `await fastify.register(...)` |
| Treating `getAccessToken()`'s result as a string | It resolves to a `TokenSet` — read `.accessToken` off it |

## Related Skills

- Auth0 setup → set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Migrate from another auth provider → migration (migrate)
- Multi-factor authentication → ask for MFA (feature:mfa)
- Manage Auth0 resources from the terminal → the Auth0 CLI (`tooling-cli`)

## Quick Reference

**Plugin Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `domain` | Yes | Auth0 tenant domain, or a `DomainResolver` function for multi-custom-domain setups |
| `clientId` | Yes | Auth0 application Client ID |
| `clientSecret` | No* | Client Secret. *Required unless you authenticate with `clientAssertionSigningKey` (private key JWT) |
| `appBaseUrl` | Conditional | Application origin (e.g. `http://localhost:3000`). **Required when `domain` is a string.** Optional when `domain` is a resolver function — then it is inferred per request from the host/proto headers |
| `sessionSecret` | Yes | Session encryption secret (required, min 64 chars) — `openssl rand -hex 64` generates a 128-character one |
| `audience` | No | API identifier — set it to have the SDK request an access token for that API at login |
| `mountRoutes` | No | Mount the built-in login/callback/logout/back-channel-logout routes. Default `true` |
| `routes` | No | Override individual route paths. Keys: `login`, `callback`, `logout`, `backchannelLogout` |
| `pushedAuthorizationRequests` | No | Use PAR for the authorization request |
| `sessionConfiguration` | No | `rolling` (default `true`), `absoluteDuration` (default 3 days), `inactivityDuration` (default 1 day), and `cookie` options — all durations in seconds |
| `sessionStore` | No | Custom server-side session store; defaults to a stateless encrypted cookie. **Required for back-channel logout** — the default stateless store cannot revoke sessions by logout token; provide a stateful store that implements `deleteByLogoutToken` to support `/auth/backchannel-logout` |
| `customFetch` | No | Replacement `fetch` implementation (proxies, retries, instrumentation) |
| `discoveryCache` | No | TTL config (seconds) for cached OIDC discovery metadata and JWKS |

**Client Methods** — all on `fastify.auth0Client` after registration:
- `getSession({ request, reply })` - resolves to `SessionData` or `undefined` (when not authenticated). Carries `user`, `idToken`, `refreshToken`, `tokenSets`
- `getUser({ request, reply })` - resolves to `UserClaims` or `undefined` — the user's ID token claims (`sub`, `name`, `email`, `picture`, `org_id`, …)
- `getAccessToken({ request, reply })` - resolves to a `TokenSet`; read the token from `.accessToken` (also carries `audience`, `scope`, `expiresAt`). Optionally takes `{ audience, scope }` as a first argument. **Note:** requesting a different `audience` than the one configured at plugin registration requires Multi-Resource Refresh Tokens (MRRT) to be enabled on the Auth0 tenant — without it Auth0 rejects the token exchange. If the user logged in before `audience` was configured, they must re-login to pick up the new audience
- `logout({ returnTo }, { request, reply })` - resolves to a `URL` — the Auth0 logout URL; redirect with `logoutUrl.href`

**Common Use Cases:**
- Protected routes → use `preHandler` to check the session (see Step 4)
- Check auth status → `!!session`
- Get user info → `getUser({ request, reply })`
- Call APIs → set `audience`, then `getAccessToken({ request, reply })`

## References

- [Auth0 Fastify Documentation](https://auth0.com/docs/quickstart/webapp/fastify)
- [SDK GitHub Repository](https://github.com/auth0/auth0-fastify)
- [SDK Examples](https://github.com/auth0/auth0-fastify/blob/main/packages/auth0-fastify/EXAMPLES.md)
