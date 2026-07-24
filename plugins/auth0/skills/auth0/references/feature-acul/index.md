
# ACUL Screen Generator

Generates production-ready, fully themed Auth0 ACUL screen components. Follows a strict 9-phase workflow (Phases 0–8): CLI authentication → intent detection → project setup → screen requirements → tech stack and design → theme extraction → structured code generation → build validation & iterative fix → dev mode wiring.

## Reference Hierarchy

Always resolve the correct reference for a screen using this priority order. **Before running the CLI**, check if the screen exists in auth0-acul-samples — if it does not, the CLI will fail.

```text
1. Check auth0-acul-samples availability first  (gate for CLI usage)
   → Check the Screen Catalog section in this file for the Samples column
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

4. assets/acul/react-templates/ or assets/acul/js-templates/
   → Structural component pattern only — never use their hooks/actions for other screens
```

For which screens are in auth0-acul-samples → see the Screen Catalog section in this file.


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

For full CLI flag reference → see the CLI Commands section in this file.

> **Tooling note.** ACUL is CLI-driven by design: the CLI scaffolds and previews
> the screen *code*, which neither Terraform nor the MCP server can do — so this
> workflow uses the Auth0 CLI regardless of the project's other tooling. The one
> piece that *is* declarative is the tenant-side toggle that turns a screen's
> rendering mode to `advanced`: an infrastructure-as-code project can manage that
> with the Terraform `auth0_prompt_screen_renderer` resource (`rendering_mode`)
> instead of the CLI. The Auth0 MCP server exposes **no** ACUL/prompt-screen tool.


## Phase 1: Intent Detection

Ask the customer which mode they need:

- **A) Build from scratch** — new project, select screens, full setup
- **B) Add a screen** — existing project, add one or more new screens
- **C) Modify a screen** — existing project, change an existing screen's code or styling

This choice gates Phases 2A / 2B / 2C.


## Phase 2A: Scratch — Project Init

Gather: app name, framework (`react` or `js`), initial screen list.

```bash
auth0 acul init <app_name> -t react -s login-id,login-password,signup
auth0 acul config generate <screen-name>    # repeat per screen
```

Verify `acul_config.json` is created in the project directory.

**The CLI-scaffolded code is your primary source.** Read the generated screen files to understand the project structure, SDK imports, hook patterns, and component layout. Do NOT fetch from GitHub — the CLI output is the canonical starting point. Only customize or extend the generated code based on the customer's requirements (branding, extra components, etc.).

Proceed to Phase 3.


## Phase 2B: Add Screen — Check Samples Availability First

1. Verify `acul_config.json` exists in the project directory.
   - If missing → stop. Instruct customer to run `auth0 acul init` first.

2. **Check if the screen exists in auth0-acul-samples before attempting CLI.**

   Check the Screen Catalog section in this file for the `Samples (React)` or `Samples (React-JS)` column for the requested screen. Then fetch the GitHub directory listing to **confirm** the screen actually exists at the expected path:

   ```text
   React:    https://github.com/auth0-samples/auth0-acul-samples/tree/main/react/src/screens/<screen-name>
   React-JS: https://github.com/auth0-samples/auth0-acul-samples/tree/main/react-js/src/screens/<screen-name>
   ```

   This check determines whether the CLI can scaffold the screen. If the screen is NOT present in auth0-acul-samples, the CLI `auth0 acul screen add` command will fail — so skip it entirely and go straight to Step 4.

3. **Screen IS in auth0-acul-samples → try the CLI:**
   ```bash
   auth0 acul screen add <screen-name> -d <project-dir>
   ```
   - **If CLI succeeds → use the scaffolded code directly.** Read the generated files to understand the structure, SDK imports, and hook patterns. Do NOT fetch from GitHub. Customize the CLI-generated code based on the customer's requirements (branding, components, etc.). Proceed to Phase 3.
   - **If CLI errors despite the screen being in samples** (e.g., auth issues, version mismatch) → fall through to Step 4 as a recovery path.

4. **Screen is NOT in auth0-acul-samples (or CLI failed) → skip CLI, fetch reference directly.**

   Since the CLI does not support this screen, do NOT attempt `auth0 acul screen add` — it will error. Instead, build the screen from reference code.

   **Step 4a — Capture project structure (if not already known):**
   If this is the first screen being added manually (i.e., you don't already have a reference for the project's directory layout, config wiring, and build setup from a previous CLI-generated screen), create a dummy page:
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

   Determine whether the example is React (JSX/TSX, hooks) or plain JS (class-based manager) and match it to the project's framework. If the project is React but only a JS example exists (or vice versa), adapt the patterns accordingly using the appropriate SDK reference (the React SDK section or JS SDK section in this file).

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

   For all screen names and their availability → see the Screen Catalog section in this file.


## Phase 2C: Modify Screen — Fetch Current State

1. Verify `acul_config.json` exists.

2. Fetch current rendering configuration:
   ```bash
   auth0 acul config get <screen-name> -f <screen-name>.json
   auth0 acul config list --rendering-mode advanced
   ```

3. Read the existing screen file from the customer's codebase. **The local code is your primary reference.** Understand its current structure, SDK imports, and hook patterns before making any changes.

4. Only fetch from GitHub references if the local code is missing critical SDK patterns (e.g., wrong hook pattern, missing action functions) and you cannot determine the correct pattern from the existing codebase. Use the Reference Hierarchy (samples availability → CLI scaffolded code when supported → SDK examples) to validate.


## Phase 3: Screen Requirements

Gather from the customer:

