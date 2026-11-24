# Token Caching with @auth0/ai-mcp (Node.js)

Framework-specific surface only. The cache key, the scope-matching modes and the scope re-check are in the hub. This file also covers the two other token kinds the Node.js package caches.

---

## Turn caching on

Caching is opt-in. With no `tokenStore`, every `getTokenOnBehalfOf`, `getClientCredentialsToken` and `getTokenForConnection` call is a fresh request to Auth0 and nothing is kept anywhere. To turn it on, pass a token store to `createMcpClient` (or inline on a handler):

```ts
import { MemoryIndexedTokenStore, createMcpClient } from '@auth0/ai-mcp';

export const client = createMcpClient({
  domain: 'your-tenant.us.auth0.com',
  audience: 'https://mcp.example.com/mcp',
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  tokenStore: new MemoryIndexedTokenStore({ maxEntries: 5000 }),
  scopeMatching: 'strict',
});
```

The package keeps no cache of its own. The core client (`@auth0/auth0-api-js` 1.8.0 or later) does the caching for all three kinds of token: On-Behalf-Of, client credentials and Token Vault connection tokens. Each kind uses its own key prefix, so a kind never reads another kind's entries.

---

## What the key holds (read before writing a store)

Keys are opaque hashes built by the core client, never by your store, and they carry no claim value. They are still stable pseudonymous identifiers, so treat the store as sensitive.

- **On-Behalf-Of:** the exchanging tenant, client and audience; the inbound token's issuer, client, subject (`sub`) and organization; the inbound session; the audience you request; and the normalized scope set.
- **Token Vault:** the tenant, client and audience; the caller's issuer, client, `sub` and organization; the connection; the `loginHint`; and the inbound session. `sub` is required: an access token without a string `sub` is exchanged on every call and nothing is stored. The key is built from verified claims only, so a call with an expired or mismatched token fails and never reads the store.
- **Client credentials:** the tenant, the requesting client, the audience and the scope set you requested. There is no caller. A call without `scope` has its own entry. `getClientCredentialsToken` always matches scopes exactly, whatever `scopeMatching` says.
- **Session part of the key:** the `sid` claim of the inbound access token, else its `jti` claim, else a SHA-256 digest of the token. Auth0 access tokens for an API in the default profile carry neither `sid` nor `jti`, so the session part is a digest of the whole token: a cached token is reused only for the same inbound token, and a refreshed access token triggers a new exchange. Check which claims your tokens carry before you rely on cross-token reuse.

Because the subject is in the key, one caller's token is never served to another caller, and separate sessions of one user stay apart.

### Expiry and revocation window

- A stored token counts as a hit only until 30 seconds before its own expiry. A token issued with 30 seconds or less left is not stored.
- **Revocation window:** a cached token stays usable until that time whatever happens meanwhile: the session ends, the inbound token is revoked, the user disconnects the connection in Token Vault, or (for client credentials) a client grant changes or the client secret is rotated, because the secret is not part of the key. A shorter token lifetime shortens the window. If a downstream provider needs a faster cut-off, do not set a `tokenStore`.
- Store failures never fail a tool call: a read that throws is a miss, and a write that throws is ignored, so the fresh token is still returned. An outage costs extra exchanges.
- The package never deletes entries. Your store must expire them using each value's `expiresAt` (epoch seconds).

---

## The store interface

`TokenStore` (types exported from `@auth0/ai-mcp`) has three async methods: `get(key)` returns a `CachedToken` or `undefined`, `set(key, value)` and `delete(key)`. A `CachedToken` holds `accessToken`, `expiresAt`, `grantedScopes` and optional `scope`, `tokenType`, `issuedTokenType`. The caching of client credentials and Token Vault tokens needs no indexed store.

The package ships two stores:

- `MemoryIndexedTokenStore({ maxEntries })`: in memory, bounded (default 1000, least recently used evicted), copies values on write and read, drops expired entries lazily. One process only: not shared between workers and empty after a restart.
- `createEncryptedTokenStore(inner, { secret })`: wraps any store so the inner store never sees an access token in the clear.

### Encrypted store

