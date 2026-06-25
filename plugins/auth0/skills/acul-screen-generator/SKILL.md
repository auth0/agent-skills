---
name: acul-screen-generator
description: >
  Use when building or customizing Auth0 Universal Login screens with full UI control — creating branded login, signup, or MFA screens using the ACUL React or Vanilla JS SDK. Use this even if the user says "custom login page", "style my Auth0 login", or "build my own Universal Login UI" without mentioning ACUL directly. Does not cover basic branding (colors/logo only) — use auth0-branding for that.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.1'
  openclaw:
    emoji: "🔐"
    homepage: https://github.com/auth0/agent-skills
---

# ACUL Screen Generator

Generates production-ready, fully themed Auth0 ACUL screen components. Follows a strict 9-phase workflow (Phases 0–8): CLI authentication → intent detection → project setup → screen requirements → tech stack and design → theme extraction → structured code generation → build validation & iterative fix → dev mode wiring.

## Reference Hierarchy

Always resolve the correct reference for a screen using this priority order. **Before running the CLI**, check if the screen exists in auth0-acul-samples — if it does not, the CLI will fail.

```text
1. Check auth0-acul-samples availability first  (gate for CLI usage)
   → Read `references/screen-catalog.md` for the Samples column
   → Verify the screen directory exists at:
     React:    https://github.com/auth0-samples/auth0-acul-samples/tree/main/react/src/screens/<screen-name>
     React-JS: https://github.com/auth0-samples/auth0-acul-samples/tree/main/react-js/src/screens/<screen-name>
   → If the screen IS in samples → proceed to CLI (step 2)
   → If the screen is NOT in samples → skip CLI entirely, go to step 3

2. Auth0 CLI scaffolded code  (only for screens confirmed in auth0-acul-samples)
   → Use `auth0 acul screen add` or `auth0 acul init` to generate screen code locally
   → The CLI produces the correct project structure, SDK imports, and hook patterns
   → If the CLI succeeds, use the scaffolded code as-is — do NOT fetch from GitHub

3. SDK examples  (for screens NOT in auth0-acul-samples — do NOT attempt CLI for these)
   → Code snippets showing SDK imports, hooks, and action functions
   → React: https://github.com/auth0/universal-login/blob/master/packages/auth0-acul-react/examples/<screen-name>.md
   → JS:    https://github.com/auth0/universal-login/blob/master/packages/auth0-acul-js/examples/<screen-name>.md
   → Determine if the example is React or JS, then adapt to match the project's framework

4. assets/react-templates/ or assets/js-templates/
   → Structural component pattern only — never use their hooks/actions for other screens
```

For which screens are in auth0-acul-samples → read `references/screen-catalog.md`.

---

## auth0-acul-samples Architecture

When a screen is available in auth0-acul-samples, generate code using this modular pattern — not a monolithic component.

**Directory structure per screen:**
```
<screen-name>/
├── index.tsx                        thin entry: wires manager hook + applies theme + renders layout
├── components/
│   ├── Header.tsx                   logo, title, subtitle from screen.texts
│   ├── <ScreenName>Form.tsx         form fields, submit, captcha, passkey button
│   ├── Footer.tsx                   signup link, forgot password, back link
│   └── AlternativeLogins.tsx        social login buttons (if screen has social)
├── hooks/
│   └── use<ScreenName>Manager.ts    wraps SDK hooks, exposes clean handlers + feature flags
└── locales/
    └── en.json                      fallback text strings
```

