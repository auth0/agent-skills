# node-auth0 v6 Migration Guide — auth0-auth-js / auth0-server-js

**Applies to:** `auth0` (node-auth0) **v4+** migrating to `@auth0/auth0-auth-js` >= v1.13.0
and/or `@auth0/auth0-server-js` >= v1.13.0. The Authentication API is stable across node-auth0
v4-v6; v5 raised the minimum Node.js version to ^20.19.0 but did not change the API surface.

**Out of scope:** The `ManagementClient`
(Management API v2) is also out of scope — it stays on the `auth0` package and is not migrated
here. Application routes, view/controller logic, database code, and any non-auth use of the
`auth0` package are likewise out of scope.

This guide covers a **surgical rewrite of the authentication layer only**. You replace
node-auth0's `AuthenticationClient` (and `UserInfoClient`) call sites with modern SDK
equivalents. Routes, controllers, business logic, data access, and framework wiring stay as they
are. The goal is to touch the smallest possible surface: the files that import and call
node-auth0's Authentication API.

**In scope:** any code that imports from the `auth0` package and uses:

- `AuthenticationClient` and its sub-clients: `.oauth`, `.database`, `.passwordless`,
  `.backchannel`, `.tokenExchange`
- `UserInfoClient`
- Auth error types (`AuthApiError`) and token-validation types (`IDTokenValidateOptions`,
  `IdTokenValidatorError`)

> If a file uses `ManagementClient`, leave that code alone. Only rewrite the
> `AuthenticationClient` / `UserInfoClient` parts. It is normal and correct for a file to keep
> importing `auth0` for management while importing `@auth0/auth0-auth-js` for authentication
> during and after the migration. Only remove the `auth0` import from files where it was used
> solely for `AuthenticationClient` / `UserInfoClient`.

---

## SDK versions

| Role | Package | Version |
|---|---|---|
| Source (being migrated) | `auth0` (node-auth0) | v4+ |
| Target — token layer | `@auth0/auth0-auth-js` | >= v1.13.0 |
| Target — session layer | `@auth0/auth0-server-js` | >= v1.13.0 |

Both target SDKs require **Node.js 20 LTS or newer**. Verify the project's runtime before
installing. Install the latest published versions:
`npm install @auth0/auth0-auth-js@latest @auth0/auth0-server-js@latest`.

---

## Which target SDK?

node-auth0's `AuthenticationClient` is a **stateless HTTP client**. Each method is a single call
to an Auth0 Authentication API endpoint. It has no notion of a logged-in user, no session, no
cookie, no token store, no automatic refresh. Anything stateful in a node-auth0 app was written
by the customer *around* node-auth0 — typically with `express-openid-connect`, `express-session`,
custom middleware, or a bespoke token cache.

The modern stack separates those two concerns into two packages:

- **`@auth0/auth0-auth-js`** — the stateless token/primitive layer. Direct successor to
  `AuthenticationClient`: same "one method = one API call = one result" model with modern
  ergonomics (camelCase, typed errors, direct return values, per-request options).
- **`@auth0/auth0-server-js`** — a stateful **session layer built on top of** auth0-auth-js.
  Owns the login redirect flow, a pluggable state/transaction store, cookie handling, automatic
  token refresh, and logout. Successor to the *session code the customer hand-rolled*, not to
  `AuthenticationClient` itself.

### Decision procedure

```
Is the customer's node-auth0 usage purely stateless?
(only token grants / DB signup / passwordless send / userinfo, and they store
 tokens + manage the logged-in user themselves — or it is a machine-to-machine
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
                                                                  see Section 7 of this guide)
```

**Signals that point to auth0-auth-js:**
- Predominant use is `clientCredentialsGrant` (M2M) — no user, so no session to own.
- The app already has a session framework and only calls node-auth0 for token grants.
- The app is an API/worker/CLI, not a browser-facing web server.
- The customer wants the smallest, most mechanical, lowest-risk migration.

**Signals that point to auth0-server-js:**
- The app performs a browser redirect login and reads `req.session.user` (or equivalent) on later requests.
- The customer wrote refresh-on-expiry logic, a token cache, or logout-with-revocation by hand.
- They use `express-openid-connect` today and want a first-party, framework-agnostic replacement.
- They are on a server framework (Express, Fastify, Hono, Next.js) and want the SDK to manage cookies.

**Mixing both:** a single app can use both — auth0-server-js for the user-facing login/session,
and auth0-auth-js directly for a separate M2M `clientCredentialsGrant` to call another API.
`ServerClient` exposes the underlying `AuthClient` via `serverClient.authClient` for occasional
low-level needs.

> **Caveat:** `serverClient.authClient` is a public getter that throws `InvalidConfigurationError`
> at runtime when the client is constructed with a domain-resolver function (the multi-tenant
> pattern, where the domain is resolved per request). It works with a static string domain. Use
> the ServerClient's own methods for per-request operations in multi-tenant setups.

---

## Section 1: Preflight and git safety

Before touching any code, verify the environment is safe for an in-place rewrite.

### 1a. Git safety check and stash-based backup

```bash
# Detect whether this is a git repository.
# Distinguishes "not a repo" (output is not "true") from other git failures.
GIT_CHECK=$(git rev-parse --is-inside-work-tree 2>&1)
if [ "$GIT_CHECK" != "true" ]; then
  echo "Not inside a git repository — skipping git safety steps."
else
  CHANGES=$(git status --porcelain)
  if [ -n "$CHANGES" ]; then
    echo "Uncommitted changes detected. Creating a stash-based backup..."
    STASH_NAME="pre-migration-backup-$(date +%Y%m%d-%H%M%S)"
    git stash push --message "$STASH_NAME" --include-untracked
    echo "Backup stash created: $STASH_NAME"
    echo "To restore the original state: git stash pop"
    echo "To inspect all stashes: git stash list"
  else
    echo "Working tree clean — no backup needed."
  fi
fi
```

> The stash preserves the pre-migration state. If the rewrite goes wrong, `git stash pop` brings
> back the original files. This is preferred over creating a backup branch because eval harnesses
> often run in fresh temporary directories that are not git repositories, and a new branch requires
> a valid HEAD commit that may not exist.

### 1b. Verify the source SDK

Confirm node-auth0 v6 is present in the project's dependencies:

```bash
node -e "
const p = require('./package.json');
const v = (p.dependencies || {})['auth0'] || (p.devDependencies || {})['auth0'];
console.log('auth0 version:', v || 'NOT FOUND');
"
```

### 1c. Verify target SDK versions

`@auth0/auth0-auth-js` >= v1.13.0 and `@auth0/auth0-server-js` >= v1.13.0 are required:

```bash
node -e "
const pkgs = ['@auth0/auth0-auth-js', '@auth0/auth0-server-js'];
pkgs.forEach(pkg => {
  try {
    const v = require(pkg + '/package.json').version;
    console.log(pkg + ': ' + v);
  } catch {
    console.log(pkg + ': NOT INSTALLED');
  }
});
"
```

---

## Section 2: Discover every call site

Run the following discovery scan against the customer's source root. This is **read-only** — it
greps and counts, changes nothing. Replace `<path-to-src>` with the source directory before
running.

