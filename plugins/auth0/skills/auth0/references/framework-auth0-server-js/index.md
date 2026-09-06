
# Auth0 auth0-server-js Integration

Add managed server-side authentication sessions to a Node.js backend with the
`@auth0/auth0-server-js` package: the `ServerClient` class wraps
`@auth0/auth0-auth-js` with cookie and state handling, so it runs the login
redirect, completes the callback, persists the session, hands back the user and
access token, and builds the logout URL.

> **This is a building block.** The README calls auth0-server-js "a building
> block for building framework-specific authentication SDKs." If an Auth0 SDK
> exists for your framework - `@auth0/nextjs-auth0`, `express-openid-connect`,
> `@auth0/auth0-nuxt`, `@auth0/auth0-fastify`, and others - use it instead.
> Those are built on top of this package and give you an idiomatic adapter.
> Reach for auth0-server-js directly only when no higher-level SDK covers your
> stack and you are prepared to write the request/response adapter yourself.

> **Agent instruction:** Before providing SDK setup instructions, fetch the
> latest version by running:
> ```
> npm view @auth0/auth0-server-js version
> ```
> Use the returned version instead of any version shown below.

## Critical rules

- **The Client Secret and the cookie secret are server secrets.** Load
  `clientSecret` and the store `secret` from environment variables; never
  hardcode them or expose them to a browser.
- **Never read the contents of `.env*` during setup** - it may contain secrets
  that should not be exposed in the LLM context. Before writing to any env file
  you MUST ask the user for explicit confirmation and wait for it.
- **`domain` must be a bare hostname** - no `https://`, no path, no trailing
  slash.
- **`authorizationParams.redirect_uri` is required** for the interactive login
  flow and must match an Allowed Callback URL in the Auth0 app.
- **Every session method takes a trailing `storeOptions`.**
  `startInteractiveLogin`, `completeInteractiveLogin`, `getUser`, `getSession`,
  `getAccessToken`, and `logout` all need it - a small object shaped by your
  framework's request/response so the store can read and write cookies.

## Prerequisites

- Node.js `^20.19.0 || ^22.12.0 || ^24.0.0` (confirm with
  `npm view @auth0/auth0-server-js engines` when building).
- An Auth0 Regular Web Application with the redirect URI in Allowed Callback URLs
  and the logout URL in Allowed Logout URLs. Configure it with the loaded
  tooling reference.
- A strong random string for the store `secret` (at least 32 random bytes);
  generate it once and store it in an environment variable.
- A `stateStore` and a `transactionStore`. The SDK ships `StatelessStateStore`,
  `StatefulStateStore`, and `CookieTransactionStore` as built-ins; pick a pair or
  implement the abstract interfaces.

## When NOT to use

- **A framework SDK exists for your stack** - `@auth0/nextjs-auth0`,
  `express-openid-connect`, `@auth0/auth0-nuxt`, `@auth0/auth0-fastify`, and
  others - use it. They wrap this package and remove the adapter work.
- **Stateless token operations only** - no session needed - use
  `@auth0/auth0-auth-js` directly.
- **Management API operations** - reading or writing users, applications,
  connections - use `node-auth0` (the `auth0` npm package).
- **Multi-factor authentication how-to** - ask for MFA (feature:mfa).

## Quick start workflow

### 1. Install the SDK

```bash
npm install @auth0/auth0-server-js
```

### 2. Configure credentials

Put the tenant Domain, Client ID, Client Secret, redirect URI, and a generated
cookie secret in environment variables. Use the loaded tooling reference for all
Auth0 tenant configuration.

```env
AUTH0_DOMAIN=<your-tenant-domain>
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
AUTH0_REDIRECT_URI=<your-callback-url>
AUTH0_COOKIE_SECRET=<32+ random bytes>
```

### 3. Instantiate ServerClient

Both built-in stores take a second argument: a `CookieHandler` you implement
for your framework (`setCookie`, `getCookie`, `getCookies`, `deleteCookie`) so
the store can read and write cookies on the current request/response.

```ts
import {
  ServerClient,
  CookieTransactionStore,
  StatelessStateStore,
} from "@auth0/auth0-server-js";

const cookieHandler = new MyCookieHandler(); // a CookieHandler you implement; see EXAMPLES.md for a Fastify adapter

const serverClient = new ServerClient({
  domain: process.env.AUTH0_DOMAIN!,        // bare hostname
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  authorizationParams: { redirect_uri: process.env.AUTH0_REDIRECT_URI! },
  transactionStore: new CookieTransactionStore({ secret: process.env.AUTH0_COOKIE_SECRET! }, cookieHandler),
  stateStore: new StatelessStateStore({ secret: process.env.AUTH0_COOKIE_SECRET! }, cookieHandler),
});
```

### 4. Login, callback, session, logout

Each call takes a trailing `storeOptions` built from the current request/response
so the store can set and read cookies.

```ts
// Login route: redirect the user to the returned URL
const url = await serverClient.startInteractiveLogin({}, storeOptions);

// Callback route: completes the login, then redirect into the app
await serverClient.completeInteractiveLogin(callbackUrl, storeOptions);

// Read the session user (undefined when not logged in)
const user = await serverClient.getUser(storeOptions);

// Get an access token for calling an API
const { accessToken } = await serverClient.getAccessToken(storeOptions);

// Logout: redirect the user to the returned URL
const logoutUrl = await serverClient.logout({ returnTo }, storeOptions);
```

## Storage exports

- `CookieTransactionStore` - holds the short-lived login transaction (state,
  PKCE verifier) in a cookie.
- `StatelessStateStore` - keeps the whole session in an encrypted cookie; no
  server store needed.
- `StatefulStateStore` - keeps a session ID in the cookie and the session in an
  external store you provide.
- `AbstractStateStore` / `AbstractTransactionStore` - interfaces to implement a
  custom store.

## Multi-domain / multi-tenant

For per-request domain resolution, pass a `DomainResolver` function as `domain`
instead of a static hostname string. Note that the `serverClient.mfa` and
`serverClient.authClient` sub-clients are only available in static-domain mode.

## Common mistakes

| Mistake | Fix |
|---|---|
| Omitting `authorizationParams.redirect_uri` | Required for interactive login; must match Allowed Callback URLs. |
| Hardcoding the store `secret` | Load it from an env variable; treat it as a server secret. |
| `domain: "https://tenant.auth0.com/"` | Bare hostname only - `tenant.auth0.com`. |
| Forgetting the trailing `storeOptions` | Every session method needs it; its shape depends on your framework. |
| Hand-wiring `ServerClient` when a framework SDK exists | Use `@auth0/nextjs-auth0`, `express-openid-connect`, and so on. |
| Accessing `serverClient.mfa` with a `DomainResolver` set as `domain` | Those sub-clients are unavailable in multi-domain mode. |

## Related capabilities

- Stateless token/OAuth operations without a session - use
  `@auth0/auth0-auth-js`.
- Full login integration for Next.js, Express, Nuxt, Fastify, and so on - use
  that framework's Auth0 SDK.
- Management API (users, apps, roles) - use `node-auth0` (the `auth0` npm
  package).
- Multi-factor authentication - ask for MFA (feature:mfa).

## References
- [`@auth0/auth0-server-js` usage examples](https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-server-js/EXAMPLES.md)
- [`@auth0/auth0-server-js` MFA examples](https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-server-js/MFA.md)
- [Source and README](https://github.com/auth0/auth0-auth-js/tree/main/packages/auth0-server-js)
