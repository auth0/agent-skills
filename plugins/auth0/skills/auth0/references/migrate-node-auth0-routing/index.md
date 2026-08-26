# Routing and Configuration

Two decisions come before any code changes: **which target SDK** each call site should move to,
and **how to rewrite the client construction**. This file covers both in depth.

---

## Choosing the target SDK

### The underlying reason there are two targets

node-auth0's `AuthenticationClient` is a **stateless HTTP client**. Each method is a single call
to an Auth0 Authentication API endpoint that returns a response. It has no notion of a logged-in
user, no session, no cookie, no token store, no automatic refresh. Anything stateful in a
node-auth0 app — persisting tokens, deciding when to refresh, tracking the login across requests —
was written by the customer *around* node-auth0, typically with `express-openid-connect`,
`express-session`, custom middleware, or a bespoke token cache.

The modern stack separates those two concerns into two packages:

- **`@auth0/auth0-auth-js`** — the stateless token/primitive layer. It is the direct successor to
  `AuthenticationClient`: same "one method = one API call = one result" model, just with the modern
  ergonomics (camelCase, typed errors, direct return values, per-request options).
- **`@auth0/auth0-server-js`** — a stateful **session layer built on top of** auth0-auth-js. It
  owns the login redirect flow, a pluggable state/transaction store, cookie handling, automatic
  token refresh, and logout. It is the successor to the *session code the customer hand-rolled*,
  not to `AuthenticationClient` itself.

So the routing question is really: **does this customer want to keep owning their session, or hand
that responsibility to the SDK?**

### Decision procedure

Run `${CLAUDE_SKILL_DIR}/scripts/scan-usage.sh <path-to-src>` first, then answer:

```
Is the customer's node-auth0 usage purely stateless?
(only token grants / DB signup / passwordless send / userinfo, and they store
 tokens + manage the logged-in user themselves — or it's a machine-to-machine
 backend with no user at all)
│
├─ YES ─────────────────────────────────► migrate to @auth0/auth0-auth-js
│                                          (near 1:1, lowest-risk, smallest diff)
│
└─ NO — they have a redirect login flow, persist a user session across requests,
        manage cookies, refresh tokens on a timer, and would rather the SDK
        did all of that
        │
        ├─ They want to keep their current session mechanism ─► @auth0/auth0-auth-js
        │                                                        (port the grant calls only;
        │                                                         leave their session code)
        │
        └─ They want the SDK to own the session ──────────────► @auth0/auth0-server-js
                                                                 (rewrite the session layer;
                                                                  see the sessions reference)
```

### Signals that point to auth0-auth-js

- Predominant use is `clientCredentialsGrant` (M2M) — there is no user, so there is no session to own.
- The app already has a session framework it is happy with and only calls node-auth0 for token grants.
- The app is an API/worker/CLI, not a browser-facing web server.
- The customer wants the smallest, most mechanical, lowest-risk migration.

### Signals that point to auth0-server-js

- The app performs a browser redirect login and reads `req.session.user` (or equivalent) on later requests.
- The customer wrote refresh-on-expiry logic, a token cache, or logout-with-revocation by hand.
- They use `express-openid-connect` today and want a first-party, framework-agnostic replacement.
- They are on a server framework (Express, Fastify, Hono, Next.js) and want the SDK to manage cookies.

### Mixing both

A single app can use both: auth0-server-js for the user-facing login/session, and auth0-auth-js
directly for a separate M2M `clientCredentialsGrant` to call another API. `ServerClient` even
exposes the underlying `AuthClient` via `serverClient.authClient` for occasional low-level needs.
Do not force everything onto one package.

---

## Constructor and option mapping

### node-auth0 `AuthenticationClient` options

```ts
new AuthenticationClient({
  domain: 'tenant.us.auth0.com',
  clientId: '...',
  clientSecret: '...',                 // OR clientAssertionSigningKey
  clientAssertionSigningKey: '...',
  clientAssertionSigningAlg: 'RS256',
  idTokenSigningAlg: 'RS256',          // for manual id_token validation
  clockTolerance: 60,                  // seconds, for validation
  useMTLS: false,
  telemetry: true,
  headers: { 'X-Custom': '...' },      // sent on every request
  timeoutDuration: 10000,              // ms
  retry: { ... },
  agent: undertakerDispatcher,
  fetch: customFetch,
  middleware: [...],
});
```

### → `@auth0/auth0-auth-js` `AuthClient` options

```ts
import { AuthClient } from '@auth0/auth0-auth-js';

new AuthClient({
  domain: 'tenant.us.auth0.com',       // same (no scheme)
  clientId: '...',                     // same
  clientSecret: '...',                 // same
  clientAssertionSigningKey: '...',    // same (string | CryptoKey)
  clientAssertionSigningAlg: 'RS256',  // same
  authorizationParams: {               // NEW: default scope/audience/redirect_uri for URL builders
    scope: 'openid profile email',
    audience: 'https://api.example.com',
    redirect_uri: 'https://app.example.com/callback',
  },
  useMtls: false,                      // RENAMED from useMTLS (lowercase tls)
  customFetch: fetch,                  // RENAMED from fetch
  telemetry: { ... },                  // structured TelemetryConfig
  discoveryCache: { ttl, maxEntries }, // NEW: OIDC discovery / JWKS cache
});
```

