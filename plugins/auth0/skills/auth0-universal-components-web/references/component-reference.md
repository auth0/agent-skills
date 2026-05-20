# Component Reference

Props, types, and import paths for all 6 universal components.

**Import paths:**
```tsx
// Components (all npm setups): import { X } from '@auth0/universal-components-react';
// Auth0ComponentProvider (SPA): import { Auth0ComponentProvider } from '@auth0/universal-components-react/spa';
// Auth0ComponentProvider (Next.js): import { Auth0ComponentProvider } from '@auth0/universal-components-react/rwa';
// shadcn: import { X } from '@/components/auth0/...';
```

The `/spa` and `/rwa` sub-paths export **only** `Auth0ComponentProvider`. All components come from the main entry `@auth0/universal-components-react`.

## Default Headings Rendered

Each component renders text headings inside its scope. When the host page already has a title matching any of these (e.g. a TopBar showing "Settings"), `hideHeader` alone won't fix the duplicate — you also need `customMessages` to rename the matching section. **Run a verbatim string comparison between the host's page title and this list before declaring placement done.**

| Component | Default headings (en-US) | `customMessages` path to rename |
|---|---|---|
| `UserMFAMgmt` | "Multi-Factor Authentication methods" | `customMessages={{ title: '...' }}` (flat) |
| `OrganizationDetailsEdit` | Page header: org display name. Sections: "Settings", "Branding" | `customMessages.details.sections.settings.title` / `...branding.title` |
| `SsoProviderTable` | "Single Sign-On" | `customMessages.tab.title` (check `SsoProviderTabMessages`) |
| `SsoProviderCreate` | "Add a Provider", "Select Your Identity Provider", "Provider Details", "Configure Provider", "Advanced Settings", "Mapping" | `customMessages.<step>.title` (check `SsoProviderCreateMessages`) |
| `SsoProviderEdit` | Page header: provider name. Sections: "Provider Details", "Configure Provider", "Mapping", "Provisioning" | `customMessages.<section>.title` (check `SsoProviderEditMessages`) |
| `DomainTable` | "Domains" | `customMessages.title` (check `DomainTableMessages`) |

When the exact override path isn't shown above, find it with:
```bash
grep -B 1 -A 30 "interface <Name>Messages" \
  node_modules/@auth0/universal-components-core/dist/index.d.mts
```

---

## Action Prop Shapes (Read This First)

Three different action shapes exist — passing the wrong handler key (`onClick` vs `onAfter`) silently no-ops. The component does nothing on click and you'll waste a debug cycle inspecting the bundle.

```typescript
// Used by: createAction, editAction, deleteAction, saveAction, cancelAction,
// verifyAction, associateToProviderAction, deleteFromProviderAction, etc.
// — basically every "*Action" prop on the component prop tables below.
interface ComponentAction<Item = void, Context = void> {
  disabled?: boolean;
  onBefore?: (item: Item, context?: Context) => boolean;             // return false to cancel default
  onAfter?: (item: Item, context?: Context) => void | boolean | Promise<boolean>;
}

// Used by: backButton (only this).
interface BackButton {
  icon?: unknown;
  onClick: (e: Event) => void;
}

// Used by: standalone action buttons inside table rows / headers when you build them yourself.
interface ActionButton<Item = void> {
  label: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon';
  icon?: unknown;
  onClick: Item extends void ? (event: Event) => void : (data: Item) => void | boolean | Promise<boolean>;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}
```

**Rule of thumb.** If the prop name ends with `Action` and isn't `backButton`, it's a `ComponentAction` — use `onAfter` for "navigate after the click", `onBefore` to gate or cancel the default. Only `backButton` and explicit `ActionButton` slots use `onClick`.

