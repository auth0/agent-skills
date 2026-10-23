# @auth0/auth0-vue — Enterprise Connect

**Minimum version:** `2.10.0`.

Framework-specific surface only. The relay flow, feature-level symbols, tenant config, and
common mistakes live in the shared Enterprise Connect reference. There is **no
`startEnterpriseLogin`** here: discover with the standalone `isFederatedDomain`, then call
`useAuth0().loginWithRedirect` with `login_hint`. Import only from `@auth0/auth0-vue`.

## Enable relay mode

Set `enterpriseConnect` in `createAuth0`, with the B2B Integration's Client ID. The flag only makes
the SDK `console.warn` on `useRefreshTokens` / `offline_access`, a static `organization`, or a
logout without `federated: true`; it does not change the login flow or throw:

```ts
import { createApp } from 'vue';
import { createAuth0 } from '@auth0/auth0-vue';
import App from './App.vue';

createApp(App)
  .use(
    createAuth0({
      domain: import.meta.env.VITE_AUTH0_DOMAIN,
      clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
      enterpriseConnect: true,
      authorizationParams: {
        redirect_uri: window.location.origin,
        scope: 'openid profile email' // no offline_access, no static organization
      }
    })
  )
  .mount('#app');
```

With vue-router, call `.use(router)` **before** `.use(createAuth0(...))`: the plugin's post-callback
`router.push(appState.target ?? '/')` runs only if a router is already installed; otherwise it only
calls `history.replaceState`, which the router ignores.

## Discover and start login

`isFederatedDomain(auth0Domain, emailDomain)` is a standalone function exported by the package. It
returns `Promise<boolean>`, never throws, and resolves `false` on any failure (unmanaged domain,
429, network error), so `await` it and treat `false` as "use your existing login". It is a routing
hint, not a security control:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuth0, isFederatedDomain } from '@auth0/auth0-vue';

const { loginWithRedirect } = useAuth0();
const email = ref('');

const handleSubmit = async () => {
  const value = email.value.trim();
  const parts = value.split('@');
  const emailDomain = parts.length === 2 ? parts[1] : '';

  if (emailDomain && (await isFederatedDomain(import.meta.env.VITE_AUTH0_DOMAIN, emailDomain))) {
    await loginWithRedirect({ authorizationParams: { login_hint: value } });
  } else {
    // not federated or malformed email: your existing login
  }
};
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="email" type="email" />
    <button type="submit">Continue</button>
  </form>
</template>
```

## Read the user and `org_id`

The plugin handles `code`/`state` on load; never call `handleRedirectCallback`. Read
`const { isLoading, isAuthenticated, user } = useAuth0();` only once `isLoading.value` is `false`
(before that, `isAuthenticated` is `false` even for a signed-in user);
`user.value?.org_id` holds the resolved organization. Enterprise Connect issues no refresh token,
so `getAccessTokenSilently` cannot renew an expired access token; send the user through login
again.

## Validate the organization (optional)

Reject with a **federated** logout so the IdP session ends too. This is a client-side guard;
enforce `org_id` on your server for every API call that trusts the token:

```ts
import { watch } from 'vue';
import { useAuth0 } from '@auth0/auth0-vue';

const allowedOrgs = ['org_123']; // your organization IDs
const { idTokenClaims, logout } = useAuth0();

watch(idTokenClaims, (claims) => {
  if (claims && (!claims.org_id || !allowedOrgs.includes(claims.org_id))) {
    logout({ logoutParams: { federated: true, returnTo: `${window.location.origin}/login` } });
  }
}, { immediate: true }); // also check claims already loaded when the guard is set up
```

## Federated logout

```ts
const { logout } = useAuth0();
logout({ logoutParams: { federated: true, returnTo: `${window.location.origin}/login` } });
```

`returnTo` must be in Allowed Logout URLs; the app origin must be in Allowed Callback URLs and
Allowed Web Origins.

## Security

Public client: no client secret. Tokens stay in memory - do not set `useRefreshTokens` or copy
tokens to `localStorage`. Maintained
example: https://raw.githubusercontent.com/auth0/auth0-vue/main/EXAMPLES.md#enterprise-connect

All calls above are accurate for `@auth0/auth0-vue` 2.10.0+ — do not read the SDK source to
re-verify them.