**index.tsx pattern:**
```tsx
import { ULThemeCard, ULThemePageLayout } from '@/components'
import { applyAuth0Theme } from '@/utils/theme/themeEngine'
import Header from './components/Header'
import <ScreenName>Form from './components/<ScreenName>Form'
import Footer from './components/Footer'
import { use<ScreenName>Manager } from './hooks/use<ScreenName>Manager'

const <ScreenName>Screen = () => {
  const { sdkInstance, texts, locales } = use<ScreenName>Manager()
  applyAuth0Theme(sdkInstance)
  document.title = texts?.pageTitle ?? locales.pageTitle

  return (
    <ULThemePageLayout>
      <ULThemeCard>
        <Header texts={texts} />
        <AlternativeLogins alignment="top" />    {/* conditional */}
        <<ScreenName>Form />
        <Footer texts={texts} links={links} />
        <AlternativeLogins alignment="bottom" />  {/* conditional */}
      </ULThemeCard>
    </ULThemePageLayout>
  )
}

export default <ScreenName>Screen   // REQUIRED: screenLoader registers via lazy(), which needs a default export
```

> **`index.tsx` must have a `export default`.** The project's screen registry (`src/utils/screen/screenLoader.ts`) loads each screen with `lazy(() => import('@/screens/<screen-name>'))`, and `React.lazy` resolves the module's **default** export. A named-only export (`export const <ScreenName>Screen`) compiles fine but renders blank / "screen not implemented" at runtime. See "Screen Registration" in Phase 6.

**hooks/use\<ScreenName\>Manager.ts pattern:**
```ts
import { useLoginId, useScreen, useTransaction } from '@auth0/auth0-acul-react/<screen-name>'
import { executeSafely } from '@/utils/helpers/executeSafely'
import locales from '../locales/en.json'

export const use<ScreenName>Manager = () => {
  const sdkInstance = useLoginId()       // screen-specific SDK hook
  const screen = useScreen()
  const { alternateConnections } = useTransaction()

  const handleSubmit = async (data) => executeSafely(() => login(data))
  const handleFederatedLogin = async (conn) => executeSafely(() => federatedLogin({ connection: conn }))

  return {
    sdkInstance,
    texts: screen.texts,
    locales,
    alternateConnections,
    handleSubmit,
    handleFederatedLogin,
    isPasskeyEnabled: screen.isPasskeyEnabled,
    isCaptchaAvailable: screen.isCaptchaAvailable,
  }
}
```

When a screen is **not** in auth0-acul-samples and the CLI doesn't support it, fall back to a single-file component based on the SDK example.

## Prerequisites

- Auth0 CLI installed: `brew install auth0`
- Custom domain configured on the Auth0 tenant (hard ACUL requirement)
- Node.js **≥ 22** (required by Auth0 CLI-generated ACUL projects)

---

## Phase 0: Environment Validation & CLI Authentication

### Step 1 — Verify Node.js version

```bash
node --version 2>&1
```

Parse the output and verify the major version is **≥ 22**. If Node.js is not installed or the version is below 22:
- **Not installed:** Stop and instruct the customer to install Node.js 22+ (e.g., `nvm install 22` or download from nodejs.org).
- **Version < 22:** Stop and instruct the customer to upgrade. Example: `nvm install 22 && nvm use 22`. The Auth0 CLI-generated ACUL projects require Node.js 22+ and will fail to build or run on older versions.

Do NOT proceed to any subsequent phase until Node.js ≥ 22 is confirmed.

### Step 2 — CLI Authentication & Tenant Check

```bash
auth0 login
auth0 acul config list --rendering-mode advanced
```

If `auth0 acul config list` returns an error about custom domain: stop and inform the customer they must configure a custom domain on their tenant before ACUL is available.

For full CLI flag reference → read `references/cli-commands.md`.

---

## Phase 1: Intent Detection

Ask the customer which mode they need:

- **A) Build from scratch** — new project, select screens, full setup
- **B) Add a screen** — existing project, add one or more new screens
- **C) Modify a screen** — existing project, change an existing screen's code or styling

This choice gates Phases 2A / 2B / 2C.

---

## Phase 2A: Scratch — Project Init

Gather: app name, framework (`react` or `js`), initial screen list.

```bash
auth0 acul init <app_name> -t react -s login-id,login-password,signup
auth0 acul config generate <screen-name>    # repeat per screen
```

Verify `acul_config.json` is created in the project directory.