```tsx
// CORRECT — table create/edit
<SsoProviderTable
  createAction={{ onAfter: () => navigate('/sso/new') }}
  editAction={{ onAfter: (provider) => navigate(`/sso/${provider.id}`) }}
/>

// CORRECT — back button
<SsoProviderEdit
  connectionId={id}
  backButton={{ onClick: () => navigate('/sso') }}
/>

// WRONG — silently ignored
<SsoProviderTable createAction={{ onClick: () => navigate('/sso/new') }} />
```

When in doubt, grep the type:
```bash
grep -B 1 -A 10 "interface ComponentAction\|interface BackButton" \
  node_modules/@auth0/universal-components-core/dist/index.d.mts
```

---

## UserMFAMgmt

MFA factor enrollment and management.

```tsx
import { UserMFAMgmt } from '@auth0/universal-components-react';
// shadcn: import { UserMFAMgmt } from '@/components/auth0/my-account/user-mfa-management';
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `schema` | `{ email?: RegExp; phone?: RegExp }` | — | Validation patterns |
| `customMessages` | `Partial<MFAMessages>` | `{}` | i18n text overrides |
| `styling` | `StylingConfig` | — | Per-component styling |
| `readOnly` | `boolean` | `false` | View-only mode |
| `hideHeader` | `boolean` | `false` | Hide header |
| `showActiveOnly` | `boolean` | `false` | Show only enrolled factors |
| `disableEnroll` | `boolean` | `false` | Disable new enrollments |
| `disableDelete` | `boolean` | `false` | Disable deletions |
| `factorConfig` | `Record<string, { visible?: boolean; enabled?: boolean }>` | — | Per-factor control |
| `onEnroll` | `() => void` | — | After successful enrollment |
| `onDelete` | `() => void` | — | After successful deletion |
| `onFetch` | `() => void` | — | After factors loaded |
| `onErrorAction` | `(error: Error, action: string) => void` | — | On API error |
| `onBeforeAction` | `(action: string, factorType?: string) => boolean` | — | Return false to cancel |

**Factor types:** `sms`, `totp`, `email`, `push-notification`, `webauthn-platform`, `webauthn-roaming`, `recovery-code`, `duo`

**Does NOT require `audience`** — works without organization API access.

---

## OrganizationDetailsEdit

Edit organization name and display name.

```tsx
import { OrganizationDetailsEdit } from '@auth0/universal-components-react';
// shadcn: import { OrganizationDetailsEdit } from '@/components/auth0/my-organization/organization-details-edit';
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `schema` | `object` | — | Zod validation overrides |
| `customMessages` | `Partial<OrgDetailsMessages>` | `{}` | i18n text |
| `styling` | `StylingConfig` | — | Styling |
| `readOnly` | `boolean` | `false` | View-only |
| `hideHeader` | `boolean` | `false` | Hide header |
| `saveAction` | `ComponentAction` | — | `onBefore` to gate save; `onAfter` to react after a successful save (e.g. show a toast) |
| `cancelAction` | `ComponentAction` | — | `onAfter` runs when the user cancels |
| `backButton` | `BackButton` (uses `onClick`) | — | Back navigation |
| `onErrorAction` | `(error: Error, action: string) => void` | — | Error callback |
| `onBeforeAction` | `(action: string) => boolean` | — | Pre-action hook |

**Requires `audience`** set to `https://{domain}/my-org/`.

---

## SsoProviderCreate

Multi-step wizard for creating SSO identity providers. Supports Okta, ADFS, SAML, OIDC, Google Workspace, Azure AD, PingFederate.

