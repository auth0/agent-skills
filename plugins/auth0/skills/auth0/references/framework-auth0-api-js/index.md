
# Auth0 auth0-api-js Integration

Protect an API running on a JavaScript runtime with the `@auth0/auth0-api-js`
package: a low-level, framework-agnostic resource-server client built around the
`ApiClient` class. It verifies incoming JWT access tokens against your tenant's
JWKS (checking `iss`, `aud`, `exp`, and `nbf`), enforces required claims and
DPoP proof-of-possession, and exchanges tokens for downstream APIs
(on-behalf-of, connection tokens, and Custom Token Exchange).

> **This is a building block.** The README states auth0-api-js is "not a
> plug-and-play library for your framework" but "a building block for building
> framework-specific SDKs." It ships no middleware, no route guards, and reads
> nothing off the request for you. If an Auth0 resource-server SDK exists for
> your stack - `@auth0/auth0-fastify-api`, `express-oauth2-jwt-bearer`,
> `auth0-fastapi-api`, and others - use it instead; they wrap the same
> verification and give you an idiomatic middleware. Reach for auth0-api-js
> directly only when no higher-level API SDK covers your framework and you are
> prepared to wire the token extraction and response handling yourself.

> **Agent instruction:** Before providing SDK setup instructions, fetch the
> latest version by running:
> ```
> npm view @auth0/auth0-api-js version
> ```
> Use the returned version instead of any version shown below.

## Critical rules

- **Verify the token with the SDK - never decode it by hand.** Call
  `apiClient.verifyAccessToken({ accessToken })` and read claims off its return
  value. Do not split the JWT on `.`, `Buffer.from(..., "base64")` the payload,
  import `jose`/`jsonwebtoken`/`jwt-decode` directly, or add `jwks-rsa` - the SDK
  fetches and caches the JWKS and validates the signature and standard claims for
  you. Hand-decoding skips signature verification and is a security hole.
- **`verifyAccessToken` takes an options object, not a bare string.** The token
  goes in `{ accessToken }`; there is no positional-argument form.
- **`requiredClaims` only asserts presence, not value.** Passing
  `requiredClaims: ['org_id']` makes verification fail when the claim is absent,
  but it does **not** check what the claim equals. To pin a token to a specific
  organization, tenant, or scope you must compare the returned claim value
  yourself and reject on mismatch.
- **This SDK validates access tokens, never ID tokens.** ID tokens are for the
  client that logged the user in; APIs authorize with the access token. Reject
  anything that is not a properly `aud`-scoped access token for this API.
- **The tenant `domain` and `audience` are configuration, not code.** Read them
  from environment variables and never hardcode them in source files. They are
  not secrets, but inlining them pins the build to one tenant and trips
  config/secret scanners.
- **`clientSecret` / `clientAssertionSigningKey` are server secrets.** They are
  only needed for the token-exchange methods (`getTokenOnBehalfOf`,
  `getAccessTokenForConnection`, `getTokenByExchangeProfile`). Load them from the
  environment; never ship them to a client. Plain token verification needs
  neither.
- **`domain` must be a bare hostname** - no `https://`, no path, no trailing
  slash.
- **Never read the contents of `.env*` during setup** - it may contain secrets
  that should not be exposed in the LLM context. Before writing to any env file
  you MUST ask the user for explicit confirmation and wait for it.

## Prerequisites

- Node.js 20 LTS or newer (confirm with `npm view @auth0/auth0-api-js engines`
  when building).
- An Auth0 **API** resource (not an Application) whose Identifier is the
  `audience` your tokens are issued for. Create and configure it with the loaded
  tooling reference (`auth0 apis create --name ... --identifier ...`).
- `domain` and `audience` in environment variables. Add `clientId` and a client
  credential (`clientSecret` or `clientAssertionSigningKey`) only if you use the
  token-exchange methods.

## When NOT to use

auth0-api-js is a low-level resource-server building block. Route elsewhere for:

