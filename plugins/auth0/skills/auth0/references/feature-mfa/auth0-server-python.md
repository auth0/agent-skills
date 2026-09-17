# auth0-server-python — MFA

**Minimum version:** 1.0.0b17. In this line every `mfa.*` method decrypts the token internally — pass the encrypted `mfa_token` as-is, never pre-decrypt. Step-up (redirect) flow: 1.0.0b15+.

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in `index.md`. `store_options` is always `{"request": request, "response": response}` (the raw framework objects your transaction/state store reads cookies from).

Two flows; pick one.

## Flow 1 — step-up (redirect)

No separate class — pass `acr_values` + `max_age: 0` on `start_interactive_login`:

```python
from auth0_server_python.auth_server.server_client import ServerClient
from auth0_server_python.auth_types import StartInteractiveLoginOptions

MFA_ACR = "http://schemas.openid.net/pape/policies/2007/06/multi-factor"

url = await server_client.start_interactive_login(
    StartInteractiveLoginOptions(
        authorization_params={"acr_values": MFA_ACR, "max_age": 0},
        app_state={"returnTo": "/sensitive-action"},
    ),
    store_options={"request": request, "response": response},
)
# issue the redirect from your framework layer
```

On callback, `await server_client.complete_interactive_login(str(request.url), store_options=...)` returns `{"app_state": {...}}`. Verify step-up completed off the user dict from `get_user()`: `user.get("acr") == MFA_ACR or "mfa" in (user.get("amr") or [])` — `acr`/`amr` sit directly on the user dict and are absent on non-stepped-up sessions.

## Flow 2 — MFA API (no redirect)

`get_access_token()` raises `MfaRequiredError`. Its `mfa_token` is **encrypted**; pass it straight to the `mfa.*` methods — they decrypt internally. Do **not** call `decrypt_mfa_token` yourself, or the token is double-decrypted and `verify` fails with `MfaTokenInvalidError`:

```python
from auth0_server_python.error import MfaRequiredError

try:
    token = await server_client.get_access_token(store_options=store_options)
except MfaRequiredError as e:
    mfa_token = e.mfa_token          # encrypted; pass as-is to every mfa.* call
    # e.mfa_requirements has "enroll" or "challenge"
```

Methods on `server_client.mfa` (dict args; `store_options` optional, required for MCD):

- `list_authenticators({"mfa_token": mfa_token})` → items with `id`, `authenticator_type`, `oob_channel`, `active`.
- `enroll_authenticator({"mfa_token", "factor_type", ...})` — `factor_type`: `"otp"`/`"sms"`/`"voice"`/`"email"`/`"auth0"`; `sms`/`voice` need `phone_number`, `email` needs `email`. OTP → `barcode_uri`, `secret`; OOB → `oob_code`.
- `challenge_authenticator({"mfa_token", "factor_type", "authenticator_id"})` → `oob_code`, `expires_in`. For OOB, derive `factor_type` from `authenticator.oob_channel` (not `authenticator_type`).
- `verify(options, store_options={"request": request, "response": response})` — `options` = `{"mfa_token", <otp | oob_code + binding_code | recovery_code>, "persist": True, "audience": "...", "scope"?}`. `persist=True` writes tokens to the session store — `audience` goes **inside** `options`, `store_options` is a **separate kwarg** (not in the dict). Check `verify_response.recovery_code` — returned on first enrollment or after using one; show once.

Push polling: call `verify` with `{"mfa_token", "oob_code"}` in a loop, backing off on `authorization_pending` / `slow_down`.

DPoP: if the login that raised `MfaRequiredError` was DPoP-bound, pass the same key — `verify({...}, dpop_key=dpop_key)`. The SDK attaches the proof and raises `MfaVerifyError` on a Bearer downgrade.

If `verify()` itself raises `MfaRequiredError` (chained factor), that error's `mfa_token` is **raw**, not encrypted.

Source: https://github.com/auth0/auth0-server-python/blob/main/examples/MFA.md · https://github.com/auth0/auth0-server-python/blob/main/examples/StepUpAuthentication.md
