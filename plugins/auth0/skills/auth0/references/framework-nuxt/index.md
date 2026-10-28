# Auth0 Nuxt SDK

`@auth0/auth0-nuxt` adds server-side session authentication to Nuxt 3/4 apps. It is not the same package as `@auth0/auth0-vue` (client-side SPA).

## Install

```bash
npm install @auth0/auth0-nuxt
```

Use the project's package manager (`pnpm add`, `yarn add`, `bun add`) if it isn't npm.

## Secrets and `.env`

Generate a strong session secret:

```bash
openssl rand -hex 64
```

Put credentials in `.env` using the `NUXT_AUTH0_` prefix (not `VITE_AUTH0_*` or `VUE_APP_AUTH0_*`):

```bash
NUXT_AUTH0_DOMAIN=your-tenant.auth0.com
NUXT_AUTH0_CLIENT_ID=your-client-id
NUXT_AUTH0_CLIENT_SECRET=your-client-secret
NUXT_AUTH0_SESSION_SECRET=<from-openssl>
NUXT_AUTH0_APP_BASE_URL=http://localhost:3000
NUXT_AUTH0_AUDIENCE=https://your-api  # optional
```

Never hardcode credentials in `nuxt.config.ts`. Leave the `runtimeConfig.auth0` values as empty strings and let Nuxt fill them from the `NUXT_AUTH0_*` env vars at runtime:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@auth0/auth0-nuxt'],
  runtimeConfig: {
    auth0: {
      domain: '',
      clientId: '',
      clientSecret: '',
      sessionSecret: '',
      appBaseUrl: 'http://localhost:3000',
      audience: '',  // optional
    },
  },
})
```

Never commit `.env` files — make sure `.env` is in `.gitignore`.

## Everything else: read the SDK source

This reference intentionally covers installation and secrets only. For other configuration, module options, routes, composables, route protection, session stores, and calling APIs, read the SDK itself instead of relying on memory:

- **Installed package:** after installing, inspect `node_modules/@auth0/auth0-nuxt/` — start with `README.md`, then the type definitions (`*.d.ts`) and the module entry to see the exact options and exports for the installed version.
- **Source repository:** [github.com/auth0/auth0-nuxt](https://github.com/auth0/auth0-nuxt) — read the README, the `EXAMPLES.md` file if present, and the source under the package directory to confirm behavior.

Treat the installed version's source and types as the authority. If they conflict with anything you recall about the SDK, follow the source.

Run `auth0 docs search "nuxt"` for the latest Auth0 docs on this topic.
