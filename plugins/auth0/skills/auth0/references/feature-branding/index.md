
# Auth0 Branding

Style Auth0 Universal Login to match a brand. Covers the theme (colors, typography, borders, widget layout), tenant-level branding settings (logo, favicon, primary color), page templates (Liquid HTML that wraps the widget), and custom text per screen.

## Capabilities

When this skill is invoked **with a specific intent** in the opening message (e.g., "brand my tenant from ferrari.com", "reset the theme", "check if Universal Login is on"), parse the intent and route directly to the matching capability below. Do not show a picker.

When this skill is invoked **without intent** (bare `/auth0-branding`, or a vague "help me with branding"), show the table below and ask in one line: "Pick a number, name one, or describe what you want." Parse the reply — accept `1`, `"brand my tenant"`, or `"make it look like acme.com"` equivalently.

| # | Capability | What it does |
|---|---|---|
| 1 | **Brand my tenant** | Style Universal Login end-to-end from a website I own, brand assets I have, or manual input. Colors, logo, typography, page layout, and (optionally) login text voice, applied together |
| 2 | **Change specific settings** | Update individual pieces directly: a logo, color, font, corner radius, background, button label, or the page template. No URL extraction or asset parsing needed |
| 3 | **Match my brand voice** | Rewrite Universal Login text to sound like a source I provide: my website, sample copy, or a voice descriptor. Text only; doesn't touch colors or layout |
| 4 | **Rollback to Auth0 defaults** | Pick what to clear: tenant branding settings, the theme, the page template, or custom text on specific prompts |
| 5 | **Check my setup** | Verify that login, signup, password reset, and MFA are actually running Universal Login on my tenant and not Classic. Safe read-only starter |

The **Prerequisites** section applies to all capabilities.

## Prompt style

Prefer free-text prompts. The skill should parse natural replies, not force clicks. Use `AskUserQuestion` **only** when one of these applies:

1. **Multi-select of non-obvious options** where seeing the full list helps the user (e.g., Capability 3's flow categories — user won't remember the full set off the top of their head).
2. **Destructive-path safety gate** (e.g., Capability 4's "save a backup before reset?" yes/no).
3. **Disambiguation between 3+ distinct paths with meaningful trade-offs** the user wouldn't know by heart.

Everything else is free text. Specifically:

- **Review prompts** ("proceed? apply / edit / cancel, or tell me what to change") are free text. Parse the reply. If the reply names specific changes, apply them inline and re-render the proposal; don't make the user click through an edit submenu.
- **"Paste a value"** asks (hex code, URL, font name) are free text. Don't wrap single-field input in a picker.
- **Capability routing at entry** is free text. See the paragraph above the capabilities table.

Discoverability cue: every proposal must list the editable knobs inline, including **"off by default"** ones (voice rewriting, page template, layout override). Users can't ask to edit what they don't know exists. The "Also available" block under the main proposal in Capability 1 is the canonical pattern.

Don't auto-run optional steps (e.g., voice-flow detection, Brandfetch lookup on an unverified domain). Ask first whether the user wants to list, detect, or pick.

## Plan mode

When Claude Code is in plan mode, the skill's writes — PATCH/PUT/DELETE/POST against the Management API, plus local file writes (backup JSON, Brandfetch key) — are held until the plan is approved.

**What's allowed:**
- GETs against the Management API (loading current theme, branding, custom text, prompts, connections, tenant settings). These drive the proposal and diagnostics.
- LLM-only work: voice classification, translation generation, proposal rendering.
- Capability 5 runs unchanged; it's already read-only.

**What's deferred:**
- All Management API writes (no PATCH/PUT/DELETE/POST).
- Local file writes: Capability 4 backup JSON, Capability 1 Brandfetch-key save.
- `auth0 test login` (it starts an auth flow in a browser — not a tenant mutation, but a side effect; defer it along with the writes).

**Still do the interactive asks.** The Brandfetch-key prompt in Capability 1, the source/screens/locale prompts in Capability 3, the surface/backup prompts in Capability 4 — all still happen. Plan mode defers *execution*, not *intent gathering*. For any ask whose answer triggers a write (e.g., "paste a Brandfetch key"), collect the answer and note in the plan "will save to `${XDG_CONFIG_HOME:-$HOME/.config}/auth0-branding/brandfetch.key` on approval."

**Plan contents.** Produce a complete plan covering:
- Target tenant (from `auth0 tenants list`) and the active-tenant confirmation.
- Every concrete API call the skill will make, in order: method, path, and a summary of the body (full payloads for small objects like `PATCH /branding`; key names + change counts for large ones like the merged theme object or custom-text PUTs).
- Every local file write, with absolute path.
- Scope pre-check outcome for Capability 4, so scope failures surface before approval.
- The post-apply `auth0 test login` step, if applicable.

Then call `ExitPlanMode`.

**After approval.** Normal execution resumes. All existing gates still apply: active-tenant confirmation, production-write confirmation, WCAG contrast warnings, template-tag validation, merge-before-PUT for custom text, scope checks for destructive operations.

## Verify in browser (post-apply)

After **any capability writes to the tenant** (capabilities 1–4), offer to open the live Universal Login page so the user can see the result immediately. Free-text prompt, not a picker:

> Open the login page in a browser to verify? (yes / no)

If **yes**: run `auth0 test login` on the active tenant. The CLI starts an authorization code flow against the default app and opens the browser. If the environment is headless or the browser fails to open, the CLI prints the authorize URL to stdout — capture it and pass it to the user to open manually.

If **no**: end with the summary of what was written.

Notes:
- This applies to Capability 1 (Brand my tenant), Capability 2 (Change specific settings), Capability 3 (Match my brand voice), and Capability 4 (Rollback to Auth0 defaults). In the rollback case, the browser page should render Auth0's built-in defaults — that's the verification.
- Capability 5 (Check my setup) is read-only; skip this step.
- If the user has a preferred client they test against, they'll mention it; `auth0 test login <id>` targets a specific app. Otherwise use the default.

## Key Concepts

| Concept | Description |
|---|---|
| Theme | Visual settings (colors, fonts, borders, widget layout, backgrounds) applied to Universal Login. Auth0 currently renders only the default theme; additional themes can be created via the API but are not used by Universal Login |
| Branding Settings | Tenant-level logo, favicon, primary color, and page background color |
| Page Template | Custom HTML using Liquid syntax that wraps the login widget; requires a custom domain |
| Text Customization | Per-prompt, per-screen, per-language text overrides on Universal Login pages |
| Custom Text Variables | Customer-defined keys (prefixed `var-`) in the Custom Text API, referenced from templates and partials as camelCase |
| Custom Domain | Required for page templates; maps your domain to Auth0's login pages |
| Universal Login vs Classic | Tenants can render each flow (login/signup, password reset, MFA) in either experience. Theme, template, and no-code editor only apply to flows running Universal Login |

## Prerequisites

These apply to any capability that writes to the tenant. "Check my setup" is read-only and can be run first to verify these are in place.

### CLI Tenant Context (if using the `auth0` CLI)

The Auth0 CLI is authenticated to **one tenant at a time**. All `auth0 ...` commands run against whichever tenant the CLI is currently logged into:

```bash
auth0 tenants list       # shows all tenants; the active one is marked with →
auth0 tenants use <name> # switch active tenant; prompts for browser login if not already authenticated
```

**Before any write operation in any capability, run `auth0 tenants list`, show the active tenant to the user, and get explicit confirmation to proceed.** If it's the wrong tenant, stop. Tell the user to run `auth0 tenants use <name>` (or `auth0 login` if the target isn't in the list) themselves and re-invoke the skill. Do not try to switch tenants on the user's behalf.

For non-interactive or multi-tenant automation, skip the CLI and call the **Management API** directly with an explicit domain + bearer token per call. (see the cURL examples section below)

