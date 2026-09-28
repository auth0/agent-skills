# Auth0 Branding: API Reference

Management API endpoints, CLI commands, and the request/response shapes the
branding capabilities call. Auth0 Branding has no SDK — all configuration is
through the Management API (or the `auth0` CLI, which wraps it). Exhaustive
schemas (every theme property, every template variable) are delegated to the
Auth0 docs via the pointers below; this file keeps the endpoints, commands, and
example bodies the capabilities actually execute.

## Management API Endpoints

### Branding Settings

| Method | Path | Description | Scopes |
|--------|------|-------------|--------|
| GET | `/api/v2/branding` | Get branding settings (logo, colors, favicon, font) | `read:branding` |
| PATCH | `/api/v2/branding` | Update branding settings | `update:branding` |

### Branding Themes

| Method | Path | Description | Scopes |
|--------|------|-------------|--------|
| POST | `/api/v2/branding/themes` | Create a new theme | `create:branding` |
| GET | `/api/v2/branding/themes/default` | Get the default theme | `read:branding` |
| GET | `/api/v2/branding/themes/{themeId}` | Get a specific theme | `read:branding` |
| PATCH | `/api/v2/branding/themes/{themeId}` | Update a theme | `update:branding` |
| DELETE | `/api/v2/branding/themes/{themeId}` | Delete a theme | `delete:branding` |

**Theme behavior notes:**
- `GET /branding/themes/default` returns 404 if no theme has been created yet. Create one with POST first.
- **PATCH and POST require all top-level sections** (`colors`, `fonts`, `borders`, `widget`, `page_background`). To update one field, GET the current theme, merge your change, then PATCH the full object.
- **Required fields within sections** (the API rejects a create/update that omits them): `fonts.font_url` and `fonts.links_style`; a `size` and `bold` on each font element (`title`, `subtitle`, `body_text`, `buttons_text`, `input_labels`, `links`); `widget.logo_url`; `page_background.background_image_url`. Use `""` for URL fields when no custom value is needed, and `bold: false` where no bold is wanted — omitting them is a 400, not a default.
- Each theme has an optional `displayName` string; the response includes a `themeId` used in subsequent PATCH/DELETE calls.

### Universal Login Templates

| Method | Path | Description | Scopes |
|--------|------|-------------|--------|
| GET | `/api/v2/branding/templates/universal-login` | Get page template | `read:branding` |
| PUT | `/api/v2/branding/templates/universal-login` | Set page template | `update:branding` |
| DELETE | `/api/v2/branding/templates/universal-login` | Delete page template | `delete:branding` |

### Custom Text (Prompts)

| Method | Path | Description | Scopes |
|--------|------|-------------|--------|
| GET | `/api/v2/prompts/<prompt>/custom-text/<language>` | Get custom text | `read:prompts` |
| PUT | `/api/v2/prompts/<prompt>/custom-text/<language>` | Set custom text (replaces all) | `update:prompts` |

> **Full reference:** the complete request/response schemas, every property, and
> per-endpoint error bodies live at
> https://auth0.com/docs/api/management/v2/branding and
> https://auth0.com/docs/api/management/v2 (Prompts). Only the endpoints the
> capabilities call are kept inline above.

### Error notes

Standard Management API status codes apply (`400` bad body / invalid hex / bad
URL, `401` expired token, `403` missing scope, `404` theme or template not set,
`429` rate limited — back off and retry). One branding-specific case worth
knowing: **`409` on a template PUT means a page template requires a custom
domain but none is configured** — configure a custom domain first. Full error
schemas: https://auth0.com/docs/api/management/v2.

## CLI Commands

