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

For full screen list and fallback URLs → see the Screen Catalog section in this group's guide leaf.

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

For full screen list and fallback URLs → see the Screen Catalog section in this group's guide leaf.

---

## CLI Reference

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

**ON ERROR:** Fall back to SDK examples — see the Screen Catalog section in this group's guide leaf for URLs.

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
