# @auth0/auth0-vue — Passkeys

**Minimum version:** `2.8.0` (the `passkey` API on the `useAuth0()` composable).

Framework-specific surface only. The shared 3-step mechanic, the tenant configuration (custom domain + passkey grant + connection auth method), the feature-level protocol symbols, and the MFA-interplay error semantics live in `feature-passkeys/index.md` — do not restate them here.

`auth0-vue` is **high-level**: `passkey.signup()` / `passkey.login()` run the challenge, the browser ceremony, and the token exchange in one call, then update reactive auth state.

## Prerequisites (app-side)

Passkey login creates no session cookie, so the plugin **must** use refresh tokens:

```ts
import { createAuth0 } from "@auth0/auth0-vue";

app.use(
  createAuth0({
    domain: "{yourCustomDomain}",     // custom domain, not *.auth0.com
    clientId: "{yourClientId}",
    authorizationParams: { redirect_uri: window.location.origin },
    useRefreshTokens: true,           // required — enable Refresh Token Rotation on the tenant
  })
);
```

## Signup

```vue
<script setup lang="ts">
import { useAuth0 } from "@auth0/auth0-vue";

const { passkey, isAuthenticated } = useAuth0();

async function signUp() {
  await passkey.signup({
    email: "user@example.com",
    name: "Jane Doe",
    // scope, audience, organization optionally
  });
}
</script>
```

`passkey.signup(options)` resolves to a `TokenEndpointResponse`; on resolve `isAuthenticated` becomes `true` and tokens are stored.

## Login

```vue
<script setup lang="ts">
const { passkey } = useAuth0();

async function logIn() {
  await passkey.login({
    // realm, organization, scope, audience optional
  });
}
</script>
```

`passkey.login(options)` also resolves to a `TokenEndpointResponse`.

## Error classes

Import from `@auth0/auth0-vue`:

- `PasskeyError` — base passkey error.
- `PasskeyRegisterError` — signup/registration ceremony failed.
- `PasskeyChallengeError` — the challenge request failed.
- `PasskeyGetTokenError` — the token exchange on the passkey grant failed.
- `MfaRequiredError` — the tenant requires a second factor after the passkey; continue with the MFA flow (see the hub, then `feature-mfa`).

## SDK-specific gotchas

- `useRefreshTokens: true` is mandatory.
- The `domain` must be the verified custom domain.
- `passkey.*` reject on user cancellation — catch and offer a retry.