```bash
# Branding settings
auth0 ul show                       # view current config (add --json for machine output)
auth0 ul update                     # interactive
auth0 ul update --accent "#0059DB" --background "#FFFFFF" \
  --logo "https://example.com/logo.svg" \
  --favicon "https://example.com/favicon.ico" \
  --font "https://cdn.example.com/fonts/custom.woff"   # non-interactive

# Page templates
auth0 ul templates show
cat login.liquid | auth0 ul templates update           # from file
auth0 ul templates update                              # interactive

# Custom text (per prompt, optional -l <locale>)
auth0 ul prompts show login
auth0 ul prompts update login

# Customization editor / rendering mode
auth0 ul customize                  # browser-based editor
auth0 ul switch                     # standard <-> advanced rendering

# Test the login flow
auth0 test login
auth0 test login "{appClientId}"
auth0 test login --organization org_abc123
```

Full CLI reference: https://auth0.com/docs/cli or `auth0 ul --help`.

## Configuration Properties

Branding settings accept `colors.primary`, `colors.page_background` (hex),
`logo_url`, `favicon_url` (HTTPS; SVG logo recommended), and `font.url` (HTTPS,
CORS-enabled WOFF). Theme objects carry ~20 color elements, a `fonts` block, a
`borders` block, a `widget` block, and a `page_background` block.

> **Full reference:** every branding-settings and theme property (all color
> keys, font-size families, border/widget/background options and their types)
> lives at https://auth0.com/docs/customize/login-pages/universal-login/customize-themes
> and the Branding Themes schema under
> https://auth0.com/docs/api/management/v2/branding. See the concrete shape in
> the "Create a theme" example below; the required-field rules are in the theme
> behavior notes above.

## Page Templates

