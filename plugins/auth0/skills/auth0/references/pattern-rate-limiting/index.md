# Auth0 Rate Limits

---

## Why you're getting 429s

Auth0 enforces rate limits on:
- **Management API** — `POST /api/v2/*` calls (creating users, updating apps, etc.)
- **Authentication API** — `/oauth/token`, `/authorize` calls

The limit depends on your Auth0 plan. Free tier limits are much lower than paid plans.

Check your current limits: Auth0 Dashboard → Tenant Settings → Advanced → Rate Limiting.

---

## Handling 429 in code

Always implement exponential backoff when calling the Management API:

```javascript
async function callManagementApi(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.statusCode === 429) {
        const retryAfter = parseInt(err.headers?.['retry-after'] || '1', 10);
        const delay = retryAfter * 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
```

The `retry-after` header tells you exactly how many seconds to wait.

---

## Bulk operations

Use the bulk import API instead of individual user creation calls:

```bash
auth0 api post /api/v2/jobs/users-imports \
  --data '{"users": [...], "connection_id": "con_xxx", "upsert": true}'
```

---

## Reducing Management API calls

- **Cache JWKS**: Your JWT library should cache the JWKS response (5–10 min TTL).
- **Cache user profiles**: Don't call `/api/v2/users/{id}` on every request. Cache 1–5 min.
- **Use ID token claims**: For basic user info (name, email, picture), read from ID token — no API call needed.

---

## M2M token caching

Never request a new M2M token on every API call. Cache and reuse until expiry:

```javascript
let cachedToken = null;
let tokenExpiry = 0;

async function getM2MToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }
  const data = await fetchNewM2MToken();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}
```