```tsx
import { SsoProviderCreate } from '@auth0/universal-components-react';
// shadcn: import { SsoProviderCreate } from '@/components/auth0/my-organization/sso-provider-create';
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `customMessages` | `Partial<SsoCreateMessages>` | `{}` | i18n text |
| `styling` | `StylingConfig` | — | Styling |
| `backButton` | `BackButton` (uses `onClick`) | — | Back navigation |
| `onErrorAction` | `(error: Error, action: string) => void` | — | Error callback |
| `onBeforeAction` | `(action: string) => boolean` | — | Pre-action hook |

---

## SsoProviderEdit

Edit existing SSO provider configuration.

```tsx
import { SsoProviderEdit } from '@auth0/universal-components-react';
// shadcn: import { SsoProviderEdit } from '@/components/auth0/my-organization/sso-provider-edit';
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `connectionId` | `string` | **Required** | SSO connection ID to edit |
| `customMessages` | `Partial<SsoEditMessages>` | `{}` | i18n text |
| `styling` | `StylingConfig` | — | Styling |
| `backButton` | `BackButton` (uses `onClick`) | — | Back navigation |
| `onErrorAction` | `(error: Error, action: string) => void` | — | Error callback |
| `onBeforeAction` | `(action: string) => boolean` | — | Pre-action hook |

---

## SsoProviderTable

List and manage SSO identity providers.

```tsx
import { SsoProviderTable } from '@auth0/universal-components-react';
// shadcn: import { SsoProviderTable } from '@/components/auth0/my-organization/sso-provider-table';
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `customMessages` | `Partial<SsoTableMessages>` | `{}` | i18n text |
| `styling` | `StylingConfig` | — | Styling |
| `readOnly` | `boolean` | `false` | View-only |
| `createAction` | `ComponentAction` | — | Use `onAfter: () => navigate('/sso/new')` to send the user to a create view. `onClick` does NOT exist here |
| `editAction` | `ComponentAction<SsoProvider>` | — | Use `onAfter: (provider) => navigate(...)`. `onClick` does NOT exist here |
| `onErrorAction` | `(error: Error, action: string) => void` | — | Error callback |
| `onBeforeAction` | `(action: string) => boolean` | — | Pre-action hook |

---

## DomainTable

Manage verified organization domains.

```tsx
import { DomainTable } from '@auth0/universal-components-react';
// shadcn: import { DomainTable } from '@/components/auth0/my-organization/domain-table';
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `customMessages` | `Partial<DomainMessages>` | `{}` | i18n text |
| `styling` | `StylingConfig` | — | Styling |
| `readOnly` | `boolean` | `false` | View-only |
| `createAction` | `ComponentAction` | — | Use `onAfter` (not `onClick`) — see Action Prop Shapes |
| `verifyAction` | `ComponentAction<Domain>` | — | `onBefore`/`onAfter` |
| `deleteAction` | `ComponentAction<Domain>` | — | `onBefore`/`onAfter` |
| `associateToProviderAction` | `ComponentAction<Domain>` | — | `onBefore`/`onAfter` |
| `deleteFromProviderAction` | `ComponentAction<Domain>` | — | `onBefore`/`onAfter` |
| `onErrorAction` | `(error: Error, action: string) => void` | — | Error callback |
| `onBeforeAction` | `(action: string) => boolean` | — | Pre-action hook |

---

## Common Types

```typescript
// Action prop shapes — see "Action Prop Shapes" section above for usage examples.
interface ComponentAction<Item = void, Context = void> {
  disabled?: boolean;
  onBefore?: (item: Item, context?: Context) => boolean;
  onAfter?: (item: Item, context?: Context) => void | boolean | Promise<boolean>;
}

interface BackButton {
  icon?: unknown;
  onClick: (e: Event) => void;
}

interface StylingConfig {
  variables?: {
    common?: Record<string, string>;
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
  classes?: Record<string, string>;
}

interface ThemeInput {
  mode?: 'light' | 'dark';
  theme?: 'default' | 'minimal' | 'rounded';
  variables?: StylingConfig['variables'];
}
```

---

## Organization Components API Requirement

All organization components (`OrganizationDetailsEdit`, `SsoProviderCreate`, `SsoProviderEdit`, `SsoProviderTable`, `DomainTable`) require:
- `audience` set to `https://{domain}/my-org/` on `Auth0Provider` (SPA) or in Auth0Client config (Next.js)
- User must have `admin` role in the organization
- My Organization API must be configured on the tenant (done by bootstrap script)

`UserMFAMgmt` works without the `audience` — it only needs the My Account API.