- **Screen type** — for full list of available screens → see the Screen Catalog section in this file
- **Components needed:**
  - Social providers: Google, GitHub, Apple, Microsoft, Facebook
  - Form fields: email, username, phone, password, confirm-password
  - MFA type (if applicable): OTP, SMS, push, WebAuthn
  - Optional extras: captcha, passkey button, remember-me, terms checkbox
- **For modify mode:** what specifically to change (layout, colors, add/remove a component)


## Phase 4: Tech Stack Detection

Confirm or detect:

- **Framework:** React (`@auth0/auth0-acul-react`) or JS (`@auth0/auth0-acul-js`)
- **Styling library:** Tailwind CSS / CSS Modules / styled-components / plain CSS
- **Existing theme file?** Check for `tailwind.config.ts`, `styles/tokens.css`, `theme/index.ts`

Load the appropriate SDK reference:
- React → see the React SDK section in this file
- JS → see the JS SDK section in this file

For social button implementation → see the Social Providers section in this file.


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

For theme file patterns per styling library → see the Theming Patterns section in this file.

**Theme file to generate per styling library (all-screens scope):**

| Styling library | Template to use | Output file |
|----------------|-----------------|-------------|
| Tailwind | `assets/acul/theme-templates/tailwind.config.ts` | `tailwind.config.ts` |
| CSS Modules | `assets/acul/theme-templates/tokens.css` | `styles/tokens.css` |
| styled-components | `assets/acul/theme-templates/theme-provider.ts` | `theme/index.ts` |
| Plain CSS | `assets/acul/theme-templates/globals.css` | `styles/globals.css` |

Replace all `{{TOKEN}}` placeholders with extracted token values.


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

Generate a single `<screen-name>.tsx` (React) or `<screen-name>.js` (JS) using the structure from `assets/acul/react-templates/` or `assets/acul/js-templates/` as a pattern, with hooks and actions sourced entirely from the SDK example fetched in Phase 2.

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


## Reference Files

| File | Load when |
|------|-----------|
| React SDK section (in this file) | Framework is React |
| JS SDK section (in this file) | Framework is JS / Vanilla |
| Screen Catalog section (in this file) | Selecting screen type or triggering CLI fallback |
| Social Providers section (in this file) | Social login buttons are needed |
| Theming Patterns section (in this file) | Generating or applying a shared theme file |
| CLI Commands section (in this file) | Need full CLI flag details |

## Asset Templates

| File | Use when |
|------|----------|
| `assets/acul/theme-templates/tailwind.config.ts` | Tailwind, all-screens scope |
| `assets/acul/theme-templates/tokens.css` | CSS Modules, all-screens scope |
| `assets/acul/theme-templates/theme-provider.ts` | styled-components |
| `assets/acul/theme-templates/globals.css` | Plain CSS, all-screens scope |
| `assets/acul/react-templates/<screen>.tsx` | React component boilerplate base |
| `assets/acul/js-templates/<screen>.js` | JS component boilerplate base |

---

# Auth0 ACUL React SDK Reference

Package: `@auth0/auth0-acul-react`

Each screen has its own import path. Import hooks and action functions from the screen-specific path.

---

## Import Pattern

```tsx
import {
  useScreen,
  useTransaction,
  useErrors,
  useLoginIdentifiers,
  login,
  federatedLogin,
  passkeyLogin,
} from '@auth0/auth0-acul-react/login-id'
```

Replace `login-id` with the screen name (e.g., `signup`, `login-password`, `mfa-otp-challenge`).

---

## Common Hooks

### `useScreen()`
Returns screen configuration and localised text strings.
```tsx
const screen = useScreen()
screen.texts?.title          // screen heading text
screen.texts?.description    // subheading/description
screen.name                  // current screen name
screen.links?.signUp         // navigation link to signup
screen.links?.resetPassword  // navigation link to password reset
screen.links?.login          // navigation link to login
```

### `useTransaction()`
Returns transaction state and available connections.
```tsx
const { hasErrors, alternateConnections, connection } = useTransaction()
alternateConnections   // array of social/enterprise connections
connection.name        // primary connection name
```

### `useErrors()`
Returns error state from the current transaction.
```tsx
const { hasErrors, errors } = useErrors()
// errors: array of { code, message }
```

### `useLoginIdentifiers()`
Returns active identifier types for dynamic label generation.
```tsx
const identifiers = useLoginIdentifiers()
// ['email', 'username'] → "Enter your email or username"
```

---

## Action Functions

Action functions are imported alongside hooks and called from event handlers.

### Authentication actions
```tsx
login({ username, password, captcha })         // login-id, login-password
federatedLogin({ connection: 'google-oauth2' }) // social login
passkeyLogin()                                  // passkey prompt (native dialog)
pickCountryCode()                               // phone country code picker
```

### Signup actions
```tsx
signup({ email, password, username })
```

### MFA actions
```tsx
continueWithMfaOtp({ code })
continueWithMfaSms({ code })
continueWithEmail({ code })
enrollWithTotp({ code })
```

### Password reset actions
```tsx
requestPasswordReset({ email })
resetPassword({ password, confirmPassword })
```

### Session actions
```tsx
logout()
```

---

## Standard Component Structure

