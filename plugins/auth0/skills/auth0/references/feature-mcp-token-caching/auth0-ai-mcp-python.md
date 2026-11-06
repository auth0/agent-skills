# Token Caching with auth0-ai-mcp (Python)

Framework-specific surface only. The cache key, the scope-matching modes and the scope re-check are in the hub.

---

## Turn caching on

To turn caching on, pass a concrete `AbstractTokenStore` implementation to `create_mcp_client` as `token_store`.

```python
from auth0_ai_mcp import create_mcp_client

# store is your AbstractTokenStore implementation.
client = create_mcp_client(
    domain, audience,
    client_id="...", client_secret="...",
    token_store=store,
    scope_matching="strict",
)
```

---

## The store interface

`AbstractTokenStore` is exported from `auth0_ai_mcp`. It is abstract, so you provide a concrete implementation with three async methods, `get`, `set`, and `delete`. The base class takes a `secret` of at least 32 characters (for example from `openssl rand -hex 32`) and gives you `encrypt(key, value)` and `decrypt(key, data)`, so the store only ever holds encrypted values.

The package ships no concrete store. The example server includes in-memory `InMemoryTokenStore` and `InMemoryIndexedTokenStore` classes in `token_store.py`. They show the shape of a store but lose every token on restart, so a production server needs a shared store such as Redis.

### Expiry

A production store has to handle expiry itself, because the SDK never calls `delete` and never cleans up old entries. Every value passed to `set` carries an `expires_at` Unix timestamp, so set a matching TTL when you write it.

### Store errors

If the store raises on a read, the SDK logs a warning and treats it as a cache miss. If it raises on a write, the SDK logs a warning and still returns the freshly exchanged token. A store outage costs extra exchanges but never fails a tool call.

Connection tokens from `get_token_for_connection` are keyed on tenant, client ID, `sub`, `connection`, and `login_hint`, with no scope dimension.

---

## Using `non_strict`

`non_strict` needs an `IndexedTokenStore`. A plain store, or no store at all, raises `ConfigurationError` at startup.

### The indexed store

`IndexedTokenStore` extends `AbstractTokenStore` with two async methods that manage the index. Each index member is a `TokenIndexMember` holding a `token_key`, its `granted_scopes`, and its `expires_at`.

- `add_index_member(index_key, member)` adds the member, replacing any member with the same `token_key`. It must be atomic. Two concurrent exchanges for the same user and audience can add to the same index at once, and a read-modify-write without a lock or an atomic store operation (such as a Redis hash field write) loses one of them.
- `list_index_members(index_key)` returns every member, or `[]` when the index does not exist. It may include expired members, because the SDK skips those on read.

The SDK never removes members from an index, so the store should expire the whole index key. Pushing its TTL out to the latest member's `expires_at` on every add keeps it alive exactly as long as its newest token.