**Tooling note.** The `auth0 ul` commands below are one way to write branding settings. The loaded tooling reference has the equivalent for infrastructure-as-code projects: the Terraform `auth0_branding` resource (`logo_url`, `favicon_url`, `colors` block). The Auth0 MCP server exposes **no** branding/Universal Login tool — for an MCP-only session, fall back to the CLI, Terraform, or the Management API directly. This interactive branding workflow (extract → propose → apply) stays CLI/API-driven regardless, because it is a guided flow rather than a static config write.

### Universal Login Active for the Flows You Want to Brand

Themes and templates only apply to flows actually running in Universal Login. Tenants can run in hybrid mode where some flows are Classic. Run Capability 5 ("Check my setup") to diagnose which flows will and won't be affected. (see the Check Setup section below for the Classic-toggle mechanics)

### Custom Domain (only if working with page templates)

Page templates require a custom domain on the tenant. Branding settings, theme, and text customization do not. If the task involves page templates and no custom domain is configured, set up a custom domain first (custom domains, feature:custom-domains).

## Capability 1: Brand my tenant

End-to-end branding from a website URL, inline brand values, or a short ask — fills primary color, logo, font, and page background, shows one proposal, and applies the theme.

**See the Brand My Tenant section below.**

## Capability 2: Change specific settings

Manual branding update driven by the user's natural-language intent — the skill resolves the phrase to specific fields, stages changes, and applies as a batch.

**See the Change Specific Settings section below.**

## Capability 3: Match my brand voice

Rewrite Universal Login text to match a source the user provides (website, sample copy, or voice descriptor); doesn't touch colors, layout, or logo.

**See the Match Brand Voice section below.**

## Capability 4: Rollback to Auth0 defaults

Clear one or more branding surfaces and restore Auth0's defaults, per-surface. Destructive; always confirms before writing.

**See the Rollback section below.**

## Capability 5: Check my setup

Read-only diagnosis. Answers "will theme changes actually show up on the flows I care about?" Safe to run first when diagnosing "why doesn't my theme show up?"

**See the Check Setup section below.**

## Common Mistakes

| Mistake | What to Do Instead |
|---|---|
| Creating additional themes via `POST /branding/themes` (Universal Login only renders the default theme; POSTed themes exist but never apply) | Always update the default theme: `GET /branding/themes/default`, then PATCH by its `themeId` |
| Sending a partial PATCH on a theme (PATCH requires all top-level sections) | GET the theme, apply your changes, then PATCH with the full object |
| Theme or page template changes do not appear on login/reset/MFA (a tenant-wide toggle is forcing that flow into Classic) | Run "Check my setup". Fix the offending tenant toggle: `universal_login_experience: classic` (login/signup), `change_password.enabled: true` (reset), or `guardian_mfa_page.enabled: true` (MFA) |
| Missing `auth0:head` or `auth0:widget` in templates (both are required; the page will not render without them) | Always include both; refuse the PUT otherwise |
| Using PUT for custom text without merging (PUT replaces all text for that prompt/language) | GET current text first, merge, then PUT the full object |

For the extended list (theme field requirements, Brandfetch ToS, homepage-only extraction gaps, CSS class names, CLI tenant context), see the API Reference section below.

## References

This file contains all branding guidance inline. Sections: Brand My Tenant · Change Specific Settings · Match Brand Voice · Rollback · Check Setup · API Reference · Examples.

Related capabilities:

- Custom domains, required for page templates (custom domains, feature:custom-domains)
- Organization-specific branding for B2B multi-tenancy (Organizations, feature:organizations)
- Custom login-flow logic via Auth0 Actions
- Advanced Customizations for Universal Login (ACUL) — build fully custom screens beyond what theme + template can do (ACUL, feature:acul)

External:

- [Customize Universal Login](https://auth0.com/docs/customize/login-pages/universal-login)
- [Customize Themes](https://auth0.com/docs/customize/login-pages/universal-login/customize-themes)
- [Customize Page Templates](https://auth0.com/docs/customize/login-pages/universal-login/customize-templates)
- [Customize Text Elements](https://auth0.com/docs/customize/login-pages/universal-login/customize-text-elements)
- [Branding API Reference](https://auth0.com/docs/api/management/v2/branding)
- [Brandfetch Brand API](https://docs.brandfetch.com/brand-api/overview)
- [Brandfetch Logo API Guidelines](https://docs.brandfetch.com/logo-api/guidelines)

---

# Auth0 Branding: API Reference

The endpoints, CLI commands, and agent-only rules the branding capabilities
execute. Auth0 Branding has no SDK — all configuration is through the Management
API (or the `auth0` CLI, which wraps it). Exhaustive schemas (every theme
property, every template variable, full request/response bodies) live in the
Auth0 docs via the pointers below; this file keeps only what the agent must send
or decide.

## Management API Endpoints

| Method | Path | Scope |
|--------|------|-------|
| GET / PATCH | `/api/v2/branding` | `read:branding` / `update:branding` |
| POST | `/api/v2/branding/themes` | `create:branding` |
| GET | `/api/v2/branding/themes/default` · `/{themeId}` | `read:branding` |
| PATCH / DELETE | `/api/v2/branding/themes/{themeId}` | `update:branding` / `delete:branding` |
| GET / PUT / DELETE | `/api/v2/branding/templates/universal-login` | `read:` / `update:` / `delete:branding` |
| GET / PUT | `/api/v2/prompts/{prompt}/custom-text/{language}` | `read:prompts` / `update:prompts` |

**Theme behavior rules (the API enforces these — they exist nowhere in the
public schema):**
- `GET /branding/themes/default` returns **404** if no theme exists yet. POST one first.
- **PATCH and POST require all top-level sections** (`colors`, `fonts`, `borders`, `widget`, `page_background`). To change one field, GET the current theme, merge, then PATCH the full object.
- **Required fields within sections** (omitting any is a 400, not a default): `fonts.font_url` and `fonts.links_style`; a `size` and `bold` on each font element (`title`, `subtitle`, `body_text`, `buttons_text`, `input_labels`, `links`); `widget.logo_url`; `page_background.background_image_url`. Use `""` for unset URL fields and `bold: false` where no bold is wanted.
- **Template key asymmetry:** the template `PUT` body uses the `template` key; `GET` returns it under `body`. Remap the key when round-tripping (GET → edit → PUT).

**Error notes.** Standard Management API status codes apply (`400` bad body /
invalid hex / bad URL, `401` expired token, `403` missing scope, `404` theme or
template not set, `429` rate limited — back off and retry). One branding-specific
case: **`409` on a template PUT means the template requires a custom domain but
none is configured** — configure a custom domain first.

> **Full reference:** complete request/response schemas, every property, and
> per-endpoint error bodies live at
> https://auth0.com/docs/api/management/v2/branding and
> https://auth0.com/docs/api/management/v2 (Prompts).

## CLI Commands

```bash
# Branding settings
auth0 ul show                       # view current config (add --json for machine output)
auth0 ul update --accent "#0059DB" --background "#FFFFFF" \
  --logo "https://example.com/logo.svg" \
  --favicon "https://example.com/favicon.ico" \
  --font "https://cdn.example.com/fonts/custom.woff"   # non-interactive

# Page templates
auth0 ul templates show
cat login.liquid | auth0 ul templates update           # from file

# Custom text (per prompt, optional -l <locale>)
auth0 ul prompts show login
auth0 ul prompts update login

# Test the login flow
auth0 test login
auth0 test login "{appClientId}"
auth0 test login --organization org_abc123
```

Full CLI reference: https://auth0.com/docs/cli or `auth0 ul --help`.

## Configuration Properties

Branding settings accept `colors.primary`, `colors.page_background` (hex),
`logo_url`, `favicon_url` (HTTPS; SVG logo recommended), and `font.url` (HTTPS,
CORS-enabled WOFF). Theme objects carry ~20 color elements plus `fonts`,
`borders`, `widget`, and `page_background` blocks.

> **Full reference:** every branding-settings and theme property (all color
> keys, font-size families, border/widget/background options and their types),
> and the concrete create-theme request body, live at
> https://auth0.com/docs/customize/login-pages/universal-login/customize-themes
> and the Branding Themes schema under
> https://auth0.com/docs/api/management/v2/branding. The required-field rules
> above are what the schema does *not* state.

## Page Templates

Page templates control the HTML structure around the Universal Login widget,
using the [Liquid template language](https://shopify.github.io/liquid/).

**Requirements:**
- A **custom domain** must be configured on your tenant.
- Templates can only be set via the **Management API** or **CLI** (not the Dashboard).
- Every template must include the `auth0:head` and `auth0:widget` tags.

**Minimal template** (the agent writes this; `_widget-auto-layout` centers the
widget — omit it to position the widget manually):

```html
<!DOCTYPE html>
{% assign resolved_dir = dir | default: "auto" %}
<html lang="{{locale}}" dir="{{resolved_dir}}">
  <head>
    {%- auth0:head -%}
  </head>
  <body class="_widget-auto-layout">
    {%- auth0:widget -%}
  </body>
</html>
```

Templates expose `application.*`, `branding.*`, `tenant.*`, `organization.*`
(B2B), `user.*` (post-authentication screens only), and screen context
(`locale`, `dir`, `prompt.name`, `prompt.screen.name`, `prompt.screen.texts`).

**Limitations (decide before customizing structure):**
- **CSS class names change on each Auth0 build.** Never target internal class names — they break. Use the theme API or no-code editor for styling; use page templates only for structure around the widget.
- **HTML structure may change.** Avoid customizations that depend on the widget's internal DOM.
- **Storybook rendering:** `<script>` tags break Storybook. Workaround: `<scr` + `ipt>code</scr` + `ipt>`.

> **Full reference:** the complete template-variable catalog and custom-layout
> examples live at
> https://auth0.com/docs/customize/login-pages/universal-login/customize-templates.

## Text Customization

`PUT /api/v2/prompts/<prompt>/custom-text/<language>` **replaces** all custom
text for that prompt and language. To update one screen without losing others,
first GET the current text, merge your changes, then PUT the full object back.
`GET` returns only the keys you have explicitly set (not Auth0's full default
set); an empty object (`{}`) means no custom text is set and defaults are used.

```bash
CURRENT=$(auth0 api get "prompts/login/custom-text/en")
# Merge changes into $CURRENT, then:
auth0 api put "prompts/login/custom-text/en" --data "$UPDATED"
auth0 api put "prompts/login/custom-text/en" --data '{}'   # delete all custom text
```

> **Full reference:** the prompt/screen catalog and every default text key live
> at https://auth0.com/docs/customize/login-pages/universal-login/customize-text-elements.

## Raw Management API calls

The CLI (`auth0 …`) is the primary path. For pipelines that don't use the CLI,
every call is `Bearer`-authenticated JSON against `https://{yourDomain}` and
follows the schemas linked above:

- **Branding:** `GET`/`PATCH` `/api/v2/branding`, body `{ colors, logo_url, favicon_url, font }`.
- **Theme:** `POST` `/api/v2/branding/themes` (all sections required — see the theme rules); `PATCH .../themes/{themeId}` must send the full object (GET, merge, PATCH).
- **Page template:** `PUT .../branding/templates/universal-login`, body `{ "template": "<escaped HTML>" }`.
- **Custom text:** `PUT .../prompts/{prompt}/custom-text/{lang}` with the per-screen text object.

> **Full reference:** exact request/response bodies (including the full
> create-theme body) live at https://auth0.com/docs/api/management/v2/branding.

## Deployment

Store branding in version control and deploy in your release pipeline by
exporting each artifact (`auth0 ul show --json`, `auth0 ul templates show`,
`auth0 api get "prompts/<p>/custom-text/<lang>"`) and re-applying it with the CLI
commands above, keeping per-environment config files separate.

**Copying branding between tenants — the one non-obvious rule:** `--tenant` is
the only way to pick a tenant per call, so pass it on **every** export and
import. Without it both halves hit the active tenant and the import overwrites
the tenant you just exported from. Passing it per call also leaves the active
tenant untouched. Both tenants must already appear in `auth0 tenants list`,
otherwise the CLI fails with `Failed to find tenant`. When copying a theme,
`del(.themeId)` from the exported body and POST it (or PATCH the target's
existing default theme id).

---

# Universal Login screens, by category

Canonical category map used by "Match my brand voice" to expand user-selected categories into concrete (prompt, screen) pairs for custom-text rewrites. Source: Auth0 internal data.

**This list is a starting point, not complete.** Auth0 adds new screens over time. When the skill encounters a screen name it doesn't recognize (the user mentions one, or a new flow lights up), it should fall back to probing `GET /api/v2/prompts/{prompt}/custom-text/{lang}` for the candidate prompt/locale: the response indicates whether the prompt accepts that screen's keys. If the user knows the new screen name but the skill doesn't, accept what they give and proceed. The skill should treat this map as current-as-of-last-update, not as the authoritative registry.

The custom-text API is **per-prompt, not per-screen**. Multiple screens under the same prompt share one PUT call with a single merged body keyed by screen name. When applying rewrites, batch screens by prompt.

**Single-screen prompts:** Many prompts have exactly one screen, where the screen name matches the prompt name (e.g., prompt `login-id`, screen `login-id`). These still require their own individual PUT call — batching doesn't apply, but the structure is the same. Do not attempt to nest them under a parent prompt.

**Currency of this list:** The tables below reflect the known screen inventory as of last update. Auth0 adds screens over time — new screens may appear under existing prompts, or entirely new prompts may be introduced. Treat this list as a reliable baseline, not a closed registry. If the API accepts a screen or prompt not listed here, that is expected; follow the "Learn new screens" flow in the Match Brand Voice section to record it.

**Important: `GET /prompts/{prompt}/custom-text/{lang}` returns only keys the tenant has explicitly customized**, not Auth0's default built-in text. For a screen the tenant has never customized, GET returns an empty object (or the key is absent) and the skill cannot read the default copy via the API. See the Match Brand Voice section "Generate and apply" for how to handle this.

## Login

**Identifier-first note:** `login-id` and `login-password` are each their own prompt, not screens nested under the `login` prompt. Each takes a separate `PUT /prompts/{prompt}/custom-text/{lang}` call with a body keyed by the screen name matching the prompt name (e.g., `{ "login-id": { ... } }`). Do not batch them under `login`.

| Prompt | Screen |
|---|---|
| login | login |
| login-id | login-id |
| login-password | login-password |
| email-identifier-challenge | email-identifier-challenge |
| phone-identifier-challenge | phone-identifier-challenge |
| phone-identifier-enrollment | phone-identifier-enrollment |
| login-email-verification | login-email-verification |

## Signup

**Same pattern as Login:** `signup-id` and `signup-password` are separate prompts, not screens under `signup`. Each requires its own PUT call.

| Prompt | Screen |
|---|---|
| signup | signup |
| signup-id | signup-id |
| signup-password | signup-password |

## Passwordless

| Prompt | Screen |
|---|---|
| login-passwordless | login-passwordless-email-code |
| login-passwordless | login-passwordless-email-link |
| login-passwordless | login-passwordless-sms-otp |
| email-otp-challenge | email-otp-challenge |

## Password reset

Includes reset-time MFA challenge screens because they're part of the reset flow Auth0-side.

| Prompt | Screen |
|---|---|
| reset-password | reset-password |
| reset-password | reset-password-request |
| reset-password | reset-password-email |
| reset-password | reset-password-success |
| reset-password | reset-password-error |
| reset-password | reset-password-mfa-email-challenge |
| reset-password | reset-password-mfa-otp-challenge |
| reset-password | reset-password-mfa-push-challenge-push |
| reset-password | reset-password-mfa-sms-challenge |
| reset-password | reset-password-mfa-phone-challenge |
| reset-password | reset-password-mfa-voice-challenge |
| reset-password | reset-password-mfa-recovery-code-challenge |
| reset-password | reset-password-mfa-webauthn-platform-challenge |
| reset-password | reset-password-mfa-webauthn-roaming-challenge |

## Passkeys

| Prompt | Screen |
|---|---|
| passkeys | passkey-enrollment |
| passkeys | passkey-enrollment-local |

## MFA

Grouped by factor. When the user picks MFA, show a sub-picker so they can scope to the factors they've actually enabled on the tenant.

**Key restrictions on `mfa` prompt screens:** `mfa-begin-enroll-options` and `mfa-login-options` only accept `title` — `description` is not a valid key and the API will reject it with a 400. Do not include `description` in rewrites for these screens.

| Prompt | Screen |
|---|---|
| mfa | mfa-begin-enroll-options |
| mfa | mfa-detect-browser-capabilities |
| mfa | mfa-enroll-result |
| mfa | mfa-login-options |
| mfa-email | mfa-email-challenge |
| mfa-email | mfa-email-list |
| mfa-otp | mfa-otp-challenge |
| mfa-otp | mfa-otp-enrollment-code |
| mfa-otp | mfa-otp-enrollment-qr |
| mfa-push | mfa-push-challenge-push |
| mfa-push | mfa-push-enrollment-code |
| mfa-push | mfa-push-enrollment-qr |
| mfa-push | mfa-push-list |
| mfa-push | mfa-push-success |
| mfa-push | mfa-push-welcome |
| mfa-sms | mfa-country-codes |
| mfa-sms | mfa-sms-challenge |
| mfa-sms | mfa-sms-enrollment |
| mfa-sms | mfa-sms-list |
| mfa-phone | mfa-phone-challenge |
| mfa-phone | mfa-phone-enrollment |
| mfa-voice | mfa-voice-challenge |
| mfa-voice | mfa-voice-enrollment |
| mfa-recovery-code | mfa-recovery-code-challenge |
| mfa-recovery-code | mfa-recovery-code-enrollment |
| mfa-recovery-code | mfa-recovery-code-challenge-new-code |
| mfa-webauthn | mfa-webauthn-change-key-nickname |
| mfa-webauthn | mfa-webauthn-enrollment-success |
| mfa-webauthn | mfa-webauthn-error |
| mfa-webauthn | mfa-webauthn-platform-challenge |
| mfa-webauthn | mfa-webauthn-platform-enrollment |
| mfa-webauthn | mfa-webauthn-roaming-challenge |
| mfa-webauthn | mfa-webauthn-roaming-enrollment |
| mfa-webauthn | mfa-webauthn-not-available-error |

## Organizations (B2B)

| Prompt | Screen |
|---|---|
| organizations | organization-picker |
| organizations | organization-selection |
| invitation | accept-invitation |

## Other

Long-tail screens rarely targeted for voice rewrites. Available if the user explicitly picks the Other category, where they can then choose individual screens.

| Prompt | Screen |
|---|---|
| consent | consent |
| customized-consent | customized-consent |
| logout | logout |
| logout | logout-aborted |
| logout | logout-complete |
| device-flow | device-code-activation |
| device-flow | device-code-activation-allowed |
| device-flow | device-code-activation-denied |
| device-flow | device-code-confirmation |
| email-verification | email-verification-result |
| captcha | interstitial-captcha |
| brute-force-protection | brute-force-protection-unblock |
| brute-force-protection | brute-force-protection-unblock-failure |
| brute-force-protection | brute-force-protection-unblock-success |
| common | redeem-ticket |
| status | status |
| custom-form | custom-form |

---