```tsx
import React, { useState } from 'react'
import {
  useScreen, useTransaction, useErrors,
  login, federatedLogin, passkeyLogin,
} from '@auth0/auth0-acul-react/login-id'

export const LoginIdScreen: React.FC = () => {
  // 1. SDK hooks
  const screen = useScreen()
  const { alternateConnections } = useTransaction()
  const { hasErrors, errors } = useErrors()

  // 2. Local state
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [captcha, setCaptcha] = useState('')

  // 3. Event handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await login({ username, captcha })
    setLoading(false)
  }

  const handleSocial = async (connectionName: string) => {
    await federatedLogin({ connection: connectionName })
  }

  // 4. JSX
  return (
    <div className="page-wrapper">
      <div className="card">
        {/* Logo slot */}
        <div className="logo-slot" />

        {/* Title from screen config */}
        <h1>{screen.texts?.title ?? 'Log in'}</h1>

        {/* Error banner */}
        {hasErrors && (
          <div className="error-banner">
            {errors.map(e => <p key={e.code}>{e.message}</p>)}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <label htmlFor="username">
            {screen.texts?.usernameLabel ?? 'Email or username'}
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : (screen.texts?.buttonText ?? 'Continue')}
          </button>
        </form>

        {/* Social login */}
        {alternateConnections?.length > 0 && (
          <>
            <div className="divider"><span>Or</span></div>
            {alternateConnections.map(conn => (
              <button
                key={conn.name}
                onClick={() => handleSocial(conn.name)}
                className="social-btn"
              >
                Continue with {conn.displayName}
              </button>
            ))}
          </>
        )}

        {/* Footer links */}
        <div className="footer-links">
          <a href="#">Sign up</a>
          <a href="#">Forgot password?</a>
        </div>
      </div>
    </div>
  )
}
```

---

## Conditional Features

```tsx
// Captcha (check if configured)
{screen.isCaptchaAvailable && (
  <input value={captcha} onChange={e => setCaptcha(e.target.value)} />
)}

// Passkey button
{screen.isPasskeyEnabled && (
  <button onClick={() => passkeyLogin()}>Use passkey</button>
)}

// Country code for phone flows
{screen.isPhoneFlow && (
  <button onClick={() => pickCountryCode()}>+1</button>
)}
```

---

## Screen-Specific Imports Quick Reference

| Screen | Import path |
|--------|-------------|
| login-id | `@auth0/auth0-acul-react/login-id` |
| login-password | `@auth0/auth0-acul-react/login-password` |
| signup | `@auth0/auth0-acul-react/signup` |
| signup-id | `@auth0/auth0-acul-react/signup-id` |
| signup-password | `@auth0/auth0-acul-react/signup-password` |
| mfa-otp-challenge | `@auth0/auth0-acul-react/mfa-otp-challenge` |
| mfa-email-challenge | `@auth0/auth0-acul-react/mfa-email-challenge` |
| mfa-sms-challenge | `@auth0/auth0-acul-react/mfa-sms-challenge` |
| reset-password-request | `@auth0/auth0-acul-react/reset-password-request` |
| reset-password | `@auth0/auth0-acul-react/reset-password` |
| passkey-enrollment | `@auth0/auth0-acul-react/passkey-enrollment` |

For full screen list and fallback URLs → see the Screen Catalog section in this file.

---

# Auth0 ACUL JS SDK Reference

Package: `@auth0/auth0-acul-js`

Uses a manager class pattern. Each screen exports a default class with methods matching available actions.

---

## Import Pattern

```typescript
import LoginId from '@auth0/auth0-acul-js/login-id'

const manager = new LoginId()
```

Replace `login-id` with the screen name. Class name is PascalCase of the screen name.

---

## Manager Instance Properties

```typescript
manager.transaction.hasErrors          // boolean
manager.transaction.alternateConnections  // social/enterprise connections array
manager.transaction.connection         // primary connection
manager.getErrors()                    // returns array of { code, message }
manager.screen.texts                   // localised text strings
manager.screen.name                    // current screen name
manager.screen.isCaptchaAvailable      // boolean
manager.screen.isPasskeyEnabled        // boolean
```

---

## Common Methods by Screen

### Login screens
```typescript
// login-id
const manager = new LoginId()
await manager.login({ username: 'user@example.com', captcha: '...' })
await manager.federatedLogin({ connection: 'google-oauth2' })
await manager.passkeyLogin()
await manager.pickCountryCode()

// login-password
const manager = new LoginPassword()
await manager.login({ password: 'secret', captcha: '...' })
await manager.federatedLogin({ connection: 'google-oauth2' })
await manager.passkeyLogin()
```

### Signup screens
```typescript
const manager = new Signup()
await manager.signup({ email: 'user@example.com', password: 'secret' })
await manager.federatedLogin({ connection: 'google-oauth2' })
```

### MFA screens
```typescript
// mfa-otp-challenge
const manager = new MfaOtpChallenge()
await manager.continueWithMfaOtp({ code: '123456' })

// mfa-sms-challenge
const manager = new MfaSmsChallenge()
await manager.continueWithMfaSms({ code: '123456' })

// mfa-email-challenge
const manager = new MfaEmailChallenge()
await manager.continueWithEmail({ code: '123456' })
```

### Password reset screens
```typescript
const manager = new ResetPasswordRequest()
await manager.requestPasswordReset({ email: 'user@example.com' })

const manager = new ResetPassword()
await manager.resetPassword({ password: 'newpass', confirmPassword: 'newpass' })
```

---

## Standard Component Structure (Vanilla JS)

