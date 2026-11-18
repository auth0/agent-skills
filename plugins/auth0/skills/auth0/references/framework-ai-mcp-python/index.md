# auth0-ai-mcp Integration

Secure an MCP server built on the official `mcp` SDK, or any ASGI app, with Auth0 using `auth0-ai-mcp`.

## Prerequisites

- An MCP server built on the official `mcp` SDK, or any ASGI app (Python 3.10 or later)
- An Auth0 API for the MCP server itself, whose identifier is the server's audience
- `client_id` and `client_secret` of an Auth0 client, needed for On-Behalf-Of, client credentials and Token Vault (token verification works without them)
- If the tenant is not set up yet, see Step 2

## When NOT to Use

- **`fastmcp` is listed in `pyproject.toml`** - FastMCP has its own adapter package, `auth0-ai-fastmcp`, so do not hand-write one with this guide.
- **Other MCP frameworks** - See [Writing an Adapter](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/WritingAnAdapter.md) for how to wire the core into them.

## Quick Start Workflow

### 1. Install

```bash
pip install "auth0-ai-mcp[mcp]"
```

Or with Poetry:

```bash
poetry add "auth0-ai-mcp[mcp]"
```

The `mcp` extra installs the official `mcp` SDK that the snippets below use. Leave it out if the server is another ASGI app.

### 2. Set up the tenant

