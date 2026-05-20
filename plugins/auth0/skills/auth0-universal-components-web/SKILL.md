---
name: auth0-universal-components-web
description: Use when adding pre-built Auth0 UI components to any React web application (React SPA or Next.js). Covers MFA enrollment, organization management, SSO provider configuration, and domain management with design-system theming. Use this whenever someone wants to add Auth0 user account management, delegated admin, or identity management UI — even if they don't say "universal components" explicitly. Also use when someone wants to theme or style Auth0 components to match their app's design system, or when they mention Auth0 self-service features.
---

# Auth0 Universal Components for Web

Drop-in UI components for Auth0 — MFA enrollment, organization management, SSO configuration, domain management. Works with React SPAs (Vite, CRA) and Next.js App Router.

**Status:** BETA  
**Components:** `UserMFAMgmt` · `OrganizationDetailsEdit` · `SsoProviderCreate` · `SsoProviderEdit` · `SsoProviderTable` · `DomainTable`

---

## Workflow

Every step uses a deterministic script that outputs structured JSON. If a script fails, read `error.fallback_instructions` from the output and follow them, then re-run (all scripts are idempotent).

### Step 1: Detect Project Stack

```bash
node <skill-path>/scripts/detect-stack.mjs <project-root>
```

Parse the JSON output. Key fields for subsequent decisions:
- `data.framework` → "nextjs" or "react-spa"
- `data.cssPath` → "tailwind" (Tailwind v4+) or "scoped" (Tailwind v3 or no Tailwind)
- `data.packageManager` → determines install commands
- `data.typescript` → determines file extensions
- `data.shadcn.installed` → if true, use shadcn CLI for installation
- `data.auth0.sdkInstalled` → if already present, skip SDK install
- `data.auth0.configured` → if true, tenant config already exists (domain + clientId in env file)
- `data.auth0.domain` → existing tenant domain from env file (use for Steps 2-3 if present)

Use these values for ALL subsequent decisions. Do not re-detect manually.

### Step 1.5: Auth0 SDK Prerequisite

**Check `data.auth0.sdkInstalled` from Step 1.** If it is `null` (no Auth0 SDK installed), the app needs login/authentication set up before components can work.

**Action:** Based on the detected framework, use the specific SDK skill:

- **If `data.framework === "nextjs"`** → Read and follow `.skills/auth0-nextjs/SKILL.md`
  - This sets up `@auth0/nextjs-auth0` — middleware, Auth0Client, session management, protected routes
  - The bootstrap script in Step 3 will provide the env vars (domain, client ID, secret) that this skill needs

- **If `data.framework === "react-spa"`** → Read and follow `.skills/auth0-react/SKILL.md`
  - This sets up `@auth0/auth0-react` — Auth0Provider, login/logout, token handling, protected routes
  - The bootstrap script in Step 3 will provide the env vars (domain, client ID) that this skill needs

Tell the user: "Your app doesn't have Auth0 authentication set up yet. I'll configure that first, then continue with the UI components."

After the SDK skill completes, re-run `detect-stack.mjs` to confirm `data.auth0.sdkInstalled` is now populated, then continue to Step 2.

**If `data.auth0.sdkInstalled` is already set** → skip this step entirely.

### Step 2: Validate Auth0 CLI

**If `data.auth0.configured` is true** → the app already has tenant config. Use `data.auth0.domain` as the tenant domain. Still validate the CLI session (needed for bootstrap to check/update resources).

**If `data.auth0.configured` is false** → ask the user for their Auth0 tenant domain (e.g., `my-app.us.auth0.com`).

```bash
node <skill-path>/scripts/validate-auth0.mjs --domain <tenant-domain>
```

**If it fails:**
- `CLI_NOT_INSTALLED` → Ask the user to install the Auth0 CLI, then re-run
- `SESSION_EXPIRED` or `TENANT_MISMATCH` → Run the `auth0 login` command from `fallback_instructions` directly (use 120s timeout). This opens the user's browser for authentication — tell them to complete the login flow in their browser. Once it completes, re-run validation to confirm.

