# Auth0 ACUL (Advanced Customization for Universal Login)

Build fully custom login/signup screens with your own code or framework, beyond what theme settings allow. Covers the multi-phase ACUL Screen Generator workflow (CLI auth, project setup, screen scaffolding, theme extraction, code generation, build validation, dev-mode wiring), the ACUL React + JS SDK APIs, the `auth0 acul` CLI commands, the full screen catalog, and social-login + theming patterns.

ACUL is CLI-driven by design: the CLI scaffolds and previews the screen *code*, which neither Terraform nor the MCP server can do — so this workflow uses the Auth0 CLI regardless of the project's other tooling. The one declarative piece is the tenant-side toggle that switches a screen's rendering mode to `advanced`, which an infrastructure-as-code project can manage with the Terraform `auth0_prompt_screen_renderer` resource (`rendering_mode`). The Auth0 MCP server exposes **no** ACUL/prompt-screen tool.

## Reference Hierarchy

Always resolve the correct reference for a screen using this priority order. **Before running the CLI**, check if the screen exists in auth0-acul-samples — if it does not, the CLI will fail.

```text
1. Check auth0-acul-samples availability first  (gate for CLI usage)
   → Check the Screen Catalog section in this group's guide for the Samples column
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

For which screens are in auth0-acul-samples → see the Screen Catalog section in this group's guide.


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

> **`index.tsx` must have a `export default`.** The project's screen registry (`src/utils/screen/screenLoader.ts`) loads each screen with `lazy(() => import('@/screens/<screen-name>'))`, and `React.lazy` resolves the module's **default** export. A named-only export (`export const <ScreenName>Screen`) compiles fine but renders blank / "screen not implemented" at runtime. See "Screen Registration" in this group's guide, Phase 6.

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

## Choose your task

You arrived here for the ACUL intent. The reference hierarchy, auth0-acul-samples architecture, and prerequisites above are shared by every ACUL task. From here, read the guide, which holds the full 9-phase generator workflow (environment validation, intent detection, project setup, screen requirements, tech stack, theme extraction, code generation, build validation, dev-mode wiring):

| Intent | Read |
|---|---|
| feature:acul | `Read: references/feature-acul/guide.md` |

**Then, as needed for your task:**
- SDK API + CLI reference (React `@auth0/auth0-acul-react` hooks + action functions, JS `@auth0/auth0-acul-js` manager classes, import paths, component structure, plus the full `auth0 acul` CLI command and flag reference — `init`, `screen add`, `config`, `dev`, typical workflows): `Read: references/feature-acul/api-reference.md`
- Screen catalog (all React + JS screens with samples availability and SDK URLs), social-login button patterns, and theming/design-token patterns live in the guide's Patterns section: `Read: references/feature-acul/guide.md`

Read only the reference (or references) your task needs — not all of them.
