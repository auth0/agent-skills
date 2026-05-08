# Theming Guide

Match Auth0 universal components to your app's design system using CSS variables.

---

## How It Works

Auth0 components render inside `.auth0-universal` with `all: revert-layer` — your app's CSS doesn't bleed in, Auth0 styles don't bleed out. You must explicitly set CSS variables for brand matching.

**Primary mechanism:** `:root` CSS variables (works at all mount timings, avoids late-mount timing issues with provider-level `themeSettings.variables`).

---

## Two CSS Paths

The `detect-stack.mjs` script chooses one path based on Tailwind version:

### Tailwind Path (`cssPath === "tailwind"`)

For Tailwind v4+ projects. Three imports required:
```css
@import "tailwindcss";
@import "@auth0/universal-components-react/tailwind";
@import "@auth0/universal-components-core/styles/globals.css";
```

Plus a `@theme inline` block (shadcn already has this) to map `--color-*` to bare variables:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-ring: var(--ring);
}
```

Variables use bare names (`--primary`, `--radius-2xl`). Auth0 components read these via the `--color-*` theme mappings.

### Scoped Path (`cssPath === "scoped"`)

For Tailwind v3 or no-Tailwind projects. Import:
```tsx
import '@auth0/universal-components-react/styles';
```

Variables use `--auth0-*` bridge names that map to internal Auth0 variables:

| You set | Maps to internally |
|---|---|
| `--auth0-primary` | `--color-primary` |
| `--auth0-primary-foreground` | `--color-primary-foreground` |
| `--auth0-background` | `--color-background` |
| `--auth0-foreground` | `--color-foreground` |
| `--auth0-border` | `--color-border` |
| `--auth0-card` | `--color-card` |
| `--auth0-card-foreground` | `--color-card-foreground` |
| `--auth0-muted` | `--color-muted` |
| `--auth0-muted-foreground` | `--color-muted-foreground` |
| `--auth0-destructive` | `--color-destructive` |
| `--auth0-input` | `--color-input` |
| `--auth0-ring` | `--color-ring` |

Radius variables (`--radius-sm` through `--radius-2xl`) use the same names in both paths.

---

## Required Override (Both Paths)

The extract-theme script generates a COMPLETE override block with ALL required variables. Without the full set (especially background, foreground, card), components render with incorrect colors (dark theme on light apps or vice versa).

The generated block includes sensible defaults for variables that couldn't be auto-detected from the project's CSS. Always apply the entire `data.generatedOverrideBlock` verbatim.

**Tailwind path — minimum required variables:**
```css
:root {
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --border: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
```

**Scoped path — minimum required variables:**
```css
:root {
  --auth0-primary: #0058A3;
  --auth0-primary-foreground: #ffffff;
  --auth0-background: #ffffff;
  --auth0-foreground: #1a1a1a;
  --auth0-card: #ffffff;
  --auth0-card-foreground: #000000;
  --auth0-border: #e5e5e5;
  --auth0-ring: #e5e5e5;
}
```

Without `--auth0-background` and `--auth0-card`, components will NOT inherit from your app — they use internal defaults which may be dark.

---

## Full Color Variables (Tailwind Path)

| Variable | Used for |
|---|---|
| `--primary` | Primary buttons, links, active states |
| `--primary-foreground` | Text on primary surfaces |
| `--background` | Page/container background |
| `--foreground` | Default text color |
| `--card` | Card surface background |
| `--card-foreground` | Text inside cards |
| `--secondary` | Secondary button background |
| `--secondary-foreground` | Text on secondary surfaces |
| `--muted` | Muted/disabled backgrounds |
| `--muted-foreground` | Placeholder text, secondary labels |
| `--accent` | Hover/highlight backgrounds |
| `--accent-foreground` | Text on hover highlights |
| `--destructive` | Error/delete actions |
| `--destructive-foreground` | Text on destructive surfaces |
| `--border` | Borders (cards, inputs, separators) |
| `--input` | Input field background |
| `--ring` | Focus ring color |
| `--popover` | Dropdown/dialog backgrounds |
| `--popover-foreground` | Text inside dropdowns/dialogs |

**Example (light + dark):**
```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
}
```

---

## Border Radius Variables

**Important:** Radius variables CANNOT be overridden via `:root` CSS — the theme's `[data-theme='default']` selector has higher specificity and overwrites them. You MUST use `themeSettings.variables.common` on `Auth0ComponentProvider` to override border radius.

| Variable | Default | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Tags, chips |
| `--radius-md` | `6px` | Small elements |
| `--radius-lg` | `10px` | Buttons, inputs |
| `--radius-xl` | `12px` | Cards |
| `--radius-2xl` | `14px` | Modals, large panels |

**How to override radius** (via `Auth0ComponentProvider`):
```tsx
<Auth0ComponentProvider
  themeSettings={{
    theme: 'default',
    mode: isDarkMode ? 'dark' : 'light',
    variables: {
      common: {
        '--radius-sm': '0px',
        '--radius-md': '0px',
        '--radius-lg': '0px',
        '--radius-xl': '0px',
        '--radius-2xl': '0px',
      },
    },
  }}
>
```

This is the ONLY reliable method. CSS `:root` declarations do not work because the internal `[data-theme='default']` selector overwrites them.

---

## Typography Variables

| Variable | Default | Used for |
|---|---|---|
| `--font-size-page-header` | `2.25rem` | Main page title |
| `--font-size-heading` | `1.5rem` | Section headings |
| `--font-size-title` | `1.25rem` | Card titles |
| `--font-size-body` | `1rem` | Body text |
| `--font-size-label` | `0.875rem` | Form labels |

---

## Theme Presets

Set on `Auth0ComponentProvider`:

| Preset | Description | Best for |
|---|---|---|
| `default` | Shadows, depth, standard look | Dashboard UIs |
| `minimal` | Flat, reduced shadows | Modern/clean apps |
| `rounded` | Larger border radii | Consumer-facing apps |

---

## Per-Component Styling

Use the `styling` prop for component-specific overrides:

```tsx
<UserMFAMgmt
  styling={{
    variables: {
      light: { '--primary': 'oklch(0.65 0.20 145)' },
      common: { '--radius-xl': '16px' },
    },
    classes: {
      'UserMFAMgmt-card': 'my-custom-class',
    },
  }}
/>
```

### Class Targets

| Component | Slots |
|---|---|
| `UserMFAMgmt` | `-card`, `-header`, `-list` |
| `OrganizationDetailsEdit` | `-card`, `-header` |
| `SsoProviderTable` | `-card`, `-header`, `-row` |
| `SsoProviderCreate` | `-card`, `-header` |
| `SsoProviderEdit` | `-card`, `-header` |
| `DomainTable` | `-card`, `-header`, `-row` |

---

## Dark Mode

Sync via `themeSettings.mode`:
```tsx
<Auth0ComponentProvider themeSettings={{ mode: isDarkMode ? 'dark' : 'light' }}>
```

Detection options:
- **next-themes:** `const { resolvedTheme } = useTheme()`
- **Media query:** `window.matchMedia('(prefers-color-scheme: dark)').matches`
- **React state:** custom toggle

When `mode === 'dark'`, components read from the `.dark` CSS block.

---

## Limitations

Customizable (~40%): colors, border radius, typography, shadows (via preset).

Not customizable: component dimensions, internal spacing, animation timing, icon sizes, internal layout.
