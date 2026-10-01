# @auth0/auth0-auth-js — Passkeys

**Minimum version:** `1.7.0` (where the `passkey` API on `AuthClient` shipped). Two follow-ups the flows below depend on: `mfa_required` is surfaced from the passkey token exchange only from **`1.9.1`**; client credentials are correctly sent on `passkey.register` / `passkey.challenge` only from **`1.12.1`** (below that a confidential-client register/challenge won't authenticate).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

`auth0-auth-js` is the **low-level building-block** SDK: no session storage, no framework glue. It gives you the challenge and the token exchange; you run `navigator.credentials.*` yourself and you own where the tokens go.

## Signup / Login

```ts
import { AuthClient } from "@auth0/auth0-auth-js";

const authClient = new AuthClient({
  domain: "{yourCustomDomain}",     // custom domain, not *.auth0.com
  clientId: "{yourClientId}",
  clientSecret: "{yourClientSecret}",  // confidential client for the token exchange
});

// Signup registration challenge — options REQUIRED (≥1 of email/username/phoneNumber)
// → PasskeySignupChallengeResponse { authSession, authnParamsPublicKey }
const { authSession, authnParamsPublicKey } = await authClient.passkey.register({ email: "user@example.com" });

// Login challenge (options optional) → PasskeyLoginChallengeResponse { authSession, authnParamsPublicKey }
const login = await authClient.passkey.challenge(/* options? */);

// --- you run navigator.credentials.create() / .get() with authnParamsPublicKey ---

// Token exchange on the passkey grant → tokens (you store them)
const tokens = await authClient.passkey.getTokenByPasskey({ authSession, /* credential */ });
```

- `passkey.register(options)` → `PasskeySignupChallengeResponse { authSession, authnParamsPublicKey }`. Options are **required** — at least one of `email` / `username` / `phoneNumber`.
- `passkey.challenge(options?)` → `PasskeyLoginChallengeResponse { authSession, authnParamsPublicKey }`.
- `passkey.getTokenByPasskey(options)` → returns the token set; nothing is persisted for you. **This method lives on the `passkey` sub-client** — there is no top-level `authClient.getTokenByPasskey`.

## SDK-specific gotchas

- **`register` / `challenge` accept only a client secret** on a confidential client (they reject private-key-JWT and mTLS); public clients call them with `clientId` alone. Only `getTokenByPasskey` supports the full set (client secret, private-key JWT, or mTLS) — a public client cannot complete it. If you configure private-key-JWT or mTLS *only*, `register` / `challenge` will fail.
- This SDK stores nothing — persist the returned tokens and the `authSession` yourself.
- Use the registration challenge with `navigator.credentials.create()` and the login challenge with `.get()`.
- `passkey.getTokenByPasskey()` can surface `mfa_required` (throws `PasskeyGetTokenError`; narrow with `isMfaRequiredError`) — continue via `authClient.mfa` (see the hub, then `feature-mfa`).
- The `domain` must be the verified custom domain.
