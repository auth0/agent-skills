
# Auth0 auth0-auth-js Integration

Add OAuth 2.0 / OpenID Connect to a server-side Node.js or edge runtime with the
`@auth0/auth0-auth-js` package: a low-level, stateless, headless authentication
client built around the `AuthClient` class. It builds authorization URLs,
exchanges codes for tokens, refreshes tokens, runs the client-credentials and
password grants, reads a user profile from `/userinfo`, and builds logout URLs.

> **Stateless by design.** auth0-auth-js holds no session, sets no cookies, and
> stores no state. You own where the tokens and the PKCE `code_verifier` live.
> For managed server sessions with cookies use `@auth0/auth0-server-js`; for a
> framework you already run (Next.js, Express, Nuxt, and so on) use that
> framework's Auth0 SDK instead - it wraps this package for you.

> **Agent instruction:** Before providing SDK setup instructions, fetch the
> latest version by running:
> ```
> npm view @auth0/auth0-auth-js version
> ```
> Use the returned version instead of any version shown below.

## Critical rules

- **`AuthClient` is server-side only.** It needs the Client Secret, so never
  import it into browser or mobile client code and never ship the secret to a
  client bundle.
- **Never read the contents of `.env*` during setup** - it may contain secrets
  that should not be exposed in the LLM context. Before writing to any env file
  you MUST ask the user for explicit confirmation and wait for it.
- **`domain` must be a bare hostname** - no `https://`, no path, no trailing
  slash.
- **The PKCE `codeVerifier` is single-use and per-request.** Generate it with
  `buildAuthorizationUrl()`, carry it through the redirect, and pass the same
  value to `getTokenByCode()`. Never reuse one across requests or store it in a
  long-lived, shared location.

## Prerequisites

- Node.js `^20.19.0 || ^22.12.0 || ^24.0.0` (confirm with
  `npm view @auth0/auth0-auth-js engines` when building).
- An Auth0 application whose grant type and callback URL match the flow: a
  Regular Web Application for the authorization-code flow, a Machine-to-Machine
  application for client credentials. Create and configure it with the loaded
  tooling reference.
- `domain`, `clientId`, `clientSecret` (and a redirect URI for the code flow) in
  environment variables.

## When NOT to use

auth0-auth-js is a low-level token/OAuth building block. Route elsewhere for:

- **Managed server sessions** - login cookies, session persistence, "keep the
  user logged in" - use `@auth0/auth0-server-js`.
- **A framework you already run** - if an Auth0 SDK exists for the app's stack
  (Next.js, Express, Nuxt, Fastify, and so on), use it. Those wrap this package
  and handle the redirect, callback, and storage for you. auth0-auth-js is for
  building a new integration where none exists.
- **Management API operations** - reading or writing users, applications,
  connections - use `node-auth0` (the `auth0` npm package).
- **Multi-factor authentication how-to** - ask for MFA (feature:mfa).

## Quick start workflow

### 1. Install the SDK

```bash
npm install @auth0/auth0-auth-js
```

### 2. Configure credentials

Put the tenant Domain, Client ID, Client Secret, and (for the code flow) the
redirect URI in `.env`. For all Auth0 tenant configuration (create the app, set
the callback URL, choose grant types), use the loaded tooling reference - do not
inline setup here.

```env
AUTH0_DOMAIN=<your-tenant-domain>
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
AUTH0_REDIRECT_URI=<your-callback-url>
```

### 3. Instantiate AuthClient

```ts
import { AuthClient } from "@auth0/auth0-auth-js";

const authClient = new AuthClient({
  domain: process.env.AUTH0_DOMAIN!,        // bare hostname, e.g. tenant.us.auth0.com
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  authorizationParams: { redirect_uri: process.env.AUTH0_REDIRECT_URI! },
});
```

### 4. Authorization code + PKCE

`buildAuthorizationUrl()` returns the URL to redirect to along with the
`codeVerifier` you must persist for the callback. After Auth0 redirects back,
exchange the code:

```ts
const { authorizationUrl, codeVerifier } = await authClient.buildAuthorizationUrl();
// redirect the user to authorizationUrl; persist codeVerifier for the callback

// in the callback handler, with the full callback URL:
const tokens = await authClient.getTokenByCode(callbackUrl, { codeVerifier });
```

### 5. Other grants and token operations

```ts
// Machine-to-machine
const m2m = await authClient.getTokenByClientCredentials({ audience });

// Refresh
const refreshed = await authClient.getTokenByRefreshToken({ refreshToken });

// User profile from an access token
const user = await authClient.getUserInfo({ accessToken });
```

### 6. Logout

`buildLogoutUrl()` returns the URL to send the user to - the SDK does not issue
the redirect itself.

```ts
const logoutUrl = authClient.buildLogoutUrl({ returnTo });
```

## Sub-clients

`AuthClient` exposes feature sub-clients that share its constructor config:
`authClient.mfa`, `authClient.passkey`, `authClient.passwordless`, and
`authClient.database`. Their usage is covered in the package's examples (see
References).

## Common mistakes

| Mistake | Fix |
|---|---|
| `domain: "https://tenant.auth0.com/"` | Bare hostname only - `tenant.auth0.com`. |
| Reusing a `codeVerifier` across requests | Generate a new one per `buildAuthorizationUrl()` call. |
| Calling `getTokenByCode()` without the verifier | Pass `{ codeVerifier }` as the second argument. |
| Expecting cookies or a session | auth0-auth-js is stateless - use `@auth0/auth0-server-js` for sessions. |
| Importing `AuthClient` in browser/mobile code | Server-side only - it needs the Client Secret. |
| Using it for Management API calls | Use `node-auth0` (the `auth0` npm package). |

## Related capabilities

- Managed server sessions with cookies - use `@auth0/auth0-server-js`.
- Full login integration for an existing framework - use that framework's Auth0
  SDK (Next.js, Express, Nuxt, and so on).
- Management API (users, apps, roles) - use `node-auth0` (the `auth0` npm
  package).
- Multi-factor authentication - ask for MFA (feature:mfa).

## References
- [`@auth0/auth0-auth-js` usage examples](https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-auth-js/EXAMPLES.md)
- [Source and README](https://github.com/auth0/auth0-auth-js/tree/main/packages/auth0-auth-js)
