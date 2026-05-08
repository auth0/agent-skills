# React SPA Setup Guide

Setup for React SPAs (Vite, CRA) using `@auth0/universal-components-react` in SPA mode.

---

## Environment Variables

Write to `.env.local` or `.env` (merge, don't overwrite):

**Vite:**
```bash
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://your-tenant.us.auth0.com/my-org/
```

**Create React App:**
```bash
REACT_APP_AUTH0_DOMAIN=your-tenant.us.auth0.com
REACT_APP_AUTH0_CLIENT_ID=your-client-id
REACT_APP_AUTH0_AUDIENCE=https://your-tenant.us.auth0.com/my-org/
```

Values come from the bootstrap script output (`data.env_vars`).

---

## Installation

**shadcn (when `components.json` exists):**
```bash
npx shadcn@latest add https://auth0-ui-components.vercel.app/r/my-account.json
npx shadcn@latest add https://auth0-ui-components.vercel.app/r/my-organization.json
```

**npm (when no `components.json`):**
```bash
<installCmd> @auth0/universal-components-react @auth0/auth0-react
```

---

## Stylesheet

**Tailwind v4** (`cssPath === "tailwind"`):
```css
/* src/index.css or src/app.css */
@import "tailwindcss";
@import "@auth0/universal-components-react/tailwind";
@import "@auth0/universal-components-core/styles/globals.css";
```

If the project does NOT already have a `@theme inline` block that maps `--color-*` to bare variables (shadcn projects already have this), add one:
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

**No Tailwind or Tailwind v3** (`cssPath === "scoped"`):
```tsx
// In entry file (main.tsx)
import '@auth0/universal-components-react/styles';
```

shadcn adds the stylesheet import automatically during installation.

---

## Auth0Provider

Read existing entry file first. If `Auth0Provider` already exists, reuse it.

```tsx
// src/main.tsx (Vite)
import { Auth0Provider } from '@auth0/auth0-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@auth0/universal-components-react/styles';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      useMrrt={true}
    >
      <App />
    </Auth0Provider>
  </StrictMode>,
);
```

Key props:
- `audience` — required for organization components. Set to `https://{domain}/my-org/`. Omit if only using `UserMFAMgmt`.
- `cacheLocation="localstorage"` — persist tokens across page refreshes
- `useRefreshTokens={true}` — enable refresh token rotation
- `useMrrt={true}` — multi-resource refresh tokens

---

## Auth0ComponentProvider

```tsx
// src/App.tsx
import { Auth0ComponentProvider } from '@auth0/universal-components-react/spa';

function App() {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

  return (
    <Auth0ComponentProvider
      i18n={{ currentLanguage: 'en-US' }}
      themeSettings={{
        theme: 'default',
        mode: isDarkMode ? 'dark' : 'light',
        variables: {
          common: {
            // Border radius — MUST be set here, not in CSS (theme selector overwrites CSS)
            // Values come from extract-theme.mjs output: data.themeSettingsVariables.common
          },
          light: {
            // Color overrides (optional — CSS :root block already handles colors)
          },
        },
      }}
      toastSettings={{ provider: 'sonner' }}
    >
      {/* Routes and components */}
    </Auth0ComponentProvider>
  );
}
```

Props:
| Prop | Type | Description |
|---|---|---|
| `i18n` | `{ currentLanguage: string }` | `'en-US'` or `'ja'` |
| `themeSettings` | `ThemeInput` | Theme mode, variant, variables |
| `toastSettings` | `{ provider: 'sonner' }` | Toast notifications |
| `loader` | `ReactNode` | Loading indicator |

**Provider hierarchy:**
```
Auth0Provider (@auth0/auth0-react)
  └── Auth0ComponentProvider (/spa)
        └── Components
```

---

## Dev Server

```bash
npm run dev   # Vite: http://localhost:5173
npm start     # CRA: http://localhost:3000
```

Ensure Auth0 app settings include:
- Callback URL: `http://localhost:<port>`
- Logout URL: `http://localhost:<port>`
- Allowed Web Origins: `http://localhost:<port>`