```bash
set -euo pipefail
ROOT="${1:-<path-to-src>}"

if [ ! -d "$ROOT" ]; then
  echo "error: '$ROOT' is not a directory" >&2
  echo "usage: bash <this-block> <path-to-src>" >&2
  exit 2
fi

FILE_GLOBS=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
            --include='*.mjs' --include='*.cjs' --include='*.cts' --include='*.mts')
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
          --exclude-dir=.git --exclude-dir=coverage)

# grep helper: recursive, line-numbered, extended regex. Never fail on "no matches".
scan() { grep -rEn "${FILE_GLOBS[@]}" "${EXCLUDES[@]}" "$1" "$ROOT" 2>/dev/null || true; }
count() { scan "$1" | wc -l | tr -d ' '; }
section() { printf '\n=== %s ===\n' "$1"; }

echo "node-auth0 -> auth0-auth-js / auth0-server-js — usage scan"
echo "root: $ROOT"

section "Imports from the 'auth0' package"
scan "from ['\"]auth0['\"]|require\(['\"]auth0['\"]\)"

section "AuthenticationClient construction (MIGRATE)"
scan "new[[:space:]]+AuthenticationClient"

section "UserInfoClient construction (MIGRATE -> claims / getUser / direct fetch)"
scan "new[[:space:]]+UserInfoClient|\.getUserInfo\("

section "oauth.* calls (MIGRATE -> AuthClient methods)"
scan "\.oauth\.(authorizationCodeGrant|authorizationCodeGrantWithPKCE|refreshTokenGrant|passwordGrant|clientCredentialsGrant|revokeRefreshToken|tokenForConnection|pushedAuthorization)"

section "database.* calls (MIGRATE -> authClient.database.*)"
scan "\.database\.(signUp|changePassword)"

section "passwordless.* calls (MIGRATE -> authClient.passwordless.* + grant methods)"
scan "\.passwordless\.(sendEmail|sendSMS|loginWithEmail|loginWithSMS)"

section "backchannel.* calls (MIGRATE -> CIBA methods)"
scan "\.backchannel\.(authorize|backchannelGrant)"

section "tokenExchange.* calls (MIGRATE -> exchangeToken)"
scan "\.tokenExchange\.exchangeToken"

section "AuthApiError / id-token validation types (MIGRATE -> typed errors / claims)"
scan "AuthApiError|IDTokenValidateOptions|IdTokenValidatorError"

section "High-risk residue: expires_in arithmetic (INSPECT — expiresAt is absolute)"
scan "expires_in"

section "ManagementClient usage (DO NOT MIGRATE — stays on 'auth0')"
scan "new[[:space:]]+ManagementClient|ManagementClient"

section "Summary counts"
printf '%-45s %s\n' "AuthenticationClient constructions:" \
  "$(count 'new[[:space:]]+AuthenticationClient')"
printf '%-45s %s\n' "UserInfoClient / getUserInfo:" \
  "$(count 'new[[:space:]]+UserInfoClient|\.getUserInfo\(')"
printf '%-45s %s\n' "oauth.* calls:" \
  "$(count '\.oauth\.(authorizationCodeGrant|authorizationCodeGrantWithPKCE|refreshTokenGrant|passwordGrant|clientCredentialsGrant|revokeRefreshToken|tokenForConnection|pushedAuthorization)')"
printf '%-45s %s\n' "database.* calls:" \
  "$(count '\.database\.(signUp|changePassword)')"
printf '%-45s %s\n' "passwordless.* calls:" \
  "$(count '\.passwordless\.(sendEmail|sendSMS|loginWithEmail|loginWithSMS)')"
printf '%-45s %s\n' "backchannel.* calls:" \
  "$(count '\.backchannel\.(authorize|backchannelGrant)')"
printf '%-45s %s\n' "tokenExchange.* calls:" \
  "$(count '\.tokenExchange\.exchangeToken')"
printf '%-45s %s\n' "expires_in occurrences (inspect):" \
  "$(count 'expires_in')"
printf '%-45s %s\n' "ManagementClient refs (leave alone):" \
  "$(count 'ManagementClient')"

echo
echo "Next: use the routing decision above and the constructor mapping in Section 3,"
echo "then apply the four structural changes from Section 4 before rewriting each call site."
```

Use the output to decide:
1. **Which call sites to migrate** — everything AuthenticationClient/UserInfoClient-related.
2. **Which target SDK** — see the decision procedure in the introduction above.
3. **What NOT to touch** — ManagementClient usage stays on `auth0`.

---

## Section 3: Install the target SDK and rewrite the constructor

### Import rewrites

```ts
// before
import { AuthenticationClient, UserInfoClient, AuthApiError } from 'auth0';

// after — auth-js target
import { AuthClient, TokenByCodeError, TokenByPasswordError } from '@auth0/auth0-auth-js';

// after — server-js target
import { ServerClient } from '@auth0/auth0-server-js';
```

### node-auth0 `AuthenticationClient` → `@auth0/auth0-auth-js` `AuthClient`

```ts
// before
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
  agent: dispatcher,             // an undici Dispatcher instance
  fetch: customFetch,
  middleware: [...],
});

// after
import { AuthClient } from '@auth0/auth0-auth-js';

new AuthClient({
  domain: 'tenant.us.auth0.com',       // same (no https:// scheme)
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
| `useMTLS` | `useMtls` | **Renamed** (lowercase `tls`). |
| `fetch` | `customFetch` | **Renamed.** |
| `telemetry: boolean` | `telemetry: TelemetryConfig` | Now a structured object. |
| `headers` (global) | per-call `RequestOptions.headers` | Moved to per-request options; set per call site rather than globally. |
| `timeoutDuration` | per-call `RequestOptions.signal` (AbortSignal timeout) | Use `AbortSignal.timeout(ms)` on the call. |
| `retry` | (configure via `customFetch`) | Wrap your fetch with retry if needed. |
| `agent` | (configure via `customFetch`) | Set the dispatcher inside your custom fetch. |
| `middleware` | `customFetch` | Compose behavior in the fetch wrapper. |
| `idTokenSigningAlg` | — (internal) | ID-token validation is internal; read `TokenResponse.claims`. |
| `clockTolerance` | — (internal) | Handled internally during validation. |

### Migrating global config to per-request options

node-auth0's global `headers`, `timeoutDuration`, `agent`, `retry`, and `middleware` options
do not have direct constructor equivalents in auth0-auth-js. Methods accept a trailing
`RequestOptions` parameter:

```ts
import type { RequestOptions } from '@auth0/auth0-auth-js';

const tokens = await authClient.getTokenByClientCredentials(
  { audience: 'https://api.example.com' },
  {
    headers: { 'X-Custom': 'value' },
    signal: AbortSignal.timeout(5000), // timeout in ms
  } satisfies RequestOptions
);
```

**Type import:** `@auth0/auth0-server-js` re-exports `RequestOptions`, `ApiResponse`, and
`FullResponseOption` from `@auth0/auth0-auth-js`, so you can import any of them from either
package.

**Arity rule:** MFA methods (`authClient.mfa.*`) take `requestOptions` as the 2nd argument;
store-first methods on `serverClient` take it as the 3rd argument after the store context; cache
hits ignore it entirely.

**Common patterns:**

- **Global headers:** Apply via `RequestOptions.headers` on each call, or wrap `customFetch`
  once to inject everywhere.
- **Timeout:** Replace `timeoutDuration: 10000` with `signal: AbortSignal.timeout(10000)` on
  the call.
- **Agent (Node.js dispatcher):** Wrap `customFetch` to inject the agent into the HTTP transport.
- **Retry / middleware:** Compose behavior in a `customFetch` wrapper passed at construction or
  per request.

### `@auth0/auth0-server-js` `ServerClient` constructor

ServerClient wraps an `AuthClient` and adds the session machinery. It shares the auth options
and **adds required stores**:

```ts
import { ServerClient } from '@auth0/auth0-server-js';

