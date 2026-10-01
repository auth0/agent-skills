# auth0-api-python

Python resource-server SDK for validating Auth0 JWT access tokens via `verify_access_token` / `verify_request`.

Framework-specific MFA scope gate: see the MFA reference (`feature-mfa`) for the scope-gate pattern and the `auth0-api-python` leaf for exact signatures.

## Integration

Install: `pip install auth0-api-python`

Import: `from auth0_api_python import ApiClient, ApiClientOptions, VerifyAccessTokenError`

Instantiate:

```python
client = ApiClient(ApiClientOptions(domain=AUTH0_DOMAIN, audience=AUTH0_AUDIENCE))
```

`verify_access_token(access_token)` and `verify_request(headers)` are async — always `await` them. On error, `VerifyAccessTokenError.get_status_code()` returns `401`.

For scope enforcement: split `claims.get("scope", "").split()` and check the required scope string. `required_claims` only checks claim key presence, not value content.
