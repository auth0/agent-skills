# @auth0/ai-fastmcp (Node.js) errors and fixes

SDK-specific errors only. Tenant setup errors are in the hub.

---

## The server does not start

**Error:** `createFastMcpAuth` throws `InvalidConfigurationError` when called.

**Fix:** The message names the option. The common causes are `Missing MCP client option "domain"` or `"audience"` (set `AUTH0_DOMAIN` or `AUTH0_AUDIENCE`, or pass the option), `"client" cannot be combined with "domain"` (pass a client or inline options, not both), `"resource" must equal the client audience`, an audience that is not an absolute `http` or `https` URL (such as `urn:acme:mcp`), an audience whose path ends in a slash (FastMCP serves `/mcp`, not `/mcp/`), `the path of "resource" must equal "endpoint" or be empty` (set `endpoint` to the path of the resource), a blank entry in `requiredScopes`, and `DPoP mode "required" is not supported by the FastMCP adapter`. Name the Auth0 API with the public URL of the server, without a trailing slash on its path.

---

## A new tool's scope is never requested at login

**Error:** The client does not ask for the scope, and the tool answers `Missing required scope: <scope>`.

**Fix:** A scope that only one tool checks is not published. List it in `metadata.scopesSupported` of `createFastMcpAuth`. Scopes in the server-wide `requiredScopes` are published automatically. Also add the scope to the MCP API and to the client's grant (a grant update replaces the whole list), then sign in again.

---

## A request with a missing or bad token gets a `401`

**Error:** `401` with a `WWW-Authenticate` header and a JSON body.

**Fix:** This is the expected response. A missing header, or a scheme other than Bearer, gets `unauthorized` with a bare `Bearer resource_metadata="..."` challenge. A token that fails verification gets `invalid_token` with the fixed text `The access token is invalid or has expired.` whatever the cause. Check `aud` equals `AUTH0_AUDIENCE` exactly (path and slash included), `iss` is `https://<domain>/`, `exp` is in the future, and the token has a `sub`. To see the exact reason, run `createMcpClient({ domain, audience }).verifyAccessToken({ accessToken })` in a script. A tenant that cannot be reached also answers `401` and does not call `onError`.

---

## A DPoP request gets `DPoP is not supported by this server.`

**Error:** `401` with `invalid_token`, described as `DPoP is not supported by this server.` or `DPoP-bound access tokens are not supported by this server.`

**Fix:** DPoP fails closed. The adapter accepts Bearer tokens only and refuses a `DPoP` header or a token with a `cnf` claim before it contacts the tenant. Make the client request Bearer tokens for the API. If DPoP is required, serve MCP with `@auth0/ai-mcp` instead. `dpop: { mode: 'required' }` throws at startup. `Authorization: DPoP <token>` without a `DPoP` header counts as no credential.

---

## A `400` with `invalid_request`

**Error:** `400` with `The request is malformed.` or `The session id is not valid.`

**Fix:** The `Authorization` header is malformed (a token with a space in it, often a shell variable holding two words), or the `mcp-session-id` header is longer than 256 characters.

---

## A `403` with `insufficient_scope` on the whole request

**Error:** `403` before any tool runs.

**Fix:** The token lacks a scope of the server-wide `requiredScopes`. The `scope` parameter of the challenge lists every required scope. Grant the scopes to the client and make it request them.

---

## A tool answers `Missing required scope` with status `200`

**Error:** The tool result has `isError: true`, `_meta.error` of `insufficient_scope` and the text `Missing required scope: refund:orders`.

**Fix:** The tool uses `requiredScopes` in `withAuth0Execute`, and the caller's token lacks the scope. The status is `200` by design so the client can read what it is missing. Only the `scope` claim counts, never `permissions`. Publish the scope in `metadata.scopesSupported`, grant it on the client, and sign in again. A tool with `canAccess: requireScopes(...)` instead disappears from the tool list and a direct call fails with a message containing `Unknown tool`.

---

## `Tool execution failed.`

**Error:** The tool result says `Tool execution failed.` with `_meta.error` of `server_error`.

**Fix:** `withAuth0Execute` replaced an error it does not show to the client. Read the server log first: unless an `onError` is in effect there is one line such as `[ai-fastmcp] Tool failed: TokenExchangeError code=... statusCode=403 auth0_error=access_denied`. A `MissingClientAuthError` means the exchange needs `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`. A `TokenExchangeError` means the tenant refused the exchange: check the hub issues (a regular app as the OBO client, consent skipping off on the downstream API, missing client grant, wrong secret, an audience that is no API identifier). Auth0's own answer is at `error.cause.cause` in an `onError` hook. A `[auth0-ai-mcp]` warning about an expired or about-to-expire token means the exchange worked but the token is refused; raise the downstream API's token lifetime.

---

## `The token exchange did not grant the requested scopes.`

**Error:** The tool result has `_meta.error` of `insufficient_scope`.

**Fix:** The exchange worked but Auth0 granted fewer scopes than the tool asked for (`DownscopedTokenError`). Grant the missing scopes to the OBO client on that downstream API with a user-subject client grant, or ask for fewer.

---

## The accessors return `undefined`, or `No authenticated request context.`

**Error:** `getCallerPrincipal()` and `getCallerMcpClient()` return `undefined`, or `getCallerMcpClientOrThrow()` throws.

**Fix:** The tool is not wrapped. The request did pass `authenticate` and `context.session` is set, but the binding of the accessors is missing. Wrap the `execute` function in `withAuth0Execute`, or read `context.session`. Resources and prompts get the session as the `auth` argument, and the accessors return `undefined` there too.

---

## The `resource_metadata` URL in a challenge returns `404`

**Error:** Clients cannot find the metadata, and the server logs a warning that a request arrived on another path.

**Fix:** `server.start` got an endpoint other than `auth.endpoint`. Pass `httpStream: { endpoint: auth.endpoint, ... }`.

---

## `Authentication failed for stdio transport`

**Error:** FastMCP logs the message and wrapped tools answer `Authentication is required.`

**Fix:** The adapter authenticates HTTP requests only. Start the server with `transportType: "httpStream"`.

---

## `GET /sse` returns `404`

**Error:** A client using the legacy SSE transport gets `{"error":"not_found"}`.

**Fix:** Intentional, because that route would take tool calls without running `authenticate`. Connect with the Streamable HTTP transport at `auth.endpoint`.

---

## `403` with `The session belongs to a different caller.`

**Error:** A stateful server answers `403` with `forbidden` and no challenge.

**Fix:** A second subject used a session id that another subject used first. A client that switches users must start a new session. Use `stateless: true` if clients cannot, or if you run several instances.

---

## A `UserError` does not arrive as written

**Error:** The client sees `Tool '<name>' execution failed: <message>`.

**Fix:** The `UserError` comes from a different installed copy of `fastmcp` than the one serving the tools. Run `npm ls fastmcp` and keep one copy.

---

## A tool result says `Unrecognized key: "_meta"`

**Error:** `Tool '<name>' execution failed:` followed by `Unrecognized key: "_meta"`.

**Fix:** FastMCP is older than 4.7.0. Install FastMCP 4.22.0 or later, the oldest release this package supports.
