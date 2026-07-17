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