new ServerClient({
  domain: 'tenant.us.auth0.com',       // string, or a DomainResolver for multi-tenant
  clientId: '...',
  clientSecret: '...',                 // or clientAssertionSigningKey / mTLS
  authorizationParams: {
    scope: 'openid profile email offline_access', // offline_access => refresh tokens
    audience: 'https://api.example.com',
    redirect_uri: 'https://app.example.com/callback',
  },
  transactionStore,   // REQUIRED — holds the in-flight login (state, PKCE verifier)
  stateStore,         // REQUIRED — holds the established session (user + tokens)
  stateIdentifier: '__a0_session',    // cookie/store key (default)
  transactionIdentifier: '__a0_tx',  // cookie/store key (default)
  customFetch: fetch,
  useMtls: false,
  telemetry: { ... },
});
```

The `transactionStore` and `stateStore` have **no node-auth0 counterpart** — they are the
session substrate. See Section 7 for how to construct them.

---

## Section 4: The four cross-cutting structural changes

Every call-site rewrite is subject to four changes that cut across all methods. They cause the
overwhelming majority of migration defects. All four are silent in plain JavaScript — the code
runs but produces wrong behavior at runtime. In TypeScript, the compiler catches the
return-shape and casing changes at compile time; only the `expires_in`→`expiresAt` expiry
change compiles clean in both JS and TS, so that is the one to hunt manually. Apply each change
deliberately, not just the method rename.

1. Return shape: `JSONApiResponse<T>` → domain object directly
2. Casing: snake_case wire shape → camelCase
3. Token expiry: `expires_in` (relative) → `expiresAt` (absolute) — **most dangerous**
4. Error model: `AuthApiError` → typed per-operation errors

---

### 4.1 Return shape: `JSONApiResponse<T>` → domain object

#### What changed

node-auth0 wraps most Authentication API results in a response envelope:

- `JSONApiResponse<T>` — has `.data` (the payload), `.status` (number), `.statusText`,
  `.headers` (a `Headers` object).
- `VoidApiResponse` — same envelope, `.data` is `undefined` (used by `sendEmail`,
  `revokeRefreshToken`, etc.).
- `TextApiResponse` — `.data` is a `string` (used by `database.changePassword`).

**Exception:** `backchannel.authorize`, `backchannel.backchannelGrant`, and
`tokenExchange.exchangeToken` return domain objects directly (no `.data` wrapper) in node-auth0.

The new SDKs **drop the envelope** and return the domain object directly:

- Token grants return a `TokenResponse` instance.
- `database.signUp` returns a `SignUpResult` object.
- `database.changePassword` returns a `string`.
- `sendEmail` / `sendSms` / `revokeToken` return `void`.

HTTP metadata (status code, headers such as `x-request-id`, rate-limit headers) is available
through the per-operation error objects on failure paths. On **success paths**, metadata is
available via the opt-in `fullResponse` envelope (see "Reading HTTP response metadata" below).

#### The rewrite

Delete `.data` indirection on every success path:

```ts
// before
const resp = await auth0.oauth.clientCredentialsGrant({ audience });
const token = resp.data.access_token;
const status = resp.status;

// after
const tokens = await authClient.getTokenByClientCredentials({ audience });
const token = tokens.accessToken;
```

```ts
// before — changePassword returned TextApiResponse
const resp = await auth0.database.changePassword({ email, connection });
console.log(resp.data);

// after — returns the string directly
const message = await authClient.database.changePassword({ email, connection });
console.log(message);
```

#### Reading HTTP response metadata (fullResponse)

When your node-auth0 code reads HTTP response metadata on a **success path**, migrate to the
opt-in envelope rather than dropping the read. This is most common for rate-limit tracking,
request-id logging, or retry-after telemetry:

```ts
// before (node-auth0): metadata on the success envelope
const resp = await auth0.oauth.clientCredentialsGrant({ audience });
const remaining = resp.headers.get('x-ratelimit-remaining');
const token = resp.data.access_token;

// after: opt in to the envelope
const { data, response } = await authClient.getTokenByClientCredentials(
  { audience, fullResponse: true });
const remaining = response.headers.get('x-ratelimit-remaining');
const token = data.accessToken;
```

The same opt-in covers non-token Authentication API methods:

| Method | Bare return | `fullResponse: true` return |
|---|---|---|
| `database.signUp` | `SignUpResult` | `ApiResponse<SignUpResult>` |
| `database.changePassword` | `string` | `ApiResponse<string>` |
| `passwordless.sendEmail` | `void` | `ApiResponse<void>` (`data` is `undefined`) |
| `passwordless.sendSms` | `void` | `ApiResponse<void>` (`data` is `undefined`) |

```ts
// before (node-auth0): read the request id off the signup envelope
const resp = await auth0.database.signUp({ email, password, connection });
const reqId = resp.headers.get('x-request-id');

// after: opt in to the envelope
const { data, response } = await authClient.database.signUp(
  { email, password, connection, fullResponse: true });
const reqId = response.headers.get('x-request-id');

// void-returning methods expose the Response with an undefined `data`
const { response: sendResp } = await authClient.passwordless.sendEmail(
  { email, fullResponse: true });
const rateLimit = sendResp.headers.get('x-ratelimit-remaining');
```

**Caveats:**

- Pass `fullResponse: true` as a literal, not a variable. Using spread —
  `{ ...opts, fullResponse: true }` — widens `true` to `boolean`, causing TypeScript overload
  resolution to fall back to the bare return type. Fix: `{ ...opts, fullResponse: true as const }`.
- When `fullResponse: true` is requested on a **token** method and a cached token is still valid,
  the cache is bypassed to force a token-endpoint round-trip. Repeated calls with this flag on a
  hot cache will trigger repeated exchanges.
- Reserved headers: a caller `Authorization` header is ignored and the `Auth0-Client` telemetry
  header always wins; `RequestOptions.headers` cannot override them.
- Per-request `customFetch` replaces the base transport for that call but does not inherit mTLS;
  if you rely on mTLS, the supplied fetch must itself be mTLS-capable.

**Decision guidance:** default to the bare return type. Reach for `fullResponse` only where the
customer actually consumed response metadata on success. `MissingCapturedResponseError` is an
internal-bug sentinel; customers do not normally catch it.

#### Gotchas

- **Void methods.** Code that did `const r = await auth0.passwordless.sendEmail(...)` and then
  checked `r.status === 200` must drop that check — by default the method returns `void` and
  throws on failure. Rely on the thrown error instead. If success status/headers are genuinely
  needed, opt into `fullResponse: true` to get an `ApiResponse<void>` whose `response` carries
  the status/headers.
- **Header reads.** Any code reading `resp.headers.get('x-ratelimit-remaining')` on a success
  path needs the opt-in `fullResponse` envelope. Search the customer's code for `.headers` on
  response values.
- **Do not hand-roll a compatibility shim.** Resist reintroducing a custom `{ data, status }`
  shape. Let the domain object flow through; it keeps the migration honest and avoids a
  compatibility shim you would have to maintain.

---

### 4.2 Casing: snake_case wire shape → camelCase

#### What changed

node-auth0's public API exposes the **snake_case wire shape** verbatim on both inputs and
outputs. The new SDKs use **camelCase** for the public API and only translate to snake_case at
the HTTP boundary internally.

#### Input parameters — field map

| node-auth0 (snake_case) | new SDK (camelCase) |
|---|---|
| `client_id` | `clientId` |
| `client_secret` | `clientSecret` |
| `refresh_token` | `refreshToken` |
| `redirect_uri` | (via `authorizationParams.redirect_uri` on config / builder) |
| `code_verifier` | `codeVerifier` |
| `phone_number` | `phoneNumber` |
| `auth_req_id` | `authReqId` |
| `binding_message` | `bindingMessage` |
| `subject_token` / `subject_token_type` | `subjectToken` / `subjectTokenType` |
| `given_name` / `family_name` | `givenName` / `familyName` |
| `user_metadata` | `userMetadata` |
| `login_hint` | `loginHint` |

#### Output fields — `TokenResponse` field map

| node-auth0 `TokenSet` (snake_case) | new SDK `TokenResponse` (camelCase) |
|---|---|
| `access_token` | `accessToken` |
| `refresh_token` | `refreshToken` |
| `id_token` | `idToken` |
| `token_type` | `tokenType` |
| `expires_in` (relative seconds) | `expiresAt` (**absolute Unix timestamp — see §4.3**) |
| `scope` | `scope` |
| — (had to decode id_token yourself) | `claims` (already-decoded ID token claims) |
| `authorization_details` | `authorizationDetails` |

#### The rewrite

Rename fields on both the arguments you pass in and the fields you read out. Watch nested objects
(`user_metadata`, `authorization_details`) — the nested keys inside `userMetadata` are your own
application data and are **not** re-cased by the SDK; only the SDK's own known fields change.

```ts
// before
const resp = await auth0.oauth.refreshTokenGrant({ refresh_token: rt });
const newRt = resp.data.refresh_token;
const idToken = resp.data.id_token;

