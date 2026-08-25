# API Mapping: node-auth0 → auth0-auth-js / auth0-server-js

This is the complete method-by-method mapping from the node-auth0 `AuthenticationClient` (and
`UserInfoClient`) to their modern equivalents. It is organized by node-auth0 sub-client so you
can migrate one call site at a time.

**How to read the "after" column:** unless a row explicitly routes to `@auth0/auth0-server-js`,
the replacement lives on the `@auth0/auth0-auth-js` `AuthClient` (or one of its sub-clients:
`authClient.database`, `authClient.passwordless`, `authClient.mfa`, `authClient.passkey`).

**Before you touch any method,** internalize the three structural changes that apply to *every*
row — return shape, casing, and `expires_in` → `expiresAt` — plus the error-model change. Those
are documented in full in [breaking-changes.md](breaking-changes.md). This file shows the
method/parameter mapping; that file shows the field-level and error-level mapping. You need both.

---

## Naming conventions used throughout

| node-auth0 | new SDKs |
|---|---|
| Params and response fields use the **snake_case wire shape**: `client_id`, `refresh_token`, `access_token`, `expires_in`, `phone_number` | camelCase: `clientId`, `refreshToken`, `accessToken`, `expiresAt`, `phoneNumber` |
| Methods take a `bodyParameters` object (+ optional `initOverrides`) | Methods take a single `options` object (+ optional trailing `RequestOptions` for per-call `signal`, `headers`, `customFetch`) |
| Every method returns a `JSONApiResponse<T>` / `VoidApiResponse` / `TextApiResponse` wrapper | Methods return the domain object directly (`TokenResponse`, `SignUpResult`, `string`, `void`) |

---

## `AuthenticationClient.oauth.*` → `AuthClient` methods

node-auth0's OAuth sub-client is the largest surface. All of these move onto the `AuthClient`
instance directly (not a sub-client).

### `oauth.authorizationCodeGrant` → `getTokenByCode`

The single most important semantic change in the whole migration.

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
const reqId = resp.headers.get('x-request-id'); // metadata on success
```

**auth0-auth-js** — you pass the **entire callback `URL`**. The SDK extracts `code` and validates
`state` for you. `redirect_uri` comes from the `AuthClient` config / `authorizationParams`, not
the call:

```ts
import { AuthClient } from '@auth0/auth0-auth-js';

const authClient = new AuthClient({ domain, clientId, clientSecret });

