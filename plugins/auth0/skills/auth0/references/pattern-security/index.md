# Auth0 Security Best Practices

---

## Token validation

**Always validate access tokens on the backend.** Never trust a token sent from a client without verifying it.

```javascript
// Express — using express-oauth2-jwt-bearer
import { auth } from 'express-oauth2-jwt-bearer';

const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256',
});

app.get('/api/data', checkJwt, (req, res) => {
  // Token is validated — req.auth.payload has claims
});
```

Validate these claims on every request:
- `iss` — must match your Auth0 domain (`https://YOUR_TENANT.auth0.com/`)
- `aud` — must match your API identifier
- `exp` — must not be expired
- `alg` — must be RS256 (default) or the alg you configured

---

## Scopes and RBAC

Scopes limit what an access token can do. Define them in your Auth0 API settings.

```javascript
const { requiredScopes } = require('express-oauth2-jwt-bearer');

app.delete('/api/resource/:id',
  checkJwt,
  requiredScopes('delete:resource'),
  (req, res) => { /* authorized */ }
);
```

For Role-Based Access Control (RBAC), enable it on the Auth0 API and assign roles to users. Roles produce a `permissions` claim in access tokens.

---

## Token storage

| Context | Recommended storage | Avoid |
|---|---|---|
| Browser SPA | In-memory (SDK default) | localStorage (XSS risk) |
| Server-side session | Encrypted session cookie (HttpOnly) | Unencrypted cookies |
| Mobile | Secure platform keychain/keystore | Plain storage |
| CI/CD | Env var / secrets manager | Source code |

Auth0 SDKs handle storage automatically in their default configurations.

---

## PKCE (required for public clients)

All SPA and mobile clients must use PKCE. Auth0 SDKs enforce this by default. Do not disable it.

---

## Client secrets

- Client secrets are for server-side apps only (Regular Web App, Machine-to-Machine).
- SPAs and native apps must NOT have a client secret — they use PKCE instead.
- Rotate secrets if compromised: Auth0 Dashboard → Applications → [app] → Rotate Secret.

---

## Allowed URLs

Be specific with callback and logout URLs:

```
# Too broad:
https://example.com/*

# Correct:
https://example.com/callback
https://example.com
```

---

## Refresh token rotation

Enable refresh token rotation to limit blast radius of a stolen token:
Auth0 Dashboard → Applications → [app] → Refresh Token Rotation → Enable.