// after
const tokens = await authClient.getTokenByRefreshToken({ refreshToken: rt });
const newRt = tokens.refreshToken;
const idToken = tokens.idToken;
```

> **Keys that look renamed but are your data:** `user_metadata` → `userMetadata` is a rename of
> the SDK's parameter. The object *inside* it (e.g. `{ plan: 'free' }`) is passed through
> untouched. Do not rename the customer's own metadata keys.

---

### 4.3 Token expiry: `expires_in` (relative) → `expiresAt` (absolute)

**This is the highest-risk change in the migration. It is silent, it compiles, and it corrupts
session lifetimes.**

#### What changed

- node-auth0 `TokenSet.expires_in` = the token's **lifetime in seconds relative to now**
  (e.g. `86400` for a 24-hour token). This is the raw OAuth `expires_in` from the wire.
- new SDK `TokenResponse.expiresAt` = an **absolute Unix timestamp in seconds** (e.g.
  `1786000000`) computed by the SDK as roughly `now + expires_in`.

#### Why it bites

Existing node-auth0 code almost always converts the relative value to an absolute deadline:

```ts
// before — very common node-auth0 pattern
const resp = await auth0.oauth.refreshTokenGrant({ refresh_token: rt });
const expiresAtMs = Date.now() + resp.data.expires_in * 1000; // stored deadline
```

If you mechanically rename `expires_in` → `expiresAt` and leave the arithmetic:

```ts
// WRONG — double-counts "now"
const tokens = await authClient.getTokenByRefreshToken({ refreshToken: rt });
const expiresAtMs = Date.now() + tokens.expiresAt * 1000; // ~ now + (now + lifetime) → far future
```

The stored deadline lands decades in the future, so the token is treated as valid long after it
has actually expired → 401s in production that the app never proactively refreshes.

#### The rewrite

`expiresAt` is *already* the deadline. Do not add `Date.now()`.

```ts
// after — correct
const tokens = await authClient.getTokenByRefreshToken({ refreshToken: rt });
const expiresAtMs = tokens.expiresAt * 1000; // absolute; convert s → ms only if you store ms
```

If downstream code genuinely needs the *relative* remaining lifetime (e.g. to set a cookie
`Max-Age`), compute it from the absolute value:

```ts
const secondsRemaining = tokens.expiresAt - Math.floor(Date.now() / 1000);
```

#### How to find every instance

The residue check in Section 8 flags `expires_in` arithmetic, but also grep the customer's code
for these patterns and inspect each by hand:

- `expires_in`
- `Date.now() +` near a token result
- `+ expires` / `* 1000` near a token result
- any stored field named `expiresAt`, `expires_at`, `expiry`, `tokenExpiry` fed from a grant

Every one of these is a candidate for the double-count bug.

---

### 4.4 Error model: `AuthApiError` → typed per-operation errors

#### What changed

node-auth0 throws a single error type for Authentication API failures:

```ts
class AuthApiError extends Error {
  name: 'AuthApiError';
  error: string;             // OAuth error code, e.g. 'invalid_grant'
  error_description: string;
  statusCode: number;
  body: string;
  headers: Headers;
}
```

The new SDKs throw **typed, per-operation error classes** — `TokenByCodeError`,
`TokenByRefreshTokenError`, `TokenByClientCredentialsError`, `TokenByPasswordError`,
`TokenExchangeError`, `TokenRevocationError`, `PasswordlessStartError`,
`PasswordlessChallengeError`, `PasswordlessDbGetTokenError`, `MfaEnrollmentError`, etc. Each
carries a structured `.cause` (the underlying OAuth2 error) rather than flat `error` /
`error_description` strings.

#### The rewrite — generic catch

```ts
// before
try {
  await auth0.oauth.refreshTokenGrant({ refresh_token: rt });
} catch (e) {
  if (e instanceof AuthApiError && e.error === 'invalid_grant') {
    // refresh token revoked/expired
  }
}

// after
import { TokenByRefreshTokenError } from '@auth0/auth0-auth-js';
try {
  await authClient.getTokenByRefreshToken({ refreshToken: rt });
} catch (e) {
  if (e instanceof TokenByRefreshTokenError && e.cause?.error === 'invalid_grant') {
    // refresh token revoked/expired
  }
}
```

Import the specific error class for the operation you are calling. If the customer had one broad
`catch (e instanceof AuthApiError)` around several different operations, either widen to catch
each operation's error type or check the shared base behavior — but prefer the specific type per
call site, since it documents which operation can fail.

#### MFA detection

```ts
// before
try {
  await auth0.oauth.passwordGrant({ username, password });
} catch (e) {
  if (e instanceof AuthApiError && e.error === 'mfa_required') {
    // start MFA flow using e (mfa_token is in the body)
  }
}

// after
import { TokenByPasswordError } from '@auth0/auth0-auth-js';
try {
  await authClient.getTokenByPassword({ username, password });
} catch (e) {
  if (e instanceof TokenByPasswordError && e.cause?.error === 'mfa_required') {
    // drive the MFA challenge via authClient.mfa.*
  }
}
```

> After detecting `mfa_required`, the MFA enroll/challenge/verify flow that node-auth0 handled
> ad hoc now lives on `authClient.mfa.*` (`listAuthenticators`, `enrollAuthenticator`,
> `challengeAuthenticator`, `verify`). In server-js, `serverClient.mfa.verify()` also persists
> the resulting tokens to the session.

#### ID-token validation types

node-auth0 exposed `IDTokenValidateOptions` and `IdTokenValidatorError` for callers doing manual
ID-token validation. The new SDK validates ID tokens internally and exposes the decoded, validated
result as `TokenResponse.claims`.

`IDTokenValidateOptions` and `IdTokenValidatorError` are removed in the new SDK. Delete all
manual ID-token validation code — the new SDK handles nonce, max_age, and other validation
internally during the grant call and exposes the decoded, verified claims as
`TokenResponse.claims`. There is no caller-facing `nonce` or `maxAge` option on
`getTokenByCode`; delete those call sites entirely:

```ts
// before — manual ID-token validation
import { IDTokenValidateOptions, IdTokenValidatorError } from 'auth0';
// ... validator.validate(idToken, { nonce: 'abc', maxAge: 300 }) ...

// after — delete all manual ID-token validation; read the claims the SDK already verified
const tokens = await authClient.getTokenByCode(callbackUrl, { codeVerifier });
const claims = tokens.claims; // decoded, validated ID token claims
// Remove IDTokenValidateOptions, IdTokenValidatorError, and any IDTokenValidator imports.
```

---

### 4.5 Checklist per call site

For every node-auth0 auth call you rewrite, confirm all four:

- [ ] **Return shape** — removed `.data` / `.status` / `.headers` access on the success path.
- [ ] **Casing** — renamed every snake_case field on input args and output reads to camelCase.
- [ ] **Expiry** — any code using the old `expires_in` now uses `expiresAt` as an *absolute*
      timestamp; no `Date.now() +` was left in front of it.
- [ ] **Errors** — `AuthApiError` catches replaced with the specific typed error (`.cause.error`);
      for `mfa_required`, check `e.cause?.error === 'mfa_required'` on the typed error.

---

## Section 5: Apply the four structural changes at every call site

The four structural changes from Section 4 are **mandatory at every call site** — apply them
simultaneously with the method rename in Section 6. That combination is the source of nearly all
migration bugs.

---

## Section 6: Method-by-method API mapping

**How to read this section:** unless a row explicitly routes to `@auth0/auth0-server-js`, the
replacement lives on the `@auth0/auth0-auth-js` `AuthClient` (or one of its sub-clients:
`authClient.database`, `authClient.passwordless`, `authClient.mfa`, `authClient.passkey`).

**Before you touch any method,** internalize the four structural changes in Section 4 — return
shape, casing, `expires_in` → `expiresAt`, and error model. This section shows the method and
parameter mapping; Section 4 shows the field-level and error-level mapping. You need both.

---

### `AuthenticationClient.oauth.*` → `AuthClient` methods

node-auth0's OAuth sub-client is the largest surface. All of these move onto the `AuthClient`
instance directly (not a sub-client).

#### `oauth.authorizationCodeGrant` → `getTokenByCode`

The single most important semantic change in the whole migration.

> **Server-js routing:** If your routing decision is `@auth0/auth0-server-js`, do NOT use
> `getTokenByCode` for the callback handler. Use
> `serverClient.completeInteractiveLogin(callbackUrl, storeOptions)` instead (covered in
> Section 7). Skip the rest of this entry.

**node-auth0** — you pass the raw authorization `code` (and `redirect_uri`) that you extracted
from the callback query string yourself:

```ts
import { AuthenticationClient } from 'auth0';

const auth0 = new AuthenticationClient({ domain, clientId, clientSecret });

