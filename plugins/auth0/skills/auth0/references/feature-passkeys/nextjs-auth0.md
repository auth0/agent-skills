# @auth0/nextjs-auth0 — Passkeys

**Minimum version:** `4.22.0` (passkey signup/login + My Account enrollment).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

This SDK ships **two layers**:

- **Built-in route handlers** — `auth0.middleware()` mounts `/auth/passkey/register`, `/challenge`, `/get-token`, `/enrollment-challenge`, `/enrollment-verify`.
- **Client one-call wrappers** (high-level) over those routes — the usual path for app code.
- **Server methods** (`auth0.passkey.*`) — low-level single-step building blocks if you handle routes yourself.

## Client — signup / login (high-level, one call)

The client helper runs the whole flow (challenge → WebAuthn ceremony → get-token → session) in one call and returns `Promise<void>`:

```tsx
"use client";
import { passkey } from "@auth0/nextjs-auth0/client";

// Signup: at least one identifier; profile fields depend on the connection's Attributes config
await passkey.signup({ email: "user@example.com", name: "Jane Doe" });

// Login
await passkey.login();
```

`PasskeyRegisterOptions` accepts `email`, `username`, `phoneNumber`, `name`, `givenName`, `familyName`, `nickname`, `picture`, `userMetadata`, `connection`, `organization`. The client module also exports `serializeCredential`.

## Client — enrollment (add a passkey to an authenticated account)

Requires an access token with `create:me:authentication_methods` and an MRRT policy for the `https://{yourDomain}/me/` audience (the SDK auto-exchanges the session refresh token via MRRT). See the hub's Enrollment section.

```tsx
"use client";
import { passkey } from "@auth0/nextjs-auth0/client";

const challenge = await passkey.enrollmentChallenge(/* { connection?, userIdentityId? } */);
// runs the WebAuthn registration ceremony
const method = await passkey.enrollmentVerify(/* { authenticationMethodId, authSession, authResponse } */);
// method: PasskeyEnrollmentVerifyResponse — the registered auth method (id, type: "passkey", ...)
```

- `passkey.signup(options?)` / `passkey.login(options?)` → `Promise<void>`.
- `passkey.enrollmentChallenge(options?)` → `PasskeyEnrollmentChallengeResponse` (`{ authenticationMethodId, authSession, authnParamsPublicKey }`).
- `passkey.enrollmentVerify(options)` → `PasskeyEnrollmentVerifyResponse`.

## Server — low-level building blocks (`auth0.passkey.*`)

Use these only if you handle the routes yourself. App Router signatures take options; Pages Router / Middleware take the request first:

```ts
import { auth0 } from "@/lib/auth0";

// App Router
const registration = await auth0.passkey.register(/* PasskeyRegisterOptions? */);  // → PasskeyRegisterResponse
const challenge = await auth0.passkey.challenge(/* PasskeyChallengeOptions? */);    // → PasskeyChallengeResponse
await auth0.passkey.getToken({ authSession, authResponse /*, connection?, organization?, scope?, audience? */ }); // → Promise<void>, sets session
```

- `register(options?)` → `PasskeyRegisterResponse`; `challenge(options?)` → `PasskeyChallengeResponse`.
- `getToken(options)` → `Promise<void>`; the credential field is **`authResponse`** (a serialized `PasskeyAuthResponse`), not `credential`.
- `enrollmentChallenge(options?)` → `PasskeyEnrollmentChallengeResponse`; `enrollmentVerify(options)` → `PasskeyEnrollmentVerifyResponse`.
- **Pages Router / Middleware overloads:** `register(req, options?)`, `challenge(req, options?)`, `enrollmentChallenge(req, options?)`, `enrollmentVerify(req, options)` take `req: NextRequest`; only `getToken(req, res, options)` needs both `NextRequest` and `NextResponse` (wrong arity throws a `TypeError`).

## SDK-specific gotchas

- The application must be a **confidential client** — the server token exchange authenticates with the client secret.
- **Production requires a Custom Domain** (it becomes the passkey `rpId`); for local dev the `rpId` is just `localhost`, which works without a custom domain.
- The client wrappers (`@auth0/nextjs-auth0/client`) do the whole flow — do not also call the server `register`/`challenge` from a client component; those are server-only.
- `getToken()` can throw `mfa_required` (rethrown by the client verify path) — continue with the MFA flow (see the hub, then `feature-mfa`).
- Enrollment requires the MRRT policy; without it the My Account access token cannot be minted.
