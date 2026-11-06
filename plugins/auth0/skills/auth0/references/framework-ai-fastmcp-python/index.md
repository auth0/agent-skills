# auth0-ai-fastmcp Integration

Secure an MCP server built on Prefect FastMCP with Auth0 using `auth0-ai-fastmcp`. It checks the incoming token, identifies the caller, and gates tools by scope.

## Prerequisites

- An MCP server built on [Prefect FastMCP](https://gofastmcp.com)
- An Auth0 tenant with an API registered for this MCP server
- If tools call downstream APIs on the caller's behalf, an OBO client id and secret (see On-Behalf-Of)

## When NOT to Use

- **Official `mcp` SDK or another ASGI app** - Use the `auth0-ai-mcp` guide instead. `auth0-ai-fastmcp` is the FastMCP adapter for `auth0-ai-mcp`.

## Quick Start Workflow

### 1. Install

```bash
pip install auth0-ai-fastmcp
```

With Poetry:

```bash
poetry add auth0-ai-fastmcp
```

### 2. Set up the tenant

The full walkthrough with every Auth0 CLI command is in the example README under [What you need on the tenant](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/examples/b2b_ecommerce/README.md#what-you-need-on-the-tenant). Follow it instead of rewriting the commands. In short, the tenant needs:

- An API for the MCP server itself. Its identifier must be `resource_url` plus `mcp_path` (`/mcp` by default), which is the audience step 4 derives.
- The `tool:*` scopes added to that API, one per gated tool.
- If tools call downstream APIs, one API per downstream service and an OBO client with grants to them. See On-Behalf-Of.
- A client for the MCP client that logs users in, with a grant to the MCP API that includes all the tool scopes.

### 3. Configure environment

Create `.env`:

```bash
AUTH0_DOMAIN=your-tenant.us.auth0.com
MCP_RESOURCE_URL=http://localhost:3002
OBO_CLIENT_ID=
OBO_CLIENT_SECRET=
```

`resource_url` is the base URL of the server without `/mcp`, because FastMCP appends `/mcp` itself. The audience defaults to that base URL plus `/mcp`, so it is not set separately. If `resource_url` includes `/mcp`, the server advertises `/mcp/mcp` and the client never gets a token the server accepts. See [Configuration](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/docs/Configuration.md) for the full explanation.

`OBO_CLIENT_ID` and `OBO_CLIENT_SECRET` are needed only when tools call `get_token_on_behalf_of`, `get_client_credentials_token` or `get_token_for_connection`. See [`.env.example`](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/examples/b2b_ecommerce/.env.example) for the complete list of variables used by the example.

### 4. Configure Auth0FastMCP

```python
from fastmcp import FastMCP
from auth0_ai_fastmcp import Auth0FastMCP, Auth0FastMCPOptions

auth0 = Auth0FastMCP(Auth0FastMCPOptions(
    domain="your-tenant.auth0.com",
    resource_url="https://your-api.example.com",
    tool_scopes=["tool:do_thing"],
    client_id="...",
    client_secret="...",
))
```

Use `Auth0FastMCPOptions` as the single configuration object. `tool_scopes` lists the scopes advertised in the server metadata so the MCP client requests them at login. A scope only gates a tool once you put `with_required_scopes` on it. See [Tool Scopes](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/docs/ToolScopes.md) for how this works.

`required_scopes` is optional and lists scopes that every request must carry. FastMCP turns away a request whose token lacks any of them with a `403`, `insufficient_scope` and the missing scope named, before any tool, resource or prompt runs. They are advertised in the metadata too, so the client requests them at login. Leave it unset if each tool checks its own scope.

The runnable [server.py](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/examples/b2b_ecommerce/server.py) reads the values from environment variables and also sets `token_store`, `scope_matching`, `organization_policy` and `organization_id`. Every field is listed in [Configuration](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/docs/Configuration.md).

Caching of exchanged tokens is on only when a `token_store` is passed. See Token Caching.

### 5. Mount the provider and middleware

```python
mcp = FastMCP(name="My Server", auth=auth0.provider)
mcp.add_middleware(auth0.middleware)
```

Both lines are required. `auth=auth0.provider` checks the incoming token, and `mcp.add_middleware(auth0.middleware)` puts the caller into the request context for every request, so tools, resources, prompts and list requests such as `tools/list` can all read it. Without the middleware, a tool fails with `UnauthenticatedError: No MCP client in the current request context.` and a gated tool fails with `UnauthenticatedError: No principal in the current request context.` Without `auth=auth0.provider`, every request except `initialize`, `ping` and `server/discover` fails with `UnauthenticatedError: No verified access token on this request`.

The provider also serves the RFC 9728 `/.well-known/oauth-protected-resource/mcp` metadata that tells the MCP client how to log in. A request with a missing or bad token gets a `401` with a `WWW-Authenticate` header and never reaches a tool. So does a token that passes verification but has no usable `sub`, `exp` or client id (`azp` or `client_id`), or has an `org_id` that is not a string or a `permissions` claim that is not a list of strings.

### 6. Gate a tool

```python
from auth0_ai_fastmcp import with_required_scopes
from auth0_ai_mcp import require_caller_mcp_client

@mcp.tool
@with_required_scopes("tool:do_thing")
async def do_thing() -> str:
    auth0 = require_caller_mcp_client()
    token = await auth0.get_token_on_behalf_of(audience="https://downstream-api/", scope="read:things")
    # call the downstream API with token["access_token"]
    return "done"
```

Import `with_required_scopes` and `require_scopes` from `auth0_ai_fastmcp`, not `auth0_ai_mcp`, so a denied call reaches the client with its reason even when `mask_error_details` is on. Keep `@mcp.tool` above `@with_required_scopes`. `with_required_scopes` checks the caller's scopes before the tool body runs and raises `InsufficientScopeError` if one is missing. It also works on async resource and prompt handlers. See [Resources and prompts](#resources-and-prompts) for the in-handler alternative.

The `tool:*` scopes that gate the tool are separate from the downstream scopes passed to `get_token_on_behalf_of`. Details on the exchange are in On-Behalf-Of.

The same client also has `get_client_credentials_token(audience=..., scope=...)` for calls made as the server with no user, and `get_token_for_connection(connection=..., login_hint=None)` for a federated provider such as Google through Token Vault. The user must have linked the account first for the second one, otherwise it fails with `federated_connection_refresh_token_not_found`. Like the on-behalf-of exchange, it needs a Custom API client, see [Token Vault](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-mcp/docs/TokenVault.md) for the tenant setup.

### 7. Test

Start the server and add it to the MCP client. The URL has to end in `/mcp`, because that is where the server listens. This example uses Claude Code and the port from the example server.

```bash
claude mcp add --transport http b2b-ecommerce http://localhost:3002/mcp
```

Adding the server does not sign you in. Run `/mcp` inside Claude Code and choose Authenticate.

Pointing the client at `http://localhost:3002` alone fails with `MCP endpoint not found`.

Then check these cases.

- A request with no token or a bad token gets a `401` with a `WWW-Authenticate` header.
- Once you are signed in, the first tool call runs.
- A call to a tool whose `tool:*` scope is missing from the token is turned away before any downstream token is requested.

For errors during login or token exchange, see Common Errors.

## Resources and prompts

Resources and prompts see the same caller as tools. Read it with `require_caller_principal()`, which raises if there is no caller, and check scopes with `require_scopes(principal, ...)` inside the handler, which raises `InsufficientScopeError` if one is missing.

```python
from auth0_ai_fastmcp import require_scopes
from auth0_ai_mcp import require_caller_principal

@mcp.resource("orders://recent")
async def recent_orders() -> str:
    principal = require_caller_principal()
    require_scopes(principal, "resource:recent_orders")
    return f"Recent orders for {principal.sub}"

@mcp.prompt
async def order_summary(order_id: str) -> str:
    principal = require_caller_principal()
    require_scopes(principal, "prompt:order_summary")
    return f"Summarize order {order_id} for {principal.sub}"
```

Add these scopes to `tool_scopes` too, so the MCP client requests them at login. `require_caller_mcp_client()` works here as well, for a resource or prompt that calls a downstream API.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting `mcp.add_middleware(auth0.middleware)` | Add it after creating `FastMCP`. Without it, tools fail with `UnauthenticatedError` about the request context. |
| Creating `FastMCP` without `auth=auth0.provider` | Pass it. Otherwise every request except `initialize`, `ping` and `server/discover` fails with `UnauthenticatedError: No verified access token on this request`. |
| Setting `resource_url` to the full MCP URL | Use the base URL without `/mcp`. Otherwise every request gets a `401` because the audience becomes `/mcp/mcp` and no longer matches the API in Auth0. See step 3. |
| Pointing the MCP client at the base URL | Use the URL ending in `/mcp`. Otherwise the client reports `MCP endpoint not found`. |
| Leaving a gated tool's scope out of `tool_scopes` | Add it to `tool_scopes` so the client requests it at login. |
| A new `tool:*` scope never shows up in the token | Adding a scope to the MCP API does not add it to existing grants. Update the login client's grant with the full scope list. |
| Mixing up `tool:*` scopes and downstream scopes | They are two separate layers. `tool:*` scopes gate the tool and downstream scopes go to `get_token_on_behalf_of`. |
| Calling `get_token_on_behalf_of`, `get_client_credentials_token` or `get_token_for_connection` without `client_id` and `client_secret` | Set both in `Auth0FastMCPOptions`. |

## Related References

- Official `mcp` SDK or another ASGI app - the `auth0-ai-mcp` integration guide
- Calling a downstream API as the signed-in user - the On-Behalf-Of reference
- Caching exchanged tokens - the Token Caching reference
- Login or token exchange errors - the Common Errors reference

## Quick Reference

**Auth0FastMCPOptions fields** (full list in [Configuration](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/docs/Configuration.md)):
- `domain` - Auth0 tenant domain as a bare host, no scheme, path, query or whitespace
- `resource_url` - base URL of this server, without `/mcp`
- `audience` - optional, this server's API identifier. Defaults to `resource_url` plus `mcp_path` and must equal it when set
- `mcp_path` - path the MCP endpoint is mounted at, default `/mcp`
- `tool_scopes` - scopes advertised in the metadata. A tool is gated by `with_required_scopes`, not by being listed here. `required_scopes` are advertised too
- `client_id` and `client_secret` - client for token exchanges, needed only for `get_token_on_behalf_of`, `get_client_credentials_token` and `get_token_for_connection`
- `required_scopes` - optional, scopes every request must carry, enforced by FastMCP with a `403`

**Auth0FastMCP properties:**
- `.provider` - pass it as `FastMCP(auth=auth0.provider)`
- `.middleware` - register it with `mcp.add_middleware(auth0.middleware)`
- `.mcp_client` - the underlying `auth0-ai-mcp` `McpServerClient`, for advanced use

**Environment variables used by the example:**
- `AUTH0_DOMAIN` - Auth0 tenant domain, no `https://`
- `MCP_RESOURCE_URL` - base URL of this server, without `/mcp`
- `OBO_CLIENT_ID` and `OBO_CLIENT_SECRET` - OBO client credentials

**Docs in the package:**
- [README](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/README.md)
- [Examples](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/EXAMPLES.md)
- [Configuration](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/docs/Configuration.md)
- [Tool Scopes](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/docs/ToolScopes.md)
- [b2b_ecommerce example](https://github.com/auth0/auth0-ai-python/blob/main/packages/auth0-ai-fastmcp/examples/b2b_ecommerce/README.md)
