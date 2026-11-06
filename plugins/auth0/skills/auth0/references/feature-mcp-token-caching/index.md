# Auth0 MCP OBO Token Caching

Cache the tokens that an On-Behalf-Of exchange gets from Auth0, so repeat calls skip the network round trip.

---

## Overview

### What caching does

Every OBO exchange swaps the user's token for a service token at Auth0, which costs a network round trip. With a cache, the SDK keeps each token it gets and hands it back the next time a tool asks for the same user, service and scopes.

### Off by default

The OBO cache is optional and off by default. Without a token store, every exchange is a fresh call and nothing is persisted anywhere. To turn caching on, pass a concrete token store to the SDK's client factory.

---

## SDK Integration

Get the exact calls from the per-SDK reference. **`Read:` the file for the detected SDK.**

| SDK | What it covers | Read this file |
|---|---|---|
| `auth0-ai-mcp` (Python) | Turning the cache on, the store interface, the indexed store | `Read: references/feature-mcp-token-caching/auth0-ai-mcp-python.md` |

---

## Cache key

The cache key is derived from the caller's `sub`, the `audience`, the organization, the scopes, and the session. Tokens are stored under the scopes Auth0 actually granted, so two requests from the same user that end up with different granted scopes are separate cache entries under `"strict"` mode.

Scope-matching modes (`strict` and `non_strict`) apply to OBO tokens only.

---

## Scope-matching modes

The `scope_matching` option decides when a saved token is good enough to hand back.

| | `strict` (default) | `non_strict` |
|---|---|---|
| Reuses a saved token when | its scopes exactly match what the tool asks for | its scopes include everything the tool asks for |
| A `read:inventory` request after a `read:inventory write:inventory` swap | does a new swap | reuses the saved token |
| Store it needs | any token store | an indexed token store, which also tracks the scopes of each saved token. A plain store, or no store at all, is a configuration error at startup. |
| Pick it when | you have no reason not to. Each tool gets a token with only the access it asked for. | several tools call the same service with overlapping scopes and the extra swaps matter to you |
| Trade-off | more swaps | a tool can get a token with more access than it asked for |

To do this without one scope set evicting another, `"non_strict"` keeps every distinct token plus an index of the scopes each was granted. Any cached token whose scopes cover the request can then be reused.

---

## Scope re-check on every hit

The scopes Auth0 actually granted can be narrower than what was requested. Both modes store the token under its granted scopes and record those granted scopes alongside it, so a downscoped token is cached. On a hit, `"strict"` reuses the token only when the granted scopes exactly equal the request, and `"non_strict"` reuses it only when the granted scopes still cover the request. A request with no scopes never reuses a cached token under `"non_strict"`.
