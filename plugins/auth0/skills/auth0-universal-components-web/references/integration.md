# Integration Guide

Implementation patterns, callbacks, i18n, error handling, and protected routes.

---

## Provider Hierarchy

**React SPA:**
```
Auth0Provider (@auth0/auth0-react)
  └── Auth0ComponentProvider (@auth0/universal-components-react/spa)
        └── Components
```

**Next.js (proxy mode):**
```
Auth0Provider (@auth0/nextjs-auth0)
  └── ClientProvider ('use client')
        └── Auth0ComponentProvider (/rwa, mode="proxy")
              └── Components
```

In proxy mode, API calls route through Next.js middleware. Access tokens never reach the browser.

---

## Page Layout

Auth0 components manage their own internal layout. Place them in a simple container matching the app's existing page patterns:

```tsx
<div className="max-w-2xl mx-auto space-y-6">
  <h1 className="text-2xl font-semibold">Security Settings</h1>
  <UserMFAMgmt />
</div>
```

Read 2-3 existing pages in the app before creating component pages — match headers, containers, spacing patterns.

---

## Component Usage Examples

### UserMFAMgmt

```tsx
import { UserMFAMgmt } from '@auth0/universal-components-react';

function SecurityPage() {
  return (
    <UserMFAMgmt
      onEnroll={() => console.log('Factor enrolled')}
      onDelete={() => console.log('Factor deleted')}
      onErrorAction={(error, action) => console.error(`${action} failed:`, error)}
    />
  );
}
```

### SsoProviderTable + Create + Edit (Navigation Pattern)

```tsx
// React SPA with react-router
import { SsoProviderTable } from '@auth0/universal-components-react';
import { useNavigate } from 'react-router-dom';

function SsoPage() {
  const navigate = useNavigate();
  return (
    <SsoProviderTable
      createAction={{ onClick: () => navigate('/sso/create') }}
      editAction={{ onClick: (provider) => navigate(`/sso/edit/${provider.id}`) }}
    />
  );
}
```

```tsx
// Next.js
'use client';
import { SsoProviderTable } from '@auth0/universal-components-react';
import { useRouter } from 'next/navigation';

export default function SsoPage() {
  const router = useRouter();
  return (
    <SsoProviderTable
      createAction={{ onClick: () => router.push('/sso/create') }}
      editAction={{ onClick: (provider) => router.push(`/sso/edit/${provider.id}`) }}
    />
  );
}
```

### SsoProviderEdit (Dynamic Route)

```tsx
// Next.js: src/app/sso/edit/[id]/page.tsx
'use client';
import { SsoProviderEdit } from '@auth0/universal-components-react';
import { useRouter, useParams } from 'next/navigation';

export default function EditSsoPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  return <SsoProviderEdit connectionId={id} backButton={{ onClick: () => router.push('/sso') }} />;
}
```

---

## Server vs Client Components (Next.js)

Universal components are **client components** — they use hooks and browser APIs.

Rules:
- All Auth0 component files need `'use client'` at the top
- Server components can render Auth0 components as children
- `Auth0ComponentProvider` must be in a client component wrapper

---

## Event Callbacks

All components support:

| Callback | Signature | Purpose |
|---|---|---|
| `onErrorAction` | `(error: Error, action: string) => void` | API error notification |
| `onBeforeAction` | `(action: string, ...args) => boolean` | Return `false` to cancel action |

Additional per-component callbacks:
- `UserMFAMgmt`: `onEnroll`, `onDelete`, `onFetch`
- `OrganizationDetailsEdit`: `saveAction`, `cancelAction`, `backButton`
- `SsoProviderTable`: `createAction`, `editAction`
- `SsoProviderCreate`: `backButton`
- `SsoProviderEdit`: `backButton`
- `DomainTable`: `createAction`, `verifyAction`, `deleteAction`

---

## Internationalization (i18n)

```tsx
<Auth0ComponentProvider
  i18n={{
    currentLanguage: 'en-US',    // 'en-US' or 'ja'
    fallbackLanguage: 'en-US',
  }}
>
```

Override specific strings per component:
```tsx
<UserMFAMgmt
  customMessages={{
    title: 'Multi-Factor Authentication',
    description: 'Manage your security factors',
    enroll: 'Add Factor',
  }}
/>
```

---

## Toast Notifications

Components use toasts for success/error feedback. Configure on the provider:

```tsx
// Built-in sonner (default)
<Auth0ComponentProvider toastSettings={{ provider: 'sonner' }}>

// Custom toast provider
<Auth0ComponentProvider
  toastSettings={{
    provider: 'custom',
    methods: {
      success: (message) => myToast.success(message),
      error: (message) => myToast.error(message),
    },
  }}
>
```

---

## Protected Routes

**React SPA:**
```tsx
import { useAuth0 } from '@auth0/auth0-react';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) { loginWithRedirect(); return null; }
  return children;
}
```

**Next.js:** Middleware handles authentication. Pages are protected by default when middleware is configured.

---

## Error Handling

Provider-level errors (session expired, network failure) are handled by `Auth0ComponentProvider` internally. Component-level errors surface via the `onErrorAction` callback.

Common error scenarios:
| Error | Cause | Fix |
|---|---|---|
| 401 Unauthorized | Session expired | User re-authenticates automatically |
| 403 Forbidden | Missing role/permissions | Assign admin role to user in organization |
| Network error | API unreachable | Check middleware config (Next.js) or CORS (SPA) |

---

## Auth0 Tenant Requirements

| Feature | Requires |
|---|---|
| `UserMFAMgmt` | My Account API + MFA methods enabled in Dashboard |
| Organization components | My Organization API + client grant + admin role + organization membership |

The bootstrap script configures all of this automatically.