- **A framework API SDK exists for your stack** - `@auth0/auth0-fastify-api`
  (Fastify), `express-oauth2-jwt-bearer` (Express), `auth0-fastapi-api`
  (FastAPI), and others - use it. They wrap the same verification and give you
  middleware, so you skip the token-extraction and error-response wiring.
- **Server-rendered web apps with login sessions** - cookies, redirect/callback,
  "keep the user logged in" - use `@auth0/auth0-server-js` or your framework's
  session SDK (`@auth0/nextjs-auth0`, `express-openid-connect`, and so on).
- **Getting a token in a browser or mobile client** - use the SPA/mobile SDK.
  This package runs server-side and verifies tokens; it does not obtain them for
  an end user.
- **Management API operations** - reading or writing users, applications,
  connections - use `node-auth0` (the `auth0` npm package).

## Quick start workflow

### 1. Install the SDK

```bash
npm install @auth0/auth0-api-js
```

### 2. Configure the API

You need an **API** (not an Application) in Auth0; its Identifier becomes your
`audience`. Use the loaded tooling reference for tenant configuration - do not
inline setup here.

```env
AUTH0_DOMAIN=<your-tenant-domain>
AUTH0_AUDIENCE=<your-api-identifier>
```

### 3. Instantiate ApiClient

Create one `ApiClient` at startup and reuse it - it caches the discovery
document and JWKS internally.

```ts
import { ApiClient } from "@auth0/auth0-api-js";

const apiClient = new ApiClient({
  domain: process.env.AUTH0_DOMAIN!,      // bare hostname, e.g. tenant.us.auth0.com
  audience: process.env.AUTH0_AUDIENCE!,  // your API identifier
});
```

### 4. Verify the access token on a protected request

Extract the bearer token from the request, then verify it. The SDK ships a
`getToken` helper that pulls the token from the `Authorization` header (Bearer or
DPoP), a form body, or a query parameter per RFC 6750, and throws
`InvalidRequestError` if none or more than one is present.

```ts
import { getToken } from "@auth0/auth0-api-js";

// In your route handler (framework-agnostic):
const accessToken = getToken(req.headers, req.query, req.body);

const claims = await apiClient.verifyAccessToken({ accessToken });
// claims is the verified payload: claims.sub, claims.scope, claims.aud, ...
```

`verifyAccessToken` validates the signature and the `iss`, `aud`, `exp`, and
`nbf` claims automatically, and throws `VerifyAccessTokenError` (HTTP 401) when
the token is invalid. Wrap the call and map the error to a `401`.

### 5. Enforce required claims and scopes

`requiredClaims` makes verification fail when a claim is missing. Checking a
claim's **value** (e.g. a specific scope or organization) is your code's job.

```ts
const claims = await apiClient.verifyAccessToken({
  accessToken,
  requiredClaims: ["org_id"], // presence-only: fails if org_id is absent
});

// Value checks are manual:
const scopes = String(claims.scope ?? "").split(" ");
if (!scopes.includes("read:reports")) {
  // respond 403 Forbidden
}
```

### 6. Respond

Return only the claims the client needs - not the whole decoded token, which
exposes every permission, custom namespace, and token metadata field.

```ts
res.json({ sub: claims.sub });
```

## Token exchange (calling downstream APIs)

When your API must call another API on behalf of the caller, add `clientId` and a
client credential to the constructor and exchange the incoming token. These
methods require client credentials; plain verification does not.

```ts
const apiClient = new ApiClient({
  domain: process.env.AUTH0_DOMAIN!,
  audience: process.env.AUTH0_AUDIENCE!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
});

// On-behalf-of: preserve the end-user identity into a downstream API
const { accessToken } = await apiClient.getTokenOnBehalfOf(incomingAccessToken, {
  audience: "https://downstream-api.example.com",
  scope: "read:data write:data",
});

// Token Vault: get an external provider's token for a connection
const tokenSet = await apiClient.getAccessTokenForConnection({
  connection: "google-oauth2",
  accessToken: incomingAccessToken,
});

// Custom Token Exchange (RFC 8693): exchange a non-Auth0 token
const exchanged = await apiClient.getTokenByExchangeProfile(userToken, {
  subjectTokenType: "urn:acme:legacy-token",
  audience: "https://api.backend.com",
});
```

