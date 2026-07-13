# Token Handling Patterns

---

## Access token vs ID token

| Token | Purpose | Use for |
|---|---|---|
| **Access token** | Authorization for an API | Calling your backend API |
| **ID token** | User identity assertion | Reading user profile in your frontend |

**Never send the ID token to your API** — instead, send the access token and validate it there. Never use the access token to read user profile in your frontend; instead, read profile info from the ID token (or the `/userinfo` endpoint).

---

## Getting an access token

```javascript
// React
const { getAccessTokenSilently } = useAuth0();
const token = await getAccessTokenSilently({
  authorizationParams: { audience: 'https://api.example.com' }
});

// Next.js (nextjs-auth0 v4)
import { auth0 } from '@/lib/auth0';
const { token } = await auth0.getAccessToken();

// Express (server-side, from the session)
const token = req.oidc.accessToken.access_token;
```

---

## Calling an API with an access token

```javascript
const response = await fetch('https://api.example.com/data', {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

---

## Token expiry and silent renewal

Call `getAccessTokenSilently()` before every API call — the SDK renews silently if the token is expired. Never cache tokens manually.

---

## Audience

Always set `audience` in `authorizationParams`:

```javascript
loginWithRedirect({
  authorizationParams: {
    audience: 'https://api.example.com',
    scope: 'openid profile email read:data'
  }
});
```

If you omit `audience`, you get an opaque Management API token — not useful for your custom API.

---

## Opaque tokens vs JWTs

| Token type | Format | Validation |
|---|---|---|
| JWT (access token) | `header.payload.sig` | Verify locally with JWKS |
| Opaque (Management API) | Random string | Introspection endpoint |

For custom APIs, always use JWTs — they validate locally without a network call.

JWKS endpoint: `https://YOUR_TENANT.auth0.com/.well-known/jwks.json`
