# Setup: @auth0/auth0-hono

Configure environment, install dependencies, Auth0 dashboard setup, and multi-runtime deployment.

## Install Dependencies

Install the Auth0 Hono SDK and required peer dependencies:

```bash
npm install @auth0/auth0-hono hono @hono/node-server
```

Verify your `package.json` includes the ESM module type:

```json
{
  "type": "module"
}
```

If not present, add it:

```bash
npm pkg set type=module
```

## Environment Variables

Set up the following environment variables in a `.env` file (never commit this to version control):

```bash
# Auth0 tenant domain (e.g., your-tenant.us.auth0.com)
AUTH0_DOMAIN=your-tenant.us.auth0.com

# Auth0 application credentials (use capital ID)
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>

# Your application URL
APP_BASE_URL=http://localhost:3000

# Session encryption key (generate via: openssl rand -hex 32)
AUTH0_SESSION_ENCRYPTION_KEY=<32-character-hex-string>
```

**Session encryption key:** Must be at least 32 characters. Generate a secure random value:

```bash
openssl rand -hex 32
```

## Auth0 Dashboard Configuration

1. **Create or select a Regular Web Application** (NOT a Single Page Application)
   - Navigate to Applications → Applications in the Auth0 Dashboard
   - Click Create Application
   - Choose "Regular Web Application"

2. **Configure Allowed Callback URLs**
   - Add: `http://localhost:3000/callback` (for development)
   - Add your production callback URL after deployment

3. **Configure Allowed Logout URLs**
   - Add: `http://localhost:3000` (for development)
   - Add your production base URL after deployment

4. **Configure Allowed Web Origins**
   - Add: `http://localhost:3000` (for development)
   - Add your production origin after deployment

5. **Save your credentials**
   - Copy `Domain`, `Client ID`, and `Client Secret` to your `.env` file

## Node.js Setup

Create a minimal Hono server with Auth0 middleware:

```typescript
import { Hono } from 'hono';
import { auth0 } from '@auth0/auth0-hono';
import { serve } from '@hono/node-server';

const app = new Hono();

// Add Auth0 middleware to all routes
app.use('*', auth0({
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  baseURL: process.env.APP_BASE_URL,
  session: {
    secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY,
  },
}));

// Example route
app.get('/', (c) => {
  return c.text('Hello, Hono!');
});

serve({
  fetch: app.fetch,
  port: 3000,
});
```

The `auth0()` middleware automatically creates three routes:
- `/login` - Initiates the Auth0 login flow
- `/logout` - Clears the session and logs out the user
- `/callback` - OAuth callback URL where Auth0 redirects after authentication

## Cloudflare Workers Setup

For Cloudflare Workers, use the `honoEnv` helper to inject environment bindings:

```typescript
import { Hono } from 'hono';
import { auth0 } from '@auth0/auth0-hono';
import { env } from '@auth0/auth0-hono/lib/honoEnv';

type Bindings = {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_CLIENT_SECRET: string;
  APP_BASE_URL: string;
  AUTH0_SESSION_ENCRYPTION_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', auth0({
  domain: env(c).AUTH0_DOMAIN,
  clientID: env(c).AUTH0_CLIENT_ID,
  clientSecret: env(c).AUTH0_CLIENT_SECRET,
  baseURL: env(c).APP_BASE_URL,
  session: {
    secret: env(c).AUTH0_SESSION_ENCRYPTION_KEY,
  },
}));

export default app;
```

In `wrangler.toml`, configure environment variables:

```toml
[env.development]
vars = { AUTH0_DOMAIN = "your-tenant.us.auth0.com", APP_BASE_URL = "http://localhost:3000" }
secrets = ["AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SESSION_ENCRYPTION_KEY"]
```

## Deno Setup

Use npm imports with Deno:

```typescript
import { Hono } from 'npm:hono@3';
import { auth0 } from 'npm:@auth0/auth0-hono';

const app = new Hono();

app.use('*', auth0({
  domain: Deno.env.get('AUTH0_DOMAIN'),
  clientID: Deno.env.get('AUTH0_CLIENT_ID'),
  clientSecret: Deno.env.get('AUTH0_CLIENT_SECRET'),
  baseURL: Deno.env.get('APP_BASE_URL'),
  session: {
    secret: Deno.env.get('AUTH0_SESSION_ENCRYPTION_KEY'),
  },
}));

Deno.serve({ port: 3000 }, app.fetch);
```

Run with: `deno run --allow-net --allow-env server.ts`

## Bun Setup

Install using Bun's package manager:

```bash
bun add @auth0/auth0-hono hono
```

Bun natively supports `process.env`, so configuration is the same as Node.js:

```typescript
import { Hono } from 'hono';
import { auth0 } from '@auth0/auth0-hono';

const app = new Hono();

app.use('*', auth0({
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  baseURL: process.env.APP_BASE_URL,
  session: {
    secret: process.env.AUTH0_SESSION_ENCRYPTION_KEY,
  },
}));

export default app;
```

Start: `bun run server.ts`

## Verify Setup

1. Start your server:
   ```bash
   node server.ts  # Or: deno run --allow-net --allow-env server.ts
   ```

2. Visit `http://localhost:3000/login` in your browser

3. You should be redirected to Auth0's login page

4. After successful login, you'll be redirected back to your app with a session cookie set

## Common Setup Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot callback URL in Auth0 Dashboard | Add `/callback` path to Allowed Callback URLs (e.g., `http://localhost:3000/callback`) |
| Missing or weak `AUTH0_SESSION_ENCRYPTION_KEY` | Generate 32+ character secret with `openssl rand -hex 32` |
| App created as SPA type | Must be Regular Web Application type for server-side sessions |
| Secrets hardcoded in code | Always use environment variables; add `.env` to `.gitignore` |
| Wrong `APP_BASE_URL` for production | Update to match your production domain |
| Package.json missing `"type": "module"` | SDK is ESM-only; add this field and use `import` statements |
| Runtime mismatch (require() in Node context) | Use ESM imports only: `import { auth0 } from '@auth0/auth0-hono'` |