// `callbackUrl` is a URL object for the full incoming request URL,
// e.g. new URL(req.url, `https://${req.headers.host}`)
const tokens = await authClient.getTokenByCode(callbackUrl, {
  // options; e.g. expectedState if you manage state yourself
});
const accessToken = tokens.accessToken;
const expiresAt = tokens.expiresAt; // absolute Unix seconds
```

> **Gotcha:** if the customer's code manually parses `req.query.code`, that parsing is now the
> SDK's job. Delete it and hand the SDK the full URL. If they were tracking `state` in a cookie,
> pass it via the options so the SDK can validate it. **Header reads on success:** if the node-auth0
> code read `resp.headers.get(...)` on success (for rate-limit telemetry or request-id logging), see
> [breaking-changes.md → Reading HTTP response metadata (fullResponse)](breaking-changes.md#reading-http-response-metadata-fullresponse)
> for the opt-in envelope. Error-path metadata remains accessible on the typed error.

### `oauth.authorizationCodeGrantWithPKCE` → `getTokenByCode` (with verifier)

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

### `oauth.refreshTokenGrant` → `getTokenByRefreshToken`

```ts
// node-auth0
const resp = await auth0.oauth.refreshTokenGrant({ refresh_token: rt });
// auth0-auth-js
const tokens = await authClient.getTokenByRefreshToken({ refreshToken: rt });
```

### `oauth.passwordGrant` → `getTokenByPassword`

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

### `oauth.clientCredentialsGrant` → `getTokenByClientCredentials`

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

### `oauth.revokeRefreshToken` → `revokeToken`

Renamed, and simplified return (was `VoidApiResponse`, now `void`).

```ts
// node-auth0
await auth0.oauth.revokeRefreshToken({ token: rt });
// auth0-auth-js
await authClient.revokeToken({ token: rt });
```

> **Session apps:** if you are migrating to server-js and this revoke was part of logout, use
> `serverClient.revokeRefreshToken()` (it reads the refresh token from the session) instead of
> the low-level `revokeToken`. See [server-js-sessions.md](server-js-sessions.md).

### `oauth.tokenForConnection` → `exchangeToken` (Token Vault)

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

### `oauth.pushedAuthorization` (PAR) → `buildAuthorizationUrl({ pushedAuthorizationRequests: true })`

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

### There was no authorization-URL builder in node-auth0 — introduce one

node-auth0 left `/authorize` URL construction to the caller (or to `express-openid-connect`).
The new SDK gives you `buildAuthorizationUrl()` and `buildLogoutUrl()`. When migrating a redirect
login, replace hand-built `/authorize` and `/v2/logout` URLs with these:

```ts
const { authorizationUrl, codeVerifier } = await authClient.buildAuthorizationUrl({
  authorizationParams: { redirect_uri, scope: 'openid profile email', audience },
});
// ... later, on logout:
const logoutUrl = await authClient.buildLogoutUrl({ returnTo: 'https://app.example.com' });
```

---

## `AuthenticationClient.database.*` → `authClient.database.*`

Database connection operations move to the `authClient.database` sub-client. Names and required
params are unchanged; only casing and return shape change.

### `database.signUp` → `authClient.database.signUp`

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
> See [breaking-changes.md → Reading HTTP response metadata (fullResponse)](breaking-changes.md#reading-http-response-metadata-fullresponse).

### `database.changePassword` → `authClient.database.changePassword`

Note the return type: node-auth0 returned a `TextApiResponse` (read via `.data`); the new SDK
returns the plain `string` directly.

```ts
// node-auth0
const resp = await auth0.database.changePassword({ email, connection: 'Username-Password-Authentication' });
const message = resp.data; // plain-text confirmation
// auth0-auth-js
const message = await authClient.database.changePassword({ email, connection: 'Username-Password-Authentication' });
```

> **Header reads on success:** If the node-auth0 code read response headers on the success path, see
> [breaking-changes.md → Reading HTTP response metadata (fullResponse)](breaking-changes.md#reading-http-response-metadata-fullresponse).

---

## `AuthenticationClient.passwordless.*` → split: `authClient.passwordless.*` + grant methods

node-auth0 lumped "start" (send the code/link) and "login" (redeem the code) onto one sub-client.
The new SDK **splits** them: starting stays on `authClient.passwordless`; redeeming a code becomes
a top-level grant method on `AuthClient`.

### `passwordless.sendEmail` → `authClient.passwordless.sendEmail`

```ts
// node-auth0
await auth0.passwordless.sendEmail({ email, send: 'code' });
// auth0-auth-js
await authClient.passwordless.sendEmail({ email, send: 'code' });
```

> **Default changed.** node-auth0 defaulted `send` to `'link'` (magic link). The new SDK defaults
> `send` to `'code'` (OTP). If the customer relied on the implicit default to send magic links,
> set `send: 'link'` explicitly.

### `passwordless.sendSMS` → `authClient.passwordless.sendSms`

Note the casing change: `sendSMS` → `sendSms`, and `phone_number` → `phoneNumber`.

```ts
// node-auth0
await auth0.passwordless.sendSMS({ phone_number: '+15551234567' });
// auth0-auth-js
await authClient.passwordless.sendSms({ phoneNumber: '+15551234567' });
```

> **Header reads on success:** `sendEmail` and `sendSms` return `void` by default. If the node-auth0
> code read `resp.headers`/`resp.status` off the `VoidApiResponse`, opt into `fullResponse: true` to
> get an `ApiResponse<void>` (`data` is `undefined`; `response` carries status/headers). See
> [breaking-changes.md → Reading HTTP response metadata (fullResponse)](breaking-changes.md#reading-http-response-metadata-fullresponse).

### `passwordless.loginWithEmail` → `getTokenByPasswordlessEmail`

Redeeming the OTP is now a **grant method on `AuthClient`**, not on the passwordless sub-client.

```ts
// node-auth0
const resp = await auth0.passwordless.loginWithEmail({ email, code, audience, scope });
const token = resp.data.access_token;
// auth0-auth-js
const tokens = await authClient.getTokenByPasswordlessEmail({ email, code, audience, scope });
const token = tokens.accessToken;
```

### `passwordless.loginWithSMS` → `getTokenByPasswordlessSms`

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

## `AuthenticationClient.backchannel.*` (CIBA) → `AuthClient` backchannel methods

### `backchannel.authorize` → `initiateBackchannelAuthentication`

```ts
// node-auth0
const resp = await auth0.backchannel.authorize({
  binding_message: 'ABC123', scope: 'openid', userId: 'auth0|123',
});
const authReqId = resp.auth_req_id;
// auth0-auth-js
const { authReqId, expiresIn, interval } = await authClient.initiateBackchannelAuthentication({
  bindingMessage: 'ABC123', scope: 'openid', loginHint: 'auth0|123',
});
```

### `backchannel.backchannelGrant` → `backchannelAuthenticationGrant`

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

## `AuthenticationClient.tokenExchange.*` (RFC 8693) → `exchangeToken`

```ts
// node-auth0
const resp = await auth0.tokenExchange.exchangeToken({
  subject_token_type: 'urn:example:custom', subject_token: token, audience: 'https://api.example.com', scope: 'read',
});
// auth0-auth-js
const tokens = await authClient.exchangeToken({
  subjectTokenType: 'urn:example:custom', subjectToken: token, audience: 'https://api.example.com', scope: 'read',
});
```

> `exchangeToken` is overloaded: a custom-exchange profile shape (`subjectTokenType` +
> `subjectToken` + `audience`) and a Token-Vault shape (`connection` present). Presence of
> `connection` routes to the vault path. The custom-exchange profile is the RFC 8693 replacement
> for `tokenExchange.exchangeToken`.
>
> **Session apps:** server-js exposes `loginWithCustomTokenExchange` (exchange → establish
> session) and `customTokenExchange` (exchange → return tokens, no session).

---

## `UserInfoClient` → `TokenResponse.claims` or `authClient.userinfo.getUserInfo()` or `serverClient.getUser()`

The standalone `UserInfoClient` from node-auth0 does not exist in the new SDK. In `@auth0/auth0-auth-js`
v1.12.1+ there **is** an `authClient.userinfo` sub-client (added in
[auth0-auth-js PR #228](https://github.com/auth0/auth0-auth-js/pull/228)). Choose the replacement
based on what the app needs:

| Customer's intent | Replacement |
|---|---|
| Wanted user profile claims right after login | Read `TokenResponse.claims` from the grant result — the SDK already decodes the ID token. No extra `/userinfo` round-trip needed. Preferred. |
| Wanted a live `/userinfo` response for an arbitrary access token (auth-js v1.12.1+) | `await authClient.userinfo.getUserInfo(accessToken)` — the new sub-client. |
| Wanted the profile in a server-rendered app with a session | `await serverClient.getUser()` returns the stored user claims from the session. |
| Genuinely needs a raw `/userinfo` fetch on older SDK versions | Call the `/userinfo` endpoint directly with `fetch`. The endpoint is in the tenant's server metadata (`getServerMetadata()`). |

**Before (node-auth0):**

```ts
import { UserInfoClient } from 'auth0';
const userInfo = new UserInfoClient({ domain });
const resp = await userInfo.getUserInfo(accessToken);
const profile = resp.data; // { sub, name, email, ... }
```

**After — preferred, use the claims you already have:**

```ts
const tokens = await authClient.getTokenByCode(callbackUrl, {});
const profile = tokens.claims; // { sub, name, email, ... } decoded from the id_token
```

**After — sub-client (auth0-auth-js v1.12.1+), when you only have an access token:**

```ts
// authClient.userinfo is available in @auth0/auth0-auth-js v1.12.1+
const profile = await authClient.userinfo.getUserInfo(accessToken);
// { sub, name, email, ... }
```

**After — raw fetch fallback (older SDK versions):**

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

## Quick lookup table

| node-auth0 | new SDK equivalent | Layer |
|---|---|---|
| `oauth.authorizationCodeGrant` | `authClient.getTokenByCode(url, opts)` | auth-js |
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
| `UserInfoClient.getUserInfo` | `TokenResponse.claims` (preferred) / `authClient.userinfo.getUserInfo()` (auth-js v1.12.1+) / `serverClient.getUser()` / raw `/userinfo` fetch | auth-js / server-js |
| (no equivalent) — build `/authorize` URL | `authClient.buildAuthorizationUrl({ ... })` | auth-js |
| (no equivalent) — build `/v2/logout` URL | `authClient.buildLogoutUrl({ returnTo })` | auth-js |
| `ManagementClient.*` | **not migrated — stays on `auth0`** | — |
