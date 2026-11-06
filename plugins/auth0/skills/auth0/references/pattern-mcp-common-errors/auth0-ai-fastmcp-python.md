# auth0-ai-fastmcp (Python) errors and fixes

SDK-specific errors only. Tenant setup errors are in the hub.

---

## A new tool's scope is never requested at login

**Error:** The MCP client does not ask for the new tool's scope when the user logs in.

**Fix:** Add the scope to the list the server advertises, which is `tool_scopes` on `Auth0FastMCPOptions`. The MCP client learns which scopes to ask for from that list.

---

## Claude Code reports `MCP endpoint not found`

**Error:** `MCP endpoint not found`

**Fix:** The URL given to Claude Code has to end in `/mcp`, because that is where the server listens. Pointing Claude Code at `http://localhost:3002` alone fails.

```bash
claude mcp add --transport http b2b-ecommerce http://localhost:3002/mcp
```

---

## A request with a missing or bad token gets a `401`

**Error:** The response is a `401` with a `WWW-Authenticate` header.

**Fix:** This is the expected response when the token is missing or bad. The request is stopped before it reaches a tool, so check the token that is being sent. The `scope` in the header lists every scope from `tool_scopes` and `required_scopes`, which is what the client asks for at login.

---

## Every request gets a `503` when Auth0 is down

**Error:** The response is a `503` with `Retry-After: 5` and no `WWW-Authenticate` header, and the log shows `Auth0 could not be reached to verify the token`.

**Fix:** The server could not reach Auth0 to check the token, so it did not call the token bad and sends no login challenge. The client keeps its token and retries after the delay. The JSON-RPC error code is `-32003`. Check that the tenant `domain` is correct and reachable from the server, then retry. The request does not reach a tool.

---

## A valid token still gets a `401`

**Error:** The response is a `401` with `invalid_token` in the `WWW-Authenticate` header, even though the token is signed by your tenant for the right audience.

**Fix:** The server also needs the token to identify the caller. It turns away a token that has no `sub`, no `exp`, or neither an `azp` nor a `client_id` claim. It also turns away a token whose `org_id` is not a string or whose `permissions` claim is not a list of strings. Decode the token and check those claims.

---

## A tool call fails because the token lacks the tool's scope

**Error:** The server raises `InsufficientScopeError`. The MCP client may only see a generic `Error calling tool '<name>': Missing one or more required scopes.`

**Fix:** A user needs a matching `tool:*` scope to call each tool, and `with_required_scopes` raises `InsufficientScopeError` if one is missing. When the user's token lacks the tool's scope, the call is turned away before any downstream token is requested. Make sure the token carries the scope for that tool. See "A new scope never shows up in the token" if the scope is missing from the token. The `scope` claim has to be a space-separated string. A list-typed `scope` claim is read as no scopes, so every scope check fails.

---

## `get_token_on_behalf_of` raises because Auth0 granted fewer scopes

**Error:** The `get_token_on_behalf_of` call raises when Auth0 grants fewer scopes than the tool asked for.

**Fix:** The call raises so a tool never quietly runs with too little access. Give the OBO client a grant on that service with exactly the scopes its tools ask for. A cached token is checked the same way every time it is reused.

---

## A tool, resource or prompt fails with `Token exchange failed (<error code>)`

**Error:** The client gets `Token exchange failed (<error code>)`, for example `Token exchange failed (federated_connection_refresh_token_not_found)`.

**Fix:** A tool, resource or prompt let an `ApiError` or `DownscopedTokenError` escape, so the middleware replaced Auth0's message with the error code. The server log has the full error and traceback. To show the user a better message, catch `ApiError` in the handler, check `exc.code`, and raise your own `ToolError` (`ResourceError` or `PromptError` for a resource or prompt) from it. The middleware leaves that message as it is.

```python
try:
    token = await client.get_token_for_connection(connection="google-oauth2")
except ApiError as exc:
    if exc.code == "federated_connection_refresh_token_not_found":
        raise ToolError("Connect your Google account first") from exc
    raise
```

---

## A call without `scope` never reuses a cached token in `non_strict` mode

**Error:** In `non_strict` mode a `get_token_on_behalf_of` call that leaves out `scope` never reuses a cached token.

**Fix:** You can leave out `scope`, but then Auth0 returns a token with no `scope`. Pass `scope` when the call should be able to reuse a cached token.

---

## OBO tokens are not cached

**Error:** Every `get_token_on_behalf_of` call goes to Auth0 and costs a network round trip.

**Fix:** Pass a `token_store` in the configuration. Caching is on when a `token_store` is passed and off without one.

---

## Cached tokens are lost after a restart

**Error:** Tokens that were cached before a restart are gone.

**Fix:** The in-memory store keeps every token only until the process stops, so a restart loses them. See Token Caching for what a shared, production store needs.

---

## `ConfigurationError` at startup with `non_strict` scope matching

**Error:** `ConfigurationError` at startup

**Fix:** `non_strict` needs an `IndexedTokenStore`, which also tracks the scopes of each saved token. A plain store, or no store at all, raises `ConfigurationError` at startup. Use an `IndexedTokenStore`, or switch back to `strict`, which works with any `AbstractTokenStore`.

---

## FastMCP only

### Every request gets a `401` because `resource_url` ends in `/mcp`

**Error:** Every request gets a `401`. The server advertises a `/mcp/mcp` resource, so the audience becomes that value and no longer matches the API registered in Auth0.

**Fix:** Make sure `MCP_RESOURCE_URL` does not end in `/mcp`. FastMCP appends `/mcp` to `resource_url` and advertises the result, and the MCP client asks Auth0 for a token for that value, which is also the audience. The API identifier in Auth0 must be that value, for example `https://your-api.example.com/mcp` for `resource_url="https://your-api.example.com"`.

### Tools fail with `UnauthenticatedError`

**Error:** `UnauthenticatedError: No MCP client in the current request context.` or `UnauthenticatedError: No principal in the current request context.`

**Fix:** Register the middleware as well as the provider. `auth=auth0.provider` checks the incoming token, and `mcp.add_middleware(auth0.middleware)` puts the caller into the request context for tools, resources and prompts.

```python
mcp = FastMCP(name="My Server", auth=auth0.provider)
mcp.add_middleware(auth0.middleware)
```

### Every request fails with `UnauthenticatedError: No verified access token on this request`

**Error:** `UnauthenticatedError: No verified access token on this request`, raised by the middleware before any tool, resource or prompt runs.

**Fix:** The middleware found no verified token on the request. Only `initialize`, `ping` and `server/discover` run without one. This usually means `FastMCP` was created without `auth=auth0.provider`, so no token was checked. Pass the provider as shown above.

### Requests get a `403` because of `required_scopes`

**Error:** A `403` with `insufficient_scope` and `Required scope: <scope>`, before any tool, resource or prompt runs.

**Fix:** `required_scopes` lists the scopes every request must carry, and FastMCP turns away any request whose token lacks one of them. Make sure the token carries every scope in that list. They are advertised automatically, so the client asks for them at login. Or leave `required_scopes` unset and gate each tool with `with_required_scopes`.
