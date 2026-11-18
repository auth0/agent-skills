# On-Behalf-Of with @auth0/ai-mcp (Node.js)

Framework-specific surface only. The tenant setup and the common issues are in the hub.

---

## Call the exchange in a tool

Inside a tool, get the request-scoped client with `getCallerMcpClientOrThrow()` and call `getTokenOnBehalfOf` on it, once per downstream service. The client needs `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` (or `clientId` and `clientSecret`) of the OBO client from the hub.

```ts
import { getCallerMcpClientOrThrow, withRequiredScopes } from '@auth0/ai-mcp';

server.registerTool(
  'cancel_and_refund_order',
  { description: 'Cancels an order and refunds it.' },
  withRequiredScopes('tool:cancel_and_refund_order', async () => {
    const mcpClient = getCallerMcpClientOrThrow();
    const orders = await mcpClient.getTokenOnBehalfOf({ audience: ORDERS_AUDIENCE, scope: 'cancel:orders' });
    const payments = await mcpClient.getTokenOnBehalfOf({ audience: PAYMENTS_AUDIENCE, scope: 'refund:payments' });
    // Send orders.accessToken and payments.accessToken to their APIs, never the caller's own token.
    return { content: [{ type: 'text' as const, text: 'done' }] };
  }),
);
```

`getTokenOnBehalfOf({ audience, scope? })` resolves to an object with `accessToken`, `expiresAt` (epoch seconds), `scope` (as the server returned it, may be absent), `grantedScopes` (normalized, always present), and `tokenType` and `issuedTokenType` when present. Decide what a token covers with `grantedScopes`, not `scope`: an empty `scope` string means nothing was granted.

`withRequiredScopes` checks the scopes on the caller's incoming token (the scopes the client was granted for your MCP server) before the tool body runs. A missing scope returns a tool result with `isError: true` and `_meta.error` of `insufficient_scope`, with HTTP 200. `requireScopes` is the imperative form and throws `InsufficientScopeError`.

### When Auth0 grants fewer scopes than asked

If the exchanged token comes back with fewer scopes than were requested, `getTokenOnBehalfOf` throws `DownscopedTokenError` (HTTP 403 `insufficient_scope` if it escapes a custom `createMcpHandler` handler), so tool code never receives a token missing scopes it asked for. On `createNodeMcpHandler` and `createMcpSdkHandler` the MCP SDK turns any error thrown in a tool into a tool result with `isError: true`, so the call ends as a tool error with HTTP 200. The narrower token is still cached under the scopes it was actually granted when a store is set.

### Exchange failures are tool errors

A failed exchange (tenant refused, wrong secret, timeout) never becomes a protocol error on the SDK adapters. The request-scoped client replaces the message with `The token operation failed.`, keeps the error class and the `code`, `statusCode` and `headers` of the token response, and attaches the original error as `cause`. Catch what you want to handle in the tool, log the class name (never the token or `cause`), and return an `isError` result:

```ts
import { DownscopedTokenError, UnauthenticatedError, getCallerMcpClientOrThrow } from '@auth0/ai-mcp';

try {
  const token = await getCallerMcpClientOrThrow().getTokenOnBehalfOf({ audience: ORDERS_AUDIENCE, scope: 'read:orders' });
  // call the API with token.accessToken
} catch (error) {
  if (error instanceof UnauthenticatedError) throw error;
  const text = error instanceof DownscopedTokenError ? 'Not permitted.' : 'The request failed.';
  console.error('exchange failed', error instanceof Error ? error.name : 'unknown');
  return { isError: true as const, content: [{ type: 'text' as const, text }] };
}
```

### Other points

- `scope` is optional for the package, but Auth0 grants no scope to an exchange that sends none, so always pass the scopes the downstream API needs. A downstream API that checks scopes refuses the token and the package does not complain.
- Never put `openid` or `offline_access` in `scope`: Auth0 refuses the whole request with `invalid_scope`.
- Concurrent identical exchanges from one client share one request to Auth0. Each outbound request is aborted after `requestTimeoutMs` (default 10000).
- A token that is expired or expires within five seconds is rejected with the generic error, so a tool never gets a dead token. With a `tokenStore` set, a caller's token in its last five seconds fails the exchange as `UnauthenticatedError`.
- Client credentials (`getClientCredentialsToken`) and Token Vault (`getTokenForConnection({ connection })`) work the same way and are never cached by the package.

### Caching

By default there is no cache and every `getTokenOnBehalfOf` call performs a fresh exchange. Passing a `tokenStore` to the client adds a cache in front of the exchange.

---

## Org mode (optional)

Organization policy is set with `organizationPolicy` on the client (or inline on the handler).

- `'allow'` (the default) accepts tokens whether or not they carry an `org_id` claim.
- `'required'` needs the token to carry an `org_id` claim. Tokens without one get a `401` with `error="invalid_token"`. When `organizationId` is also set (one `org_...` id or a list, trimmed), only tokens from those organizations are accepted. Setting `organizationId` without `'required'` throws `InvalidConfigurationError`.

```ts
import { createMcpClient } from '@auth0/ai-mcp';

export const client = createMcpClient({
  domain: 'your-tenant.us.auth0.com',
  audience: 'https://mcp.example.com/mcp',
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  organizationPolicy: 'required',
  organizationId: ['org_abc123', 'org_def456'],
});
```

Once a token passes verification, `getCallerPrincipal()?.orgId` holds the organization from the `org_id` claim. It is `null` for tokens with no organization. The two rejection cases (`MissingOrganizationError`, `OrganizationNotAllowedError`) look identical to the client and do not call `onError`, so check the tenant logs.
