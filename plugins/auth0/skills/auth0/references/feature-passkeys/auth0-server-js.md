# @auth0/auth0-server-js — Passkeys

**Minimum version:** `1.7.0` (where the `passkey` API on `ServerClient` shipped). For a working confidential-client flow use **`>=1.12.1`** — that release bumped the `@auth0/auth0-auth-js` peer dep to `^1.12.1`, which carries the fix that actually sends client credentials on `register`/`challenge`.

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

`auth0-server-js` is **low-level**: the server issues the challenge and runs the token exchange; the WebAuthn ceremony (`navigator.credentials.*`) runs in the browser and the credential is posted back to your server. On success `passkey.getToken()` persists the session to the configured `StateStore`.

## Signup / Login

```ts
import { ServerClient } from "@auth0/auth0-server-js";

const serverClient = new ServerClient({
  domain: "{yourCustomDomain}",   // custom domain, not *.auth0.com
  clientId: "{yourClientId}",
  clientSecret: "{yourClientSecret}",  // confidential client required
  stateStore, transactionStore,        // your stores
});

// Signup registration challenge — options REQUIRED (≥1 of email/username/phoneNumber)
// → PasskeyRegisterResponse { authSession, authnParamsPublicKey: PasskeyCreationOptions }
const { authSession, authnParamsPublicKey } = await serverClient.passkey.register({ email: "user@example.com" });

// Login challenge (options optional)
// → PasskeyChallengeResponse { authSession, authnParamsPublicKey: PasskeyRequestOptions }
const login = await serverClient.passkey.challenge(/* options? */);

// --- browser runs navigator.credentials.create() / .get() with authnParamsPublicKey ---

// Token exchange on the passkey grant; persists tokens to the StateStore
await serverClient.passkey.getToken({ authSession, credential /*, realm?, scope?, audience?, organization? */ });
```

- `passkey.register(options)` → `PasskeyRegisterResponse { authSession, authnParamsPublicKey: PasskeyCreationOptions }`. Options are **required** — at least one of `email` / `username` / `phoneNumber`.
- `passkey.challenge(options?)` → `PasskeyChallengeResponse { authSession, authnParamsPublicKey: PasskeyRequestOptions }`.
- `passkey.getToken({ authSession, credential, realm?, scope?, audience?, organization? })` → exchanges the credential, persists tokens to the `StateStore`, and resolves to `PasskeyGetTokenResult { authorizationDetails? }` (RAR only, not the token set).

`PasskeyCreationOptions` / `PasskeyRequestOptions` are the SDK's own WebAuthn-shaped interfaces (e.g. `challenge` is a base64url `string`), re-exported from `auth0-auth-js` — not the DOM `PublicKeyCredential*Options` lib types.

## Error handling

`passkey.getToken()` throws `PasskeyGetTokenError`; when `error.cause.error === 'mfa_required'` narrow with `isMfaRequiredError(error)`, read `cause.mfa_token` / `cause.mfa_requirements` (no session is persisted), and continue via `serverClient.mfa` (see the hub's MFA-interplay section, then `feature-mfa`).

## SDK-specific gotchas

- **Configure the `ServerClient` with `clientSecret`.** `register` / `challenge` accept **only** a client secret — they reject private-key-JWT (`clientAssertionSigningKey`) and mTLS, so a confidential client must set `clientSecret`. (A *public* client can call `register` / `challenge` with `clientId` alone; the public-client rejection is only at the `getToken` step, whose exchange also accepts private-key-JWT or mTLS.)
- `authnParamsPublicKey` is the SDK's WebAuthn options object — hand it to the browser as-is; do not reshape it. (base64url reshaping applies only to the credential *response*, not to `authnParamsPublicKey`.)
- Persist `authSession` across the challenge→exchange round trip (it ties the credential to the challenge).
- `serverClient.mfa` is available with a static `domain`; in resolver (multi-tenant) mode the `mfa` getter throws `InvalidConfigurationError` — the passkey methods themselves work in both modes.
- The `domain` must be the verified custom domain.
