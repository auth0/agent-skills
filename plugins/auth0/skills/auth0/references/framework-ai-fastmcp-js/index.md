# @auth0/ai-fastmcp Integration

Secure a Node.js MCP server built on FastMCP with Auth0 using `@auth0/ai-fastmcp`.

## Prerequisites

- A Node.js FastMCP server (FastMCP 4.22.0 or later), or a new one
- An Auth0 API for the MCP server itself, whose identifier is the server's public URL, for example `http://localhost:3000/mcp` locally. That identifier is the audience
- `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` of an Auth0 client, needed only when a tool exchanges tokens. Token verification works without them
- If the tenant is not set up yet, see Step 2

## When NOT to Use

- **A server built on the official `@modelcontextprotocol/server`** - Use the `@auth0/ai-mcp` reference. FastMCP is the only framework this adapter wraps.
- **The server is built on `@modelcontextprotocol/sdk` (v1) without FastMCP** - This skill does not route v1 servers.
- **The caller needs DPoP** - This adapter accepts Bearer tokens only and answers `401` to a DPoP request or a DPoP-bound token (fail closed, no proof is verified). Serve MCP with `@auth0/ai-mcp` instead.
- **A Python FastMCP server** - Use the `auth0-ai-fastmcp` Python reference.

## Quick Start Workflow

### 1. Install

```bash
npm install @auth0/ai-fastmcp@beta @auth0/ai-mcp@beta fastmcp zod
```

`@auth0/ai-mcp` and `fastmcp` are peer dependencies, so install them next to the adapter and keep a single copy of `fastmcp` (check with `npm ls fastmcp`).

### 2. Set up the tenant

