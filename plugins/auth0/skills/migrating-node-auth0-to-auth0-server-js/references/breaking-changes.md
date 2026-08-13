# Breaking Changes: the four cross-cutting rewrites

Every call-site rewrite in [api-mapping.md](api-mapping.md) is subject to four changes that cut
across all methods. They cause the overwhelming majority of migration defects, and three of the
four are *silent* — the code compiles and often runs, but produces wrong behavior at runtime.
Apply each one deliberately.

1. [Return shape: `JSONApiResponse<T>` → domain object](#1-return-shape)
2. [Casing: snake_case wire shape → camelCase](#2-casing)
3. [Token expiry: `expires_in` (relative) → `expiresAt` (absolute)](#3-token-expiry) ← most dangerous
4. [Error model: `AuthApiError` → typed per-operation errors](#4-error-model)

---

## 1. Return shape

### What changed

node-auth0 wraps most Authentication API results in a response envelope:

- `JSONApiResponse<T>` — has `.data` (the payload), `.status` (number), `.statusText`,
  `.headers` (a `Headers` object).
- `VoidApiResponse` — same envelope, `.data` is `undefined` (used by `sendEmail`, `revokeRefreshToken`, …).
- `TextApiResponse` — `.data` is a `string` (used by `database.changePassword`).

**Exception:** `backchannel.authorize`, `backchannel.backchannelGrant`, and
`tokenExchange.exchangeToken` return domain objects directly (no `.data` wrapper) in node-auth0.

The new SDKs **drop the envelope** and return the domain object directly:

- Token grants return a `TokenResponse` instance (see §2 and §3 for its fields).
- `database.signUp` returns a `SignUpResult` object.
- `database.changePassword` returns a `string`.
- `sendEmail` / `sendSms` / `revokeToken` return `void`.

HTTP metadata (status code, response headers such as `x-request-id`, `retry-after`, rate-limit
headers) is available through the per-operation error objects and, where relevant, through
`RequestOptions` — you do not read it off the success value's envelope anymore.

### The rewrite

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

### Gotchas

- **Void methods.** Code that did `const r = await auth0.passwordless.sendEmail(...)` and then
  checked `r.status === 200` must drop that check — the method now returns `void` and throws on
  failure. Rely on the thrown error instead (see §4).
- **Header reads.** Any code reading `resp.headers.get('x-ratelimit-remaining')` on a *success*
  path needs to move that read to where the SDK surfaces it (per-request options / error cause),
  not the success value. Search the customer's code for `.headers` on response values.
- **Do not "helpfully" re-wrap.** Resist reintroducing a `{ data, status }` shape to minimize
  downstream diff. Let the domain object flow through; it keeps the migration honest and avoids a
  compatibility shim you would have to maintain.

---

## 2. Casing

### What changed

node-auth0's public API exposes the **snake_case wire shape** verbatim, on both inputs and
outputs. The new SDKs use **camelCase** for the public API and only translate to snake_case at the
HTTP boundary internally.

### Input parameters — field map

| node-auth0 (snake_case) | new SDK (camelCase) |
|---|---|
| `client_id` | `clientId` |
| `client_secret` | `clientSecret` |
| `refresh_token` | `refreshToken` |
| `redirect_uri` | (via `authorizationParams.redirect_uri` on config / builder — see mapping notes) |
| `code_verifier` | `codeVerifier` |
| `phone_number` | `phoneNumber` |
| `auth_req_id` | `authReqId` |
| `binding_message` | `bindingMessage` |
| `subject_token` / `subject_token_type` | `subjectToken` / `subjectTokenType` |
| `given_name` / `family_name` | `givenName` / `familyName` |
| `user_metadata` | `userMetadata` |
| `login_hint` | `loginHint` |

### Output fields — `TokenResponse` field map

| node-auth0 `TokenSet` (snake_case) | new SDK `TokenResponse` (camelCase) |
|---|---|
| `access_token` | `accessToken` |
| `refresh_token` | `refreshToken` |
| `id_token` | `idToken` |
| `token_type` | `tokenType` |
| `expires_in` (relative) | `expiresAt` (**absolute — see §3**) |
| `scope` | `scope` |
| — (had to decode id_token yourself) | `claims` (already-decoded ID token claims) |
| `authorization_details` | `authorizationDetails` |

### The rewrite

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

### Gotcha: keys that look renamed but are your data

`user_metadata` → `userMetadata` is a rename of the **SDK's** parameter. The object *inside* it
(e.g. `{ plan: 'free' }`) is passed through untouched. Do not rename the customer's own metadata
keys.

---

## 3. Token expiry

**This is the highest-risk change in the migration. It is silent, it compiles, and it corrupts
session lifetimes.**

### What changed

- node-auth0 `TokenSet.expires_in` = the token's **lifetime in seconds relative to now**
  (e.g. `86400` for a 24-hour token). This is the raw OAuth `expires_in` from the wire.
- new SDK `TokenResponse.expiresAt` = an **absolute Unix timestamp in seconds** (e.g.
  `1786000000`) computed by the SDK as roughly `now + expires_in`.

### Why it bites

Existing node-auth0 code almost always converts the relative value to an absolute deadline itself:

```ts
// before — very common node-auth0 pattern
const resp = await auth0.oauth.refreshTokenGrant({ refresh_token: rt });
const expiresAtMs = Date.now() + resp.data.expires_in * 1000; // stored deadline
```

If you mechanically rename `expires_in` → `expiresAt` and leave the arithmetic, you get:

```ts
// WRONG — double-counts "now"
const tokens = await authClient.getTokenByRefreshToken({ refreshToken: rt });
const expiresAtMs = Date.now() + tokens.expiresAt * 1000; // ~ now + (now + lifetime) → far future
```

The stored deadline lands decades in the future, so the token is treated as valid long after it
has actually expired → 401s in production that the app never proactively refreshes.

### The rewrite

`expiresAt` is *already* the deadline. Do not add `Date.now()`.

```ts
// after — correct
const tokens = await authClient.getTokenByRefreshToken({ refreshToken: rt });
const expiresAtMs = tokens.expiresAt * 1000; // absolute; convert s → ms only if you store ms
```

If some downstream code genuinely needs the *relative* remaining lifetime (e.g. to set a cookie
`Max-Age`), compute it from the absolute value:

```ts
const secondsRemaining = tokens.expiresAt - Math.floor(Date.now() / 1000);
```

### How to find every instance

The verification script flags `expires_in` arithmetic residue, but also grep the customer's code
for these patterns and inspect each by hand:

- `expires_in`
- `Date.now() +` near a token result
- `+ expires` / `* 1000` near a token result
- any stored field named `expiresAt`, `expires_at`, `expiry`, `tokenExpiry` fed from a grant

Every one of these is a candidate for the double-count bug.

---

## 4. Error model

### What changed

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
`TokenExchangeError`, `TokenRevocationError`, `PasswordlessStartError`, `PasswordlessChallengeError`,
`PasswordlessDbGetTokenError`, `MfaEnrollmentError`, etc. Each carries a structured `.cause` (the
underlying OAuth2 error) rather than flat `error` / `error_description` strings.

### The rewrite — generic catch

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

### MFA detection — use the type guard, not the string

A very common node-auth0 pattern is detecting `mfa_required` by string comparison to route the
user into an MFA challenge:

```ts
// before
try {
  await auth0.oauth.passwordGrant({ username, password });
} catch (e) {
  if (e instanceof AuthApiError && e.error === 'mfa_required') {
    // start MFA flow using e (mfa_token is in the body)
  }
}
```

The new SDK provides `isMfaRequiredError()`, a type guard that narrows the error and gives typed
access to the MFA context (including the `mfa_token`). Use it instead of matching the string:

```ts
// after
import { isMfaRequiredError } from '@auth0/auth0-auth-js';
try {
  await authClient.getTokenByPassword({ username, password });
} catch (e) {
  if (isMfaRequiredError(e)) {
    // e is narrowed; drive the MFA challenge via authClient.mfa.*
  }
}
```

> After detecting `mfa_required`, the MFA enroll/challenge/verify flow that node-auth0 handled
> ad hoc now lives on `authClient.mfa.*` (`listAuthenticators`, `enrollAuthenticator`,
> `challengeAuthenticator`, `verify`). In server-js, `serverClient.mfa.verify()` also persists the
> resulting tokens to the session.

### ID-token validation types

node-auth0 exposed `IDTokenValidateOptions` and `IdTokenValidatorError` for callers doing manual
ID-token validation. The new SDK validates ID tokens internally during grants and exposes the
decoded, validated result as `TokenResponse.claims`. Replace manual validation:

- Options like `organization`, `nonce`, `maxAge` are passed to the grant call (e.g.
  `getTokenByCode`), and the SDK validates them and throws a typed error on mismatch — you no
  longer construct a validator or catch `IdTokenValidatorError` yourself.
- Read the validated claims from `TokenResponse.claims` instead of decoding the `id_token` string.

---

## Checklist per call site

For every node-auth0 auth call you rewrite, confirm all four:

- [ ] **Return shape** — removed `.data` / `.status` / `.headers` access on the success path.
- [ ] **Casing** — renamed every snake_case field on input args and output reads to camelCase.
- [ ] **Expiry** — any code using the old `expires_in` now uses `expiresAt` as an *absolute*
      timestamp; no `Date.now() +` was left in front of it.
- [ ] **Errors** — `AuthApiError` catches replaced with the specific typed error (`.cause.error`);
      `mfa_required` string checks replaced with `isMfaRequiredError()`.