```javascript
import LoginId from '@auth0/auth0-acul-js/login-id'

const manager = new LoginId()

function render() {
  const container = document.getElementById('app')
  container.innerHTML = `
    <div class="page-wrapper">
      <div class="card">
        <div class="logo-slot"></div>
        <h1>${manager.screen.texts?.title ?? 'Log in'}</h1>

        ${manager.transaction.hasErrors ? `
          <div class="error-banner">
            ${manager.getErrors().map(e => `<p>${e.message}</p>`).join('')}
          </div>
        ` : ''}

        <form id="login-form">
          <label for="username">
            ${manager.screen.texts?.usernameLabel ?? 'Email or username'}
          </label>
          <input id="username" type="text" name="username" />

          ${manager.screen.isCaptchaAvailable ? `
            <input id="captcha" type="text" placeholder="Enter captcha" />
          ` : ''}

          <button type="submit">
            ${manager.screen.texts?.buttonText ?? 'Continue'}
          </button>
        </form>

        ${manager.transaction.alternateConnections?.length ? `
          <div class="divider"><span>Or</span></div>
          ${manager.transaction.alternateConnections.map(conn => `
            <button class="social-btn" data-connection="${conn.name}">
              Continue with ${conn.displayName}
            </button>
          `).join('')}
        ` : ''}

        <div class="footer-links">
          <a href="#">Sign up</a>
          <a href="#">Forgot password?</a>
        </div>
      </div>
    </div>
  `

  // Attach event listeners after render
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const username = document.getElementById('username').value
    const captcha = document.getElementById('captcha')?.value
    await manager.login({ username, captcha })
  })

  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const connection = btn.dataset.connection
      await manager.federatedLogin({ connection })
    })
  })

  if (manager.screen.isPasskeyEnabled) {
    // Passkey button handler
    document.getElementById('passkey-btn')?.addEventListener('click', async () => {
      await manager.passkeyLogin()
    })
  }
}

render()
```

---

## Manager Class Name Reference

| Screen | Import path | Class name |
|--------|-------------|------------|
| login-id | `@auth0/auth0-acul-js/login-id` | `LoginId` |
| login-password | `@auth0/auth0-acul-js/login-password` | `LoginPassword` |
| signup | `@auth0/auth0-acul-js/signup` | `Signup` |
| signup-id | `@auth0/auth0-acul-js/signup-id` | `SignupId` |
| signup-password | `@auth0/auth0-acul-js/signup-password` | `SignupPassword` |
| mfa-otp-challenge | `@auth0/auth0-acul-js/mfa-otp-challenge` | `MfaOtpChallenge` |
| mfa-email-challenge | `@auth0/auth0-acul-js/mfa-email-challenge` | `MfaEmailChallenge` |
| mfa-sms-challenge | `@auth0/auth0-acul-js/mfa-sms-challenge` | `MfaSmsChallenge` |
| reset-password-request | `@auth0/auth0-acul-js/reset-password-request` | `ResetPasswordRequest` |
| reset-password | `@auth0/auth0-acul-js/reset-password` | `ResetPassword` |
| passkey-enrollment | `@auth0/auth0-acul-js/passkey-enrollment` | `PasskeyEnrollment` |

For full screen list and fallback URLs → see the Screen Catalog section in this file.

---

# Auth0 ACUL CLI Commands Reference

Full reference for `auth0 acul` commands. Requires Auth0 CLI installed (`brew install auth0`).

---

## Authentication

```bash
auth0 login                        # authenticate with Auth0 tenant
auth0 login --tenant <tenant>      # authenticate to a specific tenant
```

---

## auth0 acul init

Generates a new ACUL project from a template.

```bash
auth0 acul init <app_name>
auth0 acul init <app_name> -t react -s login,signup
auth0 acul init <app_name> -t react -s login,login-id,login-password,signup,reset-password
```

| Flag | Short | Description |
|------|-------|-------------|
| `--template` | `-t` | Framework template: `react` or `js` |
| `--screens` | `-s` | Comma-separated screen list |
| `--tenant` | | Target a specific tenant |
| `--no-input` | | Disable interactive prompts |

Creates `acul_config.json` in the project directory — required for all subsequent commands.

---

## auth0 acul screen add

Adds screens to an existing ACUL project. Project must already be initialized.

```bash
auth0 acul screen add <screen-name> -d <project-dir>
auth0 acul screen add login-id login-password -d ./acul_app
auth0 acul screen add mfa-otp-challenge -d ./my-project
```

| Flag | Short | Description |
|------|-------|-------------|
| `--dir` | `-d` | Path to project directory (must contain `acul_config.json`) |
| `--tenant` | | Target a specific tenant |

**ON ERROR:** Fall back to SDK examples — see the Screen Catalog section in this file for URLs.

---

## auth0 acul config

### List configurations

```bash
auth0 acul config list
auth0 acul config list --rendering-mode advanced
auth0 acul config list --screen login-id
auth0 acul config list --prompt login --rendering-mode advanced --fields head_tags,context_configuration
```

| Flag | Description |
|------|-------------|
| `--prompt` | Filter by Universal Login prompt |
| `--rendering-mode` | Filter by mode: `advanced` or `standard` |
| `--screen` | Filter by screen name |
| `--fields` | Comma-separated fields to include |
| `--json` | Output as JSON |
| `--page` | Page index (starts at 0) |
| `--per-page` | Results per page (default 50, max 100) |

### Get screen config

```bash
auth0 acul config get <screen-name>
auth0 acul config get login-id -f ./acul_config/login-id.json
auth0 acul config get signup-id --file settings.json
```

| Flag | Short | Description |
|------|-------|-------------|
| `--file` | `-f` | Save config to file path |

### Set screen config

```bash
auth0 acul config set <screen-name>
auth0 acul config set login-id --file settings.json
```

### Generate config stub

```bash
auth0 acul config generate <screen-name>
auth0 acul config generate login-id --file login-settings.json
```

Generates a stub `.json` config file for a screen. Use after `screen add` or during scratch setup.

---

## auth0 acul dev

Starts development mode with automatic build watching.

```bash
# Local preview (no tenant connection)
auth0 acul dev -p 3000
auth0 acul dev -p 3000 -d ./my-project

# Connected mode — updates rendering settings on tenant (stage/dev only)
auth0 acul dev --connected -s login-id
auth0 acul dev -c -s login-id,signup -d ./my-project
```

