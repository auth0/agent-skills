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

Run [scripts/scan-usage.sh](../scripts/scan-usage.sh) first, then answer:

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
                                                                  see server-js-sessions.md)
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

> **Per-request options.** The new SDK's methods accept a trailing `RequestOptions`
> (`{ signal, headers, customFetch }`), so anything node-auth0 configured globally (custom headers,
> timeout, agent) is now set per call. If the customer set a global header on the
> `AuthenticationClient`, apply it via `RequestOptions.headers` on the calls that need it, or wrap
> `customFetch` once to inject it everywhere.
>
> **Note:** Per-request `RequestOptions` support is not yet published as of auth0-auth-js v1.12.0.
> Check the release notes or GitHub for the version that ships this feature before relying on
> `signal`, `headers`, or per-call `customFetch`.

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
substrate. See [server-js-sessions.md](server-js-sessions.md) for how to construct them (cookie
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
