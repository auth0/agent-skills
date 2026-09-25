# auth0-server-python — Passkeys

**Minimum version:** `1.0.0b13` (passkey signup/signin + MFA; DPoP-bound passkeys also landed here).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

`auth0-server-python` is **low-level**: the server issues the challenge and runs the token exchange; the WebAuthn ceremony runs on the client and the credential is posted back. Methods and fields are `snake_case`.

## Signup / Login

```python
from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import PasskeyUserProfile, PasskeyAuthResponse

server_client = ServerClient(
    domain="{yourCustomDomain}",      # custom domain, not *.auth0.com
    client_id="{yourClientId}",
    client_secret="{yourClientSecret}",  # see "client auth" below
    secret="{yourSessionSecret}",
    # state_store / transaction_store as configured
)

# Signup challenge → PasskeySignupChallengeResponse
#   .auth_session: str, .authn_params_public_key: PasskeyPublicKeyOptions
signup_challenge = await server_client.passkey_signup_challenge(
    user_profile=PasskeyUserProfile(email="user@example.com", name="Jane Doe"),
    # optional: connection, organization, user_metadata, store_options
)

# Login challenge → PasskeyLoginChallengeResponse (same fields)
login_challenge = await server_client.passkey_login_challenge(
    # optional: username (conditional-UI hint), connection, organization, store_options
)

# --- client runs the WebAuthn ceremony with authn_params_public_key ---

# Token exchange → PasskeyLoginResult
result = await server_client.signin_with_passkey(
    auth_session=login_challenge.auth_session,
    authn_response=PasskeyAuthResponse(  # the WebAuthn credential from the client
        id="...", raw_id="...", type="public-key", response={...},
    ),
    # optional: store_options, connection, organization, scope, audience, dpop_key
)
# tokens / user claims live inside result.state_data (e.g. result.state_data["user"])
```

- `passkey_signup_challenge(user_profile=..., ...)` → `PasskeySignupChallengeResponse`.
- `passkey_login_challenge(...)` → `PasskeyLoginChallengeResponse`.
- `signin_with_passkey(auth_session, authn_response, ...)` → `PasskeyLoginResult`.

All three are `async` — `await` them. The credential is passed as `authn_response=PasskeyAuthResponse(...)`; there is **no** separate `credential` param.

## Data classes (from `auth0_server_python.auth_types`)

- `PasskeyUserProfile` — the signup identity; all optional: `email`, `name`, `username`, `phone_number`, `given_name`, `family_name`, `nickname`, `picture`.
- `PasskeyAuthResponse` — the WebAuthn credential posted back: `id: str`, `raw_id: str` (alias `rawId`), `type: str`, `response: dict[str, str]`, optional `authenticator_attachment`, `client_extension_results`.
- `PasskeyLoginResult` — single field `state_data: dict[str, Any]`; the tokens and user claims live inside it (`result.state_data["user"]`).

## Client authentication

A **confidential client is not strictly required** — the passkey token exchange allows public clients, and the SDK only authenticates when a `client_secret` is configured. The real constraint: the passkey challenge endpoints accept a **client secret only, not a client assertion** — a client configured with Private Key JWT only (`client_assertion_signing_key`) cannot use passkey flows. Also enable the passkey grant `urn:okta:params:oauth:grant-type:webauthn` on the app.

## Error handling

The three methods raise `PasskeyError` (a subclass of `Auth0Error`); its code comes from `PasskeyErrorCode` (`passkey_challenge_error`, `passkey_token_error`, `invalid_response`). `signin_with_passkey()` can also raise `MfaRequiredError` (from `auth0_server_python.error`) before a session is created — continue with the MFA flow (see the hub, then `feature-mfa`).

## SDK-specific gotchas

- Carry the challenge's `auth_session` through to `signin_with_passkey`.
- `authn_params_public_key` is the WebAuthn options the client ceremony consumes — pass it through unchanged.
- For DPoP-bound tokens pass `dpop_key` (an EC P-256 JWK) to `signin_with_passkey`.
- The `domain` must be the verified custom domain.
