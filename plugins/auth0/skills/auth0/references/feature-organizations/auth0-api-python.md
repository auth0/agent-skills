# auth0-api-python — Organizations (API side)

**Minimum version:** `required_claims` on `verify_access_token` has been available since the early
`1.0.0b` betas (target `1.0.0b4`+; this reference documents the current `1.0.0b10` API). Check the
installed version in `pyproject.toml`/`requirements.txt` and upgrade if it falls short.

Framework-specific surface only. The protocol shape, `org_id`-reading guidance, tenant config, and
common mistakes live in the shared Organizations reference. This SDK **validates** access tokens on
a resource API — it does not perform login. Organizations here means: enforce the `org_id` claim on
the verified access token to prevent cross-tenant access.

## Enforce org membership

`verify_access_token`'s `required_claims` asserts a claim is **present** (raising
`VerifyAccessTokenError` when absent); it does **not** check the value. Require `org_id`, then
compare the returned claim to the org this API serves:

```python
import os
from auth0_api_python import ApiClient, ApiClientOptions
from auth0_api_python.errors import VerifyAccessTokenError

api_client = ApiClient(ApiClientOptions(
    domain=os.environ["AUTH0_DOMAIN"],
    audience=os.environ["AUTH0_AUDIENCE"],
))

async def require_acme_org(access_token: str) -> dict:
    # required_claims=["org_id"] rejects a token that carries no org_id at all.
    claims = await api_client.verify_access_token(
        access_token=access_token,
        required_claims=["org_id"],
    )
    # required_claims is presence-only — enforce the value yourself.
    if claims["org_id"] != os.environ["ACME_ORG_ID"]:
        raise VerifyAccessTokenError("token is not for a served organization")
    return claims
```

Map both `VerifyAccessTokenError` cases to a `401`/`403`. For a multi-org API, compare against a
**set** of served org IDs, not a single value.

## Reading the organization back

`verify_access_token` returns the claims as a dict — read `org_id` straight off it:

```python
# required_claims=["org_id"] guarantees the key is present, so indexing it
# below cannot raise KeyError on a token that lacks the claim.
claims = await api_client.verify_access_token(
    access_token=access_token,
    required_claims=["org_id"],
)
org_id = claims["org_id"]  # "org_barkbook_acme"
```

## Security / correctness

- Keep domain/audience/org id in the environment (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `ACME_ORG_ID`),
  not hardcoded in `.py` source.
- Do not decode the JWT by hand (`jwt.decode`/PyJWT, base64-decoding a segment) — `verify_access_token`
  already verifies the signature and returns the claims.
- Use the resource-server package `auth0-api-python`, not the management SDK (`from auth0 import ...`)
  or the web app SDK (`auth0-server-python`).
- There is no `org_id=` keyword on `verify_access_token` — enforce with `required_claims` plus a value
  comparison.

The symbols above are accurate for auth0-api-python 1.0.0b10 — do not read site-packages to re-verify
them.

> **No org-specific upstream example yet.** `EXAMPLES.md` has no Organizations section. The closest
> maintained reference is its access-token validation section, which documents `verify_access_token`
> and `required_claims`:
> https://raw.githubusercontent.com/auth0/auth0-api-python/main/EXAMPLES.md#using-verify_access_token
