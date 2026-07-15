# Common Auth0 Errors and Fixes

---

## 401 Unauthorized from your API

**Checklist:**
1. Is the `Authorization: Bearer <token>` header being sent?
2. Was the token requested with the correct `audience`? Must exactly match your API identifier.
3. Is the token expired? Call `getAccessTokenSilently()` before every API call.
4. Does your API's `audience` validation match the `aud` claim in the token?

```javascript
// React — always call getAccessTokenSilently, don't cache manually
const token = await getAccessTokenSilently({
  authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
});
```

---

## Callback URL mismatch

**Error:** `Callback URL mismatch. The provided redirect_uri is not in the list of allowed callback URLs.`

**Fix:** Add the exact URL to **Allowed Callback URLs** in Auth0 Dashboard → Applications → [your app]:
```
http://localhost:3000/callback
https://yourapp.com/callback
```

URL must match exactly — including trailing slashes and path.

---

## CORS error

**Error:** `Access to fetch at 'https://tenant.auth0.com' has been blocked by CORS policy`

**Fix:** Add your frontend origin to **Allowed Web Origins** in Auth0 Dashboard:
```
http://localhost:3000
https://yourapp.com
```

Origin only — no path, no trailing slash.

---

## Redirect loop / infinite redirect

**Checklist:**
1. Is the callback route unprotected? The `/callback` handler must not require authentication.
2. Is the post-login redirect target in **Allowed Callback URLs**?
3. Next.js: Is the auth route at `app/auth/[auth0]/route.js` or `pages/api/auth/[...auth0].js`?

---

## invalid_grant / token expired

**Cause:** Refresh token rotation already consumed the token, or the session expired.

**Fix:** Redirect to login. This is expected behavior when sessions expire legitimately.

---

## AUTH0_DOMAIN includes https://

**Error:** `Invalid URL` or `getaddrinfo ENOTFOUND https://...`

**Fix:**
```bash
# Wrong
AUTH0_DOMAIN=https://your-tenant.auth0.com

# Correct
AUTH0_DOMAIN=your-tenant.auth0.com
```

---

## Missing user profile data (null name/email)

**Fix:** Request the correct scopes:
```javascript
loginWithRedirect({
  authorizationParams: { scope: 'openid profile email' }
});
```

---

## logout doesn't clear the Auth0 session

**Fix:** Pass `returnTo` so Auth0 clears its session cookie:
```javascript
logout({ logoutParams: { returnTo: window.location.origin } });
```

Add the `returnTo` URL to **Allowed Logout URLs** in Auth0 Dashboard.
