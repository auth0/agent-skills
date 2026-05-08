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

### Step 6: Theme Integration

```bash
node <skill-path>/scripts/extract-theme.mjs --css-file <project-root>/<mainCssFile> --css-path <cssPath>
```

The script outputs two things that BOTH must be applied:

1. **`data.generatedOverrideBlock`** — CSS color variables. Apply **verbatim** to the project's main CSS file (inside `:root`). This sets all required Auth0 color bridge variables. Without the full set (especially `--auth0-background`, `--auth0-foreground`, `--auth0-card`), components render with a dark/black theme.

2. **`data.themeSettingsVariables`** — A JSON object to pass as `themeSettings.variables` on `Auth0ComponentProvider`. This includes border radius (and optionally colors for programmatic control). **Border radius MUST be set here** — CSS `:root` declarations do NOT work for radius because the internal `[data-theme='default']` selector has higher specificity and overwrites them.

Apply the CSS block to the main CSS file. Then set `themeSettings.variables` on the provider:

```tsx
<Auth0ComponentProvider
  themeSettings={{
    theme: 'default',
    mode: isDarkMode ? 'dark' : 'light',
    variables: /* paste data.themeSettingsVariables here */,
  }}
>
```

If the project already has an Auth0 override section in CSS, **replace it entirely** with the generated block.

Read `references/theming.md` for the full variable reference if the user wants more control.

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

### Step 8: Verify

```bash
node <skill-path>/scripts/verify-setup.mjs \
  --project-root <path> \
  --framework <framework> \
  --css-path <cssPath>
```

Fix any failing checks using the `fix` field in the output. Then start the dev server and verify in a browser:
1. Component renders without console errors
2. Authentication flow completes
3. Colors and radii match the host app

---

## Script Failure Recovery

| Script | Timeout | If no output (silent hang) | If `"status": "error"` or `"partial"` |
|--------|---------|---------------------------|---------------------------------------|
| detect-stack | 10s | Read `package.json` manually — check for `next` (framework), `tailwindcss` version (cssPath), lockfile (pkg manager) | Follow `error.fallback_instructions` |
| validate-auth0 | 30s | Run `auth0 --version` directly to check CLI | Run `auth0 login` command from `fallback_instructions` directly (120s timeout, opens browser) |
| bootstrap | 120s | Re-run (idempotent, skips completed work) | Follow `error.fallback_instructions`, then re-run |
| extract-theme | 10s | Read CSS file directly, find `:root` block | Ask user for primary color, write minimal override |
| verify-setup | 15s | Check each item manually (env file, node_modules, CSS imports) | Fix reported failures using `fix` field |

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
| Components use wrong colors | CSS variables not set — run extract-theme or add `--primary` to `:root` |
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
- **`references/theming.md`** — Read during Step 6 for full CSS variable reference. Contains: all ~80+ variables, dark mode, presets, per-component styling.
- **`references/component-reference.md`** — Read during Step 7. Contains: all 6 components with props, types, import paths.
- **`references/integration.md`** — Read during Step 7. Contains: provider patterns, callbacks, i18n, error handling, protected routes.

---

## When NOT to Use This Skill

- **Just need login/logout** — Use `auth0-react` (SPA) or `auth0-nextjs` (Next.js) skill
- **Mobile apps** — Use `auth0-react-native` skill
- **Only need tenant setup** — Use `universal-components-bootstrap` skill
- **Non-React framework** — These components are React-only