### Step 3: Bootstrap Auth0 Tenant

**If `data.auth0.configured` is true** → the tenant is already set up. Run bootstrap anyway with the existing domain — it's idempotent and will verify/create only missing resources (connection profiles, resource servers, roles, etc. needed by the specific components). This ensures the tenant has the API scopes and resources the components require, even if basic auth was set up earlier.

**If `data.auth0.configured` is false** → this is a fresh setup. Ask the user which features they need.

Feature selection (ask the user):
- **full** — Organization management + MFA/self-service (default)
- **myorg** — Organization management only (SSO, domains, org details)
- **myaccount** — MFA/self-service only (UserMFAMgmt)

```bash
node <skill-path>/scripts/bootstrap.mjs \
  --domain <tenant-domain> \
  --features full|myorg|myaccount \
  --framework nextjs|react-spa \
  --port <dev-server-port>
```

**Timeout:** 120s. The script is idempotent — on `"status": "partial"`, re-run after fixing the issue in `fallback_instructions`.

On success, write `data.env_vars` to the project's `.env.local` file. Do NOT overwrite existing values — merge only new keys.

**Demo admin user (only when needed).** When organization features are enabled, bootstrap checks whether the demo org already has any member with the admin role. If it does, the step is a no-op. If it doesn't, bootstrap returns `status: "partial"` with `error.code: "ADMIN_MEMBER_REQUIRED"` — that's a signal, not a failure. Handle it like this:

1. Use `AskUserQuestion` to collect an email and a password from the developer for a dedicated demo admin user. Tell them this user is a fresh account scoped to the Universal-Components-Demo connection — it isn't reused from any existing tenant identity.
2. Re-run bootstrap with the credentials appended:

   ```bash
   node <skill-path>/scripts/bootstrap.mjs \
     --domain <tenant-domain> \
     --features full|myorg|myaccount \
     --framework nextjs|react-spa \
     --port <dev-server-port> \
     --admin-email <email> \
     --admin-password <password>
   ```

3. On success, `data.demo_admin` contains `{ email, user_id }` for the user the developer should sign in with. The previous re-runs of bootstrap will see the now-existing admin and skip the step — no need to keep passing the flags.

If the developer prefers to use an existing tenant user, they can skip this prompt by adding the user to demo-org and assigning the admin role manually in the Auth0 dashboard, then re-running bootstrap (which will see the admin and continue past the step).

### Step 4: Install Component Package

The Auth0 SDK is already installed (handled by Step 1.5 or already present). Now install the components:

**If `shadcn.installed` is true:**
```bash
npx shadcn@latest add https://auth0-ui-components.vercel.app/r/my-account.json
npx shadcn@latest add https://auth0-ui-components.vercel.app/r/my-organization.json
```

**Otherwise (npm package):**
```bash
<installCmd> @auth0/universal-components-react
```

### Step 5: Framework Setup

Read the appropriate reference file based on `data.framework`:

- **Next.js:** Read `references/setup-nextjs.md` — middleware, Auth0Client, proxy mode provider, layout integration
- **React SPA:** Read `references/setup-react-spa.md` — Auth0Provider, Auth0ComponentProvider, stylesheet import

Follow the reference file exactly. It contains the code to generate for each framework.

### Step 6: Apply Theme

