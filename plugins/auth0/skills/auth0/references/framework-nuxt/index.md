# Auth0 Nuxt SDK — reference hub

Server-side session authentication for Nuxt 3/4 with `@auth0/auth0-nuxt`. Uses server-side encrypted cookie sessions, NOT client-side tokens (not the same as `@auth0/auth0-vue`).

<!-- Shared prerequisites and critical rules that every leaf needs. Read this
     first (hop 1), then follow the dispatch table below to the one leaf for
     your intent. Full install/secret/.env/config steps live in integrate.md.
     (Carved from the original framework-nuxt.md.) -->

## Critical rules

- **Never use `useUser()` for security checks.** It is client-side only and can be tampered with. Enforce all security-critical decisions server-side with `useAuth0(event).getSession()`.
- Install `@auth0/auth0-nuxt` — NOT `@auth0/auth0-vue` or `@auth0/auth0-spa-js`.
- Auth0 app type must be **Regular Web Application**, not Single Page Application.
- Environment variables use the `NUXT_AUTH0_*` prefix (not `VITE_AUTH0_*` or `VUE_APP_AUTH0_*`).
- Generate a strong session secret with `openssl rand -hex 64`; never commit `.env` files.

## When NOT to Use

- **Nuxt 2** — not supported; use a different Auth0 SDK.
- **Pure client-side SPA without a server** — use `@auth0/auth0-vue` instead.
- **Static site generation only (SSG) without a server runtime.**
- **Non-Auth0 authentication provider.**

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-nuxt/integrate.md` |

**Then, as needed for your task:**
- Protecting pages/routes (page-level `definePageMeta` middleware, role/permission guards) or custom session stores: `Read: references/framework-nuxt/patterns.md` — integrate.md covers only the baseline global/server middleware.
- Any other task (guidance, debugging, API integration, session management): start with `Read: references/framework-nuxt/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