// You parsed `code` out of the callback URL yourself.
const resp = await auth0.oauth.authorizationCodeGrant({
  code,
  redirect_uri: 'https://app.example.com/callback',
});
const accessToken = resp.data.access_token;
const expiresIn = resp.data.expires_in; // relative seconds
const reqId = resp.headers.get('x-request-id'); // metadata on success envelope
```

**auth0-auth-js** — you pass the **entire callback `URL`**. The SDK extracts
`code` and performs the PKCE exchange. `redirect_uri` comes from the `AuthClient`
config / `authorizationParams`, not the call.

> **CSRF: validate `state` before calling `getTokenByCode`.** `AuthClient.getTokenByCode`
> does NOT compare the callback `state` against your stored transaction state. You must do
> this yourself before calling the method; abort on mismatch. If you use
> `@auth0/auth0-server-js`, prefer `completeInteractiveLogin()` — it validates and consumes
> the transaction internally so you never hand-roll the state check.

```ts
import { AuthClient } from '@auth0/auth0-auth-js';

const authClient = new AuthClient({ domain, clientId, clientSecret });

// `callbackUrl` is a URL object for the full incoming request URL,
// e.g. new URL(req.url, `https://${req.headers.host}`)

// 1. Validate state BEFORE exchanging the code (CSRF protection).
const callbackState = callbackUrl.searchParams.get('state');
if (!callbackState || callbackState !== storedState) {
  throw new Error('State mismatch — possible CSRF attack; abort the flow.');
}

// 2. Exchange the code for tokens.
const tokens = await authClient.getTokenByCode(callbackUrl, {
  codeVerifier: verifier, // PKCE: the verifier you persisted before the redirect
});
const accessToken = tokens.accessToken;
const expiresAt = tokens.expiresAt; // absolute Unix seconds (not relative)
```

> **PKCE is the only supported flow for `getTokenByCode`.** Pass the `codeVerifier` you
> persisted before the redirect.

> **Gotcha:** if the customer's code manually parses `req.query.code`, that parsing is now the
> SDK's job. Delete it and hand the SDK the full URL. **Header reads on success:** if the
> node-auth0 code read `resp.headers.get(...)` on success (for rate-limit telemetry or
> request-id logging), see Section 4.1 "Reading HTTP response metadata (fullResponse)" for the
> opt-in envelope.

#### `oauth.authorizationCodeGrantWithPKCE` → `getTokenByCode` (with verifier)

**node-auth0:**

```ts
const resp = await auth0.oauth.authorizationCodeGrantWithPKCE({
  code,
  code_verifier: verifier,
  redirect_uri: 'https://app.example.com/callback',
});
```

**auth0-auth-js** — PKCE is folded into the same method; supply the code verifier via options.
Typically the verifier was produced earlier by `buildAuthorizationUrl` (see below), which returns
a `codeVerifier` for you to persist:

```ts
const tokens = await authClient.getTokenByCode(callbackUrl, {
  codeVerifier: verifier,
});
```

> If the customer builds the authorization URL themselves today, prefer switching them to
> `authClient.buildAuthorizationUrl()` (below) so the SDK generates and returns the
> `codeVerifier`, then persist it and pass it back to `getTokenByCode`.

#### `oauth.refreshTokenGrant` → `getTokenByRefreshToken`

```ts
// node-auth0
const resp = await auth0.oauth.refreshTokenGrant({ refresh_token: rt });
// auth0-auth-js
const tokens = await authClient.getTokenByRefreshToken({ refreshToken: rt });
```

#### `oauth.passwordGrant` → `getTokenByPassword`

```ts
// node-auth0
const resp = await auth0.oauth.passwordGrant({
  username, password, realm: 'Username-Password-Authentication', audience, scope,
});
// auth0-auth-js
const tokens = await authClient.getTokenByPassword({
  username, password, realm: 'Username-Password-Authentication', audience, scope,
});
```

#### `oauth.clientCredentialsGrant` → `getTokenByClientCredentials`

The canonical M2M grant. This is the most common reason to stay on **auth0-auth-js** rather than
adopt server-js — there is no user session involved.

```ts
// node-auth0
const resp = await auth0.oauth.clientCredentialsGrant({ audience: 'https://api.example.com' });
const token = resp.data.access_token;
// auth0-auth-js
const tokens = await authClient.getTokenByClientCredentials({ audience: 'https://api.example.com' });
const token = tokens.accessToken;
```

#### `oauth.revokeRefreshToken` → `revokeToken`

Renamed, and simplified return (was `VoidApiResponse`, now `void`).

```ts
// node-auth0
await auth0.oauth.revokeRefreshToken({ token: rt });
// auth0-auth-js
await authClient.revokeToken({ token: rt });
```

> **Session apps:** if you are migrating to server-js and this revoke was part of logout, use
> `serverClient.revokeRefreshToken()` (it reads the refresh token from the session) instead of
> the low-level `revokeToken`. See Section 7.

#### `oauth.tokenForConnection` → `exchangeToken` (Token Vault)

`getTokenForConnection` also exists on `AuthClient` but is **deprecated**; prefer `exchangeToken`.

```ts
// node-auth0
const resp = await auth0.oauth.tokenForConnection({
  connection: 'google-oauth2',
  subject_token: refreshToken,
  subject_token_type: 'urn:ietf:params:oauth:token-type:refresh_token',
  login_hint: userId,
});
// auth0-auth-js (Token Vault exchange overload)
const tokens = await authClient.exchangeToken({
  connection: 'google-oauth2',
  subjectToken: refreshToken,
  subjectTokenType: 'urn:ietf:params:oauth:token-type:refresh_token',
  loginHint: userId,
});
```

#### `oauth.pushedAuthorization` (PAR) → `buildAuthorizationUrl({ pushedAuthorizationRequests: true })`

There is **no standalone PAR method** in the new SDK. Pushed Authorization is a flag on the
authorization-URL builder. The SDK performs the PAR POST and returns an authorization URL that
references the resulting `request_uri`.

```ts
// node-auth0 — explicit PAR call returning { request_uri, expires_in }
const resp = await auth0.oauth.pushedAuthorization({
  response_type: 'code',
  redirect_uri: 'https://app.example.com/callback',
});
// build the /authorize URL yourself from resp.data.request_uri ...