**The CLI-scaffolded code is your primary source.** Read the generated screen files to understand the project structure, SDK imports, hook patterns, and component layout. Do NOT fetch from GitHub — the CLI output is the canonical starting point. Only customize or extend the generated code based on the customer’s requirements (branding, extra components, etc.).

Proceed to Phase 3.

---

## Phase 2B: Add Screen — Check Samples Availability First

1. Verify `acul_config.json` exists in the project directory.
   - If missing → stop. Instruct customer to run `auth0 acul init` first.

2. **Check if the screen exists in auth0-acul-samples before attempting CLI.**

   Read `references/screen-catalog.md` and check the `Samples (React)` or `Samples (React-JS)` column for the requested screen. Then fetch the GitHub directory listing to **confirm** the screen actually exists at the expected path:

   ```text
   React:    https://github.com/auth0-samples/auth0-acul-samples/tree/main/react/src/screens/<screen-name>
   React-JS: https://github.com/auth0-samples/auth0-acul-samples/tree/main/react-js/src/screens/<screen-name>
   ```

   This check determines whether the CLI can scaffold the screen. If the screen is NOT present in auth0-acul-samples, the CLI `auth0 acul screen add` command will fail — so skip it entirely and go straight to Step 4.

3. **Screen IS in auth0-acul-samples → try the CLI:**
   ```bash
   auth0 acul screen add <screen-name> -d <project-dir>
   ```
   - **If CLI succeeds → use the scaffolded code directly.** Read the generated files to understand the structure, SDK imports, and hook patterns. Do NOT fetch from GitHub. Customize the CLI-generated code based on the customer’s requirements (branding, components, etc.). Proceed to Phase 3.
   - **If CLI errors despite the screen being in samples** (e.g., auth issues, version mismatch) → fall through to Step 4 as a recovery path.

4. **Screen is NOT in auth0-acul-samples (or CLI failed) → skip CLI, fetch reference directly.**

   Since the CLI does not support this screen, do NOT attempt `auth0 acul screen add` — it will error. Instead, build the screen from reference code.

   **Step 4a — Capture project structure (if not already known):**
   If this is the first screen being added manually (i.e., you don’t already have a reference for the project’s directory layout, config wiring, and build setup from a previous CLI-generated screen), create a dummy page:
   ```bash
   auth0 acul screen add login-id -d <project-dir>
   ```
   - Read the generated dummy screen files to capture the project structure, directory layout, config wiring, and build setup
   - Then remove the dummy screen files (delete the `login-id/` screen directory)

   If you already have the project structure from a previous CLI-generated or manually-created screen, skip this step.

   **Step 4b — Fetch the screen reference code:**
   Determine the tech stack of the existing project (React or JS/Vanilla) by inspecting the project files. Then fetch the reference:

   - **React project → check SDK examples in universal-login repo:**
     - Fetch: `https://github.com/auth0/universal-login/blob/master/packages/auth0-acul-react/examples/<screen-name>.md`
     - Parse for: exact import path, hook pattern (Pattern A or B), action function names, and payload shapes
   - **JS/Vanilla project → check JS SDK examples:**
     - Fetch: `https://github.com/auth0/universal-login/blob/master/packages/auth0-acul-js/examples/<screen-name>.md`
     - Parse for: manager class name, method names, and payload shapes

   Determine whether the example is React (JSX/TSX, hooks) or plain JS (class-based manager) and match it to the project’s framework. If the project is React but only a JS example exists (or vice versa), adapt the patterns accordingly using the appropriate SDK reference (`references/acul-react-sdk.md` or `references/acul-js-sdk.md`).

   **Step 4c — Generate the screen files using the project structure**, populated with the SDK reference data from step 4b. This ensures correct directory layout, config integration, and build compatibility. Follow the modular architecture pattern from the "auth0-acul-samples Architecture" section if React, or a single-file component if the example is simple enough.

   **Step 4d — Register the screen so local dev mode can resolve it (REQUIRED).**
   The CLI auto-registers screens it scaffolds, but **manually generated screens are not registered** — so `auth0 acul dev` (local mode) renders **"Screen '<screen-name>' is not implemented"** even though the files exist and the build passes. (Connected mode reads screens from the tenant, so it works without this step — which is why the bug only shows in local dev.) The screen resolves through a `SCREEN_COMPONENTS` map in `src/utils/screen/screenLoader.ts`.

   **First determine how the project maintains that map — do NOT assume it is hand-edited:**

   1. Check whether `screenLoader.ts` is auto-generated. Open it and look for a banner like `// Auto-generated file`, and check `package.json` scripts for a generator (e.g. `generate:screenLoader`) and `scripts/generate-screen-loader.js`.
      - **If a generator exists (the common case for CLI-scaffolded projects):** the loader is regenerated by scanning `src/screens/*/index.tsx` against an allowlist (e.g. `src/constants/validScreens.js`). **Do NOT hand-edit `screenLoader.ts` — your edit will be overwritten.** Instead:
        - Confirm `<screen-name>` is present in the allowlist (`VALID_SCREENS`). If missing, add it there.
        - Run the generator: `npm run generate:screenLoader` (use the actual script name from `package.json`).
        - Verify the new entry now appears in `screenLoader.ts`.
      - **If there is no generator:** hand-edit the `SCREEN_COMPONENTS` map directly:
        ```ts
        "<screen-name>": lazy(() => import("@/screens/<screen-name>")),
        ```
   2. Either way, confirm the screen's `index.tsx` has a **default export** (`export default <ScreenName>Screen`) — `lazy()` resolves the default export. A named-only export compiles but loads as blank / "not implemented".

   For all screen names and their availability → read `references/screen-catalog.md`.

