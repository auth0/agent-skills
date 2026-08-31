
# Auth0 node-auth0 Integration

Administer an Auth0 tenant from server-side Node.js / TypeScript with the
`auth0` npm package (the node-auth0 SDK): read and write users, applications,
connections, roles, organizations, actions, resource servers, and everything
else the Auth0 Dashboard exposes, through the Management API.

> **Authentication lives in separate packages.** node-auth0 covers the
> Management API only - it does not sign users in or issue tokens. For
> authentication (OAuth token grants, database signup, passwordless, MFA
> challenges, or reading a user's profile from an access token) use
> `@auth0/auth0-auth-js` for stateless token/OAuth operations or
> `@auth0/auth0-server-js` for stateful server sessions. Both sit alongside
> node-auth0 in the same project when you need administration and
> authentication together.

> **Agent instruction:** Before providing SDK setup instructions, fetch the
> latest release version by running:
> ```
> gh api repos/auth0/node-auth0/releases/latest --jq '.tag_name'
> ```
> Use the returned version instead of any version shown below.

## Critical rules

- **Never read the contents of `.env*` during setup** - it may contain secrets
  that should not be exposed in the LLM context. Before writing to any env file
  you MUST ask the user for explicit confirmation and wait for it.
- **The npm package is `auth0`, not `@auth0/node-auth0`.** Install with
  `npm install auth0` and import `{ ManagementClient } from "auth0"`.
  `node-auth0` is only the GitHub repo slug; `@auth0/node-auth0` does not exist.
- **The Client Secret is a tenant-admin credential.** Load it from an
  environment variable, keep `.env` out of git, and run the SDK server-side
  only. Never hardcode it, print it, or ship it to a browser or mobile client.
- **Grant the M2M app the least Management scope the task needs** (e.g. just
  `read:users` for a reporting script). Do not authorize broad scopes like
  `delete:users` where a read-only scope suffices.

## Prerequisites

- Node.js `^20.19.0 || ^22.12.0 || ^24.0.0 || ^26.0.0`.
- A Machine-to-Machine (M2M) application authorized for the Auth0 Management API
  with the scopes the task needs. The SDK uses its client credentials to fetch
  and cache its own management token. If the app does not exist yet, create and
  authorize it with the loaded tooling reference (see step 2 below).

## When NOT to use

node-auth0 is a Management-API-only SDK. It does not sign users in, hold
sessions, or validate access tokens for your endpoints. Route elsewhere for:

- **End-user login, signup, or sessions** - use the app's framework SDK. Use the
  Auth0 integration workflow for Next.js, React, Vue, Angular, Express, the
  mobile SDKs, and so on; those own the redirect, callback, cookies, and token
  storage.
- **Authentication API operations** - token grants, database signup,
  passwordless, MFA challenges, or reading a user's profile from an access token
  - use `@auth0/auth0-auth-js` or `@auth0/auth0-server-js` (see the callout at
  the top).
- **Protecting an API by validating incoming JWTs** - use
  `express-oauth2-jwt-bearer` (the Express API integration workflow) or the
  framework's resource-server SDK.

## Quick start workflow

### 1. Install the SDK

```bash
npm install auth0
```

### 2. Configure credentials

The ManagementClient authenticates as the M2M app using the client-credentials
grant, so it needs the tenant Domain, Client ID, and Client Secret in the
environment.

For all Auth0 tenant configuration (create the M2M app, authorize it for the
Management API, choose scopes), use the loaded tooling reference: the Auth0 CLI
(`tooling-cli`), MCP (`tooling-mcp`), or Terraform (`tooling-terraform`). Do not
inline setup here. Once the app exists, put its credentials in `.env`:

```env
AUTH0_DOMAIN=<your-tenant-domain>
AUTH0_CLIENT_ID=<your-m2m-client-id>
AUTH0_CLIENT_SECRET=<your-m2m-client-secret>
```

**Domain must be a bare hostname** - no `https://`, no path, no trailing slash.
The client rejects a domain that contains a scheme or slashes.

### 3. Initialize the ManagementClient

The SDK fetches and caches its own Management API token internally, refreshing
shortly before expiry. You do not pre-fetch a token and need no auth package for
this.

```ts
import { ManagementClient } from "auth0";

const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,        // bare hostname, e.g. tenant.us.auth0.com
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});
```

If you already hold a Management API token minted elsewhere, pass it instead of
the client credentials - the SDK uses it as-is and will not refresh it:

```ts
const management = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN!,
  token: process.env.AUTH0_MGMT_TOKEN!,
});
```

### 4. Call managers to administer resources

Managers are named after the resource (`management.users`, `management.clients`,
`management.connections`, `management.roles`, `management.organizations`,
`management.actions`, `management.resourceServers`, `management.clientGrants`,
`management.logStreams`, and more), with nested managers where the API nests
(`management.clients.credentials`, `management.connections.users`,
`management.branding.themes`). Every manager exposes `.list()`, `.get()`,
`.create()`, `.update()`, `.delete()`.

```ts
// Create a user in a database connection
const user = await management.users.create({
  connection: "Username-Password-Authentication",
  email: "jane@example.com",
  password: "<generated-strong-password>",
  email_verified: false,
});

const fetched = await management.users.get(user.user_id);

await management.users.update(user.user_id, { app_metadata: { plan: "pro" } });

// Delete
await management.users.delete(user.user_id);
```

Request and response shapes vary per endpoint. Use the SDK's TypeScript types as
the source of truth - import them from the `Management` namespace:

```ts
import type { Management } from "auth0";

const body: Management.CreateClientRequestContent = { name: "My App" };
const created: Management.CreateClientResponseContent = await management.clients.create(body);
```

`import type` is erased at compile time, so it adds nothing to your bundle.

### 5. Iterate list results with pagination

List methods return a page object, not a plain array: iterate `page.data` and
advance with `page.hasNextPage()` / `page.getNextPage()`.

```ts
// Offset-based pagination (most endpoints)
let page = await management.users.list({ page: 0, per_page: 50 });
for (const u of page.data) console.log(u.user_id);
while (page.hasNextPage()) {
  page = await page.getNextPage();
  for (const u of page.data) console.log(u.user_id);
}
```

Some endpoints (e.g. `connections`, `organizations`) use checkpoint pagination
with `take` instead of `page`/`per_page`:

```ts
let page = await management.connections.list({ take: 50 });
for (const conn of page.data) console.log(conn.name);
while (page.hasNextPage()) {
  page = await page.getNextPage();
  for (const conn of page.data) console.log(conn.name);
}
```

### 6. Handle errors with ManagementError

A non-2xx response throws a `ManagementError` carrying the status code, message,
parsed body, and raw response. Token-acquisition failures (bad credentials,
unreachable `/oauth/token`) also surface as `ManagementError`; a token-fetch
timeout throws `ManagementError` with `statusCode` 408.

```ts
import { ManagementClient, ManagementError } from "auth0";

try {
  await management.users.create({ connection: "…", email: "…" });
} catch (err) {
  if (err instanceof ManagementError) {
    console.error(err.statusCode); // e.g. 409 for a duplicate user
    console.error(err.message);
    console.error(err.body);       // parsed API error body
  } else {
    throw err;
  }
}
```

The error class is `ManagementError`, not `ManagementApiError`.

## Per-request options: retries, timeouts, headers, cancellation

Every manager method takes an optional trailing options argument. The SDK
retries `408`/`429`/`5xx` with exponential backoff (default `maxRetries: 2`) and
uses a 60s timeout by default.

```ts
import { withTimeout, withRetries, withHeaders, withAbortSignal } from "auth0";

await management.users.list({ per_page: 50 }, {
  ...withTimeout(30),   // seconds
  ...withRetries(3),
  ...withHeaders({ "X-Request-ID": crypto.randomUUID() }),
});

// Cancellation
const controller = new AbortController();
const p = management.users.list({}, { ...withAbortSignal(controller.signal) });
setTimeout(() => controller.abort(), 10_000);
```

## Smaller bundles for size-constrained runtimes

For Cloudflare Workers or other size-constrained runtimes, import only the
managers you use from their own entry points so the bundler tree-shakes the
rest. Configure auth once with `createManagementAuth` and reuse the returned
options across sub-clients (the token is fetched and cached once).

```ts
import { createManagementAuth } from "auth0/management";
import { UsersClient } from "auth0/users";
import { ClientsClient } from "auth0/clients";

const auth = createManagementAuth({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});

export const users = new UsersClient(auth.clientOptions);
export const clients = new ClientsClient(auth.clientOptions);

await users.list({ per_page: 10 });
```

Tree-shaking applies only to ESM through a bundler; a CommonJS `require()` loads
the full resource graph.

## Common mistakes

| Mistake | Fix |
|---|---|
| `npm install @auth0/node-auth0` | The package is `auth0` - `npm install auth0`. |
| `import { ManagementApiError }` | The error class is `ManagementError`. |
| Treating a `list()` result as an array | It's a page - iterate `page.data`, advance with `page.getNextPage()`. |
| Passing a resource id as `{ id }` to `get`/`update`/`delete` | The id is a positional string - `management.users.get(userId)`, `management.users.update(userId, body)`. |
| `domain: "https://tenant.auth0.com/"` | Bare hostname only - `tenant.auth0.com`. |
| Using node-auth0 to log users into an app | Wrong SDK - use the app's framework SDK for login/sessions. |
| Using node-auth0 for authentication (token grants, signup, MFA, `/userinfo`) | Use `@auth0/auth0-auth-js` or `@auth0/auth0-server-js`. |
| Granting the M2M app broad Management scopes | Grant only what the task needs (e.g. just `read:users`). |
| Hardcoding the client secret in source | Load from an env variable; keep `.env` out of git. |
| Per-record loops for large jobs | The Management API is rate limited - keep `maxRetries` on and prefer bulk/Import-Users jobs. |

## Related capabilities

- End-user login and sessions for an app - use the Auth0 integration workflow
  for the app's framework (Next.js, React, Express, and so on).
- Authentication API operations (token grants, signup, MFA, `/userinfo`) -
  `@auth0/auth0-auth-js` or `@auth0/auth0-server-js`.
- Hitting 429 Too Many Requests on the Management API - ask about rate limits
  (`debug:rate-limit`).
- Scripting tenant setup from the terminal instead of code - the Auth0 CLI
  (`tooling-cli`).

## References
- [Full API reference](https://raw.githubusercontent.com/auth0/node-auth0/master/reference.md)
- [`@auth0/auth0-auth-js` usage examples](https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-auth-js/EXAMPLES.md) - Authentication API SDK
- [`@auth0/auth0-server-js` usage examples](https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-server-js/EXAMPLES.md) - server-side sessions
