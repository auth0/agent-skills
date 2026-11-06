# auth0-ai-mcp (Python) errors and fixes

SDK-specific errors only. Tenant setup errors are in the hub.

---

## A new tool's scope is never requested at login

**Error:** The MCP client does not ask for the new tool's scope when the user logs in.

**Fix:** Add the scope to the list the server advertises, which is `scopes_supported` on `Auth0AsgiMiddleware`. The MCP client learns which scopes to ask for from that list.

---

## A Token Vault call fails with `invalid_grant`

**Error:** `get_token_for_connection` fails with `invalid_grant`.

**Fix:** The user has not linked an account for that connection yet, so there is nothing in the vault to exchange. Link the account first with the Connected Accounts flow, as described under "Linking an account" in [Token Vault](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenVault.md).

---

## A request with a missing or bad token gets a `401`

**Error:** The response is a `401` with a `WWW-Authenticate` header.

**Fix:** This is the expected response. A missing, blank or non-Bearer token gets a bare `Bearer resource_metadata="..."` challenge, and a token that fails verification gets `error="invalid_token"` with the description "The access token is not valid". Both challenges also carry `scope="..."` listing the advertised scopes when `scopes_supported` is set. The request is stopped before it reaches a tool, so check the token that is being sent. The real reason a token was rejected is only in the server log. See [What the middleware returns](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenVerification.md#what-the-middleware-returns).

---

## A request gets a `421 Invalid Host header`

**Error:** Every request gets a `421` with the text `Invalid Host header`, and nothing reaches the auth middleware.

**Fix:** The `mcp` SDK only accepts the `127.0.0.1`, `localhost` and `::1` hosts by default. Pass your public host to `streamable_http_app`, with and without a port.

```python
from mcp.server.transport_security import TransportSecuritySettings

mcp.streamable_http_app(
    transport_security=TransportSecuritySettings(allowed_hosts=["your-mcp-server", "your-mcp-server:*"]),
)
```

---

## A DPoP or mTLS token gets a `401`

**Error:** A `401` with `error="invalid_token"` for a token that is valid at Auth0. An `Authorization: DPoP ...` header gets a `401` with the bare challenge.

**Fix:** Only Bearer tokens are supported. A token bound to a DPoP key or a client certificate has a `cnf` claim and is rejected, so request a normal Bearer token for the MCP server's API.

---

## `ConfigurationError` when a tool is decorated

**Error:** `ConfigurationError` at import time on a `with_required_scopes` decorator.

**Fix:** The scope list is empty or has a blank entry, an entry contains a space, or the decorated function is not `async`. Pass one scope per list entry and gate only `async def` functions.

---

## A request gets a `503` with no `WWW-Authenticate` header

**Error:** The response is a `503` with a `Retry-After` header and the message "Service unavailable: the token could not be verified".

**Fix:** The server could not reach the Auth0 tenant to fetch the signing keys, or, in multi-domain mode, the domains resolver failed. Check that `domain` is correct and that the server can reach `https://<domain>/.well-known/openid-configuration` and the JWKS URL. The real reason is in the server log. The client should retry, and it does not need to log in again.

---

## A tool call fails because the token lacks the tool's scope

**Error:** The server raises `InsufficientScopeError`. On the official `mcp` SDK the client sees `Error executing tool <name>: Missing one or more required scopes.`

**Fix:** A user needs the scope each tool requires, and `with_required_scopes` raises `InsufficientScopeError` if one is missing. It is raised inside the tool, so the framework reports a tool error and the HTTP response is still `200`. A real `403` is not provided. When the user's token lacks the tool's scope, the call is turned away before any downstream token is requested. Make sure the token carries the scope for that tool. See "A new scope never shows up in the token" if the scope is missing from the token.

---

## `get_token_on_behalf_of` raises because Auth0 granted fewer scopes

**Error:** The `get_token_on_behalf_of` call raises when Auth0 grants fewer scopes than the tool asked for.

**Fix:** The call raises on purpose, so a tool never quietly runs with too little access. Give the OBO client a grant on that service with exactly the scopes its tools ask for. A cached token is checked the same way every time it is reused.

---

## A call without `scope` never reuses a cached token in `non_strict` mode

**Error:** In `non_strict` mode a `get_token_on_behalf_of` call that leaves out `scope` never reuses a cached token.

**Fix:** You can leave out `scope`, but a call without it never reuses a cached token in `non_strict` mode. Pass `scope` when the call should be able to reuse a cached token.

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

## ASGI middleware only

### Every tool call fails the scope check

**Error:** Every `with_required_scopes` check fails because the token arrives with an empty `scope` claim.

**Fix:** Check that `Auth0AsgiMiddleware` gets `scopes_supported` with every tool scope, the way the example `server.py` does.

### Every request gets a `401` because `AUTH0_AUDIENCE` is not the URL clients use

**Error:** Every request gets a `401`.

**Fix:** Make sure the API identifier in Auth0 and `AUTH0_AUDIENCE` in `.env` are the public URL of the MCP server. The middleware advertises the client's `audience` as `resource` in the `/.well-known/oauth-protected-resource` metadata, and the MCP client asks for a token for exactly that value. If clients reach the server at a different URL, the token's `aud` will not match what the server accepts and the middleware turns every request away.
