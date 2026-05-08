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
| `saveAction` | `{ onClick?: () => void }` | — | Custom save action |
| `cancelAction` | `{ onClick?: () => void }` | — | Custom cancel action |
| `backButton` | `{ onClick?: () => void }` | — | Back navigation |
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
| `backButton` | `{ onClick?: () => void }` | — | Back navigation |
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
| `backButton` | `{ onClick?: () => void }` | — | Back navigation |
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
| `createAction` | `{ onClick?: () => void }` | — | Create provider action |
| `editAction` | `{ onClick?: (provider: SsoProvider) => void }` | — | Edit provider action |
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
| `createAction` | `{ onClick?: () => void }` | — | Add domain |
| `verifyAction` | `{ onClick?: (domain: Domain) => void }` | — | Verify domain |
| `deleteAction` | `{ onClick?: (domain: Domain) => void }` | — | Delete domain |
| `associateToProviderAction` | `{ onClick?: (domain: Domain) => void }` | — | Associate to SSO |
| `deleteFromProviderAction` | `{ onClick?: (domain: Domain) => void }` | — | Remove from SSO |
| `onErrorAction` | `(error: Error, action: string) => void` | — | Error callback |
| `onBeforeAction` | `(action: string) => boolean` | — | Pre-action hook |

---

## Common Types

```typescript
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
