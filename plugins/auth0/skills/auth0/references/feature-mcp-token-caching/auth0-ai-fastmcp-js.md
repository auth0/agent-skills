# Token Caching with @auth0/ai-fastmcp (Node.js)

Framework-specific surface only. The cache key, the scope-matching modes and the scope re-check are in the hub. The store, the keys and the encrypted store are those of `@auth0/ai-mcp`; this adapter adds no cache of its own.

---

## Turn caching on

Caching is opt-in. With no `tokenStore`, every `getTokenOnBehalfOf`, `getClientCredentialsToken` and `getTokenForConnection` call is a fresh request to Auth0 and nothing is kept. Pass a store with the inline options:

```ts
import { MemoryIndexedTokenStore } from "@auth0/ai-mcp";
import { createFastMcpAuth } from "@auth0/ai-fastmcp";

export const auth = createFastMcpAuth({
  domain: "your-tenant.us.auth0.com",
  audience: "https://mcp.example.com/mcp",
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  tokenStore: new MemoryIndexedTokenStore(),
});
```

Or give it to a client you pass in (`client` cannot be combined with inline client options):

```ts
import { MemoryIndexedTokenStore, createMcpClient } from "@auth0/ai-mcp";
import { createFastMcpAuth } from "@auth0/ai-fastmcp";

const client = createMcpClient({
  domain: "your-tenant.us.auth0.com",
  audience: "https://mcp.example.com/mcp",
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  tokenStore: new MemoryIndexedTokenStore(),
});

export const auth = createFastMcpAuth({ client });
```

Tools do not change. A second `session.mcpClient.getTokenOnBehalfOf(...)` for the same audience and scopes by the same caller returns the stored token with no request to the tenant.

---

## What is cached and under which key

The core client (`@auth0/auth0-api-js` 1.8.0 or later) caches three kinds, each under its own key prefix: On-Behalf-Of, client credentials and Token Vault connection tokens.

- **Always per caller** for On-Behalf-Of and Token Vault: the key includes the issuer, client, `sub` and organization of the inbound token, so a token is never served to another caller. Token Vault also keys on the connection and `loginHint`. A Token Vault call with a token that has no string `sub` is never cached.
- **Session part:** the `sid` claim of the inbound access token, else its `jti`, else a SHA-256 digest of the token. Auth0 access tokens for an API in the default profile carry neither, so a cached token is reused only for the same inbound token, and a refreshed token triggers a new exchange.
- **Client credentials** have no caller: the key is the tenant, the requesting client, the audience and the requested scopes, matched exactly.
- **Scope comparison** uses the scopes the tenant granted, not the ones requested.
- **Expiry:** a stored token is a hit until 30 seconds before its own expiry, and a token issued with 30 seconds or less left is not stored.
- **Revocation window:** a cached token stays usable until then, even if the session ends, the inbound token is revoked, the user disconnects the connection, a client grant changes or the client secret is rotated. If a provider needs a faster cut-off, do not set a `tokenStore`.
- A store that throws never fails a tool: a failed read is a miss and a failed write is ignored. The store must expire entries itself, using each value's `expiresAt`.

---

## Scope matching

| Mode | A stored On-Behalf-Of token is a hit when |
|---|---|
| `"strict"` (default) | its granted scopes are exactly the requested scopes |
| `"non_strict"` | its granted scopes cover the requested scopes (smallest wins) |

`scopeMatching` applies to On-Behalf-Of only. `"non_strict"` needs an indexed store such as `MemoryIndexedTokenStore`; otherwise `createFastMcpAuth` throws `InvalidConfigurationError` when called, and the server never starts.

```ts
import { MemoryIndexedTokenStore } from "@auth0/ai-mcp";
import { createFastMcpAuth } from "@auth0/ai-fastmcp";

export const auth = createFastMcpAuth({
  tokenStore: new MemoryIndexedTokenStore(),
  scopeMatching: "non_strict",
});
```

---

## Several instances

`MemoryIndexedTokenStore` lives in one process: it is not shared between instances and is empty after a restart. That only costs extra exchanges. For instances that must share tokens, implement `TokenStore` (and `IndexedTokenStore` for `"non_strict"`) on shared storage and wrap it with `createEncryptedTokenStore`:

```ts
import { MemoryIndexedTokenStore, createEncryptedTokenStore } from "@auth0/ai-mcp";
import { createFastMcpAuth } from "@auth0/ai-fastmcp";

const secret = process.env.TOKEN_STORE_SECRET;
if (secret === undefined) throw new Error("TOKEN_STORE_SECRET is not set.");

export const auth = createFastMcpAuth({
  // Replace MemoryIndexedTokenStore with your shared store.
  tokenStore: createEncryptedTokenStore(new MemoryIndexedTokenStore(), { secret }),
  scopeMatching: "non_strict",
});
```

The wrapper encrypts every value before it reaches the inner store. The secret must be at least 32 characters (use 32 random bytes from a secret manager), every instance sharing the storage needs the same one, and there is no rotation: a changed secret makes old entries misses. A stored token is a credential for your downstream API until it expires, so treat the store like any place that holds credentials. The store guide of `@auth0/ai-mcp` covers the Redis shape (write the value and its expiry in one command) and the index rules.

The cache and the session binding of stateful servers are separate: the binding only remembers which subject owns a `mcp-session-id` and never holds a token.
