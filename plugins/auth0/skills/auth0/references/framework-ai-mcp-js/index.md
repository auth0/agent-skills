# @auth0/ai-mcp Integration

Secure a Node.js MCP server built on the official MCP TypeScript SDK (`@modelcontextprotocol/server`, v2) with Auth0 using `@auth0/ai-mcp`.

## Prerequisites

- A Node.js MCP server built on `@modelcontextprotocol/server` 2.3 or later, or a new one (Node.js 20 or later, zod 4.2 or later for tool schemas)
- An Auth0 API for the MCP server itself, whose identifier is the server's public URL, for example `https://mcp.example.com/mcp`. That identifier is the audience
- `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` of an Auth0 client, needed only when a tool exchanges tokens (On-Behalf-Of, client credentials, Token Vault). Token verification works without them
- If the tenant is not set up yet, see Step 2

## When NOT to Use

- **`fastmcp` is listed in `package.json`** - FastMCP has its own adapter package, `@auth0/ai-fastmcp`, so use that reference instead of hand-wiring this one.
- **The server is built on `@modelcontextprotocol/sdk` (v1)** - This skill does not route v1 servers, and the v2 adapters do not accept a v1 server. The package still has the framework-neutral `createMcpHandler`, and the Handler docs of the package show an unsupported v1 recipe: [Using the MCP SDK v1](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/Handler.md#using-the-mcp-sdk-v1).
- **A Python MCP server** - Use the `auth0-ai-mcp` Python reference.

## Quick Start Workflow

### 1. Install

```bash
npm install @auth0/ai-mcp@beta @modelcontextprotocol/server zod
```

`@modelcontextprotocol/server` is an optional peer dependency that only the `@auth0/ai-mcp/mcp-sdk` entry point loads, so install it when you use that entry point. `@auth0/auth0-api-js` comes with the package, and the token store types and the `AuthError` and `InvalidConfigurationError` classes are re-exported from `@auth0/ai-mcp`, so import them from there.

### 2. Set up the tenant

The tenant needs the following. The exact CLI commands are in the "Set up your tenant" section of the [ai-mcp-server example README](https://github.com/auth0/auth0-ai-js/tree/main/examples/ai-mcp-server#set-up-your-tenant), so run them from there rather than rewriting them.

- An API for the MCP server itself. Its identifier must equal `AUTH0_AUDIENCE` and be the public URL of the server.
- The tool scopes added to that API, one per gated tool.
- The MCP client (Claude Code in the example) registered on the tenant, with a client grant to the MCP API that lists every tool scope. Claude Code also needs two tenant settings, see [MCP clients and tenant settings](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/McpClients.md).
- For tools that call downstream APIs, an OBO client and one API per downstream service. See On-Behalf-Of for the setup.

### 3. Configure environment

```bash
# Tenant domain, no https://, no trailing slash
AUTH0_DOMAIN=your-tenant.us.auth0.com

# The MCP server's own API identifier, which is also its public URL. Clients request a
# token for exactly this value, and the server publishes it as the protected resource.
AUTH0_AUDIENCE=http://localhost:3000/mcp

# Only for tools that exchange tokens: a Custom API client tied to AUTH0_AUDIENCE
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
```

`createNodeMcpHandler`, `createMcpSdkHandler` and `createMcpHandler` read these four variables when you pass no client or inline options. `createMcpClient` itself reads nothing from the environment: to build a client from it, use `createMcpClient(resolveMcpClientOptions({ ... }))`. A missing domain or audience throws `InvalidConfigurationError` at startup.

### 4. Serve MCP with token verification

```ts
import { createServer } from 'node:http';
import { getCallerPrincipal } from '@auth0/ai-mcp';
import { createNodeMcpHandler } from '@auth0/ai-mcp/mcp-sdk';
import { McpServer } from '@modelcontextprotocol/server';

const handler = createNodeMcpHandler({
  requiredScopes: ['mcp:access'],
  createServer: () => {
    const server = new McpServer({ name: 'hello', version: '1.0.0' });
    server.registerTool('hello', { description: 'Greets the caller.' }, async () => ({
      content: [{ type: 'text' as const, text: `Hello ${getCallerPrincipal()?.sub}` }],
    }));
    return server;
  },
});

createServer((req, res) => void handler(req, res)).listen(3000);
```

To keep the settings in code, pass `domain`, `audience`, `clientId` and `clientSecret` as options. What you leave out is still read from the environment. To share one client with other code, build it with `createMcpClient` and pass `client`. Passing `client` together with an inline client option throws `InvalidConfigurationError`.

`createServer` runs once per request, so register tools inside it and keep expensive setup outside. The adapter is stateless and answers with JSON bodies, so there are no sessions and no streaming.

Before any tool runs, the handler does the following.

- It reads the `Authorization` header (Bearer, or DPoP with a `DPoP` proof header) and verifies the token against your tenant: signature, issuer, audience, expiry, and the organization policy.
- A missing credential gets a `401` with a bare `Bearer resource_metadata="..."` challenge. A token that fails verification gets a `401` with `error="invalid_token"`. A malformed header gets a `400`. A token missing a `requiredScopes` scope gets a `403` with `error="insufficient_scope"`. None of these reach a tool.
- DPoP fails closed: a bad or missing proof is a `401` with `error="invalid_dpop_proof"` or `use_dpop_nonce`, and `dpop: { mode: 'disabled' }` is Bearer only. Do not use `disabled` to "make DPoP errors go away".
- On success it builds a `Principal` (`sub`, `scopes`, `clientId`, `orgId`, `permissions`, `expiresAt`) and binds it with a request-scoped client to the request, so tool code reads the caller without taking an auth argument.
- It serves the RFC 9728 metadata at `/.well-known/oauth-protected-resource/mcp` (the well-known path followed by the path of the resource). `resource` defaults to the audience and, if you set it, must equal it. The audience must therefore be the public URL of the server and an absolute `http` or `https` URL, such as `https://mcp.example.com/mcp`. A value like `urn:acme:mcp` throws.

On Express, route both paths to the handler and mount it before any body-parsing middleware:

```ts
app.all('/mcp', handler);
app.get('/.well-known/oauth-protected-resource/mcp', handler);
```

### 5. Gate a tool

```ts
import { getCallerMcpClientOrThrow, withRequiredScopes } from '@auth0/ai-mcp';

server.registerTool(
  'list_reports',
  { description: 'Lists reports for the calling user.' },
  withRequiredScopes('tool:list_reports', async () => {
    const mcpClient = getCallerMcpClientOrThrow();
    const token = await mcpClient.getTokenOnBehalfOf({
      audience: 'https://reports-api.example.com',
      scope: 'read:reports',
    });
    // Send token.accessToken to the downstream API, never the caller's own token.
    return { content: [{ type: 'text' as const, text: 'ok' }] };
  }),
);
```

`withRequiredScopes` checks the `scope` claim of the caller's incoming token (never `permissions`) before the callback runs. All listed scopes are required and matching is exact. When one is missing it returns a tool result with `isError: true` and `_meta.error` set to `insufficient_scope`, with HTTP 200. `requireScopes` is the imperative form and throws `InsufficientScopeError`. A string is one scope or a space-delimited list, and an empty requirement throws `InvalidConfigurationError` when the tool is wrapped.

Per-tool scopes are not published automatically. List every scope a tool needs in `metadata.scopesSupported` of the handler, otherwise an MCP client asks for none and every gated tool answers `isError`.

For how the exchange works, see On-Behalf-Of.

### 6. Test

1. Request the MCP endpoint without a token. The response should be a `401` whose `WWW-Authenticate` header starts with `Bearer resource_metadata="..."` and carries no `error`.

   ```bash
   curl -i -X POST http://localhost:3000/mcp -H "content-type: application/json" -H "accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```

2. Fetch `http://localhost:3000/.well-known/oauth-protected-resource/mcp` and check that `resource` is the audience and `authorization_servers` is `https://<domain>/`.
3. Call a tool with an access token issued for the audience (a machine-to-machine client with a grant to the MCP API works for a first test), or add the server to an MCP client:

   ```bash
   claude mcp add --transport http my-server http://localhost:3000/mcp
   ```

If a call fails, see Common Errors.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| The API identifier or `AUTH0_AUDIENCE` is not the public URL clients use | Set both to that URL, without a trailing slash on the path. The handler accepts only tokens for the audience and advertises it as the resource, so any other value makes every request a `401` or throws at startup |
| `metadata.scopesSupported` left out | List every tool scope. Without it a client asks for no scope, gets a token without the tool scopes, and every `withRequiredScopes` check fails |
| Calling `getTokenOnBehalfOf` without `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` | Set both, or pass `clientId` and `clientSecret`. Token verification works without them, the exchange does not |
| `getCallerPrincipal()` or `getCallerMcpClientOrThrow()` outside a request | They need the request context the handler binds. Call them inside a tool running under the handler |
| Mounting the handler only on `/mcp` in Express | Also route `GET /.well-known/oauth-protected-resource/mcp` to it, or MCP clients cannot discover the authorization server |
| A body-parsing middleware ahead of the handler | Mount the handler first. A parser that already consumed the stream makes the adapter re-serialize the body |
| Passing `client` and `domain` together | Use one tier: environment, inline options or a shared `client` |
| Using `scopeMatching: 'non_strict'` without an indexed token store | Use `MemoryIndexedTokenStore` or another indexed store, or `strict`. Otherwise `InvalidConfigurationError` at startup. See Token Caching |
| The tool scope was added to the API but a new login still lacks it | A client grant update replaces the whole scope list. Patch the grant with the full list and have the client sign in again |

## Related References

- Exchanging the caller's token for a downstream token - the On-Behalf-Of reference
- Caching exchanged tokens - the Token Caching reference
- Errors and fixes - the Common Errors reference

## Quick Reference

**Client with an organization policy:**
```ts
import { createMcpClient } from '@auth0/ai-mcp';

const client = createMcpClient({
  domain: 'your-tenant.us.auth0.com',
  audience: 'https://mcp.example.com/mcp',
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  organizationPolicy: 'required',
  requestTimeoutMs: 5_000,
});
```

**Imports:**
```ts
import {
  createMcpClient,
  getCallerPrincipal,
  getCallerMcpClientOrThrow,
  withRequiredScopes,
  requireScopes,
  InsufficientScopeError,
  UnauthenticatedError,
  DownscopedTokenError,
} from '@auth0/ai-mcp';
import { createNodeMcpHandler, createMcpSdkHandler } from '@auth0/ai-mcp/mcp-sdk';
```

**Entry points:**
- `createNodeMcpHandler` (Node `http` and Express) and `createMcpSdkHandler` (`Request` to `Response` runtimes), both from `@auth0/ai-mcp/mcp-sdk`
- `createMcpHandler`, `authenticateRequest`, `buildProtectedResourceMetadata` and `buildWwwAuthenticate` from `@auth0/ai-mcp` for a custom stack

**Methods on the request-scoped client:**
- `getTokenOnBehalfOf({ audience, scope })` - exchanges the caller's token for a narrower downstream token
- `getTokenForConnection({ connection, loginHint })` - exchanges the caller's token for a federated provider token through Token Vault. The user must have linked the account first
- `getClientCredentialsToken({ audience, scope })` - a token for the server itself, with no caller

**Environment variables:**
- `AUTH0_DOMAIN` - tenant domain, no `https://`, no trailing slash
- `AUTH0_AUDIENCE` - the MCP server's own API identifier, which must be its public URL
- `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` - the client used for token exchanges

**Docs in the package:**
- [Handler and adapters](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/Handler.md)
- [Token verification](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/TokenVerification.md)
- [Scope enforcement](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/ScopeEnforcement.md)
- [On Behalf Of](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/OnBehalfOf.md)
- [Token caching](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/TokenCaching.md)
- [Organization policy](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/OrganizationPolicy.md)
- [Errors](https://github.com/auth0/auth0-ai-js/blob/main/packages/ai-mcp/docs/Errors.md)
- [Example server](https://github.com/auth0/auth0-ai-js/tree/main/examples/ai-mcp-server)