// auth0-auth-js — PAR is handled inside buildAuthorizationUrl
const { authorizationUrl, codeVerifier } = await authClient.buildAuthorizationUrl({
  pushedAuthorizationRequests: true,
  authorizationParams: { redirect_uri: 'https://app.example.com/callback' },
});
// redirect the user to authorizationUrl; persist codeVerifier for the callback
```

> Requires the tenant to expose a `pushed_authorization_request_endpoint`. The SDK throws if PAR
> is requested but unsupported by tenant metadata.

#### Authorization-URL and logout-URL builders

node-auth0 left `/authorize` URL construction to the caller (or to `express-openid-connect`).
The new SDK gives you `buildAuthorizationUrl()` and `buildLogoutUrl()`:

```ts
const { authorizationUrl, codeVerifier } = await authClient.buildAuthorizationUrl({
  authorizationParams: { redirect_uri, scope: 'openid profile email', audience },
});
// ... later, on logout:
const logoutUrl = await authClient.buildLogoutUrl({ returnTo: 'https://app.example.com' });
```

---

### `AuthenticationClient.database.*` → `authClient.database.*`

Database connection operations move to the `authClient.database` sub-client. Names and required
params are unchanged; only casing and return shape change.

#### `database.signUp` → `authClient.database.signUp`

```ts
// node-auth0
const resp = await auth0.database.signUp({
  email, password, connection: 'Username-Password-Authentication',
  given_name: 'Ada', family_name: 'Lovelace', user_metadata: { plan: 'free' },
});
const userId = resp.data.id;
// auth0-auth-js
const result = await authClient.database.signUp({
  email, password, connection: 'Username-Password-Authentication',
  givenName: 'Ada', familyName: 'Lovelace', userMetadata: { plan: 'free' },
});
const userId = result.id;
```

> **ID normalization is preserved.** node-auth0 mapped the server's `_id | user_id | id` onto a
> single `id`. The new SDK does the same, so `result.id` is always present. Do not add your own
> `_id` fallback.
>
> **Header reads on success:** node-auth0's `resp.headers`/`resp.status` on the signup envelope
> map to `fullResponse: true`, which returns `ApiResponse<SignUpResult>` (`{ data, response }`).
> See Section 4.1 "Reading HTTP response metadata (fullResponse)".

#### `database.changePassword` → `authClient.database.changePassword`

Note the return type: node-auth0 returned a `TextApiResponse` (read via `.data`); the new SDK
returns the plain `string` directly.

```ts
// node-auth0
const resp = await auth0.database.changePassword({
  email, connection: 'Username-Password-Authentication',
});
const message = resp.data; // plain-text confirmation
// auth0-auth-js
const message = await authClient.database.changePassword({
  email, connection: 'Username-Password-Authentication',
});
```

> **Header reads on success:** if the node-auth0 code read response headers on the success path,
> see Section 4.1 "Reading HTTP response metadata (fullResponse)".

---

### `AuthenticationClient.passwordless.*` → split: `authClient.passwordless.*` + grant methods

node-auth0 lumped "start" (send the code/link) and "login" (redeem the code) onto one sub-client.
The new SDK **splits** them: starting stays on `authClient.passwordless`; redeeming a code
becomes a top-level grant method on `AuthClient`.

#### `passwordless.sendEmail` → `authClient.passwordless.sendEmail`

```ts
// node-auth0
await auth0.passwordless.sendEmail({ email, send: 'code' });
// auth0-auth-js
await authClient.passwordless.sendEmail({ email, send: 'code' });
```

> **Default changed.** node-auth0 defaulted `send` to `'link'` (magic link). The new SDK defaults
> `send` to `'code'` (OTP). If the customer relied on the implicit default to send magic links,
> set `send: 'link'` explicitly.

#### `passwordless.sendSMS` → `authClient.passwordless.sendSms`

Note the casing change: `sendSMS` → `sendSms`, and `phone_number` → `phoneNumber`.

```ts
// node-auth0
await auth0.passwordless.sendSMS({ phone_number: '+15551234567' });
// auth0-auth-js
await authClient.passwordless.sendSms({ phoneNumber: '+15551234567' });
```

> **Header reads on success:** `sendEmail` and `sendSms` return `void` by default. If the
> node-auth0 code read `resp.headers`/`resp.status` off the `VoidApiResponse`, opt into
> `fullResponse: true` to get an `ApiResponse<void>`. See Section 4.1.

#### `passwordless.loginWithEmail` → `getTokenByPasswordlessEmail`

Redeeming the OTP is now a **grant method on `AuthClient`**, not on the passwordless sub-client.

```ts
// node-auth0
const resp = await auth0.passwordless.loginWithEmail({ email, code, audience, scope });
const token = resp.data.access_token;
// auth0-auth-js
const tokens = await authClient.getTokenByPasswordlessEmail({ email, code, audience, scope });
const token = tokens.accessToken;
```

#### `passwordless.loginWithSMS` → `getTokenByPasswordlessSms`

```ts
// node-auth0
const resp = await auth0.passwordless.loginWithSMS({ phone_number, code });
// auth0-auth-js
const tokens = await authClient.getTokenByPasswordlessSms({ phoneNumber, code });
```

> **Session apps:** server-js exposes `startPasswordless` / `completePasswordless` /
> `completePasswordlessMagicLink`, which both send the code and establish a session. Use those
> instead of the two-step auth-js flow when the SDK owns the session.

---

### `AuthenticationClient.backchannel.*` (CIBA) → `AuthClient` backchannel methods

#### `backchannel.authorize` → `initiateBackchannelAuthentication`

```ts
// node-auth0
const resp = await auth0.backchannel.authorize({
  binding_message: 'ABC123', scope: 'openid', userId: 'auth0|123',
});
const authReqId = resp.auth_req_id;
// auth0-auth-js
const { authReqId, expiresIn, interval } = await authClient.initiateBackchannelAuthentication({
  bindingMessage: 'ABC123', loginHint: { sub: 'auth0|123' }, authorizationParams: { scope: 'openid' },
});
```

#### `backchannel.backchannelGrant` → `backchannelAuthenticationGrant`

```ts
// node-auth0
const resp = await auth0.backchannel.backchannelGrant({ auth_req_id: authReqId });
// auth0-auth-js
const tokens = await authClient.backchannelAuthenticationGrant({ authReqId });
```

> **One-shot convenience:** `authClient.backchannelAuthentication({ ... })` initiates *and* polls
> to completion, returning a `TokenResponse`. Use it if the customer's code did the
> initiate-then-poll loop by hand.
>
> **Session apps:** server-js exposes `loginBackchannel(...)` which runs CIBA and establishes a
> session in one call.

---

### `AuthenticationClient.tokenExchange.*` (RFC 8693) → `exchangeToken`

```ts
// node-auth0
const resp = await auth0.tokenExchange.exchangeToken({
  subject_token_type: 'urn:example:custom',
  subject_token: token,
  audience: 'https://api.example.com',
  scope: 'read',
});
// auth0-auth-js
const tokens = await authClient.exchangeToken({
  subjectTokenType: 'urn:example:custom',
  subjectToken: token,
  audience: 'https://api.example.com',
  scope: 'read',
});
```

> `exchangeToken` is overloaded: a custom-exchange profile shape (`subjectTokenType` +
> `subjectToken` + `audience`) and a Token-Vault shape (`connection` present). Presence of
> `connection` routes to the vault path. The custom-exchange profile is the RFC 8693 replacement
> for `tokenExchange.exchangeToken`.
>
> **Session apps:** server-js exposes `loginWithCustomTokenExchange` (exchange and establish
> session) and `customTokenExchange` (exchange, return tokens, no session).

---

### `UserInfoClient` → `TokenResponse.claims` / `authClient.getUserInfo` / `serverClient.getUser`

The standalone `UserInfoClient` from node-auth0 does not exist in the new SDK. Choose the
replacement based on what the app needs:

| Customer's intent | Replacement |
|---|---|
| Wanted user profile claims right after login | Read `TokenResponse.claims` — the SDK already decodes the ID token. No extra `/userinfo` round-trip needed. **Preferred.** |
| Wanted a live `/userinfo` response for an arbitrary access token (auth-js) | `await authClient.getUserInfo({ accessToken })` — direct method on `AuthClient`. |
| Wanted the profile in a server-rendered app with a session | `await serverClient.getUser()` returns the stored user claims from the session. |
| Genuinely needs a raw `/userinfo` fetch | Call the `/userinfo` endpoint directly with `fetch`. The endpoint is in the tenant's server metadata (`getServerMetadata()`). |

**Before (node-auth0):**

```ts
import { UserInfoClient } from 'auth0';
const userInfo = new UserInfoClient({ domain });
const resp = await userInfo.getUserInfo(accessToken);
const profile = resp.data; // { sub, name, email, ... }
```

**After — preferred, use the claims you already have:**

```ts
const tokens = await authClient.getTokenByCode(callbackUrl, { codeVerifier });
const profile = tokens.claims; // { sub, name, email, ... } decoded from the id_token
```

**After — direct method (auth0-auth-js), when you only have an access token:**

```ts
// authClient.getUserInfo() takes an options object: { accessToken, expectedSubject? }
const profile = await authClient.getUserInfo({ accessToken });
// { sub, name, email, ... }
```

**After — raw fetch fallback:**

```ts
const metadata = await authClient.getServerMetadata();
const resp = await fetch(metadata.userinfo_endpoint, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const profile = await resp.json();
```

> Prefer reading `claims` over any `/userinfo` call: it avoids a network round-trip and the
> claims are already validated by the SDK.

---

### Quick lookup table

| node-auth0 | New SDK equivalent | Layer |
|---|---|---|
| `oauth.authorizationCodeGrant` | `authClient.getTokenByCode(url, opts)` (auth-js) or `serverClient.completeInteractiveLogin(url, storeOpts)` — see the Session section below (server-js) | auth-js / server-js |
| `oauth.authorizationCodeGrantWithPKCE` | `authClient.getTokenByCode(url, { codeVerifier })` | auth-js |
| `oauth.refreshTokenGrant` | `authClient.getTokenByRefreshToken({ refreshToken })` | auth-js |
| `oauth.passwordGrant` | `authClient.getTokenByPassword({ ... })` | auth-js |
| `oauth.clientCredentialsGrant` | `authClient.getTokenByClientCredentials({ audience })` | auth-js |
| `oauth.revokeRefreshToken` | `authClient.revokeToken({ token })` / `serverClient.revokeRefreshToken()` | auth-js / server-js |
| `oauth.tokenForConnection` | `authClient.exchangeToken({ connection, ... })` | auth-js |
| `oauth.pushedAuthorization` | `authClient.buildAuthorizationUrl({ pushedAuthorizationRequests: true })` | auth-js |
| `database.signUp` | `authClient.database.signUp({ ... })` | auth-js |
| `database.changePassword` | `authClient.database.changePassword({ ... })` | auth-js |
| `passwordless.sendEmail` | `authClient.passwordless.sendEmail({ ... })` | auth-js |
| `passwordless.sendSMS` | `authClient.passwordless.sendSms({ phoneNumber })` | auth-js |
| `passwordless.loginWithEmail` | `authClient.getTokenByPasswordlessEmail({ ... })` | auth-js |
| `passwordless.loginWithSMS` | `authClient.getTokenByPasswordlessSms({ ... })` | auth-js |
| `backchannel.authorize` | `authClient.initiateBackchannelAuthentication({ ... })` | auth-js |
| `backchannel.backchannelGrant` | `authClient.backchannelAuthenticationGrant({ authReqId })` | auth-js |
| `tokenExchange.exchangeToken` | `authClient.exchangeToken({ subjectTokenType, subjectToken, audience })` | auth-js |
| `UserInfoClient.getUserInfo` | `TokenResponse.claims` (preferred) / `authClient.getUserInfo({ accessToken })` / `serverClient.getUser()` / raw `/userinfo` fetch | auth-js / server-js |
| (no equivalent) — build `/authorize` URL | `authClient.buildAuthorizationUrl({ ... })` | auth-js |
| (no equivalent) — build `/v2/logout` URL | `authClient.buildLogoutUrl({ returnTo })` | auth-js |
| `ManagementClient.*` | **not migrated — stays on `auth0`** | — |

---

## Section 7: Session layer (auth0-server-js only)

**Skip this section** if your routing decision is `@auth0/auth0-auth-js`.

This section applies only when the customer wants the SDK to own the login redirect flow,
session storage, cookies, token refresh, and logout. **This is a rewrite of the session
handling, not a method-for-method port.** node-auth0 had no session concept, so there is
nothing to translate line-for-line. Instead you *replace* the customer's existing session code
(their `express-session` wiring, their token cache, their refresh-on-expiry logic, their logout
handler) with the ServerClient lifecycle. Routes, views, and business logic stay put.

---

### Mental model

A ServerClient login has three durable pieces:

1. **Transaction store** — short-lived. Holds the in-flight login: the OAuth `state` and the
   PKCE `code_verifier` between the moment you redirect the user to Auth0 and the moment they
   come back to your callback. Created at `startInteractiveLogin`, consumed at
   `completeInteractiveLogin`.
2. **State store** — long-lived. Holds the established session: the user claims plus the access /
   refresh / ID tokens and their absolute expiry. Read on every subsequent request via `getUser`,
   `getSession`, `getAccessToken`.
3. **Cookies** — how the two stores key themselves to the browser. With a *stateless* store the
   session data lives encrypted in the cookie itself; with a *stateful* store the cookie holds
   only an identifier and the data lives in your backend (Redis, DB, etc.).

node-auth0 exposed none of this; the customer built equivalents by hand. You are swapping their
implementation for the SDK's.

---

### Store setup

`@auth0/auth0-server-js` ships store base classes and cookie-backed implementations:

- `CookieTransactionStore` — transaction store backed entirely by a cookie. Good default.
- `StatelessStateStore` — session lives encrypted in the cookie. No server-side storage; good
  for serverless / horizontally-scaled deployments with small sessions.
- `StatefulStateStore` — session lives server-side; the cookie holds an id. Use for large
  sessions or when you need server-side revocation.
- `AbstractStateStore` / `AbstractTransactionStore` — subclassable base classes. Extend
  `AbstractStateStore` for a custom session/state store, or `AbstractTransactionStore` for a
  custom transaction store. Alternatively, implement the `SessionStore` data-adapter interface
  (`{ get(id), set(id,data), delete(id), deleteByLogoutToken(claims,opts?) }`) and pass it as
  the backing `store` option to `StatefulStateStore`. Do NOT `extend SessionStore`.

All stores accept a `CookieHandler` so they can integrate with any framework's cookie API. The
`storeOptions` generic (`TStoreOptions`) is how you thread per-request context (like the
framework `req`/`res`) into store reads/writes — every ServerClient method takes an optional
trailing `storeOptions` argument for exactly this.

```ts
import {
  ServerClient,
  CookieTransactionStore,
  StatelessStateStore,
} from '@auth0/auth0-server-js';

const serverClient = new ServerClient({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  authorizationParams: {
    redirect_uri: 'https://app.example.com/callback',
    scope: 'openid profile email offline_access', // offline_access => refresh token
    audience: 'https://api.example.com',
  },
  transactionStore: new CookieTransactionStore(
    { secret: process.env.SESSION_SECRET! },
    cookieHandler // CookieHandler<TStoreOptions> implementation
  ),
  stateStore: new StatelessStateStore(
    { secret: process.env.SESSION_SECRET! },
    cookieHandler // CookieHandler<TStoreOptions> implementation
  ),
});
```

---

### The redirect-login lifecycle

#### 1. Start login — replace the hand-built `/authorize` redirect

Whatever the customer did to send the user to Auth0 (a hand-constructed `/authorize` URL, or
`express-openid-connect`'s `/login`) becomes:

```ts
// GET /login
app.get('/login', async (req, res) => {
  const authorizationUrl = await serverClient.startInteractiveLogin(
    {
      authorizationParams: { /* optional per-login overrides */ },
      appState: { returnTo: req.query.returnTo || '/' }, // seed appState for round-trip
    },
    { req, res }, // storeOptions — lets the transaction store write its cookie
  );
  res.redirect(authorizationUrl.href);
});
```

`startInteractiveLogin` generates `state` + PKCE, writes them to the transaction store, and
returns the fully-formed authorization URL.

#### 2. Complete login — replace the manual code exchange

The callback handler that used to call `oauth.authorizationCodeGrant` (or
`authorizationCodeGrantWithPKCE`) and then stuff tokens into the session becomes a single call:

```ts
// GET /callback
app.get('/callback', async (req, res) => {
  const callbackUrl = new URL(req.url, `https://${req.headers.host}`);
  const { appState } = await serverClient.completeInteractiveLogin(callbackUrl, { req, res });
  // Session is now established in the state store. Tokens are NOT your concern anymore.

  // Validate returnTo before redirecting to prevent open-redirect attacks.
  // Accept only safe relative paths: starts with "/" but not "//" (protocol-relative)
  // and contains no URL scheme (http:, javascript:, data:, etc.).
  // For absolute URLs, maintain an explicit allowlist of trusted origins instead.
  const returnTo = appState?.returnTo;
  const isSafeRelative = (
    typeof returnTo === 'string' &&
    returnTo.startsWith('/') &&
    !returnTo.includes('\\') &&  // reject backslash: browsers normalize \ → /, enabling bypass
    !returnTo.startsWith('//') &&
    !/^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(returnTo) // rejects any scheme prefix
  );
  res.redirect(isSafeRelative ? returnTo : '/');
});
```

`completeInteractiveLogin` validates `state`, exchanges the code, validates the ID token, writes
the session (user + tokens + absolute expiry) to the state store, and clears the transaction.

> **Open-redirect safety:** `appState.returnTo` originates from `req.query.returnTo` set in the
> login handler above. Although it round-trips through Auth0's opaque state parameter and cannot
> be injected mid-flight, the original query parameter comes from the browser and must be
> validated before passing to `res.redirect()`. The guard above covers the common case. For
> multi-origin apps, replace the `isSafeRelative` check with an explicit allowlist of permitted
> base URLs.

#### 3. Read the user / session on later requests

Replace `req.session.user` reads:

```ts
const user = await serverClient.getUser({ req, res });       // user claims, or undefined
const session = await serverClient.getSession({ req, res }); // full session data, or undefined
```

`getUser` / `getSession` return `undefined` when there is no session or it has expired (the store
deletes expired sessions on read), so use that as your "not logged in" signal.

#### 4. Get an access token to call an API — refresh is automatic

Replace the customer's manual "is the token expired? if so refresh" block:

```ts
const { accessToken } = await serverClient.getAccessToken({}, { req, res });
// If the stored access token is expired and a refresh token exists,
// the SDK refreshes and persists the new tokens transparently.
```

The `expires_in` → `expiresAt` hazard from Section 4.3 disappears entirely here: the SDK owns
expiry math. Delete the customer's `Date.now() + expires_in * 1000` bookkeeping.

For a downstream federated connection token (Token Vault), use
`serverClient.getAccessTokenForConnection({ connection }, { req, res })`.

#### 5. Logout — replace manual revoke + session clear + `/v2/logout` redirect

```ts
// GET /logout
app.get('/logout', async (req, res) => {
  const logoutUrl = await serverClient.logout(
    { returnTo: 'https://app.example.com' },
    { req, res }
  );
  res.redirect(logoutUrl.href);
});
```

`logout` clears the session from the state store AND automatically best-effort-revokes the
session refresh token before deletion. Do NOT call `serverClient.revokeRefreshToken({ req, res })`
on the logout path — the session is already gone by the time logout returns and the call will
throw `MissingSessionError`. Use `revokeRefreshToken` only for standalone revocation (revoking
a token without ending the session).

---

### Non-redirect logins that also establish a session

If the customer used node-auth0 for a non-redirect login (passwordless, CIBA,
custom token exchange) *and* wants a server-js session out of it, use the ServerClient methods
that both authenticate and write the session:

| Flow | ServerClient method |
|---|---|
| Backchannel / CIBA | `loginBackchannel({ ... }, storeOptions)` |
| Passwordless (verify code → session) | `completePasswordless({ connection, email \| phoneNumber, verificationCode }, storeOptions)` |
| Passwordless magic link (callback → session) | `completePasswordlessMagicLink(url, storeOptions)` |
| Custom token exchange → session | `loginWithCustomTokenExchange({ ... }, storeOptions)` |
| MFA verify → session | `serverClient.mfa.verify({ ... }, storeOptions)` |

Each of these performs the underlying grant *and* persists the resulting tokens to the state
store, so the user is logged in afterward.

**Passwordless initiation** — `startPasswordless({ connection, email | phoneNumber, ... }, storeOptions)` sends the OTP or magic link and stores the pending anti-forgery transaction. It does NOT exchange tokens or establish a session. Call `completePasswordless` or `completePasswordlessMagicLink` to finish the flow and create the session.

**Password grant (ROPC)** — `ServerClient` has no password-grant session method. Migrations from `oauth.passwordGrant` stay on `@auth0/auth0-auth-js` (`authClient.getTokenByPassword`) and the app owns session handling. There is no server-js session bridge for ROPC.

---

### Backchannel logout (OIDC back-channel logout)

If the customer implemented an Auth0 back-channel logout endpoint by hand (validating the logout
token, then clearing their session store), replace it with:

```ts
// POST /backchannel-logout
app.post('/backchannel-logout', async (req, res) => {
  await serverClient.handleBackchannelLogout(req.body.logout_token, { req, res });
  res.sendStatus(204);
});
```

It validates the logout token and clears the corresponding session.

---

### What you did NOT change

- Route definitions, controllers, templates, and business logic are untouched — you only swapped
  the auth/session mechanism they call into.
- The Management API (`ManagementClient`) is not part of this and stays on the `auth0` package.

---

## Section 8: Post-migration verification

The migration is not complete until all verification steps pass. Run the following in sequence.
If **any** step fails, fix the reported issues and start the loop again from step 1. **Do not
declare the migration complete until the loop converges** — all steps pass in a single iteration.

---

### Step 1: Residue check

Run this residue scan against the customer's source root. It exits non-zero if any high-signal
residue is found, so it can gate CI. Replace `<path-to-src>` with the source directory.

```bash
set -uo pipefail
ROOT="${1:-<path-to-src>}"

if [ ! -d "$ROOT" ]; then
  echo "error: '$ROOT' is not a directory" >&2
  echo "usage: bash <this-block> <path-to-src>" >&2
  exit 2
fi

FILE_GLOBS=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
            --include='*.mjs' --include='*.cjs' --include='*.cts' --include='*.mts')
