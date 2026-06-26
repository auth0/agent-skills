---
name: auth0-dpop
description: Use when adding DPoP (Demonstrating Proof-of-Possession) token binding to protect API calls with device-bound, sender-constrained access tokens that cannot be replayed if stolen. Also use when a user says "bind tokens to the client", "prevent token theft", or "sender-constrained tokens".
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
  openclaw:
    emoji: "\U0001F511"
    homepage: https://github.com/auth0/agent-skills
    requires:
      bins:
        - auth0
    os:
      - darwin
      - linux
    install:
      - id: brew
        kind: brew
        package: auth0/auth0-cli/auth0
        bins: [auth0]
        label: 'Install Auth0 CLI (brew)'
---

# Auth0 DPoP Guide

Bind access tokens to the client's cryptographic key so stolen tokens cannot be replayed.

---

## Overview

### What is DPoP?

DPoP (Demonstrating Proof-of-Possession) is an OAuth 2.0 mechanism defined in
[RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449) that cryptographically
binds access tokens to a client-held key pair. Each API request includes a
short-lived signed JWT (the DPoP proof) that proves the sender holds the private
key — a stolen token alone cannot be replayed by an attacker.

### When to Use This Skill

- Protecting high-value API calls against token theft and replay attacks
- Meeting security or compliance requirements that mandate sender-constrained tokens
- Any SPA or Vanilla JS app calling a protected Auth0 API with elevated security needs

### When NOT to Use This Skill

- **SSR / server-side environments** — DPoP relies on a private key held in the browser; it cannot be safely used server-side (Next.js, Nuxt, etc.)
- **APIs that don't support DPoP** — the resource server must be configured to accept DPoP token dialect; Bearer-only APIs will reject DPoP proofs
- **Flows requiring token sharing** — DPoP tokens are bound to a single key pair and cannot be forwarded to or reused by another client

### Requirements

- Auth0 tenant with DPoP-capable authorization server
- API resource server with DPoP token dialect enabled
- A browser SPA using one of: `@auth0/auth0-vue`, `@auth0/auth0-react`,
  `@auth0/auth0-angular`, or `@auth0/auth0-spa-js`
- HTTPS in production (required by Auth0 for DPoP)

### Key Concepts

| Concept | Description |
|---------|-------------|
| DPoP Proof | A short-lived signed JWT attached to each request proving key possession |
| DPoP Nonce | A server-issued value that must be included in the proof to prevent replay |
| `useDpop: true` | SDK option that enables automatic DPoP proof generation |
| `createFetcher()` | SDK helper that returns a `fetch`-compatible function handling proofs automatically |
| `UseDpopNonceError` | Error thrown when the server rotates its nonce mid-flight; retry with the new nonce |

---

## Step 1: Enable DPoP on Your API

### Via Auth0 Dashboard

1. Go to **Applications → APIs**
2. Select the API your SPA calls
3. Under the **Settings** tab, confirm the API identifier matches your `audience`
4. No additional toggle is needed in the dashboard — DPoP is enabled per-request
   by the client when the API resource server is configured to accept DPoP tokens

### Via Auth0 CLI

```bash
# Inspect current resource server settings
auth0 api get "resource-servers" | jq '.[] | select(.identifier == "https://your-api-identifier")'

# Enable DPoP token dialect on the API
auth0 api patch "resource-servers/{API_ID}" \
  --data '{"token_dialect": "access_token_authz"}'
```

> Replace `{API_ID}` with the ID returned from the GET call above.

---

## Step 2: Configure Your Application

### Common pattern across all frameworks

1. Add `useDpop: true` to your Auth0 client/provider configuration alongside your `audience`
2. Use `createFetcher()` instead of attaching tokens manually — the SDK handles
   proof generation, nonce management, and header injection for you
3. Handle `UseDpopNonceError` in cases where the server rotates its nonce

### Environment variables

Ensure your `.env` includes the API audience:

```bash
# Vite
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://your-api-identifier
```

**For framework-specific implementation, see [Framework Examples](references/examples.md):**
- [Vue.js](references/examples.md#vuejs)
- [React](references/examples.md#react)
- [Angular](references/examples.md#angular)
- [auth0-spa-js (Vanilla JS)](references/examples.md#auth0-spa-js-vanilla-js)

---

## Error Handling

### `UseDpopNonceError`

Servers may rotate their DPoP nonce. When this happens the SDK throws
`UseDpopNonceError`. Retry the request once — the SDK will have updated the
stored nonce automatically:

```typescript
// Import from your framework SDK:
// @auth0/auth0-vue | @auth0/auth0-react | @auth0/auth0-angular | @auth0/auth0-spa-js
import { UseDpopNonceError } from '@auth0/auth0-vue';

try {
  const response = await apiFetch('/data');
  const data = await response.json();
} catch (err) {
  if (err instanceof UseDpopNonceError) {
    // Nonce was stale — retry once; SDK has already stored the new nonce
    const response = await apiFetch('/data');
    const data = await response.json();
  } else {
    throw err;
  }
}
```

### Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| API returns `401` with `error: use_dpop_nonce` | Server issued a new nonce | Catch `UseDpopNonceError` and retry |
| API returns `401` with `invalid_dpop_proof` | Clock skew or wrong `htm`/`htu` values | Ensure system clock is accurate; verify `baseUrl` matches API URL exactly |
| Token still issued as Bearer instead of DPoP | `useDpop: true` missing or `audience` not set | Confirm both options are present in client config |
| `createFetcher` is undefined | SDK version too old | Upgrade to `@auth0/auth0-spa-js` ≥ 2.1 (or framework SDK wrapping it) |

---

## Related Skills

- `auth0-vue` - Vue.js Auth0 integration
- `auth0-react` - React Auth0 integration
- `auth0-angular` - Angular Auth0 integration
- `auth0-spa-js` - Vanilla JS / framework-agnostic SPA integration
- `auth0-mfa` - Multi-factor authentication

---

## References

- [Auth0 DPoP Documentation](https://auth0.com/docs/secure/tokens/access-tokens/dpop)
- [RFC 9449 — OAuth 2.0 Demonstrating Proof of Possession](https://datatracker.ietf.org/doc/html/rfc9449)
- [auth0-spa-js Releases](https://github.com/auth0/auth0-spa-js/releases)