Page templates control the HTML structure around the Universal Login widget,
using the [Liquid template language](https://shopify.github.io/liquid/).

### Requirements

- A **custom domain** must be configured on your tenant
- Templates can only be set via the **Management API** or **CLI** (not the Dashboard)
- Every template must include `auth0:head` and `auth0:widget` tags

**API key asymmetry:** `PUT` uses the `template` key in the request body. `GET`
returns the template under the `body` key. When round-tripping (GET → edit →
PUT), remap the key.

### Minimal Template

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

Add `class="_widget-auto-layout"` on `<body>` to center the widget. Omit it to position the widget manually.

### Template with Custom Layout

```html
<!DOCTYPE html>
{% assign resolved_dir = dir | default: "auto" %}
<html lang="{{locale}}" dir="{{resolved_dir}}">
  <head>
    {%- auth0:head -%}
    <style>
      .custom-container {
        display: flex;
        min-height: 100vh;
      }
      .brand-panel {
        flex: 1;
        background: {{ branding.colors.primary }};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        padding: 2rem;
      }
      .login-panel {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    </style>
  </head>
  <body>
    <div class="custom-container">
      <div class="brand-panel">
        <div>
          <img src="{{ branding.logo_url }}" alt="{{ tenant.friendly_name }}" />
          <h1>Welcome to {{ tenant.friendly_name }}</h1>
          {% if organization.display_name %}
            <p>Signing in as {{ organization.display_name }}</p>
          {% endif %}
        </div>
      </div>
      <div class="login-panel">
        {%- auth0:widget -%}
      </div>
    </div>
  </body>
</html>
```

Templates expose `application.*`, `branding.*`, `tenant.*`, `organization.*`
(B2B), `user.*` (post-authentication screens only), and screen context
(`locale`, `dir`, `prompt.name`, `prompt.screen.name`, `prompt.screen.texts`).

> **Full reference:** the complete template-variable catalog (every field and
> example value) lives at
> https://auth0.com/docs/customize/login-pages/universal-login/customize-templates.

### Template Limitations

- **CSS class names change on each Auth0 build.** Do not target internal class names; they will break. Use the theme API or no-code editor for styling; use page templates only for structure around the widget.
- **HTML structure may change.** Avoid customizations that depend on the widget's internal DOM.
- **Storybook rendering**: `<script>` tags break Storybook. Workaround: `<scr` + `ipt>code</scr` + `ipt>`

## Text Customization

### API Behavior

`PUT /api/v2/prompts/<prompt>/custom-text/<language>` **replaces** all custom
text for that prompt and language. To update one screen without losing others,
first GET the current text, merge your changes, then PUT the full object back.

`GET` returns only the keys you have explicitly set, not the full set of Auth0
default strings. An empty object (`{}`) means no custom text is set and Auth0's
defaults are used.

```bash
# Get current text, modify, then set
CURRENT=$(auth0 api get "prompts/login/custom-text/en")
# Merge changes into $CURRENT
auth0 api put "prompts/login/custom-text/en" --data "$UPDATED"

# Delete: send an empty object to remove all custom text for a prompt
auth0 api put "prompts/login/custom-text/en" --data '{}'
```

> **Full reference:** the prompt/screen catalog and every default text key live
> at https://auth0.com/docs/customize/login-pages/universal-login/customize-text-elements.

## cURL examples

The CLI (`auth0 …`) is the primary path; these raw cURL forms are the
equivalent Management API calls for pipelines that don't use the CLI. Bodies
follow the schemas linked above.

### Create a theme (full body — the concrete theme shape)

All top-level sections are required, with the per-section required fields listed
in the theme behavior notes above.

```bash
curl --request POST \
  --url 'https://{yourDomain}/api/v2/branding/themes' \
  --header 'authorization: Bearer {yourMgmtApiAccessToken}' \
  --header 'content-type: application/json' \
  --data '{
    "displayName": "My Theme",
    "colors": {
      "primary_button": "#0059DB",
      "primary_button_label": "#FFFFFF",
      "secondary_button_border": "#C9CACE",
      "secondary_button_label": "#1E212A",
      "base_focus_color": "#0059DB",
      "base_hover_color": "#004DB7",
      "links_focused_components": "#0059DB",
      "header": "#1E212A",
      "body_text": "#1E212A",
      "widget_background": "#FFFFFF",
      "widget_border": "#C9CACE",
      "input_labels_placeholders": "#65676E",
      "input_filled_text": "#1E212A",
      "input_border": "#C9CACE",
      "input_background": "#FFFFFF",
      "icons": "#65676E",
      "error": "#D03C38",
      "success": "#13A688"
    },
    "fonts": {
      "font_url": "",
      "links_style": "normal",
      "reference_text_size": 16,
      "title": { "size": 150, "bold": false },
      "subtitle": { "size": 87.5, "bold": false },
      "body_text": { "size": 87.5, "bold": false },
      "buttons_text": { "size": 100, "bold": false },
      "input_labels": { "size": 100, "bold": false },
      "links": { "size": 87.5, "bold": false }
    },
    "borders": {
      "button_border_weight": 1,
      "buttons_style": "rounded",
      "button_border_radius": 3,
      "input_border_weight": 1,
      "inputs_style": "rounded",
      "input_border_radius": 3,
      "widget_corner_radius": 5,
      "widget_border_weight": 0,
      "show_widget_shadow": true
    },
    "widget": {
      "logo_position": "center",
      "logo_url": "https://example.com/logo.svg",
      "logo_height": 52,
      "header_text_alignment": "center",
      "social_buttons_layout": "bottom"
    },
    "page_background": {
      "background_color": "#000000",
      "background_image_url": "",
      "page_layout": "center"
    }
  }'
```

### Other requests

The remaining calls follow the same auth header + JSON body pattern:

- **Get / update branding:** `GET`/`PATCH` `https://{yourDomain}/api/v2/branding` with a body of `{ colors, logo_url, favicon_url, font }`.
- **Get / update theme:** `GET`/`PATCH` `.../branding/themes/{themeId}` — PATCH must send the full object (GET, merge, PATCH).
- **Set page template:** `PUT .../branding/templates/universal-login` with `{ "template": "<escaped HTML>" }`.
- **Set custom text:** `PUT .../prompts/{prompt}/custom-text/{lang}` with the per-screen text object.

Full request/response bodies: https://auth0.com/docs/api/management/v2/branding.

## Deployment and migration patterns

### Export and version control

Store branding configuration in version control and deploy as part of your release pipeline.

```bash
# Export current branding settings
auth0 ul show --json > branding-settings.json

# Export current page template
auth0 ul templates show > login-template.liquid

# Export custom text for prompts you've customized
auth0 api get "prompts/login/custom-text/en" > text-login-en.json
auth0 api get "prompts/signup/custom-text/en" > text-signup-en.json
```

### Deploy branding in a pipeline

```bash
#!/bin/bash
# deploy-branding.sh
# Requires: AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET

auth0 login --client-id "$AUTH0_CLIENT_ID" \
  --client-secret "$AUTH0_CLIENT_SECRET" \
  --domain "$AUTH0_DOMAIN" --no-input

auth0 ul update \
  --logo "https://cdn.example.com/logo.svg" \
  --accent "#0059DB" \
  --background "#FFFFFF" \
  --favicon "https://cdn.example.com/favicon.ico" \
  --no-input

cat ./branding/login-template.liquid | auth0 ul templates update

cat ./branding/text-login-en.json | auth0 ul prompts update login --language en
cat ./branding/text-signup-en.json | auth0 ul prompts update signup --language en
```

### Multi-environment layout

Keep environment-specific branding in separate config files:

```text
branding/
  base/
    theme.json          # shared theme structure
    login-template.liquid
  environments/
    dev/
      settings.json
      text-login-en.json
    staging/
      settings.json
      text-login-en.json
    production/
      settings.json
      text-login-en.json
```

### Copy branding between tenants

`--tenant` is the only way to pick a tenant per call, so pass it on every export
and import. Without it both halves hit the active tenant and the import
overwrites the tenant you just exported from. Passing it per call also leaves the
active tenant untouched. Both tenants must already appear in
`auth0 tenants list`, otherwise the CLI fails with `Failed to find tenant`.

```bash
set -euo pipefail

SOURCE_TENANT=source-tenant.auth0.com
TARGET_TENANT=target-tenant.auth0.com

# Export from source tenant
BRANDING=$(auth0 api get "branding" --tenant "$SOURCE_TENANT")
THEME=$(auth0 api get "branding/themes/default" --tenant "$SOURCE_TENANT" 2>/dev/null || true)
TEMPLATE=$(auth0 api get "branding/templates/universal-login" --tenant "$SOURCE_TENANT" 2>/dev/null || true)
LOGIN_TEXT=$(auth0 api get "prompts/login/custom-text/en" --tenant "$SOURCE_TENANT" 2>/dev/null || true)

# Import to target tenant
printf '%s' "$BRANDING" | auth0 api patch "branding" --tenant "$TARGET_TENANT"

if [ -n "$THEME" ]; then
  THEME_BODY=$(printf '%s' "$THEME" | jq 'del(.themeId)')
  TARGET_THEME_ID=$(auth0 api get "branding/themes/default" --tenant "$TARGET_TENANT" 2>/dev/null | jq -r '.themeId // empty' || true)
  if [ -n "$TARGET_THEME_ID" ]; then
    printf '%s' "$THEME_BODY" | auth0 api patch "branding/themes/$TARGET_THEME_ID" --tenant "$TARGET_TENANT"
  else
    printf '%s' "$THEME_BODY" | auth0 api post "branding/themes" --tenant "$TARGET_TENANT"
  fi
fi

if [ -n "$TEMPLATE" ]; then
  printf '%s' "$TEMPLATE" | auth0 api put "branding/templates/universal-login" --tenant "$TARGET_TENANT"
fi

if [ -n "$LOGIN_TEXT" ]; then
  printf '%s' "$LOGIN_TEXT" | auth0 api put "prompts/login/custom-text/en" --tenant "$TARGET_TENANT"
fi
```

### Verify branding changes

```bash
# Open a test login flow in your browser
auth0 test login

# Test with a specific application
auth0 test login "{yourAppClientId}"

# Test with organization context (for B2B branding)
auth0 test login --organization org_abc123

# Verify via API
auth0 api get "branding" | jq '.colors'
auth0 api get "branding/themes/default" | jq '.colors.primary_button'
auth0 api get "branding/templates/universal-login" | jq '.template' | head -1
```