---

## Phase 2C: Modify Screen — Fetch Current State

1. Verify `acul_config.json` exists.

2. Fetch current rendering configuration:
   ```bash
   auth0 acul config get <screen-name> -f <screen-name>.json
   auth0 acul config list --rendering-mode advanced
   ```

3. Read the existing screen file from the customer's codebase. **The local code is your primary reference.** Understand its current structure, SDK imports, and hook patterns before making any changes.

4. Only fetch from GitHub references if the local code is missing critical SDK patterns (e.g., wrong hook pattern, missing action functions) and you cannot determine the correct pattern from the existing codebase. Use the Reference Hierarchy (samples availability → CLI scaffolded code when supported → SDK examples) to validate.

---

## Phase 3: Screen Requirements

Gather from the customer:

- **Screen type** — for full list of available screens → read `references/screen-catalog.md`
- **Components needed:**
  - Social providers: Google, GitHub, Apple, Microsoft, Facebook
  - Form fields: email, username, phone, password, confirm-password
  - MFA type (if applicable): OTP, SMS, push, WebAuthn
  - Optional extras: captcha, passkey button, remember-me, terms checkbox
- **For modify mode:** what specifically to change (layout, colors, add/remove a component)

---

## Phase 4: Tech Stack Detection

Confirm or detect:

- **Framework:** React (`@auth0/auth0-acul-react`) or JS (`@auth0/auth0-acul-js`)
- **Styling library:** Tailwind CSS / CSS Modules / styled-components / plain CSS
- **Existing theme file?** Check for `tailwind.config.ts`, `styles/tokens.css`, `theme/index.ts`

Load the appropriate SDK reference:
- React → read `references/acul-react-sdk.md`
- JS → read `references/acul-js-sdk.md`

For social button implementation → read `references/social-providers.md`.

---

## Phase 5: Theme Extraction & Scope

### Design input — detect which the customer has provided:

**Option A — Image or mockup (jpeg / png / screenshot):**
Analyze the image and extract:
- Primary, secondary, accent colors (as hex)
- Background and card/surface colors
- Font family and weights
- Border radius style (sharp / slight / rounded / pill)
- Spacing rhythm (compact / normal / spacious)
- Layout type: centered card / full-bleed / split-panel / floating card