The tenant needs the following. The exact CLI commands are in the "Set up your tenant" section of the [ai-fastmcp-server example README](https://github.com/auth0/auth0-ai-js/tree/main/examples/ai-fastmcp-server#set-up-your-tenant), so run them from there rather than rewriting them.

- An API for the MCP server itself. Its identifier must equal `AUTH0_AUDIENCE`. For a local run, one command creates it:

  ```bash
  auth0 apis create --name "Orders MCP" --identifier "http://localhost:3000/mcp" --signing-alg RS256 --scopes "read:orders"
  ```

- The tool scopes added to that API, one per gated tool.
- The MCP client registered on the tenant, with a client grant to the MCP API that lists every tool scope.
- For tools that call downstream APIs, an OBO client and one API per downstream service. See On-Behalf-Of for the setup.

### 3. Configure environment

```bash
# Tenant domain, no https://, no trailing slash
AUTH0_DOMAIN=your-tenant.us.auth0.com

# The MCP server's own API identifier, which is also its public URL
AUTH0_AUDIENCE=http://localhost:3000/mcp

# Only for tools that exchange tokens: a Custom API client tied to AUTH0_AUDIENCE
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
```

`createFastMcpAuth()` with no argument reads these four variables. A missing domain or audience throws `InvalidConfigurationError` when you call it. To keep the settings in code pass `domain`, `audience`, `clientId` and `clientSecret`; what you leave out is still read from the environment. To share a client with other code pass `client` from `createMcpClient`. Passing `client` together with an inline client option throws.

### 4. Write the server

```ts
import { FastMCP } from "fastmcp";
import { z } from "zod";
import { createFastMcpAuth, withAuth0Execute } from "@auth0/ai-fastmcp";

const auth = createFastMcpAuth({ metadata: { scopesSupported: ["read:orders"] } });
const server = new FastMCP({ name: "orders", version: "1.0.0", ...auth });

server.addTool({
  name: "whoami",
  description: "Returns the subject of the caller.",
  parameters: z.object({}),
  execute: withAuth0Execute(async (_args, { session }) => session.principal.sub),
});

await server.start({
  transportType: "httpStream",
  httpStream: { endpoint: auth.endpoint, port: 3000, stateless: true },
});
```

- `createFastMcpAuth` returns the two FastMCP options `authenticate` and `oauth`. Spreading them into `new FastMCP({...})` is all the wiring there is. Do not set FastMCP's own `auth` option as well.
- `auth.endpoint` is the path of the audience (`/mcp` here). It is not enumerable, so the spread does not hand it over: pass it to `server.start`, so the MCP route and the metadata name the same path. A mismatch makes the `resource_metadata` URL of the challenge return `404`.
- Use `stateless: true`. Any instance can serve any request and no caller can ride on another caller's session. A stateful server works too, and `createFastMcpAuth` binds each `mcp-session-id` to the first subject that used it (a different subject gets `403`).
- The audience must be the public URL of the server: an absolute `http` or `https` URL, without a trailing slash on a path (`https://mcp.example.com/mcp`, not `.../mcp/`). `resource` defaults to the audience and, if set, must equal it. Anything else throws `InvalidConfigurationError` when you call `createFastMcpAuth`, and the server never starts.
- `server.start` must use `transportType: "httpStream"`. The adapter authenticates HTTP requests only, and stdio tools answer `Authentication is required.`

Before any tool runs, `authenticate` does the following.

- A missing credential, or a scheme other than Bearer, gets a `401` with a bare `Bearer resource_metadata="..."` challenge. A token that fails verification gets a `401` with `error="invalid_token"`. A malformed header gets a `400`. A token lacking a server-wide `requiredScopes` scope gets a `403`. None of these reach a tool.
- A `DPoP` header, or a Bearer token with a `cnf` claim, gets a `401`. This adapter accepts Bearer tokens only and never treats a DPoP-bound token as plain Bearer. `dpop: { mode: 'required' }` throws at startup.
- On success it builds the session: `session.principal` (`sub`, `scopes`, `clientId`, `orgId`, `permissions`, `expiresAt`), `session.scopes` and `session.mcpClient`. The session holds no credential.
- It serves the RFC 9728 metadata at `/.well-known/oauth-protected-resource/mcp` and answers `404` on `GET /sse` on purpose. Connect with the Streamable HTTP transport.

### 5. Gate a tool

```ts
server.addTool({
  name: "refund_order",
  parameters: z.object({ id: z.string() }),
  execute: withAuth0Execute(async ({ id }, { session }) => {
    const { accessToken } = await session.mcpClient.getTokenOnBehalfOf({
      audience: "https://api.example.com",
      scope: "refund:orders",
    });
    // Send accessToken to the downstream API, never the caller's own token.
    return `Refunded ${id}`;
  }, { requiredScopes: ["write:orders", "refund:orders"] }),
});
```

`withAuth0Execute` wraps `execute`. It types `session` as present, binds the request context so `getCallerPrincipal()`, `getCallerMcpClient()` and `getCallerMcpClientOrThrow()` from `@auth0/ai-mcp` work in helper code, and turns failures into safe tool results. Wrap every tool that needs them: an unwrapped tool still gets `context.session`, but the accessors return `undefined`.

`requiredScopes` on `withAuth0Execute` checks the `scope` claim of the caller's incoming token (never `permissions`). All listed scopes are required. A missing one gives a tool result with `isError: true`, `_meta.error` of `insufficient_scope` and text `Missing required scope: refund:orders`, with HTTP 200. To hide a tool instead, use FastMCP's `canAccess: requireScopes("admin:all")`.

Per-tool scopes are not published automatically. List every scope a tool needs in `metadata.scopesSupported` (as above), otherwise an MCP client asks for none and every gated tool answers `Missing required scope`. A server-wide `requiredScopes` on `createFastMcpAuth` is published on its own.

For how the exchange works, see On-Behalf-Of.

### 6. Test

1. Request the MCP endpoint without a token. The response should be a `401` with a `WWW-Authenticate` header that starts with `Bearer resource_metadata="..."` and carries no `error`. The body is `{"error":"unauthorized","error_description":"Authentication is required."}`.

   ```bash
   curl -i -X POST http://localhost:3000/mcp -H "content-type: application/json" -H "accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

2. Fetch `http://localhost:3000/.well-known/oauth-protected-resource/mcp` and check `resource` and `authorization_servers`.
3. Call a tool with an access token issued for the audience. A stateless server needs no `initialize` call first, and the answer is a server-sent event whose `data:` line holds the JSON-RPC message.

If a call fails, see Common Errors.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `auth.endpoint` not passed to `server.start` | Pass `httpStream: { endpoint: auth.endpoint, ... }`. Otherwise the challenge names a metadata URL that returns `404` and the server logs a warning about another path |
| Setting FastMCP's own `auth` option as well as spreading `createFastMcpAuth()` | Use only the spread. The package already supplies `authenticate` and `oauth` |
| The audience has a trailing slash on its path, or is not a URL | Use the public URL without the trailing slash, in the environment and in the API identifier. `createFastMcpAuth` throws otherwise |
| A tool is not wrapped in `withAuth0Execute` | Wrap it. Without the wrapper the request-context accessors return `undefined`, and errors from the tool are sent to the client unchanged |
| `metadata.scopesSupported` left out for a per-tool scope | List it. Otherwise clients ask for no scope and every call answers `Missing required scope` |
| Exchanging tokens without `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` | Set both. Verification works without them, the exchange fails and the tool returns `Tool execution failed.` |
| A client that needs DPoP | This adapter is Bearer only and answers `401`. Use `@auth0/ai-mcp` |
| Starting the server on stdio | Use `transportType: "httpStream"` |
| Two copies of `fastmcp` installed | Run `npm ls fastmcp` and keep one. A `UserError` from another copy is not shown as written |
| Using `scopeMatching: 'non_strict'` without an indexed token store | Use an indexed store or `strict`. Otherwise `InvalidConfigurationError` at startup. See Token Caching |

## Related References

- Exchanging the caller's token for a downstream token - the On-Behalf-Of reference
- Caching exchanged tokens - the Token Caching reference
- Errors and fixes - the Common Errors reference

## Quick Reference

**Imports:**
```ts
import { createFastMcpAuth, withAuth0Execute } from "@auth0/ai-fastmcp";
import type { Auth0Session } from "@auth0/ai-fastmcp";
import { getCallerPrincipal, getCallerMcpClientOrThrow } from "@auth0/ai-mcp";
```

**Options of `createFastMcpAuth`:** `client`, `domain`, `audience`, `clientId`, `clientSecret`, `tokenStore`, `scopeMatching`, `organizationPolicy`, `organizationId`, `requestTimeoutMs`, `requireClientId`, `resource`, `endpoint`, `authorizationServers`, `requiredScopes`, `realm`, `metadata` (`scopesSupported`, `resourceName`, `resourceDocumentation`), `sessionBinding`, `onError`.

**Methods on `session.mcpClient`:**
- `getPrincipal()` - the verified caller, same as `session.principal`
- `getTokenOnBehalfOf({ audience, scope })` - exchanges the caller's token for a narrower downstream token
- `getClientCredentialsToken({ audience, scope })` - a token for the server itself, with no caller
- `getTokenForConnection({ connection })` - a token for a third-party service through Token Vault

**Environment variables:**
- `AUTH0_DOMAIN` - tenant domain, no `https://`, no trailing slash
- `AUTH0_AUDIENCE` - the MCP server's own API identifier, which must be its public URL
- `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` - the client used for token exchanges

**Docs in the package:**
- [Getting started](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-fastmcp/docs/GettingStarted.md)
- [Configuration](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-fastmcp/docs/Configuration.md)
- [Tools](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-fastmcp/docs/Tools.md)
- [Errors](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-fastmcp/docs/Errors.md)
- [Troubleshooting](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-fastmcp/docs/Troubleshooting.md)
- [DPoP](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-fastmcp/docs/DPoP.md)
- [Stateless and stateful servers](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-fastmcp/docs/StatelessAndStateful.md)
- [Example server](https://github.com/auth0/auth0-ai-js/tree/main/examples/ai-fastmcp-server)
