# Next.js Setup Guide

Setup for Next.js App Router using `@auth0/universal-components-react` in proxy mode.

---

## Environment Variables

Write to `.env.local` (merge with existing, don't overwrite):

```bash
AUTH0_SECRET=<generated-with-openssl-rand-hex-32>
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_SCOPE=openid profile email offline_access
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.us.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
```

Values come from the bootstrap script output (`data.env_vars`).

---

## Auth0 Client (Server-Side)

```tsx
// src/lib/auth0.ts
import { Auth0Client } from '@auth0/nextjs-auth0/server';

export const auth0 = new Auth0Client({
  httpTimeout: 20000,
  authorizationParameters: {
    scope: process.env.AUTH0_SCOPE || 'openid profile email offline_access',
    audience: `https://${process.env.AUTH0_DOMAIN}/my-org/`,
  },
});
```

Omit `audience` if only using `UserMFAMgmt` (no organization components).

---

## Middleware

Check if `src/middleware.ts` exists first. If it does, compose with existing logic.

```tsx
// src/middleware.ts
import type { NextRequest } from 'next/server';
import { auth0 } from './lib/auth0';

export async function middleware(request: NextRequest) {
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
```

---

## Client Provider

```tsx
// src/providers/client-provider.tsx
'use client';

import { Auth0ComponentProvider } from '@auth0/universal-components-react/rwa';
import React, { useState, useEffect } from 'react';

function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDark;
}

export function ClientProvider({ children }: { children: React.ReactNode }) {
  const isDarkMode = useDarkMode();

  return (
    <Auth0ComponentProvider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      mode="proxy"
      proxyConfig={{ baseUrl: '/' }}
      themeSettings={{
        mode: isDarkMode ? 'dark' : 'light',
        theme: 'default',
        variables: {
          common: {
            // Border radius — MUST be set here, not in CSS (theme selector overwrites CSS)
            // Values come from extract-theme.mjs output: data.themeSettingsVariables.common
          },
        },
      }}
    >
      {children}
    </Auth0ComponentProvider>
  );
}
```

Key props for proxy mode:
- `domain` — from `NEXT_PUBLIC_AUTH0_DOMAIN`
- `mode` — must be `"proxy"`
- `proxyConfig` — `{ baseUrl: '/' }` routes API calls through Next.js middleware
- `themeSettings.mode` — sync with app's dark mode

---

## Layout Integration

Wire into root layout. Nest inside any existing providers:

```tsx
// src/app/layout.tsx
import { Auth0Provider } from '@auth0/nextjs-auth0';
import { ClientProvider } from '@/providers/client-provider';
import '@auth0/universal-components-react/styles';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Auth0Provider>
          <ClientProvider>
            {children}
          </ClientProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
```

**Provider hierarchy:**
```
Auth0Provider (@auth0/nextjs-auth0)
  └── ClientProvider ('use client')
        └── Auth0ComponentProvider (/rwa, mode="proxy")
              └── Pages
```

---

## Stylesheet

**Tailwind v4** (`cssPath === "tailwind"`):
```css
/* globals.css */
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
// In layout.tsx
import '@auth0/universal-components-react/styles';
```

---

## Proxy Mode Architecture

Components make API calls → Next.js middleware intercepts → attaches server-side session token → proxies to Auth0 → response flows back. The browser never sees raw access tokens.

---

## Dev Server

```bash
npm run dev
```

Ensure Auth0 app settings include:
- Callback URL: `http://localhost:3000/auth/callback`
- Logout URL: `http://localhost:3000`