Theme integration has two parts that both must land for components to render correctly:
1. A complete CSS override block (so colors inherit from the host app's tokens).
2. `themeSettings.variables` set on `<Auth0ComponentProvider>` — radius lives here, not in CSS, because the theme's `[data-theme='default']` selector has higher specificity than `:root` and silently overwrites CSS-level radius.

`apply-theme.mjs` does both in one shot. It calls `extract-theme.mjs` internally, then writes the changes:

```bash
node <skill-path>/scripts/apply-theme.mjs \
  --project-root <project-root> \
  --css-file <data.mainCssFile from Step 1> \
  --css-path <data.cssPath> \
  --framework <data.framework>
```

You can pass `--provider-file <path>` to be explicit, but the script auto-detects the file containing `<Auth0ComponentProvider>` from the conventional locations (`src/App.tsx` for SPA, `src/providers/client-provider.tsx` for Next.js).

What the script does:
- **CSS:** inserts/replaces a managed block (between `/* @auth0-universal-components:start */` and `:end` markers) carrying the full color set with sensible defaults for any variable the project doesn't define. For Tailwind v4 (`cssPath === "tailwind"`), it also ensures `@import "@auth0/universal-components-core/styles/globals.css"` and an `@theme inline` block mapping `--color-*` to the bare variables.
- **Provider:** patches `themeSettings.variables` with the extracted radius/color values. If the file has an empty placeholder it's replaced; if user customizations are already there, the script returns `action: "needs-manual-merge"` with a `manualSteps` entry instead of clobbering.

The script is idempotent — re-running on an already-patched project produces a byte-identical result. Marker comments inside the managed CSS block and the `variables` object let it recognize its own previous output.

**Verification gate.** After running apply-theme, confirm with the theme-only verify pass before moving on:

```bash
node <skill-path>/scripts/verify-setup.mjs \
  --project-root <project-root> \
  --framework <framework> \
  --css-path <cssPath> \
  --only theme
```

All theme checks must show `pass: true`. If any fails, the output's `command` field will point you back at apply-theme; fix any `manualSteps` first, then re-run verify.

Read `references/theming.md` if the user wants more control beyond what apply-theme writes (per-component overrides, additional `--auth0-*` variables, etc.).

### Step 7: Add a Component

Read `references/component-reference.md` for props and usage patterns.
Read `references/integration.md` for provider setup, callbacks, and error handling.

**Import paths depend on installation method:**

| What | Import from |
|------|-------------|
| Components (all setups) | `@auth0/universal-components-react` |
| `Auth0ComponentProvider` (SPA) | `@auth0/universal-components-react/spa` |
| `Auth0ComponentProvider` (Next.js) | `@auth0/universal-components-react/rwa` |
| Components (shadcn) | `@/components/auth0/my-account/...` or `@/components/auth0/my-organization/...` |

The `/spa` and `/rwa` sub-paths export **only** `Auth0ComponentProvider`. All components (`UserMFAMgmt`, `OrganizationDetailsEdit`, etc.) come from the main entry.

Place components inside a simple container — they manage their own internal layout:
```tsx
<div className="max-w-2xl mx-auto">
  <UserMFAMgmt />
</div>
```

**Mind the host's existing page chrome.** Most apps already have their own page header (a sidebar item label, a top bar with the page title, breadcrumbs, etc.). The Auth0 components render their own page-level header AND inner section subheads (e.g. `OrganizationDetailsEdit` renders the org's display name as a big page title plus "Settings" and "Branding" sections). Drop a component into a host page that's already titled "Settings" and you'll see "Settings" twice on screen even after `hideHeader` — the section subhead survives `hideHeader`.

Run this checklist after rendering the component, before moving on:

1. **Read the host page** (the route file, the page component, the layout) and write down the exact title text the host already shows for this area — e.g. the host's TopBar lookup for `settings` returns title `"Settings"`.

2. **Pass `hideHeader`** (or the equivalent prop from `references/component-reference.md`) whenever the host has any page-level header at all. This kills the component's page-level title (the one usually showing the org/provider name).

3. **Compare the host's title text against the component's "Default Headings Rendered" row in `references/component-reference.md`.** Do a verbatim string match. Any match — including section subheads, not just page titles — means the page will display the same word twice. When that happens, pass `customMessages` to rename the matching section. Don't reason your way out of this with "different hierarchy levels"; if the literal text matches, rename it. The exact `customMessages` path is in the same row of the table.

   **Example.** Host TopBar says "Settings". `OrganizationDetailsEdit` renders a "Settings" section subhead. Even with `hideHeader`, the subhead remains. Required fix:
   ```tsx
   <OrganizationDetailsEdit
     hideHeader
     customMessages={{
       details: { sections: { settings: { title: 'Organization Profile' } } },
     }}
   />
   ```