**Option-by-option:**

| node-auth0 | auth0-auth-js | Notes |
|---|---|---|
| `domain` | `domain` | Unchanged. No `https://` scheme. |
| `clientId` | `clientId` | Unchanged. |
| `clientSecret` | `clientSecret` | Unchanged. |
| `clientAssertionSigningKey` | `clientAssertionSigningKey` | Unchanged. Now also accepts a `CryptoKey`. |
| `clientAssertionSigningAlg` | `clientAssertionSigningAlg` | Unchanged. |
| `useMTLS` | `useMtls` | **Renamed** (casing). |
| `fetch` | `customFetch` | **Renamed.** |
| `telemetry: boolean` | `telemetry: TelemetryConfig` | Now a structured object. |
| `headers` (global) | per-call `RequestOptions.headers` | Moved to per-request options; set per call site rather than globally. |
| `timeoutDuration` | per-call `RequestOptions.signal` (AbortSignal timeout) | Use an `AbortSignal.timeout(ms)` on the call. |
| `retry` | (configure via `customFetch`) | Wrap your fetch with retry if needed. |
| `agent` | (configure via `customFetch`) | Set the dispatcher inside your custom fetch. |
| `middleware` | `customFetch` | Compose behavior in the fetch wrapper. |
| `idTokenSigningAlg` | — (internal) | ID-token validation is internal; read `TokenResponse.claims`. |
| `clockTolerance` | — (internal) | Handled internally during validation. |

### Migrating global config to per-request options

node-auth0's global constructor options for `headers`, `timeoutDuration`, `agent`, `retry`, and
`middleware` do not have direct constructor equivalents in auth0-auth-js. Instead, the new SDK's
methods accept a trailing `RequestOptions` parameter:

```ts
import type { RequestOptions } from '@auth0/auth0-server-js'; // or '@auth0/auth0-auth-js'

const tokens = await authClient.getTokenByClientCredentials(
  { audience: 'https://api.example.com' },
  {
    headers: { 'X-Custom': 'value' },
    signal: AbortSignal.timeout(5000), // timeout in ms
  } satisfies RequestOptions
);
```

**Type import:** `@auth0/auth0-server-js` re-exports `RequestOptions` from `@auth0/auth0-auth-js`,
so you can import it from either package. Note that server-js does **not** re-export `ApiResponse`
or `FullResponseOption`; those types are defined separately in each package.

**Arity rule:** MFA methods (`authClient.mfa.*`) take `requestOptions` as the 2nd argument;
store-first methods (session-owning methods on `serverClient`) take it as the 3rd argument after the
store context; cache hits ignore it entirely.

**Common patterns:**

- **Global headers:** If the customer set a global header on the `AuthenticationClient`, either
  apply it via `RequestOptions.headers` on each call that needs it, or wrap `customFetch` once to
  inject it everywhere.
- **Timeout:** Replace `timeoutDuration: 10000` with `signal: AbortSignal.timeout(10000)` on the
  call.
- **Agent (Node.js dispatcher):** Wrap `customFetch` to inject the agent into the underlying HTTP
  transport.
- **Retry / middleware:** Compose behavior in a `customFetch` wrapper passed either at construction
  or per request.

### → `@auth0/auth0-server-js` `ServerClient` options

ServerClient wraps an `AuthClient` and adds the session machinery. It shares the auth options and
**adds required stores**:

```ts
import { ServerClient } from '@auth0/auth0-server-js';

new ServerClient({
  domain: 'tenant.us.auth0.com',       // string, or a DomainResolver for multi-tenant
  clientId: '...',
  clientSecret: '...',                 // or clientAssertionSigningKey / mTLS
  authorizationParams: {
    scope: 'openid profile email offline_access', // offline_access → refresh tokens
    audience: 'https://api.example.com',
    redirect_uri: 'https://app.example.com/callback',
  },
  transactionStore,                    // REQUIRED — holds the in-flight login (state, PKCE verifier)
  stateStore,                          // REQUIRED — holds the established session (user + tokens)
  stateIdentifier: '__a0_session',     // cookie/store key (default)
  transactionIdentifier: '__a0_tx',    // cookie/store key (default)
  customFetch: fetch,
  useMtls: false,
  telemetry: { ... },
});
```

The `transactionStore` and `stateStore` have **no node-auth0 counterpart** — they are the session
substrate. See the co-loaded sessions reference for how to construct them (cookie
stores for stateless deployments, stateful stores backed by your session DB, etc.).

---

## Import rewrites

```ts
// before
import { AuthenticationClient, UserInfoClient, AuthApiError } from 'auth0';

// after — auth-js target
import { AuthClient, TokenByCodeError, isMfaRequiredError } from '@auth0/auth0-auth-js';

// after — server-js target
import { ServerClient } from '@auth0/auth0-server-js';
```

> **Keep the `auth0` import if the file also uses `ManagementClient`.** It is correct for a file to
> import both `auth0` (for `ManagementClient`) and `@auth0/auth0-auth-js` (for authentication)
> during and after the migration. Only remove the `auth0` import from files where it was used
> *solely* for `AuthenticationClient` / `UserInfoClient`.
