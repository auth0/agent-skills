# @auth0/ai-mcp (Node.js) errors and fixes

SDK-specific errors only. Tenant setup errors are in the hub.

---

## A new tool's scope is never requested at login

**Error:** The MCP client does not ask for the new tool's scope when the user logs in, and the tool answers `isError`.

**Fix:** Add the scope to `metadata.scopesSupported` of the handler. The client learns which scopes to ask for from the protected resource metadata and the challenge. Scopes in `requiredScopes` are published automatically, per-tool scopes are not. Also add the scope to the MCP API and to the client's grant (a grant update replaces the whole list), then sign in again.

---

## A request with a missing or bad token gets a `401`

**Error:** The response is a `401` with a `WWW-Authenticate` header.

**Fix:** This is the expected response. A missing credential gets a bare `Bearer resource_metadata="..."` challenge, and a token that fails verification gets `error="invalid_token"`. Both carry `scope="..."` when `requiredScopes` is set. The request stops before any tool. The body is generic and never says why, so check the token: `aud` must equal `AUTH0_AUDIENCE` exactly, `iss` must be `https://<domain>/`, and `exp` must be in the future. To see the exact reason, run `client.verifyAccessToken({ accessToken })` in a script with the same settings. A tenant that cannot be reached for discovery or keys also answers `401` and does not call `onError`, so a burst of `401`s for valid tokens means check connectivity.

---

## A `400` with `invalid_request`

**Error:** `400` with `error="invalid_request"`.

**Fix:** The `Authorization` or `DPoP` header is malformed (for example `Bearer a b`), or a token or proof is longer than 8192 characters. Print the header you send. Keep the tokens for your MCP API small if they carry many permissions.

---

## A `403` with `insufficient_scope` on the whole request

**Error:** `403` with `error="insufficient_scope"` before any tool runs.

**Fix:** The token lacks a scope of the handler's `requiredScopes`. The `scope` parameter of the challenge lists every required scope, so compare it with the `scope` claim of the token. Grant the scopes to the client and make it request them. Matching is exact, with no hierarchy: `mcp:write` does not satisfy `mcp:read`.

---

## A tool call fails because the token lacks the tool's scope

**Error:** The tool returns `isError: true` with `_meta.error` of `insufficient_scope` and the text `Missing one or more required scopes.` (from `withRequiredScopes`), or `InsufficientScopeError` is thrown (from `requireScopes`).

**Fix:** The check runs inside the tool, so the HTTP status stays `200`. Only the server-wide `requiredScopes` can make a client authorize again. Make sure the incoming token carries the tool's scope. `permissions` is never consulted, only the `scope` claim. If RBAC is on for the API, the user also needs the permission, because Auth0 puts in the token only the scopes the user's roles grant.

---

## `getTokenOnBehalfOf` throws `DownscopedTokenError`

**Error:** The exchange threw `DownscopedTokenError`, or the tool returned an `isError` result because of it.

**Fix:** It throws on purpose, so a tool never runs with less access than it asked for. Give the OBO client a user-subject grant on that downstream API that includes exactly the scopes the tool requests. A scope that no API defines is dropped, so a request for only such a scope fails the same way. The error carries no scope data.

---

## An exchange fails with `The token operation failed.`

**Error:** `getTokenOnBehalfOf` rejects with the generic message `The token operation failed.` (HTTP `200` with `isError` on the SDK adapters, `500` from a custom `createMcpHandler` handler).

**Fix:** The message is generic by design. The original error is `error.cause`, and `code`, `statusCode` and `headers` (for example `Retry-After` on a `429`) are copied onto the error. Log the class name inside the tool, never the token or `cause`. Then look in the tenant logs: the usual causes are the hub issues (a regular app as the OBO client, consent skipping off on the downstream API, missing client grant, wrong `AUTH0_CLIENT_SECRET`, an audience that is no API identifier). `onError` is not called for tool errors on `createNodeMcpHandler` and `createMcpSdkHandler`, so alerts on `onError` or on 5xx will not see them.

---

## An exchange fails right after a valid request

**Error:** A tool that exchanges tokens fails with `UnauthenticatedError`, or with a console warning `[auth0-ai-mcp]` about an expired or about-to-expire token.

**Fix:** With a `tokenStore` set, a caller token with less than five seconds left is refused for exchange (the gate accepts it until expiry). A token the tenant issues that is already expired or expires within five seconds is also refused. Retry with a fresh token, and raise the token lifetime of the downstream API in the tenant if the second case recurs.

---

## A Token Vault call fails with `invalid_grant`

**Error:** `getTokenForConnection` fails.

**Fix:** The user has not linked an account for that connection yet, so there is nothing in the vault to exchange. Link the account first with the Connected Accounts flow, see [Token Vault](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/TokenVault.md).

---

## A DPoP token gets `invalid_dpop_proof` or `use_dpop_nonce`

**Error:** `401` with `error="invalid_dpop_proof"` or `use_dpop_nonce` on the `DPoP` challenge.

**Fix:** DPoP fails closed. The proof did not verify against the token, the method, the URL or the time window (`iatOffset`, default 300 s), or the server requires a nonce the client must send back. The proof is checked against `request.url`, so behind a proxy that rewrites the URL pass the handler a `Request` with the public URL. Do not set `dpop: { mode: 'disabled' }` to hide the error: that ignores DPoP and lets a DPoP-bound token pass as plain Bearer.

---

## `InvalidConfigurationError` at startup

**Error:** The server throws `InvalidConfigurationError` when the handler or client is created.

**Fix:** The message names the option and its environment variable. The common causes are a missing `AUTH0_DOMAIN` or `AUTH0_AUDIENCE`, `client` combined with an inline option such as `domain`, a `resource` that differs from the audience (a trailing slash counts), an audience that is not an absolute `http` or `https` URL, an `organizationId` without `organizationPolicy: 'required'`, `scopeMatching: 'non_strict'` without an indexed token store, and an empty requirement passed to `requireScopes` or `withRequiredScopes`. Name the Auth0 API with the public URL of the server.

---

## A framework routes by path and discovery fails

**Error:** MCP clients cannot find the authorization server, or the `resource_metadata` URL returns `404`.

**Fix:** The metadata is served at `/.well-known/oauth-protected-resource` followed by the path of the resource (`/.well-known/oauth-protected-resource/mcp`). On Express, route both `/mcp` and that path to the handler, and mount the handler before body-parsing middleware. Every path other than the metadata paths goes through authentication, so mount it only on the MCP path and the metadata path.

---

## A `405` from the MCP endpoint

**Error:** `405` with `Allow: POST`.

**Fix:** `createNodeMcpHandler` and `createMcpSdkHandler` are stateless and answer only `POST`. There are no sessions, no streaming and no standalone event stream. Use `createMcpHandler` and your own transport if you need them.

---

## The server rejects every request from Claude Code

**Error:** Sign-in fails with `Unknown client` or `userinfo audience is not allowed for this client`.

**Fix:** The tenant needs Client ID Metadata Document Registration on and Resource Parameter Compatibility Profile set to `compatibility`, both under Settings, Advanced. See [MCP clients and tenant settings](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/McpClients.md).
