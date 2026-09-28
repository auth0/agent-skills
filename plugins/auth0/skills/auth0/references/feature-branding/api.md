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
