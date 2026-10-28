# Auth0 Nuxt SDK

`@auth0/auth0-nuxt` adds server-side session authentication to Nuxt 3/4 apps. It is not the same package as `@auth0/auth0-vue` (client-side SPA).

## Install

```bash
npm install @auth0/auth0-nuxt
```

Use the project's package manager (`pnpm add`, `yarn add`, `bun add`) if it isn't npm.

## Everything else: read the SDK source

This reference intentionally covers installation only. For configuration, module options, environment variables, routes, composables, route protection, session stores, and calling APIs, read the SDK itself instead of relying on memory:

- **Installed package:** after installing, inspect `node_modules/@auth0/auth0-nuxt/` — start with `README.md`, then the type definitions (`*.d.ts`) and the module entry to see the exact options and exports for the installed version.
- **Source repository:** [github.com/auth0/auth0-nuxt](https://github.com/auth0/auth0-nuxt) — read the README, the `EXAMPLES.md` file if present, and the source under the package directory to confirm behavior.

Treat the installed version's source and types as the authority. If they conflict with anything you recall about the SDK, follow the source.

Run `auth0 docs search "nuxt"` for the latest Auth0 docs on this topic.