EXCLUDES=(--exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
          --exclude-dir=.git --exclude-dir=coverage)
FAILED=0

check() {
  local label="$1" regex="$2" hint="$3"
  local hits
  hits="$(grep -rEn "${FILE_GLOBS[@]}" "${EXCLUDES[@]}" "$regex" "$ROOT" 2>/dev/null || true)"
  if [ -n "$hits" ]; then
    printf '\n[FAIL] %s\n' "$label"
    printf '       %s\n' "$hint"
    printf '%s\n' "$hits" | sed 's/^/       /'
    FAILED=1
  else
    printf '[ ok ] %s\n' "$label"
  fi
}

echo "verify-migration — residue check"
echo "root: $ROOT"
echo

check "No residual AuthenticationClient" \
  "new[[:space:]]+AuthenticationClient" \
  "Replace with AuthClient (@auth0/auth0-auth-js) or ServerClient (@auth0/auth0-server-js)."

check "No residual UserInfoClient" \
  "UserInfoClient" \
  "Use TokenResponse.claims, serverClient.getUser(), or a direct /userinfo fetch."

check "No residual node-auth0 auth sub-client calls" \
  "new[[:space:]]+AuthenticationClient|UserInfoClient|\.oauth\.(authorizationCodeGrant|authorizationCodeGrantWithPKCE|refreshTokenGrant|passwordGrant|clientCredentialsGrant|revokeRefreshToken|tokenForConnection|pushedAuthorization)|\.passwordless\.(loginWithEmail|loginWithSMS)|\.backchannel\.(authorize|backchannelGrant)|\.tokenExchange\.exchangeToken" \
  "Map each call using the API mapping table in the 'Method-by-method API mapping' section above."