4. **Match the host's container.** If the host uses a centered max-width column (`max-w-2xl`, `.settings-org-profile`), wrap the component in the same. Don't introduce a new container shape.

These checks prevent the most common visual integration regression: stacked or repeated headings that make the embedded component feel bolted-on rather than part of the app.

### Step 8: Final Verification

The theme-only verify already ran in Step 6. Now run the full battery to confirm env vars, packages, providers, and middleware are all in place:

```bash
node <skill-path>/scripts/verify-setup.mjs \
  --project-root <path> \
  --framework <framework> \
  --css-path <cssPath>
```

Each failing check has a `fix` describing the remediation, and (where applicable) a `command` field naming the script to re-run. Then start the dev server and verify in a browser:
1. Component renders without console errors
2. Authentication flow completes
3. Colors AND border radii match the host app — radii are the canary for "did themeSettings.variables get set?"

---

## Script Failure Recovery

| Script | Timeout | If no output (silent hang) | If `"status": "error"` or `"partial"` |
|--------|---------|---------------------------|---------------------------------------|
| detect-stack | 10s | Read `package.json` manually — check for `next` (framework), `tailwindcss` version (cssPath), lockfile (pkg manager) | Follow `error.fallback_instructions` |
| validate-auth0 | 30s | Run `auth0 --version` directly to check CLI | Run `auth0 login` command from `fallback_instructions` directly (120s timeout, opens browser) |
| bootstrap | 120s | Re-run (idempotent, skips completed work) | Follow `error.fallback_instructions`, then re-run |
| extract-theme | 10s | Read CSS file directly, find `:root` block | Ask user for primary color, write minimal override |
| apply-theme | 15s | Re-run (idempotent — managed markers prevent duplication) | Read `data.manualSteps`; if `provider.themeSettings.action === "needs-manual-merge"`, merge the proposed object into existing `themeSettings.variables` by hand |
| verify-setup | 15s | Check each item manually (env file, node_modules, CSS imports) | Fix reported failures using `fix` and `command` fields |

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Wrong import path for components | Components come from `@auth0/universal-components-react` (main entry). Only `Auth0ComponentProvider` uses `/spa` or `/rwa` sub-paths |
| Using npm in a shadcn project | Check `components.json` — if present, use shadcn CLI |
| Missing `Auth0Provider` wrapper (SPA) | `Auth0ComponentProvider` requires `Auth0Provider` as parent |
| Missing `mode="proxy"` (Next.js) | Next.js `Auth0ComponentProvider` needs `mode="proxy"` + `proxyConfig` |
| Forgot `'use client'` directive (Next.js) | Provider wrapper must be a client component |
| Missing middleware (Next.js) | Create `src/middleware.ts` with Auth0 middleware |
| Missing `AUTH0_SECRET` (Next.js) | Generate with `openssl rand -hex 32` |
| Forgot stylesheet import | Import `@auth0/universal-components-react/styles` or `/tailwind` |
| Components use wrong colors | CSS variables not set — run apply-theme.mjs (or, for manual control, extract-theme + paste the override block) |
| Border radius doesn't apply | Radius can't be set via `:root` — the theme's `[data-theme='default']` selector wins. Set radius keys under `themeSettings.variables.common`; apply-theme.mjs does this automatically |
| Components render with dark/black background on a light app | Missing `--auth0-background`/`--auth0-card`/`--auth0-foreground`. Apply the full override block via apply-theme.mjs — partial sets fall through to internal dark defaults |
| Tailwind utility classes (`text-foreground`, `bg-card`) don't pick up your colors | Missing `@theme inline` block mapping `--color-*` to bare vars. apply-theme.mjs adds these for Tailwind v4 projects |
| Re-running apply-theme refuses to update variables | Means the file already has user customizations (the managed marker is gone). Read `data.manualSteps` and merge by hand |
| Create / edit / delete buttons in a table do nothing on click | You passed `onClick` on a `*Action` prop. `createAction`, `editAction`, `deleteAction`, `saveAction`, `cancelAction`, `verifyAction`, etc. are typed `ComponentAction` — they accept `onBefore` and `onAfter`, not `onClick`. `onClick` is silently dropped. Switch to `onAfter`. Only `backButton` (and standalone `ActionButton` slots) use `onClick`. See "Action Prop Shapes" in `references/component-reference.md` |
| Duplicate "page" headers stacked above the component | Host already has a page title (TopBar, breadcrumb, etc.) AND the component is rendering its own. Pass `hideHeader` to the component (check the prop table in `references/component-reference.md`). For section-title clashes, use `customMessages` to rename the section |
| Same word appears twice on the page (e.g. host title "Settings" + component section subhead "Settings") | `hideHeader` only suppresses the component's *page-level* header — section subheads survive. Verbatim-match the host's title against the "Default Headings Rendered" table in `references/component-reference.md`; if any default subhead matches, rename it via `customMessages` (the path is listed in the same row). Don't argue that "different hierarchy levels" makes it OK — same word on the same page reads as redundant |
| `Missing requested scopes after refresh (audience: ...my-org/, missing scope: read:my_org:details)` | The user authenticated successfully, but isn't a member of an organization OR has no role granting the my-org permissions. Bootstrap creates the `admin` role and the demo org as resources — assigning users to the org and granting them roles is a developer responsibility. Fix in Auth0 Dashboard → Organizations → demo-org → Members: add the test user, then assign the `admin` role to that membership. (Or via CLI: `auth0 api post "organizations/<org_id>/members" --data '{"members":["<user_id>"]}'` then `auth0 api post "organizations/<org_id>/members/<user_id>/roles" --data '{"roles":["<admin_role_id>"]}'`.) After role assignment, the user must sign out and sign back in for the new role to be reflected in the access token |
| Missing `audience` in Auth0Provider (SPA) | Organization components need `audience` set to `https://{domain}/my-org/` |
| `AUTH0_DOMAIN` vs `NEXT_PUBLIC_AUTH0_DOMAIN` | Server-side uses `AUTH0_DOMAIN`, client-side uses `NEXT_PUBLIC_AUTH0_DOMAIN` |
| Organization components return 403 | Ensure user has admin role in the organization |
| MFA component shows no factors | Enable MFA methods in Auth0 Dashboard → Security → Multi-factor Auth |
| Installing with wrong package manager | Match the lockfile: pnpm-lock.yaml → pnpm, yarn.lock → yarn |
| Overwriting existing middleware | Read existing middleware first, compose with Auth0 middleware |

---

## Reference Files

Read these as needed during the workflow:

- **`references/setup-nextjs.md`** — Read during Step 5 when `framework === "nextjs"`. Contains: env vars, Auth0Client, middleware, proxy provider, layout.
- **`references/setup-react-spa.md`** — Read during Step 5 when `framework === "react-spa"`. Contains: env vars, Auth0Provider, Auth0ComponentProvider, stylesheet.
- **`references/theming.md`** — Read during Step 6 only when the user wants control beyond what apply-theme.mjs writes (per-component styling, additional `--auth0-*` overrides, presets). For the standard flow you don't need to read this file.
- **`references/component-reference.md`** — Read during Step 7. Contains: all 6 components with props, types, import paths.
- **`references/integration.md`** — Read during Step 7. Contains: provider patterns, callbacks, i18n, error handling, protected routes.

---

## When NOT to Use This Skill

- **Just need login/logout** — Use `auth0-react` (SPA) or `auth0-nextjs` (Next.js) skill
- **Mobile apps** — Use `auth0-react-native` skill
- **Only need tenant setup** — Use `universal-components-bootstrap` skill
- **Non-React framework** — These components are React-only