**Option B — Brand colors only (no image):**
Derive the full token set from the provided hex values:
```
primary        → button bg, links, focus ring
primary-hover  → primary darkened ~10%
primary-text   → white if primary is dark, else #111827
background     → page background
surface        → card/panel background
text-primary   → headings (#111827 light / #F1F5F9 dark)
text-secondary → labels, placeholders
border         → input borders
error          → #EF4444 (unless specified)
success        → #22C55E (unless specified)
```

### Theme scope — ask the customer:

- **Single screen:** apply tokens inline to just this component's styles
- **All screens:** generate a shared theme file first, then apply consistently across every screen

For theme file patterns per styling library → read `references/theming-patterns.md`.

**Theme file to generate per styling library (all-screens scope):**

| Styling library | Template to use | Output file |
|----------------|-----------------|-------------|
| Tailwind | `assets/theme-templates/tailwind.config.ts` | `tailwind.config.ts` |
| CSS Modules | `assets/theme-templates/tokens.css` | `styles/tokens.css` |
| styled-components | `assets/theme-templates/theme-provider.ts` | `theme/index.ts` |
| Plain CSS | `assets/theme-templates/globals.css` | `styles/globals.css` |

Replace all `{{TOKEN}}` placeholders with extracted token values.

---

## Phase 6: Structured Code Generation

Generation approach depends on the source of the screen code.

### Path A — CLI-scaffolded screen (preferred)

When the CLI successfully generates the screen (via `auth0 acul init` or `auth0 acul screen add`), use the CLI output as the base. Read the generated files and customise them based on the customer's requirements:

- Apply design tokens from Phase 5 to the generated component styling
- Add/remove components as specified (social buttons, captcha, passkey, etc.)
- Adjust layout and structure per the customer's design input
- Preserve the CLI's SDK imports, hook patterns, and action functions — they are correct

Do NOT discard CLI-generated code to re-generate from a GitHub reference.

### Path B — Screen from auth0-acul-samples (only when CLI doesn't support the screen)

Use the project structure captured from the CLI dummy-page strategy (Phase 2B, Step 4a) as the foundation. Generate the screen directory using the samples pattern (see "auth0-acul-samples Architecture" above), matching the directory layout and config wiring from the dummy page:

```
<screen-name>/
├── index.tsx
├── components/
│   ├── Header.tsx
│   ├── <ScreenName>Form.tsx
│   ├── Footer.tsx
│   └── AlternativeLogins.tsx       (only if screen has social login)
├── hooks/
│   └── use<ScreenName>Manager.ts
└── locales/
    └── en.json
```

- `index.tsx` — thin: calls `use<ScreenName>Manager()`, calls `applyAuth0Theme()`, renders `ULThemePageLayout` → `ULThemeCard` → sub-components
- `use<ScreenName>Manager.ts` — wraps SDK hooks from the samples reference, exposes typed handlers and feature flags
- Form component — uses react-hook-form, reads from manager hook, no direct SDK calls
- Header/Footer — stateless, receive texts as props
- `en.json` — fallback strings matching keys used in `screen.texts.*`

Apply design tokens from Phase 5 to the layout components and form component styling.

### Path C — Screen is NOT in auth0-acul-samples (single-file component)

Generate a single `<screen-name>.tsx` (React) or `<screen-name>.js` (JS) using the structure from `assets/react-templates/` or `assets/js-templates/` as a pattern, with hooks and actions sourced entirely from the SDK example fetched in Phase 2.

JSX structure order:
```
Outer layout wrapper → Card/panel → Logo slot → Title (screen.texts) →
Error banner (conditional) → Form fields → Captcha (conditional) →
Submit button → Passkey button (conditional) → Social divider + buttons
(conditional on alternateConnections) → Footer links
```

### Screen Registration (Path B and Path C only)

