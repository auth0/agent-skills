# On-Behalf-Of with @auth0/ai-fastmcp (Node.js)

Framework-specific surface only. The tenant setup and the common issues are in the hub.

---

## Call the exchange in a tool

Wrap the tool in `withAuth0Execute` and call `getTokenOnBehalfOf` on `session.mcpClient`, once per downstream service. The server needs `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` (or `clientId` and `clientSecret` on `createFastMcpAuth`) of the OBO client from the hub.

```ts
server.addTool({
  name: "invoices",
  parameters: z.object({ id: z.string() }),
  execute: withAuth0Execute(async ({ id }, { session }) => {
    const { accessToken } = await session.mcpClient.getTokenOnBehalfOf({
      audience: "https://api.example.com",
      scope: "read:invoices",
    });
    const response = await fetch(`https://api.example.com/invoices/${id}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return await response.text();
  }),
});
```

Inside any wrapped function, `getCallerMcpClientOrThrow().getTokenOnBehalfOf(...)` (from `@auth0/ai-mcp`) does the same without the session argument. A tool that is not wrapped has no request context, so the accessors return `undefined`.

`getTokenOnBehalfOf({ audience, scope? })` resolves to an object with `accessToken`, `expiresAt` (epoch seconds), `scope` (may be absent), `grantedScopes` (always present), and `tokenType` and `issuedTokenType` when present. Decide what a token covers with `grantedScopes`: an empty `scope` string means nothing was granted.

### Scopes on the incoming token

`withAuth0Execute(fn, { requiredScopes })` checks the scopes on the caller's incoming token before the function runs. A missing scope returns a tool result with text `Missing required scope: <scope>`, `isError: true` and `_meta.error` of `insufficient_scope`, with HTTP 200. List every per-tool scope in `metadata.scopesSupported` of `createFastMcpAuth`, or clients never ask for it.

### Exchange failures are tool errors

Whatever escapes the wrapped function is replaced by a fixed text, so the client never sees a message from the exchange:

| Text | `_meta.error` | Cause |
|---|---|---|
| `The token exchange did not grant the requested scopes.` | `insufficient_scope` | Auth0 granted fewer scopes than the tool asked for (`DownscopedTokenError`) |
| `Authentication is required.` | `invalid_token` | No session, or an `UnauthenticatedError` (for example the caller's token is in its last five seconds with a token store set) |
| `The token operation failed.` | `server_error` | An `AuthError` from `@auth0/ai-mcp` escaped |
| `Tool execution failed.` | `server_error` | Anything else: wrong client secret, a tenant that refused the exchange, no client credentials, a timeout |

All are `isError: true` with HTTP 200. The raw error goes to the `onError` of `withAuth0Execute`, else the `onError` of `createFastMcpAuth`, else one log line `[ai-fastmcp] Tool failed: <name> code=... statusCode=... auth0_error=...` on standard error. Read that line first when you see `Tool execution failed.`. Auth0's own answer sits at `error.cause.cause` in an `onError` hook. Never send `cause` to a client.

### Other points

- `scope` is optional for the package, but Auth0 grants no scope to an exchange that sends none, so pass the scopes the downstream API needs.
- Never put `openid` or `offline_access` in `scope`: Auth0 refuses the request with `invalid_scope`.
- `getClientCredentialsToken({ audience, scope? })` and `getTokenForConnection({ connection })` live on the same client and are never cached by the package.
- Each outbound request to the tenant is aborted after `requestTimeoutMs` (default 10000, an option of `createFastMcpAuth`).

### Caching

By default there is no cache and every `getTokenOnBehalfOf` call performs a fresh exchange. Passing a `tokenStore` to `createFastMcpAuth` adds a cache in front of the exchange.

---

## Org mode (optional)

Organization policy is an option of `createFastMcpAuth`.

- `organizationPolicy: "allow"` (the default) accepts tokens whether or not they carry an `org_id` claim.
- `organizationPolicy: "required"` needs an `org_id` claim. Tokens without one get a `401` with `error="invalid_token"`. With `organizationId` also set (one `org_...` id or a list, trimmed), only those organizations are accepted. Setting `organizationId` without `"required"` throws `InvalidConfigurationError` when `createFastMcpAuth` runs.

```ts
const auth = createFastMcpAuth({
  organizationPolicy: "required",
  organizationId: ["org_abc123", "org_def456"],
});
```

Once a token passes verification, `session.principal.orgId` holds the organization from the `org_id` claim. It is `null` for tokens with no organization.