check "No '.data.' access on token/grant results" \
  "\.(data)\.(access_token|refresh_token|id_token|expires_in|token_type)" \
  "New SDKs return the domain object directly; read tokens.accessToken, not resp.data.access_token."

check "No relative expires_in arithmetic" \
  "Date\.now\(\)[[:space:]]*\+[^;]*expires_in|expires_in[[:space:]]*\*[[:space:]]*1000" \
  "expiresAt is an ABSOLUTE Unix timestamp (seconds). Do not add Date.now(). See Section 4.3."
# NOTE: This grep catches the most common forms but cannot reliably detect all expiry math.
# For example, 'Date.now() + tokens.expiresAt * 1000' passes the grep but is wrong —
# expiresAt is already absolute Unix seconds, so no Date.now() addition is needed.
# Manually audit every expression that multiplies or adds to an expiry-related value.

check "No AuthApiError catches" \
  "AuthApiError" \
  "Use the typed per-operation error (e.g. TokenByRefreshTokenError) and check e.cause.error."

check "No 'mfa_required' string checks" \
  "['\"]mfa_required['\"]" \
  "Check e.cause?.error === 'mfa_required' on the typed per-operation error instead of string matching."

echo
if [ "$FAILED" -ne 0 ]; then
  echo "RESULT: residue found — resolve the [FAIL] items above, then re-run."
  echo "After this passes, run the project's own type-check, lint, and tests."
  exit 1
fi
echo "RESULT: no residue detected. Now run the project's own type-check, lint, and tests."
```

---

### Step 2: Type-check (TypeScript projects only)

Run the TypeScript compiler only when the project has TypeScript sources or a tsconfig. Do not
run `tsc` unconditionally on JavaScript-only projects — it will fail spuriously or pick up
unrelated errors.

```bash
# Guard: only run tsc if the project is TypeScript
if find . -maxdepth 4 -name "tsconfig.json" -not -path "*/node_modules/*" | grep -q . \
   || find . -maxdepth 4 -name "*.ts" ! -name "*.d.ts" -not -path "*/node_modules/*" | grep -q .; then
  echo "TypeScript project detected — running tsc --noEmit"
  npx tsc --noEmit
else
  echo "No TypeScript detected — skipping tsc check."
fi
```

---

### Step 3: Run the project's test suite

```bash
npm test  # or the project's test command (yarn test, pnpm test, jest, vitest, etc.)
```

---

### Step 4: Run the linter

If the project has a linter configured:

```bash
npm run lint  # or the project's lint command
```

If all four steps pass in a single iteration, the migration is complete.