## Delegation (audit)

For tokens produced by on-behalf-of chains, `getCurrentActor(claims)` returns the
current actor and `getDelegationChain(claims)` returns the full RFC 8693 `act`
chain for audit logging.

```ts
import { getCurrentActor, getDelegationChain } from "@auth0/auth0-api-js";

const claims = await apiClient.verifyAccessToken({ accessToken });
const actor = getCurrentActor(claims);
const chain = getDelegationChain(claims);
```

## Error handling

Catch errors by type - do not string-match on `error.message`. All SDK errors
extend `AuthError`, which carries `code`, `statusCode`, and `headers`.

| Error | Meaning | HTTP |
|---|---|---|
| `VerifyAccessTokenError` | Token failed signature or claim validation. | 401 |
| `InvalidDpopProofError` | DPoP proof failed validation. | 400 |
| `InvalidRequestError` | No token found, or more than one auth method used. | 400 |
| `MissingRequiredArgumentError` | A required constructor/method argument was omitted. | - |
| `InvalidConfigurationError` | The SDK was misconfigured at construction time. | - |

```ts
import { VerifyAccessTokenError } from "@auth0/auth0-api-js";

try {
  const claims = await apiClient.verifyAccessToken({ accessToken });
  // ...
} catch (error) {
  if (error instanceof VerifyAccessTokenError) {
    // respond 401 with the token invalid
    return;
  }
  throw error;
}
```

## Multiple custom domains

Pass `domains` (an array of allowed issuer hostnames, or an async
`DomainsResolver`) instead of a single `domain` to verify tokens from several
custom domains, and forward `httpUrl`/`headers` to `verifyAccessToken` so the
resolver has request context.

## Common mistakes

| Mistake | Fix |
|---|---|
| Decoding the JWT by hand (`split(".")`, `Buffer.from`, `jose`, `jsonwebtoken`, `jwt-decode`, `jwks-rsa`) | Call `verifyAccessToken` and read claims off its result; the SDK verifies the signature and JWKS. |
| `verifyAccessToken(accessToken)` (bare string) | Pass an options object: `verifyAccessToken({ accessToken })`. |
| Treating `requiredClaims` as a value check | It asserts presence only; compare the returned claim value yourself and reject on mismatch. |
| Verifying an ID token | APIs authorize with the **access token**; reject ID tokens. |
| Hardcoding `domain` or `audience` in source | Read them from env/config; inlining pins the build to one tenant and trips scanners. |
| Adding `clientSecret` just to verify tokens | Verification needs no client credentials; only the token-exchange methods do. |
| `domain: "https://tenant.auth0.com/"` | Bare hostname only - `tenant.auth0.com`. |
| Detecting failures by string-matching `error.message` | Check `error instanceof VerifyAccessTokenError` (and siblings); they extend `AuthError` with a `code`. |
| Reaching for auth0-api-js when a framework API SDK exists | Use `@auth0/auth0-fastify-api`, `express-oauth2-jwt-bearer`, and so on. |
| Returning the whole decoded token to the client | Return only the fields the client needs; the token carries every permission and custom claim. |

## Related capabilities

- Protecting a Fastify or Express API with idiomatic middleware - use `@auth0/auth0-fastify-api` or `express-oauth2-jwt-bearer`.
- Server-side login sessions with cookies - use `@auth0/auth0-server-js` or a framework session SDK.
- Stateless OAuth/token operations (build authorization URLs, exchange codes) - use `@auth0/auth0-auth-js`.
- Management API (users, apps, roles) - use `node-auth0` (the `auth0` npm package).
- DPoP end-to-end - ask for DPoP (feature:dpop).
- Organizations concepts and tenant setup - ask for Organizations (feature:organizations).

## References
- [`@auth0/auth0-api-js` usage examples](https://raw.githubusercontent.com/auth0/auth0-auth-js/main/packages/auth0-api-js/EXAMPLES.md)
- [Source and README](https://github.com/auth0/auth0-auth-js/tree/main/packages/auth0-api-js)