```ts
import { MemoryIndexedTokenStore, createEncryptedTokenStore, createMcpClient } from '@auth0/ai-mcp';

const secret = process.env.TOKEN_STORE_SECRET;
if (secret === undefined) throw new Error('TOKEN_STORE_SECRET is not set.');

export const client = createMcpClient({
  domain: 'your-tenant.us.auth0.com',
  audience: 'https://mcp.example.com/mcp',
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  tokenStore: createEncryptedTokenStore(new MemoryIndexedTokenStore(), { secret }),
  scopeMatching: 'non_strict',
});
```

- `secret` must be at least 32 characters or `InvalidConfigurationError` is thrown. Use 32 random bytes from a secret manager (hex or base64). Every process that shares the inner store needs the same secret. There is no secret rotation: changing it makes old entries unreadable (misses), so expect a burst of exchanges.
- Storage keys and entry expiry stay readable, because the inner store needs them. A wrong or changed secret reads as a miss, and the wrapper writes one `console.warn` line per problem kind. It does not stop someone with write access to the inner store from deleting or replaying an older entry until it expires.
- The package reads no environment: pass `process.env.TOKEN_STORE_SECRET` yourself, as above.

---

## Using `non_strict`

`scopeMatching: 'non_strict'` applies to On-Behalf-Of tokens only. It needs an `IndexedTokenStore`, which adds `addIndexMember(indexKey, member)` (atomic, replaces a member with the same `tokenKey`) and `listIndexMembers(indexKey)` (all members, or `[]`). `createMcpClient` throws `InvalidConfigurationError` at construction for `non_strict` with a missing or non-indexed store. With your own `apiClient` the check cannot run and the core client reports it on the first token request.

A request with no scopes never reuses a cached token in this mode. Expire the whole index key and push its expiry out to the latest member's `expiresAt` on every add.

---

## A shared store

For several instances, implement the interface on shared storage and wrap it with `createEncryptedTokenStore`. Write the value and its expiry in one command, or a crash leaves an entry that never expires.

```ts
import { createEncryptedTokenStore } from '@auth0/ai-mcp';
import type { CachedToken, IndexedTokenStore, TokenIndexMember } from '@auth0/ai-mcp';

interface RedisTransaction {
  hset(key: string, field: string, value: string): RedisTransaction;
  expireat(key: string, epochSeconds: number): RedisTransaction;
  exec(): Promise<unknown>;
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EXAT', epochSeconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  hvals(key: string): Promise<string[]>;
  multi(): RedisTransaction;
}

class RedisTokenStore implements IndexedTokenStore {
  constructor(private readonly redis: RedisLike) {}

  async get(key: string): Promise<CachedToken | undefined> {
    const raw = await this.redis.get(`mcp:token:${key}`);
    return raw === null ? undefined : (JSON.parse(raw) as CachedToken);
  }

  async set(key: string, value: CachedToken): Promise<void> {
    await this.redis.set(`mcp:token:${key}`, JSON.stringify(value), 'EXAT', value.expiresAt);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(`mcp:token:${key}`);
  }

  async addIndexMember(indexKey: string, member: TokenIndexMember): Promise<void> {
    const key = `mcp:index:${indexKey}`;
    const members = await this.listIndexMembers(indexKey);
    const latest = Math.max(member.expiresAt, ...members.map((entry) => entry.expiresAt));
    await this.redis.multi().hset(key, member.tokenKey, JSON.stringify(member)).expireat(key, latest).exec();
  }

  async listIndexMembers(indexKey: string): Promise<TokenIndexMember[]> {
    const values = await this.redis.hvals(`mcp:index:${indexKey}`);
    return values.map((value) => JSON.parse(value) as TokenIndexMember);
  }
}

export function createSharedStore(redis: RedisLike, secret: string): IndexedTokenStore {
  return createEncryptedTokenStore(new RedisTokenStore(redis), { secret });
}
```

The `EXAT` option of `SET` needs Redis 6.2 or later. The encrypted wrapper makes `grantedScopes` of index members ciphertext, so the inner store must treat members as opaque.

---

## Check that the cache works

The package has no cache-hit hook. Call the same tool twice with the same inbound token: the second call should make no request to `https://<domain>/oauth/token`. Two different inbound tokens without a `sid` never share an entry, which is correct.