| Flag | Short | Description |
|------|-------|-------------|
| `--port` | `-p` | Local dev server port (required) |
| `--dir` | `-d` | ACUL project directory path |
| `--connected` | `-c` | Connected mode: syncs to tenant |
| `--screens` | `-s` | Specific screens to develop |

⚠️ **Connected mode warning:** only use on stage/dev tenants, never production.

---

## Typical Workflows

### Scratch setup
```bash
auth0 login
auth0 acul init my-app -t react -s login-id,login-password,signup
cd my-app
auth0 acul config generate login-id
auth0 acul dev -p 3000
```

### Add a screen to existing project
```bash
auth0 acul screen add mfa-otp-challenge -d ./my-app
auth0 acul config generate mfa-otp-challenge -f ./my-app/acul_config/mfa-otp-challenge.json
auth0 acul dev -p 3000 -d ./my-app
```

### Inspect current tenant ACUL state
```bash
auth0 acul config list --rendering-mode advanced --json
auth0 acul config get login-id -f login-id-current.json
```

---

# ACUL Screen Catalog

Complete reference for all 68 React + 71 JS ACUL screens with their reference sources, SDK callbacks, and URLs.

**Reference priority per screen:**
1. **auth0-acul-samples** if `Samples` column = ✅ → fetch full modular implementation
2. **SDK examples** if `Samples` column = ❌ → fetch the markdown example for SDK usage
3. **assets/templates** — structural pattern only, never for hooks/actions

The `Samples` column marks which screens have a complete implementation in `auth0-acul-samples`.

> **Note:** `continueMethod()` in the tables below is a placeholder — the actual method name is screen-specific (e.g., `continueWithMfaOtp()`, `continueWithMfaSms()`). Always fetch the SDK example to get the exact method name and payload shape.