The CLI auto-registers any screen it scaffolds (Path A). **Manually generated screens (Path B, Path C) must be registered**, or local `auth0 acul dev` renders **"Screen '<screen-name>' is not implemented"** — even though the files exist and the build succeeds. (Connected mode resolves screens from the tenant, so it works without this step — which is why the bug only shows in local dev.) Screens resolve through a `SCREEN_COMPONENTS` map in `src/utils/screen/screenLoader.ts`.

For each manually generated screen:

1. **Determine how `screenLoader.ts` is maintained — do not assume it's hand-edited.** If it carries an `// Auto-generated file` banner or `package.json` has a generator script (e.g. `generate:screenLoader` backed by `scripts/generate-screen-loader.js`), it is regenerated by scanning `src/screens/*/index.tsx` against an allowlist:
   - Ensure `<screen-name>` is in the allowlist (e.g. `src/constants/validScreens.js`), then run `npm run generate:screenLoader`. **Do not hand-edit the generated file** — it will be overwritten.
   - Only if no generator exists, add the entry manually: `"<screen-name>": lazy(() => import("@/screens/<screen-name>")),`
2. Ensure the screen's `index.tsx` (or single-file component) has a `export default` — `React.lazy` resolves the **default** export, not a named one.

### Validation before outputting any code

- SDK import path exactly matches the screen name (e.g., `@auth0/auth0-acul-react/mfa-otp-challenge`)
- Hook pattern (generic `useScreen()` vs screen-specific hook) sourced from the CLI-generated code or reference, not assumed
- Action function names and payload shapes sourced from the CLI-generated code or reference
- Error state uses SDK source (`hasErrors` / `getErrors()`) — never local-only error state
- No hardcoded UI strings — use `screen.texts.*` with locale fallback
- `applyAuth0Theme()` called in index.tsx when using modular architecture (Path A, Path B)
- **Manually generated screens (Path B, Path C) registered in `src/utils/screen/screenLoader.ts` with a matching `export default`** — required for local `auth0 acul dev`

**All-screens scope:** repeat Path A, B, or C (whichever applies per screen) for every screen in the project, all importing from the shared theme file. Consistent component structure within each path.

---

## Phase 7: Build Validation & Iterative Fix

After generating or modifying screen code, **always** validate the output before moving on. Generated code may contain incorrect import paths, wrong import styles (default vs named), invalid component props, or references to non-existent exports. This phase catches and fixes those issues automatically.

### Step 1 — Install new dependencies (if any)