The tenant needs the following. The exact CLI commands are in the "What you need on the tenant" section of the [b2b_ecommerce example README](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/examples/b2b_ecommerce/README.md#what-you-need-on-the-tenant), so run them from there rather than rewriting them.

- An API for the MCP server itself. Its identifier must match `AUTH0_AUDIENCE`.
- The tool scopes added to that API, one per gated tool.
- The MCP client (Claude Code in the example) registered on the tenant, with its own grant to the MCP API that includes every tool scope.
- For tools that call downstream APIs, an OBO client and one API per downstream service. See On-Behalf-Of for the setup.
- For tools that use client credentials, a client grant against the target API (the example's analytics API shows this).

### 3. Configure environment

Create `.env`. This is an excerpt of the example's `.env.example`:

```bash
# Auth0 tenant domain (no https://, no trailing slash)
AUTH0_DOMAIN=your-tenant.us.auth0.com

# This MCP server's own API identifier, which is also its public URL. The middleware serves it
# in the RFC 9728 metadata, and MCP clients request a token for exactly this value.
AUTH0_AUDIENCE=http://localhost:3002/mcp

# --- OBO token exchange: a resource-server Custom API client ---
# app_type=resource_server, resource_server_identifier set to AUTH0_AUDIENCE, with the OBO
# exchange profile enabled and user-delegated client grants to the downstream APIs.
OBO_CLIENT_ID=
OBO_CLIENT_SECRET=
```

The full `.env.example` also has the downstream audiences and the token cache settings.

### 4. Build the client

```python
from auth0_ai_mcp import create_mcp_client

client = create_mcp_client(
    domain="your-tenant.auth0.com",
    audience="https://your-mcp-server/mcp",
    client_id="YOUR_CLIENT_ID",        # needed for OBO, client credentials and Token Vault
    client_secret="YOUR_CLIENT_SECRET",
)
```

Passing a `token_store` to `create_mcp_client` turns on caching of OBO tokens. See Token Caching and the [Token Caching docs](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenCaching.md).

### 5. Mount the middleware

Wrap the ASGI app of the MCP server. The example wraps the streamable-HTTP app of the `mcp` SDK.

```python
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from auth0_ai_mcp.middleware import Auth0AsgiMiddleware

mcp = MCPServer(name="My Server")

secured_app = Auth0AsgiMiddleware(
    mcp.streamable_http_app(
        transport_security=TransportSecuritySettings(allowed_hosts=["your-mcp-server", "your-mcp-server:*"]),
    ),
    mcp_client=client,
    scopes_supported=["read:weather"],
    resource_name="My Server",
    resource_documentation="https://your-mcp-server/docs",
)
```

The `mcp` SDK only accepts requests for `127.0.0.1`, `localhost` and `::1` by default, so list your public host in `allowed_hosts`, with and without a port, or every request gets a `421`.

`Auth0AsgiMiddleware` is plain ASGI middleware, so a FastAPI or Starlette app can be wrapped the same way.

From this point on, the middleware does the following before any tool runs.

- It extracts the `Authorization: Bearer` header from every incoming request.
- It verifies the token against Auth0 using `auth0-api-python`.
- A missing, blank or non-Bearer token gets a `401` with a bare `Bearer resource_metadata="..."` challenge, and a token that fails verification or has whitespace inside it gets a `401` with `error="invalid_token"`. Both challenges carry `scope="..."` when `scopes_supported` is set. A token bound to a DPoP key or a client certificate is also rejected, because it cannot be used as a Bearer token. If Auth0 cannot be reached to verify the token, the response is a `503` with no challenge. WebSocket connections are refused. None of these reach a tool. See [What the middleware returns](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenVerification.md#what-the-middleware-returns).
- On success it builds a `Principal` (`sub`, `expires_at`, `scopes`, `permissions`, `client_id`, `org_id`) from the verified claims and sets a per-request `contextvar` so tool code can read the caller without taking an auth argument.
- It serves the RFC 9728 `/.well-known/oauth-protected-resource` metadata for the client's `audience`, listing `scopes_supported` so the MCP client requests those scopes at login. `resource_name` and `resource_documentation` are optional and describe the server to clients.

See [Token Verification](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenVerification.md) and [Request Context](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/RequestContext.md) for more.

### 6. Gate a tool

```python
from auth0_ai_mcp import require_caller_mcp_client, with_required_scopes

@mcp.tool()
@with_required_scopes("read:weather")
async def get_weather(location: str) -> dict:
    auth0 = require_caller_mcp_client()
    token = await auth0.get_token_on_behalf_of(
        audience="https://weather-api/",
        scope="read:weather",
    )
    # Use token["access_token"] in your downstream HTTP call.
    ...
```

`with_required_scopes` checks the scopes on the caller's incoming token (the scopes the client was granted for your MCP server) before the tool body runs. It raises `UnauthenticatedError` if there is no caller in context and `InsufficientScopeError` if any listed scope is missing. A string is always one scope and a scope cannot contain a space, so pass a list when several are needed. It only gates async functions, and `@mcp.tool()` must be the top decorator, otherwise the framework registers the unguarded function. See [Scope Enforcement](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/ScopeEnforcement.md) for the imperative form.

`require_caller_principal` returns the verified `Principal` the same way. `require_caller_mcp_client` returns the `RequestScopedMcpClient` that the middleware placed in the request context. Calling `get_token_on_behalf_of` on it exchanges the caller's incoming token for a narrower token scoped to the downstream audience.

For how the exchange works, see On-Behalf-Of and the [On-Behalf-Of docs](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/OnBehalfOf.md).

### 7. Test

1. Request the MCP endpoint without a token. The response should be a `401` with a bare `Bearer resource_metadata="..."` challenge and no `error`.
2. Check that the server serves `/.well-known/oauth-protected-resource` for your `audience`.
3. Add the server to an MCP client and call a gated tool. For the example server the command is:

```bash
claude mcp add --transport http b2b-ecommerce http://localhost:3002/mcp
```

The URL has to end in `/mcp`, because that is where the example server listens. For the full list of test prompts and what to expect, see the "Test the full example" section of the [b2b_ecommerce example README](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/examples/b2b_ecommerce/README.md#test-the-full-example).

If a call fails, see Common Errors.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `AUTH0_AUDIENCE` is not the URL clients use to reach the server | Set the API identifier in Auth0 and `AUTH0_AUDIENCE` to that public URL. Clients request a token for the advertised resource, so any other value makes every request a `401` |
| `scopes_supported` left out of `Auth0AsgiMiddleware` | Pass every tool scope. Without it the token arrives with an empty `scope` claim and every `with_required_scopes` check fails |
| Omitting `client_id` and `client_secret` while tools call `get_token_on_behalf_of` | Pass both to `create_mcp_client`. They are needed for On-Behalf-Of, client credentials and Token Vault |
| A new scope never shows up in the token | Adding a scope to the MCP API does not add it to existing grants. Update the client's grant with the full scope list |
| Using `scope_matching="non_strict"` with a plain token store | Use an `IndexedTokenStore`. A plain store, or no store at all, raises `ConfigurationError` at startup. See Token Caching |
| Every request gets a `421 Invalid Host header` | Pass `TransportSecuritySettings(allowed_hosts=[...])` with your public host, with and without a port, to `streamable_http_app` |
| Adding the server to an MCP client without the `/mcp` path | The URL has to end in `/mcp`, otherwise the client fails with `MCP endpoint not found` |

## Related References

- Exchanging the caller's token for a downstream token - the On-Behalf-Of reference
- Caching exchanged tokens - the Token Caching reference
- Errors and fixes - the Common Errors reference

## Quick Reference

**Client with a cache and an organization policy, from the example `server.py`:**
```python
mcp_client = create_mcp_client(
    DOMAIN,
    AUDIENCE,
    client_id=os.environ["OBO_CLIENT_ID"],
    client_secret=os.environ["OBO_CLIENT_SECRET"],
    token_store=store,
    scope_matching=SCOPE_MATCHING,
    organization_policy="required" if ORGANIZATION_ID else "allow",
    organization_id=ORGANIZATION_ID,
)
```

**Middleware:**
```python
from auth0_ai_mcp.middleware import Auth0AsgiMiddleware

secured_app = Auth0AsgiMiddleware(
    app,
    mcp_client=client,
)
```

**Tool helpers:**
```python
from auth0_ai_mcp import (
    require_caller_mcp_client,
    require_caller_principal,
    with_required_scopes,
)
```

**Methods on the request-scoped client:**
- `get_token_on_behalf_of(audience=..., scope=...)` - exchanges the caller's token for a narrower downstream token
- `get_token_for_connection(connection=..., login_hint=None)` - exchanges the caller's token for a federated provider token via Token Vault. The user must have linked the account first, see [Token Vault](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenVault.md)
- `get_client_credentials_token(audience=..., scope=...)` - gets a token for the server itself when the tool acts as the server

**Environment variables:**
- `AUTH0_DOMAIN` - your Auth0 tenant domain, no `https://`, no trailing slash
- `AUTH0_AUDIENCE` - the MCP server's own API identifier, which must be its public URL
- `OBO_CLIENT_ID` and `OBO_CLIENT_SECRET` - the client used for token exchanges

**Docs in the package:**
- [Token Verification](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenVerification.md)
- [Request Context](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/RequestContext.md)
- [Scope Enforcement](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/ScopeEnforcement.md)
- [On-Behalf-Of](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/OnBehalfOf.md)
- [Token Vault](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenVault.md)
- [Token Caching](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenCaching.md)
- [Organization Policy](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/OrganizationPolicy.md)
- [Writing an Adapter](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/WritingAnAdapter.md)
- [Examples](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/EXAMPLES.md)
- [b2b_ecommerce example](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/examples/b2b_ecommerce/README.md)