## Table of Contents
1. [URL Patterns](#url-patterns)
2. [Hook Patterns](#hook-patterns)
3. [Login & Authentication](#login--authentication)
4. [Signup & Registration](#signup--registration)
5. [Password Reset](#password-reset)
6. [Password Reset + MFA Challenges](#password-reset--mfa-challenges)
7. [MFA — Enrollment & Options](#mfa--enrollment--options)
8. [MFA — Email](#mfa--email)
9. [MFA — SMS / Voice / Phone](#mfa--sms--voice--phone)
10. [MFA — OTP (TOTP)](#mfa--otp-totp)
11. [MFA — Push Notifications](#mfa--push-notifications)
12. [MFA — WebAuthn](#mfa--webauthn)
13. [MFA — Recovery Codes](#mfa--recovery-codes)
14. [Passkeys](#passkeys)
15. [Identifier Challenges](#identifier-challenges)
16. [Device Authorization](#device-authorization)
17. [Organization Management](#organization-management)
18. [Consent & Security](#consent--security)
19. [Session / Logout](#session--logout)
20. [Email Verification](#email-verification)
21. [JS-Only Screens](#js-only-screens)

---

## URL Patterns

### auth0-acul-samples (Priority 1)
```
React:
  directory: https://github.com/auth0-samples/auth0-acul-samples/tree/main/react/src/screens/<screen-name>
  index.tsx:  https://github.com/auth0-samples/auth0-acul-samples/blob/main/react/src/screens/<screen-name>/index.tsx
  manager:    https://github.com/auth0-samples/auth0-acul-samples/blob/main/react/src/screens/<screen-name>/hooks/use<ScreenName>Manager.ts

React-JS:
  directory: https://github.com/auth0-samples/auth0-acul-samples/tree/main/react-js/src/screens/<screen-name>
  index.tsx:  https://github.com/auth0-samples/auth0-acul-samples/blob/main/react-js/src/screens/<screen-name>/index.tsx
```

### SDK examples (Priority 2)
```
React: https://github.com/auth0/universal-login/blob/master/packages/auth0-acul-react/examples/<screen-name>.md
JS:    https://github.com/auth0/universal-login/blob/master/packages/auth0-acul-js/examples/<screen-name>.md
```

---

## Hook Patterns

ACUL screens use two patterns. The reference fetch tells you which applies.

**Pattern A — Generic hooks** (most login/signup screens):
```tsx
import { useScreen, useTransaction, useErrors, login } from '@auth0/auth0-acul-react/<screen>'
const screen = useScreen()
const { alternateConnections } = useTransaction()
```

**Pattern B — Screen-specific hook** (most MFA, reset-password-mfa, recovery screens):
```tsx
import { useScreenName, continueMethod } from '@auth0/auth0-acul-react/<screen>'
const screen = useScreenName()   // e.g., useMfaRecoveryCodeEnrollment()
await continueMethod({ ...payload })
```

**JS — Manager class** (both patterns map to this):
```js
import ScreenClass from '@auth0/auth0-acul-js/<screen>'
const manager = new ScreenClass()
await manager.continueMethod({ ...payload })
```

---

## Login & Authentication

| Screen | Samples (React) | Samples (React-JS) | SDK React | SDK JS | Primary Action | Notes |
|--------|-----------------|--------------------|-----------|--------|----------------|-------|
| `login` | ✅ | ✅ | ✅ | ✅ | `login()`, `federatedLogin()` | All-identifier login |
| `login-id` | ✅ | ✅ | ✅ | ✅ | `login()`, `federatedLogin()`, `passkeyLogin()` | Identifier-first step |
| `login-password` | ✅ | ✅ | ✅ | ✅ | `login()`, `federatedLogin()`, `passkeyLogin()` | Password entry step |
| `login-passwordless-email-code` | ✅ | ❌ | ✅ | ✅ | `continueMethod()` | Email OTP |
| `login-passwordless-sms-otp` | ✅ | ❌ | ✅ | ✅ | `continueMethod()` | SMS OTP |
| `login-email-verification` | ❌ | ❌ | ✅ | ✅ | — | Gate screen, no action |

---

## Signup & Registration

| Screen | Samples (React) | Samples (React-JS) | SDK React | SDK JS | Primary Action | Notes |
|--------|-----------------|--------------------|-----------|--------|----------------|-------|
| `signup` | ✅ | ❌ | ✅ | ✅ | `signup()`, `federatedLogin()` | Combined signup |
| `signup-id` | ✅ | ❌ | ✅ | ✅ | `signup()`, `federatedLogin()` | Identifier-first |
| `signup-password` | ✅ | ❌ | ✅ | ✅ | `signup()` | Password entry |
| `accept-invitation` | ❌ | ❌ | ✅ | ✅ | `signup()` | Org invite |
| `redeem-ticket` | ❌ | ❌ | ✅ | ✅ | — | Ticket-based access |

---

## Password Reset

| Screen | Samples (React) | Samples (React-JS) | SDK React | SDK JS | Primary Action | Notes |
|--------|-----------------|--------------------|-----------|--------|----------------|-------|
| `reset-password-request` | ✅ | ❌ | ✅ | ✅ | `requestPasswordReset()` | Sends reset email |
| `reset-password-email` | ✅ | ❌ | ✅ | ✅ | — | Email sent confirmation |
| `reset-password` | ✅ | ❌ | ✅ | ✅ | `continueMethod()` | Enter new password |
| `reset-password-success` | ✅ | ❌ | ✅ | ✅ | — | Success state |
| `reset-password-error` | ✅ | ❌ | ✅ | ✅ | — | Error state |

---

## Password Reset + MFA Challenges

All screens: Pattern B (screen-specific hook + `continueMethod()`). Not in samples — use SDK examples.

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `reset-password-mfa-email-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `reset-password-mfa-otp-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `reset-password-mfa-phone-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `reset-password-mfa-push-challenge-push` | ❌ | ✅ | ✅ | `continueMethod()` |
| `reset-password-mfa-recovery-code-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `reset-password-mfa-sms-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `reset-password-mfa-voice-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `reset-password-mfa-webauthn-platform-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `reset-password-mfa-webauthn-roaming-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |

---

## MFA — Enrollment & Options

| Screen | Samples (React) | SDK React | SDK JS | Primary Action | Notes |
|--------|-----------------|-----------|--------|----------------|-------|
| `mfa-begin-enroll-options` | ✅ | ✅ | ✅ | — | Options list |
| `mfa-login-options` | ✅ | ✅ | ✅ | — | Login method picker |
| `mfa-detect-browser-capabilities` | ❌ | ✅ | ✅ | — | Capability check |
| `mfa-enroll-result` | ✅ | ✅ | ✅ | — | Enrollment confirmation |
| `mfa-country-codes` | ✅ | ✅ | ✅ | `continueMethod()` | Phone country picker |

---

## MFA — Email

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `mfa-email-challenge` | ✅ | ✅ | ✅ | `continueMethod()` |
| `mfa-email-list` | ✅ | ✅ | ✅ | — |

---

## MFA — SMS / Voice / Phone

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `mfa-sms-challenge` | ✅ | ✅ | ✅ | `continueMethod()` |
| `mfa-sms-enrollment` | ✅ | ✅ | ✅ | `continueMethod()` |
| `mfa-sms-list` | ✅ | ✅ | ✅ | — |
| `mfa-voice-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `mfa-voice-enrollment` | ❌ | ✅ | ✅ | `continueMethod()` |
| `mfa-phone-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `mfa-phone-enrollment` | ❌ | ✅ | ✅ | `continueMethod()` |

---

## MFA — OTP (TOTP)

Not in samples — use SDK examples.

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `mfa-otp-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |
| `mfa-otp-enrollment-qr` | ❌ | ✅ | ✅ | `continueMethod()` |
| `mfa-otp-enrollment-code` | ❌ | ✅ | ✅ | `continueMethod()` |

---

## MFA — Push Notifications

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `mfa-push-welcome` | ✅ | ✅ | ✅ | — |
| `mfa-push-enrollment-qr` | ✅ | ✅ | ✅ | `continueMethod()` |
| `mfa-push-challenge-push` | ✅ | ✅ | ✅ | `continueMethod()` |
| `mfa-push-list` | ✅ | ✅ | ✅ | — |

---

## MFA — WebAuthn

Not in samples — use SDK examples.

| Screen | Samples (React) | SDK React | SDK JS | Primary Action | Notes |
|--------|-----------------|-----------|--------|----------------|-------|
| `mfa-webauthn-platform-enrollment` | ❌ | ✅ | ✅ | `submitPasskeyCredential()`, `snoozeEnrollment()`, `refuseEnrollmentOnThisDevice()` | 3 actions |
| `mfa-webauthn-platform-challenge` | ❌ | ✅ | ✅ | `continueMethod()` | |
| `mfa-webauthn-roaming-enrollment` | ❌ | ✅ | ✅ | `continueMethod()` | |
| `mfa-webauthn-roaming-challenge` | ❌ | ✅ | ✅ | `continueMethod()` | |
| `mfa-webauthn-change-key-nickname` | ❌ | ✅ | ✅ | `continueMethod()` | |
| `mfa-webauthn-enrollment-success` | ❌ | ✅ | ✅ | — | Success state |
| `mfa-webauthn-error` | ❌ | ✅ | ✅ | — | Error state |
| `mfa-webauthn-not-available-error` | ❌ | ✅ | ✅ | — | Capability error |

---

## MFA — Recovery Codes

Not in samples — use SDK examples.

| Screen | Samples (React) | SDK React | SDK JS | Primary Action | Notes |
|--------|-----------------|-----------|--------|----------------|-------|
| `mfa-recovery-code-enrollment` | ❌ | ✅ | ✅ | `continueMethod({ isCodeCopied })` | Screen-specific hook |
| `mfa-recovery-code-challenge` | ❌ | ✅ | ✅ | `continueMethod()` | |
| `mfa-recovery-code-challenge-new-code` | ❌ | ✅ | ✅ | `continueMethod()` | |

---

## Passkeys

| Screen | Samples (React) | SDK React | SDK JS | Primary Action | Notes |
|--------|-----------------|-----------|--------|----------------|-------|
| `passkey-enrollment` | ✅ | ✅ | ✅ | `submitPasskeyCredential()` | Native dialog |
| `passkey-enrollment-local` | ✅ | ✅ | ✅ | `continueMethod()` | Local device |

---

## Identifier Challenges

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `email-identifier-challenge` | ✅ | ✅ | ✅ | `continueMethod()` |
| `phone-identifier-challenge` | ✅ | ✅ | ✅ | `continueMethod()` |
| `phone-identifier-enrollment` | ✅ | ✅ | ✅ | `continueMethod()` |
| `email-otp-challenge` | ❌ | ✅ | ✅ | `continueMethod()` |

---

## Device Authorization

Not in samples — use SDK examples.

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `device-code-activation` | ❌ | ✅ | ✅ | `continueMethod()` |
| `device-code-confirmation` | ❌ | ✅ | ✅ | `continueMethod()` |
| `device-code-activation-allowed` | ❌ | ✅ | ✅ | — |
| `device-code-activation-denied` | ❌ | ✅ | ✅ | — |

---

## Organization Management

Not in samples — use SDK examples.

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `organization-picker` | ❌ | ✅ | ✅ | `continueMethod()` |
| `organization-selection` | ❌ | ✅ | ✅ | `continueMethod()` |

---

## Consent & Security

Not in samples — use SDK examples.

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `consent` | ❌ | ✅ | ✅ | `continueMethod()` |
| `customized-consent` | ❌ | ✅ | ✅ | `continueMethod()` |
| `interstitial-captcha` | ❌ | ✅ | ✅ | `continueMethod()` |

---

## Session / Logout

Not in samples — use SDK examples.

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `logout` | ❌ | ✅ | ✅ | `logout()` |
| `logout-aborted` | ❌ | ✅ | ✅ | — |
| `logout-complete` | ❌ | ✅ | ✅ | — |

---

## Email Verification

| Screen | Samples (React) | SDK React | SDK JS | Primary Action |
|--------|-----------------|-----------|--------|----------------|
| `email-verification-result` | ❌ | ✅ | ✅ | — |

---

## JS-Only Screens

Only in `@auth0/auth0-acul-js`. No React SDK or samples equivalent. Use JS SDK examples.

| Screen | Primary Action | Notes |
|--------|----------------|-------|
| `brute-force-protection-unblock` | `unblockAccount()` | Account unblock |
| `brute-force-protection-unblock-success` | — | Success state |
| `brute-force-protection-unblock-failure` | — | Failure state |
| `get-current-screen-options` | — | Utility: read screen config |
| `get-current-theme-options` | — | Utility: read theme config |

JS SDK example URL:
```
https://github.com/auth0/universal-login/blob/master/packages/auth0-acul-js/examples/<screen-name>.md
```

---

# Social Login Provider Patterns

Patterns for rendering social login buttons in ACUL screens. Social connections come from `alternateConnections` on the transaction object — never hardcode connection names.

---

## Data Shape

```typescript
// From useTransaction() (React) or manager.transaction (JS)
alternateConnections: Array<{
  name: string          // e.g., "google-oauth2", "github", "apple"
  displayName: string   // e.g., "Google", "GitHub", "Apple"
  iconUrl?: string      // provider icon URL if available
  strategy: string      // e.g., "google-oauth2", "github", "apple"
}>
```

---

## React Pattern

```tsx
import { useTransaction, federatedLogin } from '@auth0/auth0-acul-react/login-id'

const { alternateConnections } = useTransaction()

// In JSX
{alternateConnections?.length > 0 && (
  <div className="social-section">
    <div className="divider">
      <span>Or continue with</span>
    </div>
    <div className="social-buttons">
      {alternateConnections.map(conn => (
        <SocialButton key={conn.name} connection={conn} />
      ))}
    </div>
  </div>
)}
```

```tsx
const SocialButton: React.FC<{ connection: AlternateConnection }> = ({ connection }) => {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    await federatedLogin({ connection: connection.name })
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="social-btn"
      aria-label={`Continue with ${connection.displayName}`}
    >
      {connection.iconUrl && (
        <img src={connection.iconUrl} alt="" width={20} height={20} />
      )}
      <span>Continue with {connection.displayName}</span>
    </button>
  )
}
```

---

## JS Pattern

```javascript
import LoginId from '@auth0/auth0-acul-js/login-id'
const manager = new LoginId()

function renderSocialButtons() {
  const connections = manager.transaction.alternateConnections ?? []
  if (!connections.length) return ''

  return `
    <div class="social-section">
      <div class="divider"><span>Or continue with</span></div>
      <div class="social-buttons">
        ${connections.map(conn => `
          <button
            class="social-btn"
            data-connection="${conn.name}"
            aria-label="Continue with ${conn.displayName}"
          >
            ${conn.iconUrl ? `<img src="${conn.iconUrl}" alt="" width="20" height="20" />` : ''}
            <span>Continue with ${conn.displayName}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `
}

// Attach handlers after render
document.querySelectorAll('.social-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    await manager.federatedLogin({ connection: btn.dataset.connection })
  })
})
```

---

## Provider-Specific Icon SVGs

Use these inline SVGs when `iconUrl` is unavailable or for consistent brand rendering.

### Google
```html
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
</svg>
```

### GitHub
```html
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
</svg>
```

### Apple
```html
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
</svg>
```

### Microsoft
```html
<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
  <rect x="13" y="1" width="10" height="10" fill="#7FBA00"/>
  <rect x="1" y="13" width="10" height="10" fill="#00A4EF"/>
  <rect x="13" y="13" width="10" height="10" fill="#FFB900"/>
</svg>
```

---

## Styling the Divider

```css
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
.divider span {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  white-space: nowrap;
}
```

---

# Theming Patterns for ACUL Screens

---

## Design Token Derivation

When only brand colors are provided (no image), derive the full token set:

```
Input: primary color (e.g., #4F46E5)

Derived tokens:
  --color-primary          = input hex
  --color-primary-hover    = primary darkened ~10%  (hsl lightness -10)
  --color-primary-text     = white if primary is dark, else #111827

  --color-background       = #FFFFFF (light) or #0F172A (dark, if brand is dark)
  --color-surface          = #F9FAFB (light) or #1E293B (dark)
  --color-surface-raised   = #FFFFFF (light) or #293548 (dark)

  --color-text-primary     = #111827 (light) or #F1F5F9 (dark)
  --color-text-secondary   = #6B7280 (light) or #94A3B8 (dark)
  --color-text-placeholder = #9CA3AF

  --color-border           = #E5E7EB (light) or #334155 (dark)
  --color-border-focus     = primary color

  --color-error            = #EF4444
  --color-error-bg         = #FEF2F2
  --color-success          = #22C55E
  --color-success-bg       = #F0FDF4

  --radius-sm              = 4px
  --radius-md              = 8px
  --radius-lg              = 12px
  --radius-full            = 9999px

  --shadow-card            = 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)
  --shadow-input-focus     = 0 0 0 3px <primary at 20% opacity>
```

---

## Image/Mockup Analysis

When a screenshot or design mockup is provided, extract:

1. **Colors** — sample from key areas:
   - Page background color
   - Card/panel background
   - Primary button color
   - Input border color
   - Text colors (heading, body, placeholder)
   - Error state color

2. **Typography** — identify:
   - Font family (match to Google Fonts or system font stack if custom)
   - Heading size and weight
   - Body text size
   - Button text style

3. **Spatial rhythm** — measure approximate:
   - Card padding (compact ~16px / normal ~24px / spacious ~32px)
   - Input height (small ~36px / medium ~40px / large ~48px)
   - Button border radius (sharp 0px / slight 4px / rounded 8px / pill 9999px)

4. **Layout type:**
   - Centered card (card centered on solid background)
   - Full-bleed (edge-to-edge, no visible card)
   - Split panel (image/brand on left, form on right)
   - Floating card (card with shadow on gradient/image background)

---

## Theme File Patterns by Styling Library

### Tailwind CSS — `tailwind.config.ts`

Use `assets/acul/theme-templates/tailwind.config.ts` as base.

Key pattern:
```typescript
theme: {
  extend: {
    colors: {
      brand: {
        primary: tokens.primary,
        'primary-hover': tokens.primaryHover,
        surface: tokens.surface,
        background: tokens.background,
        error: tokens.error,
      }
    },
    borderRadius: {
      card: tokens.radiusLg,
      input: tokens.radiusMd,
      btn: tokens.radiusMd,
    }
  }
}
```

Usage in components: `bg-brand-primary`, `hover:bg-brand-primary-hover`, `rounded-card`.

### CSS Modules — `styles/tokens.css`

Use `assets/acul/theme-templates/tokens.css` as base.

Pattern: define all tokens as `:root` CSS custom properties.
```css
:root {
  --color-primary: #4F46E5;
  --color-primary-hover: #4338CA;
  /* ... */
}
```

Usage: `background: var(--color-primary)`.

### styled-components — `theme/index.ts`

Use `assets/acul/theme-templates/theme-provider.ts` as base.

Pattern:
```typescript
export const theme = {
  colors: { primary: '#4F46E5', ... },
  radii: { card: '12px', ... }
}

// Wrap app
<ThemeProvider theme={theme}><App /></ThemeProvider>
```

Usage in styled components: `background: ${({ theme }) => theme.colors.primary}`.

### Plain CSS — `styles/globals.css`

Use `assets/acul/theme-templates/globals.css` as base. Same as CSS Modules pattern but applied globally.

---

## Single Screen vs All Screens

### Single screen (inline)
Apply tokens directly in the component's style file. No shared theme file.
```css
/* LoginId.module.css */
.card { background: #FFFFFF; border-radius: 12px; }
.submitBtn { background: #4F46E5; }
```

### All screens (shared theme file)
1. Generate the shared theme file first (`tailwind.config.ts` / `tokens.css` / etc.)
2. All screen components import from that single source of truth
3. Consistency is enforced — changing one variable updates all screens

**File to generate per styling library:**

| Library | File to create | Import in components |
|---------|---------------|----------------------|
| Tailwind | `tailwind.config.ts` | Classes only (no import needed) |
| CSS Modules | `styles/tokens.css` | `@import '../styles/tokens.css'` |
| styled-components | `theme/index.ts` | `import { theme } from '../theme'` |
| Plain CSS | `styles/globals.css` | Import once in entry point |
