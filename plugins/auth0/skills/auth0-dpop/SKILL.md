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

---

## Additional Resources

### [Framework Examples](references/examples.md)
Complete implementation examples for all supported frameworks:
- Vue.js
- React
- Angular
- auth0-spa-js (Vanilla JS)

### [Integration Guide](references/integration.md)
Error handling and troubleshooting:
- `UseDpopNonceError` — nonce rotation handling
- Common issues

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
