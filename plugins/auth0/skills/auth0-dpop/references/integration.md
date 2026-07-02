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

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| API returns `401` with `error: use_dpop_nonce` | Server issued a new nonce | Catch `UseDpopNonceError` and retry |
| API returns `401` with `invalid_dpop_proof` | Clock skew or wrong `htm`/`htu` values | Ensure system clock is accurate; verify `baseUrl` matches API URL exactly |
| Token still issued as Bearer instead of DPoP | `useDpop: true` missing or `audience` not set | Confirm both options are present in client config |
| `createFetcher` is undefined | SDK version too old | Upgrade to `@auth0/auth0-spa-js` ≥ 2.1 (or framework SDK wrapping it) |