If the generated or modified code introduced **new dependencies** in `package.json` (entries under `dependencies` / `devDependencies` that aren't already installed in `node_modules`), run `npm install` from the project root before linting/building. Skip this step if no new packages were added.

```bash
# Run from the project root
npm install
```

If install fails (peer-dependency conflict, registry error, version mismatch), surface the error to the customer and stop — do not proceed to lint/build until resolved.

### Step 2 — Run lint

Run the project's linter to surface import errors, type mismatches, and invalid props:

```bash
# Detect the lint command from package.json scripts
npm run lint 2>&1 || npx eslint src/screens/<screen-name>/ --ext .ts,.tsx,.js,.jsx 2>&1
```

If the project uses TypeScript, also run the type checker:

```bash
npx tsc --noEmit 2>&1
```

### Step 3 — Run build

```bash
npm run build 2>&1
```

### Step 4 — Parse errors and fix iteratively

If lint or build produces errors, parse each error and apply the appropriate fix:

| Error pattern | Root cause | Fix |
|---------------|-----------|-----|
| `does not have a default export` | Using `import X` on a named export | Change to `import { X }` |
| `has no exported member` | Importing a symbol that doesn't exist in the module | Read the source module to find the correct export name |
| `Module not found` / `Cannot find module` | Wrong import path | Verify the correct path from `node_modules` or the project's own source tree |
| `Property 'X' does not exist on type` | Invalid prop passed to a component | Read the component's type definition or source to find valid props |
| `is not assignable to type` | Prop type mismatch | Cast or transform the value to match the expected type |
| `JSX element type 'X' does not have any construct or call signatures` | Component imported incorrectly or doesn't exist | Verify the component exists and is exported correctly from its module |

**Fix workflow:**
1. Read the error output — identify the file, line, and error code.
2. Read the source file at the error location to understand context.
3. If the error involves an import — read the target module (from `node_modules` or project source) to find the correct export names and paths.
4. Apply the fix.
5. Re-run `npm run build 2>&1`.
6. Repeat from step 1 until the build succeeds.

**Iteration cap:** Use a hard cap of **5 iterations**. If errors plateau (same count or same errors across 2 consecutive iterations), stop immediately before the cap. When the cap is reached and errors remain, present the remaining errors to the customer and ask for guidance rather than continuing to modify code.

### Common pitfalls this phase catches

- `import Component from './Component'` when the file uses `export const Component` (named export) — fix: `import { Component } from './Component'`
- `import { useLoginId } from '@auth0/auth0-acul-react'` instead of the screen-specific path `@auth0/auth0-acul-react/login-id` — fix: use the correct sub-path import
- Using `<ULThemeCard title={...}>` when `ULThemeCard` doesn't accept a `title` prop — fix: remove the invalid prop and use a `<Header>` child component instead
- Importing a theme utility from a path that doesn't exist in the project — fix: verify the actual path in the project tree
- Using `applyAuth0Theme` as a named import when it's a default export (or vice versa) — fix: match the module's actual export style

### Runtime check the build CANNOT catch: unregistered screens

A clean `npm run build` does **not** guarantee a manually added screen renders in local dev. The build passes, but `auth0 acul dev` shows **"Screen '<screen-name>' is not implemented"** when:

- The screen is missing from the `SCREEN_COMPONENTS` map in `src/utils/screen/screenLoader.ts`, OR
- The screen's `index.tsx` has no `export default` (so `lazy()` can't resolve the component).

For every screen generated via Path B or Path C, verify both before finishing. This is a runtime/registry gap, not a compile error — lint and `tsc` will not flag it. If the project auto-generates `screenLoader.ts`, register via its generator (`npm run generate:screenLoader`) rather than hand-editing. (See "Screen Registration" in Phase 6.)

### Successful validation

Once the build completes with **exit code 0** and no lint errors, **and every manually added screen is registered in `screenLoader.ts` with a `export default`**, proceed to Phase 8.

---

## Phase 8: Dev Mode Wiring

Provide the customer with ready-to-run commands:

```bash
# Local preview — no tenant connection needed
auth0 acul dev -p 3000 -d <project-dir>

# Connected mode — syncs assets to tenant (stage/dev only)
auth0 acul dev --connected -s <screen-name> -d <project-dir>
```

⚠️ Always include this warning when connected mode is suggested:
> Connected mode updates your Auth0 tenant in real time. Only use this on a stage or development tenant — never on production.

---

## Reference Files

| File | Load when |
|------|-----------|
| `references/acul-react-sdk.md` | Framework is React |
| `references/acul-js-sdk.md` | Framework is JS / Vanilla |
| `references/screen-catalog.md` | Selecting screen type or triggering CLI fallback |
| `references/social-providers.md` | Social login buttons are needed |
| `references/theming-patterns.md` | Generating or applying a shared theme file |
| `references/cli-commands.md` | Need full CLI flag details |

## Asset Templates

| File | Use when |
|------|----------|
| `assets/theme-templates/tailwind.config.ts` | Tailwind, all-screens scope |
| `assets/theme-templates/tokens.css` | CSS Modules, all-screens scope |
| `assets/theme-templates/theme-provider.ts` | styled-components |
| `assets/theme-templates/globals.css` | Plain CSS, all-screens scope |
| `assets/react-templates/<screen>.tsx` | React component boilerplate base |
| `assets/js-templates/<screen>.js` | JS component boilerplate base |
