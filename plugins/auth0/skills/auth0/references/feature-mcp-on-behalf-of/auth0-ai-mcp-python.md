# On-Behalf-Of with auth0-ai-mcp (Python)

Framework-specific surface only. The tenant setup and the common issues are in the hub.

---

## Call the exchange in a tool

Inside a tool, get the request-scoped client with `require_caller_mcp_client()` and call `get_token_on_behalf_of` on it, once per downstream service.

```python
@mcp.tool()
@with_required_scopes("tool:cancel_and_refund_order")
async def cancel_and_refund_order(order_id: str, amount: str) -> str:
    auth0 = require_caller_mcp_client()
    orders_token = await auth0.get_token_on_behalf_of(audience=ORDERS_AUDIENCE, scope="cancel:orders")
    payments_token = await auth0.get_token_on_behalf_of(audience=PAYMENTS_AUDIENCE, scope="refund:payments")
    ...
```

The full signature is:

```python
RequestScopedMcpClient.get_token_on_behalf_of(*, audience: str, scope: str | None = None) -> TokenSet
```

The returned `TokenSet` carries `access_token` and `expires_at`, plus `granted_scopes` when the token response carried a `scope`. Pass `token["access_token"]` to the downstream HTTP call.

`with_required_scopes` checks the caller's scopes before the tool body runs and raises `InsufficientScopeError` if one is missing.

### When Auth0 grants fewer scopes than asked

If the exchanged token comes back with fewer scopes than were requested, `get_token_on_behalf_of` raises `DownscopedTokenError`, so tool code never receives a token that is missing scopes it asked for. An already-expired result, or one without a usable expiry, raises `GetTokenByExchangeProfileError`, and client credentials runs the same downscope check (raising `DownscopedTokenError`) while Token Vault does not.

The token store still caches the exchanged token under the scopes it was actually granted, so a later call that asks only for that narrower set is served from cache. A cache hit is safe because both scope-matching modes re-check the granted scopes against the request on every hit.

The check only runs when the token response carries a `scope` field. An absent `scope` field means the grant matched the request, which is the normal case per RFC 6749 section 5.1, so nothing is rejected in that case.

### Leaving out `scope`

`scope` is optional. The downscope check runs only when `scope` was requested and the token response carries a `scope` field. In `non_strict` mode a call without `scope` never reuses a cached token.

### Caching

By default there is no cache and every call to `get_token_on_behalf_of` performs a fresh exchange. Passing a `token_store` to `create_mcp_client` adds a cache in front of the exchange.

---

## Org mode (optional)

Organization policy is set with the `organization_policy` argument on `create_mcp_client`.

- `"allow"` (the default) accepts tokens whether or not they carry an `org_id` claim.
- `"required"` needs the token to carry an `org_id` claim, and tokens without one are rejected with a `401`. When `organization_id` is also set, only tokens from the specified organization (or one of the specified organizations) are accepted.

`organization_id` takes a single string or a list of strings.

```python
from auth0_ai_mcp import create_mcp_client

client = create_mcp_client(
    domain="your-tenant.auth0.com",
    audience="https://your-mcp-server/mcp",
    organization_policy="required",
    organization_id="org_abc",
)
```

To accept tokens from multiple organizations:

```python
client = create_mcp_client(
    domain="your-tenant.auth0.com",
    audience="https://your-mcp-server/mcp",
    organization_policy="required",
    organization_id=["org_abc", "org_xyz"],
)
```

Once a token passes verification, `principal.org_id` holds the organization from the token's `org_id` claim. It is `None` for tokens that carry no Organization.
