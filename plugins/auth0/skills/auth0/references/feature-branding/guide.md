
# Auth0 Branding

> Orientation (capabilities table, prompt style, plan-mode rules, verify-in-browser step, key concepts, prerequisites, common mistakes) lives in this reference's overview. Read that first if you haven't already; this file picks up at the detailed capability playbooks.

# Capability 1: Brand my tenant

End-to-end branding. The tenant's theme, logo, and typography are updated to match a single source. Invoked when the user asks to brand a tenant from a website or brand assets.

Scope is intentionally narrow: **four brand values** (primary color, logo URL, font family, page background) plus the target tenant. Layout, voice rewriting, and locale handling are out of the default path; users opt in to them via `[edit]` on the review.

## Start: parse input, prompt only for what's missing

Parse the user's opening message first. Only ask when the skill needs something it can't infer.

Look for:
- **A URL** (http/https, non-Figma) → use Brandfetch; see "Extract brand tokens".
- **Inline brand values** (hex codes, logo URL, font URL, design tokens, Tailwind/CSS snippets, palette) → use directly.
- **A Figma URL** → see "Figma".
- **Nothing** → one prompt:
  ```text
  Paste a website URL, or drop your brand values (primary color, logo URL,
  font). I'll propose a branding you can review before anything changes.
  ```

Tool detection is silent. The only external dependency in the default path is Brandfetch (optional). There is no Playwright/browser step; if the user wants layout fidelity, they upload a screenshot via `[edit]`.

## Extract brand tokens

Four slots to fill: **primary color, logo URL, font family, page background**. Background defaults to white; the other three come from Brandfetch when available, from the user's inline values, or from a short ask.

### Source: URL

1. Check for a stored Brandfetch key at `${XDG_CONFIG_HOME:-$HOME/.config}/auth0-branding/brandfetch.key`. This follows the XDG Base Directory spec: honor `$XDG_CONFIG_HOME` when it's set, otherwise fall back to `~/.config/`. Saves and reads use the same resolved path.
2. If no key, one-time ask:
   ```text
   One-time setup: Brandfetch gives the cleanest colors, fonts, and logos
   for URL-based branding. Free tier covers 100 lookups/month.
     [paste key]  [sign up, ~30s]  [skip]
   (Saved locally; won't ask again.)
   ```
   If skipped, persist the decision so future runs don't re-ask. The user can paste a key later with "use this Brandfetch key: <key>".
3. If a key is available: `GET https://api.brandfetch.io/v2/brands/<domain>` with `Authorization: Bearer <key>`. Map the response:
   - **Primary color**: first `colors[].type == "accent"`, else `"dark"`.
   - **Logo URL**: light-theme SVG from `logos[]` (hotlink; don't fetch server-side per Brandfetch ToS).
   - **Font family**: `fonts[].type == "body"` or `"title"`, combined with Auth0's standard fallback stack (e.g. `"<brand font>", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
4. If Brandfetch was skipped, unreachable, or returned an incomplete response, fall through to "ask for missing values".

### Source: inline values

Parse whatever the user pasted. Any of these is fine:
- Raw hex codes (`#0051BA` → primary color)
- A palette list (map first hex to primary)
- CSS variable snippet (`--primary: #0051BA`)
- Design tokens JSON (W3C or Figma export)
- Tailwind config fragment
- Logo URL
- Font URL (Google Fonts stylesheet or a WOFF file) or CSS font name

User-supplied values always override Brandfetch.

### Figma

Figma pages don't render server-side; a URL alone can't be scraped. If the user pastes a Figma URL:

1. **Figma MCP detected silently** (Claude Code has the server connected) → read tokens, variables, and styles directly.
2. **No Figma MCP** → one prompt:
   ```text
   I need the Figma MCP server to read a Figma file. Set it up here:
   https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server

   Or paste the brand values directly:
     primary color hex
     logo URL (hosted)
     font name
   ```

Figma typically covers colors and typography; it does not cover a hostable logo URL. The user supplies that separately.

### Ask for missing values

After all available sources have been tried, if any of the four slots is still empty, ask once in a consolidated prompt:

```text
I need a few brand values to finish the proposal (paste hex codes / URLs,
or type "skip" for any to use the Auth0 default):

  Primary color     (hex, e.g. #0051BA)
  Logo URL          (must be hosted; Auth0 does not host uploaded files)
  Font family       (CSS name, e.g. "Inter", or a Google Fonts URL)
```

Omit rows for slots that are already filled. Parse the reply in any reasonable format.

## Defaults (not extracted; not asked)

These are held constant unless the user opts in to changing them via `[edit]`:

- **Layout**: Auth0's centered single-column widget.
- **Secondary colors** (border, link, muted text): derived from the primary using standard contrast rules, or left at Auth0 defaults.
- **Voice / text**: not rewritten. Users who want text to match their brand voice run Capability 3 ("Match my brand voice") as a separate step.
- **Locales**: existing enabled locales are unaffected.

## Propose

Single proposal, single free-text review prompt. Always include the "Also available" block so users can see what else is editable.

```text
Proposed branding for ikea.com:

  Primary color      #0051BA      (from Brandfetch)
  Button label       #FFFFFF      (derived from primary contrast)
  Page background    #FFFFFF
  Body text          #111111      (Auth0 default)
  Typography         Noto IKEA, Noto Sans, system-ui
                                  (from Brandfetch; browser loads
                                   Noto Sans as the hostable fallback)
  Logo               https://cdn.brandfetch.io/...

  Layout             centered single-column  (Auth0 default)

Also available (off unless you ask):
  Page template      off           (paste HTML/Liquid; needs a custom domain)
  Layout override    off           (upload a screenshot for a vision-based pass)
  Voice rewriting    off           (rewrite login text in the brand's voice after apply)

Target tenant: acme-prod (active in Auth0 CLI)
```
> Proceed? (apply / edit / cancel, or tell me what to change.)

Show provenance inline (`(from Brandfetch)`, `(you supplied)`, `(Auth0 default)`) so the user can tell at a glance what came from where.

### Parsing the review reply

The review reply is free text. Handle these cases:

- **Clear apply** (`"apply"`, `"y"`, `"yes"`, `"go"`, `"ship it"`) → jump to "Confirm target tenant".
- **Clear cancel** (`"cancel"`, `"n"`, `"no"`, `"stop"`) → abort; no writes.
- **Bare "edit"** with no specifics → print the list of editable knobs (everything in the proposal plus the "Also available" items) and wait for the next reply.
- **Named edits** (`"change primary to #181818"`, `"enable voice rewriting"`, `"use Inter as the font and dark background"`, `"paste this template: ..."`) → update the relevant slots, re-render the proposal, ask `Proceed?` again.
- **Ambiguous** ("make it darker", "looks fine but the logo is wrong") → ask one short clarifying question in free text; don't kick back to a picker.

Editable knobs and what each reply means:

| Reply pattern | Slot to update |
|---|---|
| `primary color <hex>`, `brand color <hex>`, `make the primary <hex>` | `colors.primary_button` (theme) and `colors.primary` (tenant branding) |
| `logo <url>`, `use this logo <url>` | `widget.logo_url` (theme) and `logo_url` (tenant branding) |
| `font <name>` or `font <google-fonts-url>` | `fonts.font_url` (theme) after resolving family |
| `background <hex>` | `colors.page_background` (tenant branding) and `page_background.background_color` (theme) |
| Uploaded screenshot + "match this layout" | Layout override: run vision pass, map to theme knobs (widget position, page background, border style) |
| Pasted HTML/Liquid block | Page template override: verify `auth0:head` and `auth0:widget` are present, stage for apply. Requires a custom domain — warn if none is configured. |
| `enable voice rewriting`, `rewrite the copy too`, `also match the voice` | Set voice flag on. After apply, chain into the "Match my brand voice" section below. If the tenant has more than one enabled locale, that flow asks whether to rewrite all locales or English only. |

## Confirm target tenant

Before any write, run `auth0 tenants list` and present the active tenant:

```text
Target tenant: acme-prod  (active in the Auth0 CLI)

  [y] apply to acme-prod
  [n] cancel
```

If it's the wrong tenant, cancel. Tell the user to run `auth0 tenants use <name>` (or `auth0 login`) themselves and re-invoke the skill. Do not try to switch tenants on the user's behalf.

For non-interactive / multi-tenant workflows, accept an explicit tenant domain + bearer token inline instead of the CLI; see the cURL examples section below.

## Apply

Execute based on what the user approved in the review:

Before writing, validate any URL-valued fields (logo, favicon, font, background image) using the HEAD request check in the API Reference section below (URL Validation). Block writes for URLs that fail. Skip validation for `cdn.brandfetch.io` URLs.

1. **Tenant branding settings** (logo, favicon, primary color, page background): `PATCH /api/v2/branding`.
2. **Theme** (colors, fonts, widget): `GET /branding/themes/default` → merge → `PATCH /branding/themes/{themeId}` with the full object. Partial PATCH is not supported; always send the full theme.
3. **Page template** (only if the user pasted one via `[edit]` AND the tenant has a custom domain): `PUT /api/v2/branding/templates/universal-login`. Refuse the PUT if the template is missing `auth0:head` or `auth0:widget`.
4. **Voice rewrites** (only if `[edit] → voice rewriting` was enabled): hand off to the Match Brand Voice section with the primary-color/font context so it doesn't re-ask.

Before writing, diff the proposed changes against current tenant state. In production environments, require explicit confirmation. Auth0 does not retain prior theme/template/text versions; if the user wants a backup, suggest exporting current state locally before applying (see the backup flow in the Rollback section below).

Report what was written and what was skipped (for example, "page template skipped — no custom domain configured"). If voice rewriting was opted in, chain into Capability 3 after the theme write succeeds.

After reporting (and after voice rewriting chains complete, if enabled), run the "Verify in browser (post-apply)" step from the overview.

---

# Capability 5: Check my setup

Read-only diagnosis. Answers "will theme changes actually show up on the flows I care about?"

Safe to run first; a good starter when diagnosing "why doesn't my theme show up?" before running Capability 1 ("Brand my tenant").

## Background: Universal Login vs Classic

Themes and templates only apply to flows actually running in Universal Login. Tenants can run in hybrid mode where some flows are Classic. Branding in this skill does not affect Classic flows.

All three Classic toggles are **tenant-wide**. There is no per-client override; if a flow is set to Classic, every client in the tenant uses Classic for that flow.

- **Login and signup**: `GET /api/v2/prompts` → `universal_login_experience`. `"classic"` means every client's login and signup runs Classic; `"new"` means Universal Login.
- **Password reset**: `PATCH /api/v2/tenants/settings`; the `change_password` object (`{ enabled, html }`). When `enabled: true`, the tenant renders Classic for password reset.
- **MFA**: same endpoint; the `guardian_mfa_page` object (`{ enabled, html }`). When `enabled: true`, the tenant renders Classic for MFA.

To restore Universal Login for a flow, set the relevant toggle to false. The checks below flag any toggles in the Classic state.

If a flow is intentionally kept in Classic, "Brand my tenant" can still apply tenant-wide branding settings (logo, favicon, primary color); those show up on Classic pages too. But the theme and page template will not affect that flow.

## Checks (run in parallel)

1. **Universal Login enabled at tenant level**: `GET /api/v2/tenants/settings` → `flags.universal_login === true`.
2. **Login and signup experience**: `GET /api/v2/prompts` → `universal_login_experience`. `"new"` means every client gets Universal Login for login/signup; `"classic"` means every client runs Classic.
3. **Password reset and MFA Classic toggles**: from the tenant settings call, `change_password.enabled` and `guardian_mfa_page.enabled`. Flag if true (that flow is running Classic for the whole tenant).
4. **Custom domain**: `GET /api/v2/custom-domains`. Flag if empty (page templates cannot apply).
5. **Theme present**: `GET /api/v2/branding/themes/default`. Flag if 404 (no theme has been applied yet).
6. **Active flows**: `GET /api/v2/connections`. Determines which login flows actually matter.

## Output format

Structured checklist with pass/fail/warn and a summary of what the theme *will* and *won't* affect:

```text
Tenant: acme-prod (environment: production)

Universal Login at tenant level              ✓
New Universal Login experience               ✓
Current default theme                        ✓ (themeId abc123...)
Custom domain                                ✓ login.acme.com

Tenant-wide flow toggles:
  ✓ Login/signup            universal_login_experience: new  → Universal
  ✓ Password reset          change_password.enabled: false   → Universal
  ✗ MFA                     guardian_mfa_page.enabled: true  → Classic

Active flows (from connections):
  ✓ Username-password database: login + signup + password reset enabled
  ✓ Google social
  — Enterprise: none

Summary:
  Theme will apply to login/signup (tenant set to new) and password reset.
  Theme will NOT apply to MFA (tenant has guardian_mfa_page.enabled: true, so MFA runs Classic for every client).
  Fix (if desired):
    PATCH /tenants/settings --data '{"guardian_mfa_page": {"enabled": false}}'
```

This capability is read-only and does not write to the tenant; skip the "Verify in browser (post-apply)" step from the overview.

---

# Capability 2: Change specific settings

Manual branding update driven by the user's natural-language intent. The user says what they want to change ("make the primary button orange", "change the signup headline to 'Welcome in'", "bump the corner radius to 8px", "use Inter as the font"); the skill resolves that to specific fields across theme / tenant branding settings / page template / custom text, asks a targeted disambiguation question only when the target is genuinely ambiguous, stages the change, and applies once the user is done. No URL extraction or asset parsing.

The user never needs to know the API field names or which surface a setting lives on.

## Flow

1. Load current tenant state once at the start of the session: theme (`GET /branding/themes/default`), tenant branding (`GET /branding`), and (lazily) current page template + custom text when the request targets them. Cache for the session so disambiguation prompts can show current values.
2. Ask: **"What do you want to change?"**
3. Parse the user's request and resolve it to one or more specific fields using the **Intent mapping** table below.
4. Disambiguate only when needed. If the mapped target is unique, skip ahead. If multiple fields are plausible, ask one question and show current values so the user can see what they'd be changing:
   > "'button color'; which one?
   > [a] Primary button fill (currently `#533AFD`)
   > [b] Primary button label/text (currently `#FFFFFF`)
   > [c] Secondary button border (currently `#CCCCCC`)"
5. Restate the concrete change in plain language ("change primary button fill from `#533AFD` to `#FF5733`") and confirm.
6. Stage the change in an in-memory bundle. Do not write to the tenant yet.
7. Ask **"anything else?"**; loop to step 2 if yes.
8. Show the consolidated diff of all staged changes vs current tenant state.
9. Apply as a batch; see **Apply** below.

## Intent mapping

Map freeform phrasing to the underlying surface + field. This is a starting table; cover these cases, then fall back to asking "can you describe what you see today and what you want it to look like?" if nothing matches.

| User says | Likely target |
|---|---|
| "logo" | `widget.logo_url` (theme) and `logo_url` (tenant branding). If both are set, ask which; if only one, update that one. Offer to set both if only one is set today |
| "favicon" | `favicon_url` (tenant branding) |
| "primary color" / "brand color" | Ask: theme primary button fill, tenant `colors.primary` (used on Classic pages), or both? Default to updating both if the user says "everywhere" |
| "button color" | Disambiguate fill vs label/text. If the user means a specific button (secondary, tertiary), map to the matching theme field |
| "page background" / "background color" | `colors.page_background` (solid) or `page_background.background_image_url` (image). Ask if ambiguous |
| "widget background" / "card background" | `colors.widget_background` |
| "text color" / "body text" | `colors.body_text`; disambiguate from widget title / input label if needed |
| "corner radius" / "rounded corners" / "sharper corners" | Ask which element: buttons (`borders.button_border_radius`), inputs (`borders.input_border_radius`), widget (`borders.widget_corner_radius`). If the user says "everywhere", update all three |
| "font" | `fonts.font_url` + `fonts.reference_text_size` family. Resolve the family name to a Google Fonts URL if possible (see per-surface mechanics) |
| "headline" / "title on the [login/signup/reset/...] screen" | Custom text: `{prompt}.title` on the specified screen. Confirm the prompt + screen + language |
| "description" / "subtitle on [screen]" | Custom text: `{prompt}.description` |
| "button label on [screen]" | Custom text: `{prompt}.buttonText` (or the screen-specific label key) |
| "error message for X" | Custom text: the specific error key on the relevant prompt. GET the current custom text to find the exact key name |
| "the template" / "the HTML" / "the Liquid" | Page template (`PUT /branding/templates/universal-login`) |

When the phrasing is close but not exact (e.g., "accent color", "link color", "highlight"), pick the best candidate and restate it in the confirmation step so the user can correct.

## Discoverability

If the user asks "what can I change?" or doesn't know where to start, show the surface list as a prompt, not as a required picker:

- Logo / favicon
- Colors (buttons, text, backgrounds, links)
- Fonts
- Corner radius / border style
- Page background (color or image)
- Text on a specific screen (title, description, button labels, error messages)
- Page template (HTML/Liquid)

The user can still respond in natural language from there.

## Per-surface write mechanics

Once the target is resolved, these are the mechanics for writing each surface. The user does not see these details; they're for this skill's execution.

Before staging any URL-valued field (`logo_url`, `favicon_url`, `font.url`, `widget.logo_url`, `fonts.font_url`, `page_background.background_image_url`), validate the URL resolves using the HEAD request check in the API Reference section below (URL Validation). Block staging for URLs that fail. Skip validation for `cdn.brandfetch.io` URLs.

- **Logo**: Auth0 does not host uploaded assets. Ask the user for an HTTPS URL where the logo is already hosted. For theme logo: GET default theme, replace `widget.logo_url`, PATCH back. For tenant logo: `PATCH /branding` with `logo_url`. If the user only has a file, pause and ask them to host it first (their CDN, an S3 bucket, GitHub raw content, etc.).
- **Favicon**: URL only, same constraint as logo. `PATCH /branding` with `favicon_url`.
- **Color**: validate hex. Run a WCAG AA contrast check against the natural counterpart (button vs button-label, body text vs widget background, etc.). If it fails, surface the warning clearly and ask for confirmation before staging. Never block the change; accessibility is the customer's choice.
- **Font**: URL only. Resolve the family name to a Google Fonts URL if possible. If the family isn't on Google Fonts, ask the user for a reachable WOFF URL; do not silently fall back to a default.
- **Border radius / style**: plain numeric or enum update on the relevant `borders.*` field.
- **Page background**: solid color → `colors.page_background`; image → `page_background.background_image_url` (URL only, same asset-hosting constraint as logo). Clear the other if switching modes.
- **Text on a screen**: GET existing custom text for that prompt + language, merge the user's edit, PUT. Never PUT without merging; PUT replaces the full object for that prompt/language.
- **Page template**: GET current template, apply the edit, validate `auth0:head` and `auth0:widget` are still present, PUT. Refuse the write if either tag is missing.
- **Tenant branding setting**: `PATCH /branding` with just the changed keys.

## Apply

After the user finishes staging changes, batch the writes by surface:

1. All theme field changes → one `GET /branding/themes/default` + one `PATCH /branding/themes/{themeId}` with the merged full object.
2. All tenant-level branding setting changes → one `PATCH /api/v2/branding` with the merged body.
3. Page template change (if any) → one `PUT /api/v2/branding/templates/universal-login` after verifying `auth0:head` and `auth0:widget` are present.
4. Per-screen text changes → one `PUT /api/v2/prompts/{prompt}/custom-text/{lang}` per affected prompt/language (GET-merge-PUT; do not overwrite other screens in that prompt).

Before writing, show the consolidated diff **and the target tenant name** (per the "CLI Tenant Context" prerequisite in the overview). Require explicit confirmation for the whole batch. Auth0 does not retain prior versions, so there is no automatic rollback; suggest the user export current state locally first if they want a backup.

After the batch completes, run the "Verify in browser (post-apply)" step from the overview.

## Guardrails

- WCAG AA contrast check for any color change with a visible counterpart. Always fail-warn (never fail-block), including in production. If the color fails the contrast check, show the warning and require confirmation before staging; do not override the user's choice.
- Warn if the new font isn't on a known CDN.
- Validate page template still has `auth0:head` and `auth0:widget` after edit; refuse the PUT if either is missing. (Page-template validity IS a fail-block because the page won't render otherwise; WCAG is not.)

---

# Capability 4: Rollback to Auth0 defaults

Clear one or more branding surfaces and restore Auth0's defaults. Reset is per-surface, not all-or-nothing. Destructive; always confirm before writing.

## Scope pre-check (before asking anything)

If the user selected **Theme** or **Page template** to reset, those operations require the `delete:branding` scope. Check for it immediately — before backup, before confirm — by attempting a benign scoped call:

```bash
auth0 api get "branding/themes/default"
```

- If the call returns a theme: a `DELETE` will be needed. Verify scope by making a deliberate no-op `DELETE` attempt on a known-nonexistent themeId (e.g., `branding/themes/scope-check-probe`) — a `403` with `"access token lacks scope: delete:branding"` confirms the scope is missing; a `404` ("not found") confirms the scope is present.
- If the call returns 404: no theme to delete; scope check is moot for theme. Repeat the same probe for page template if that surface was selected.

> **Why probe instead of decoding the JWT:** Management API tokens issued to the CLI aren't always JWTs the skill can decode locally (opaque tokens are valid too), and scope claims in a decoded JWT can lag the tenant's actual grants. The probe tests the live gate. Caveats: the 403 check matches on error message text; if Auth0 ever changes the wording, update the substring here. The probe id (`scope-check-probe`) is reserved-looking on purpose, but if a real theme with that id ever exists the probe will succeed and the scope check will falsely report "present" — swap to a random UUID if that becomes a concern.

**If the scope is missing**, surface a clear warning before doing anything else:

> "Your current token is missing the `delete:branding` scope, which is required to delete the theme/page template. To avoid a mid-run failure, re-authenticate first:
>
> `auth0 login --scopes delete:branding`
>
> Run that command (prefix with `!` in Claude Code), then re-invoke this capability."

Stop and do not proceed until the scope issue is resolved. Do not fall through to backup or confirm steps with a known-failing scope.

## Ask what to reset

Use two sequential `AskUserQuestion` calls. Do not render a text checklist.

**Call 1 — surfaces to reset** (`multiSelect: true`):
- `question`: "Which pieces should I reset to Auth0 defaults?"
- `header`: "Reset"
- options:

| label | description |
|---|---|
| Tenant branding settings | logo, favicon, primary color, page background |
| Theme | colors, fonts, borders, widget layout, page backgrounds |
| Page template | HTML/Liquid |
| Custom text on prompts | I'll ask which prompts to clear after you confirm |

**Call 2 — backup** (single select):
- `question`: "Save a backup of the selected surfaces before resetting?"
- `header`: "Backup"
- options:

| label | description |
|---|---|
| Yes, save a backup first (Recommended) | I'll write current state to a local JSON file you can restore from manually |
| No, reset without a backup | One-way; Auth0 does not retain prior versions |

For custom text, after the user picks the surfaces, list prompts that currently have overrides and ask which to clear (or "all"). Show the locales those overrides cover so the user knows the scope.

Reset is destructive and one-way. Auth0 does not maintain prior versions of themes, templates, or custom text, so the "save to a file" option is the only way to keep a copy of current state before reset.

## Confirm

Show the concrete plan, including the target tenant (per the "CLI Tenant Context" prerequisite in the overview):

```text
Target tenant: acme-prod  (active in the Auth0 CLI)

I'll reset the following:
  • Theme (current themeId abc123 → deleted; Universal Login will fall back to Auth0's defaults)
  • Custom text on prompts: login, signup-id (locales: en, fr)

Tenant branding settings, page template, and other prompts will be left alone.

Backup: I'll save the current state of the selected surfaces to:
  ~/auth0-branding-backup-<tenant>-<YYYY-MM-DD_HHMMSS>.json
(Override the path or cancel the backup?)

Proceed?
  [y] Yes
  [n] Cancel
```

If the user opted in to save-to-file, ask for a path or accept the default (`~/auth0-branding-backup-<tenant>-<timestamp>.json`). Confirm the path is writable before proceeding. If the user skipped the backup option, omit that block and surface a brief warning that this is one-way.

In production environments, require explicit confirmation before any write.

## Execute (only for surfaces the user selected)

0. **Save backup (if opted in)**: before any writes, fetch the current state of every selected surface and serialize to a single JSON file at the path the user confirmed.
   - Theme: `GET /branding/themes/default` (full theme object)
   - Page template: `GET /branding/templates/universal-login`
   - Custom text: for each selected prompt + locale, `GET /prompts/{prompt}/custom-text/{lang}`
   - Tenant branding: `GET /branding`
   - Write the combined object as pretty-printed JSON with a top-level `tenant`, `timestamp`, and `surfaces` map. Refuse to proceed with reset if the write fails.
1. **Theme**: `DELETE /api/v2/branding/themes/{themeId}`. After delete, `GET /branding/themes/default` returns 404 and Universal Login renders Auth0's built-in defaults.
2. **Page template**: `DELETE /api/v2/branding/templates/universal-login`.
3. **Custom text**: for each selected prompt + locale, `PUT /api/v2/prompts/{prompt}/custom-text/{lang}` with `{}` (empty object) to clear overrides.
4. **Tenant branding settings**: `PATCH /api/v2/branding` with nulls/defaults for only the fields reset (don't clobber anything the user didn't select).

Report what was reset, what was left alone, and (if saved) the full path to the backup file so the user can find it later.

After the report, run the "Verify in browser (post-apply)" step from the overview. In the rollback case, the browser should render Auth0 built-in defaults; that's the verification.

---

# Capability 3: Match my brand voice

Rewrite Universal Login text to match a source's voice. Does not touch colors, layout, or logo.

## Ask for the source

Free-text prompt. Accept whatever the user gives and route based on what it is:

> What should the voice match? Paste a website URL, sample copy, or describe the voice (e.g., "casual and direct", "formal and corporate").

Parse the reply:

- **URL** (http/https) → sample the copy and classify the voice. Run Stage 4 of the "Brand my tenant" pipeline (voice extraction) without the rest; see the Brand My Tenant section.
- **Pasted sample text** → classify directly.
- **A voice descriptor** (short phrase, no URL, no paragraph of sample copy) → use as-is.
- **Ambiguous** (e.g., a URL plus a descriptor, or text that could be either a sample or a descriptor) → ask one short clarifying question in free text; don't kick back to a picker.

## Pick which screens to rewrite

Universal Login has 80+ screens. Most tenants use under 10. Ask the user in one free-text line how they want to choose:

> Which prompts do you want rewritten?
>   - **List them yourself** (e.g. `"login and signup"`, or specific prompt names like `login-id`, `reset-password`)
>   - **"detect"** — I'll make 4–5 API calls to infer active flows from connections, prompts, MFA, and organizations settings
>   - **"pick"** — I'll show a multi-select with categories (Login, Signup, Passwordless, Password reset, Passkeys, MFA, Organizations, Other)

Parse the reply:

- **Listed explicitly** (`"login and signup"`, `login-id, signup-password`, category names) → map to (prompt, screen) pairs via the screens map below and skip straight to locale handling. Only fall back to the picker if the listing is ambiguous.
- **"detect"** → run detection (next section), then render the pre-filled picker for confirmation.
- **"pick"** → render `AskUserQuestion` with `multiSelect: true` and no pre-checks. This is the only path that forces the picker.

Category list when the picker is rendered (`AskUserQuestion` options):

| label | description |
|---|---|
| Login | login, identifier-first entry, identifier challenges |
| Signup | signup, signup-id, signup-password |
| Passwordless | email code/link, SMS OTP, email OTP challenge |
| Password reset | request, reset, confirmation, and reset-time MFA challenges |
| Passkeys | enrollment screens |
| MFA | I'll ask which factors you use after you select this |
| Organizations (B2B) | org picker, org selection, invitation accept |
| Other | consent, logout, device flow, CAPTCHA, brute force, etc. |

Expansion rules (apply after picker submit, or when parsing a listed reply):

- If **MFA** is selected, show a sub-picker for factors: OTP (authenticator apps), SMS, push, email, phone, voice, WebAuthn, recovery code. Also include the MFA "landing" screens (`mfa-begin-enroll-options`, `mfa-login-options`, etc.) as a default. Only rewrite sub-screens for factors the user confirms are enabled.
- If **Other** is selected, show the full list of long-tail screens from the screens map below so they can tick specific ones.
- For each selected category, expand to the set of (prompt, screen) pairs via the screens map below.

**New screens:** The screens catalog below is a canonical starting point, not an authoritative registry. Auth0 adds screens over time. If the user mentions a screen name the skill doesn't recognize, accept it: probe `GET /api/v2/prompts/{prompt}/custom-text/{lang}` for the prompt they expect it under, or ask the user to confirm the prompt name. The skill should not refuse a rewrite because the screen isn't in the catalog. After a successful rewrite of an unknown screen, offer to add it to the screens catalog so the user doesn't have to re-enter it next time; see "Learn new screens" below.

## Help me figure it out (optional detection)

Only run when the user said `"detect"` in reply to the "list / detect / pick" ask above. Slower (4–5 API calls) and still surfaces the picker for confirmation. The goal is to pre-fill the picker, not to bypass it.

**What to fetch:**

1. `GET /api/v2/connections` — enabled connections and their `strategy` + `options.authentication_methods`.
2. `GET /api/v2/prompts` — tenant-wide login settings (`universal_login_experience`, `identifier_first`, `webauthn_platform_first_factor`).
3. `GET /api/v2/guardian/factors` — which MFA factors are enabled.
4. `GET /api/v2/organizations` — does the tenant use organizations.

**How to map to the categories above:**

- **Login**: always pre-check. Everyone hits login screens. For `auth0` (database) connections, check `options.authentication_methods.password.enabled`. Social strategies (`google-oauth2`, `facebook`, `apple`, etc.) and enterprise strategies (`samlp`, `oidc`, `waad`, `okta`, etc.) also land on the login screen via social/enterprise buttons. If `/prompts.identifier_first === true`, prefer the split `login-id` + `login-password` screens over the combined `login`.
- **Signup**: pre-check if `options.authentication_methods.password.signup_behavior !== "disallow"` and `options.disable_signup !== true` on at least one `auth0` connection.
- **Passwordless**: pre-check if any `email` or `sms` strategy connection is enabled, OR if an `auth0` (database) connection has passwordless entries in `options.authentication_methods`. Auth0 is rolling out passwordless on database connections, so read the `authentication_methods` object directly (don't hardcode expected field names); the skill should pick up email-OTP and SMS-OTP variants as they appear.
- **Password reset**: pre-check if `options.authentication_methods.password.enabled === true` on any database connection and password reset isn't explicitly disabled.
- **Passkeys**: pre-check if `options.authentication_methods.passkey.enabled === true` on any database connection.
- **MFA**: pre-check if `GET /guardian/factors` shows any factor with `enabled: true`. Within MFA, only pre-check the sub-factors that are actually enabled (typical: OTP, push, SMS, email; less common: phone, voice, WebAuthn roaming, recovery code). If `/prompts.webauthn_platform_first_factor === true`, the legacy WebAuthn biometrics flow is active — include those `mfa-webauthn-*` screens.
- **Organizations**: pre-check if `GET /organizations` returns any rows.
- **Other**: leave unchecked by default. Ask the user directly if they use consent, device flow, logout customization, or any other screens from the long-tail list.

Present the category picker with pre-checks applied. The user confirms or adjusts before proceeding.

## Check enabled locales before rewriting

Text is per-language. English is enabled by default; Auth0 supports ~80 languages and every key has a default translation in each. When you rewrite voice in one language, the others stay on Auth0 defaults, which can read as a voice mismatch.

1. `GET /api/v2/tenants/settings`; read `enabled_locales`.
2. If more than one locale is enabled, ask:

   > "Your tenant has English, French, and Spanish enabled. I'll generate rewrites in English first. Do you want me to also generate matching rewrites in French and Spanish?"

   Options:
   - [all] Rewrite in every enabled locale
   - [en-only] English only; leave other locales on Auth0 defaults
   - [pick] Pick which locales to rewrite

3. For non-English locales, the voice profile still applies but must be adapted in that language. If you (or the user) aren't confident in a locale, flag it. A clean default is usually better than a clumsy rewrite.

## Generate and apply

**Constraint:** `GET /api/v2/prompts/{prompt}/custom-text/{lang}` returns only keys the tenant has explicitly customized, not Auth0's defaults. Most tenants have no custom text yet, so this is the norm rather than an edge case. The skill sources English defaults from Auth0's docs page and auto-translates the voice-matched English into every other enabled locale.

### Step 1: Establish the English baseline for each (prompt, screen)

The baseline needs the full set of keys for the screen in the tenant's current form. Auth0 docs defaults plus any tenant overrides, merged, gives that. Try in order:

- **Auth0 docs page + tenant overrides** (normal path):
  1. Fetch https://auth0.com/docs/customize/login-pages/universal-login/customize-text-elements#prompt-values and extract the English defaults for the prompt from its accordion list. **Treat the fetch as best-effort**: if the response is non-200, the accordion for the prompt is missing, or the extracted keys look empty/truncated, skip to the **User paste** fallback below rather than proceeding with a partial baseline. URL and page structure belong to Auth0 docs and can change without notice; if the fetch starts failing consistently, fix this reference rather than patching around it.
  2. `GET /prompts/{prompt}/custom-text/en` to fetch any tenant overrides for the screen.
  3. Merge: docs defaults as the base, tenant overrides on top. Tenant-customized keys win; uncustomized keys keep Auth0's defaults. Don't stop at the tenant response alone — it may only cover a subset of the screen's keys (e.g., the customer customized the title but not the description or error messages), so the merged view is the full baseline.
- **User paste** (fallback): if the docs page doesn't cover the screen or the fetched copy looks clearly stale, ask the user to open the Auth0 Dashboard → **Branding → Universal Login → Customize Text**, select the relevant prompt and screen, switch to the **Raw JSON** tab for that screen's text-and-translations, and paste the exact JSON here. That's the authoritative baseline. Do not accept screenshots or text copied from the live login page; those are error-prone.
- **Skip**: if none of the above work, skip the screen and tell the user which screens were skipped.

### Step 1b: Check identifier configuration before rewriting placeholder text

Before generating rewrites for any login or signup screen, check which identifiers the tenant actually accepts and match the placeholder key accordingly. This prevents copying multi-identifier language from a brand source onto a tenant that only accepts one identifier type — a label/config mismatch that would mislead users.

**How to check:** inspect `GET /api/v2/connections` results already fetched in detection (or fetch now). For each `auth0` (database) connection, read two separate fields — they answer different questions:

- **Identifier type** (what the user types to identify themselves): read `options.attributes`. The three possible keys are `email`, `phone_number`, and `username` — check which have `identifier.active: true`. If `options.attributes` is absent or null, the connection is a **legacy connection**: its default identifier is email, and `options.requires_username: true` adds username as a second identifier on top of email (it does not replace email).
- **Passkey enablement** (used during detection, not placeholder selection): read `options.authentication_methods.passkey.enabled`.

Do not use `authentication_methods` to determine identifier type — instead, use `options.attributes` (or, for legacy connections, the email default plus `options.requires_username`) to determine what the user enters. `authentication_methods` only describes authentication methods (password, passkey), not what the user enters as their identifier.

**Key selection rules — modern connections** (`options.attributes` is present):

| Active identifiers (`identifier.active: true`) | Correct placeholder key | Default text |
|---|---|---|
| `email` only | `emailPlaceholder` | "Email address" |
| `phone_number` only | `phonePlaceholder` | "Phone number" |
| `username` only | `usernameOnlyPlaceholder` | "Username" |
| `email` + `phone_number` | `phoneOrEmailPlaceholder` | "Phone number or Email address" |
| `email` + `username` | `usernameOrEmailPlaceholder` | "Username or Email address" |
| `phone_number` + `username` | `phoneOrUsernamePlaceholder` | "Phone Number or Username" |
| `email` + `phone_number` + `username` | `phoneOrUsernameOrEmailPlaceholder` | "Phone or Username or Email" |

**Key selection rules — legacy connections** (`options.attributes` is absent or null):

| `options.requires_username` | Active identifiers | Correct placeholder key | Default text |
|---|---|---|---|
| `false` or null | email only | `emailPlaceholder` | "Email address" |
| `true` | email + username | `usernamePlaceholder` | "Username or email address" |

**When the source brand uses multi-identifier language but the tenant doesn't:** flag it explicitly before showing the rewrite proposal. Example:

> "{brand} uses 'Email or mobile number' because they accept both identifiers. Your tenant only has email enabled, so I'll keep the email placeholder as-is. If you enable phone as an identifier later, set `emailPhonePlaceholder` at that point — don't change `emailPlaceholder` to reference phone now."

Do not silently copy multi-identifier phrasing into a single-identifier placeholder key. The label would be misleading even if the key accepts it.

### Step 2: Generate the English rewrite

Produce voice-matched English copy for every key in the baseline. For each key, compare the proposed rewrite against the Auth0 default value from the docs page (`https://auth0.com/docs/customize/login-pages/universal-login/customize-text-elements`) — the per-screen tables on that page list the default text for every key. If the proposed rewrite is identical to the Auth0 default, mark it as **no change** and exclude it from the PUT. There is no point overwriting a key with the value it already has.

Show side-by-side with the baseline; the user approves, edits inline, or skips. The user can also correct a baseline that looked off (by pasting current text) at any point.

### Step 3: Translate into every other selected locale

For each non-English locale the user selected:

- **Tenant override**: if `GET /prompts/{prompt}/custom-text/<locale>` returns keys for this screen, use those as the baseline and rewrite in-voice in that language.
- **Otherwise**: translate the approved English voice-matched rewrite into the locale. Preserve the voice intent from the English rewrite rather than falling back to Auth0's neutral default for that language.

Show each locale's proposed text so the user can spot-check and edit any translation that looks off. Don't require the user to paste non-English source copy; translation from the voice-matched English is the default path.

### Step 4: Apply

Before writing, show the target tenant name and the prompt/locale pairs about to be updated, and get explicit confirmation (per the "CLI Tenant Context" prerequisite in the overview).

Batch by prompt: one `PUT /api/v2/prompts/{prompt}/custom-text/{lang}` per prompt-locale pair, with approved new keys merged across all screens under that prompt and any existing overrides preserved.

Before writing, strip any key whose approved value is identical to the Auth0 default for that key. Comparison is an **exact byte-for-byte string match** after trimming trailing whitespace/newlines — no case folding, no HTML-entity decoding, no whitespace collapsing inside the string. If the approved value differs only in a trailing newline or leading/trailing spaces, treat it as identical and strip it. Any other difference (casing, punctuation, HTML entities, internal whitespace) is a genuine override and must be written. Only include keys that are genuinely different from the default — sending a default value creates a stored override that has no effect but adds noise and makes future resets less clean.

Never PUT without merging; PUT replaces the full object for that prompt/lang. The custom-text API is per-prompt, not per-screen, so screens under the same prompt share one PUT call.

**Rate limits.** A multi-prompt, multi-locale rewrite can produce 20+ PUTs in quick succession. The Management API's default per-tenant write budget is a few hundred requests per minute, but concurrent writes are the real risk: run PUTs **sequentially**, not in parallel. If the API returns **429 Too Many Requests**, back off and retry the failed PUT only — don't re-run the batch. Use exponential backoff: wait 5s, 10s, 20s, 30s, 60s; stop after five attempts and surface the failed prompt/locale pair to the user. Honor the `Retry-After` response header if present (seconds to wait before the next attempt). Successful PUTs don't need to be retried; the per-prompt design means each PUT is independent.

After all PUTs succeed, run the "Verify in browser (post-apply)" step from the overview.

## Learn new screens

If the run included a screen that was not in the screens catalog below (because Auth0 shipped a new one, or the user named a screen the catalog didn't cover) AND the PUT succeeded, offer to persist it so the user doesn't have to re-enter it next time:

```text
I rewrote `<screen-name>` under the `<prompt-name>` prompt. It wasn't in my
reference list. Add it to the screens catalog so I'll remember it next time?

  [y] Yes, add it under <inferred-category>
  [c] Yes, but put it under a different category (I'll pick)
  [n] Skip; don't save
```

Infer the default category from the prompt name where possible:
- `mfa-*` → **MFA**
- `reset-password*` → **Password reset**
- `login-passwordless*`, `*-otp-challenge` → **Passwordless**
- `organizations`, `invitation` → **Organizations (B2B)**
- `passkey*` → **Passkeys**
- `login*`, `*identifier-challenge`, `*identifier-enrollment` → **Login**
- `signup*` → **Signup**
- anything else → **Other**

If the user accepts, append a new row to the matching category's table in the screens catalog below with the `(prompt, screen)` pair. Only persist after a successful PUT so a failed or canceled rewrite doesn't pollute the catalog. If multiple new screens came up in the same run, batch the confirmations into one question listing all of them.

The reference map grows with real usage this way; users only name a new screen once.

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

## Templates

## Page Templates

Page templates let you control the HTML structure around the Universal Login widget. They use the [Liquid template language](https://shopify.github.io/liquid/).

### Requirements

- A **custom domain** must be configured on your tenant
- Templates can only be set via the **Management API** or **CLI** (not the Dashboard)
- Every template must include `auth0:head` and `auth0:widget` tags

**API key asymmetry:** `PUT` uses the `template` key in the request body. `GET` returns the template under the `body` key. This is expected API behavior.

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

### Available Template Variables

#### Application

| Variable | Description | Example |
|----------|-------------|---------|
| `application.id` | Client ID | `XXXXXXXXXXXXXXXXX` |
| `application.name` | Application name | `My Application` |
| `application.logo_url` | Application logo URL | `https://example.com/logo.png` |
| `application.metadata` | Application metadata object | `{"key": "value"}` |

#### Branding

| Variable | Description | Example |
|----------|-------------|---------|
| `branding.logo_url` | Tenant logo URL | `https://example.com/logo.png` |
| `branding.colors.primary` | Primary branding color | `#0059DB` |
| `branding.colors.page_background` | Page background color | `#FFFFFF` |

#### Tenant

| Variable | Description | Example |
|----------|-------------|---------|
| `tenant.friendly_name` | Tenant display name | `My Tenant` |
| `tenant.support_email` | Support email | `support@example.com` |
| `tenant.support_url` | Support page URL | `https://example.com/support` |
| `tenant.enabled_locales` | Enabled locale codes | `en, es` |

#### Organization (B2B)

| Variable | Description | Example |
|----------|-------------|---------|
| `organization.id` | Organization ID | `org_XXXXXXX` |
| `organization.display_name` | Display name | `Acme Corp` |
| `organization.name` | Internal name | `acme-corp` |
| `organization.branding.logo_url` | Org-specific logo | `https://acme.com/logo.png` |
| `organization.branding.colors.primary` | Org primary color | `#FF0000` |
| `organization.branding.colors.page_background` | Org background | `#FAFAFA` |

#### Current User (post-authentication screens only)

| Variable | Description |
|----------|-------------|
| `user.user_id` | User profile ID |
| `user.email` | Email address |
| `user.name` | Full name |
| `user.picture` | Profile picture URL |
| `user.email_verified` | Boolean verification status |

#### Screen Context

| Variable | Description | Example |
|----------|-------------|---------|
| `locale` | Current locale | `en-US` |
| `dir` | Text direction | `auto`, `rtl`, `ltr` |
| `prompt.name` | Current prompt | `login`, `mfa` |
| `prompt.screen.name` | Current screen | `login`, `mfa-login-options` |
| `prompt.screen.texts` | Localized screen text | `{"pageTitle": "Log In"}` |

### Template Limitations

- **CSS class names change on each Auth0 build.** Do not target internal class names; they will break.
- **HTML structure may change.** Avoid customizations that depend on the widget's internal DOM.
- **Storybook rendering**: `<script>` tags break Storybook. Workaround: `<scr` + `ipt>code</scr` + `ipt>`

## Text Customization

### Supported Prompts

Common prompts you can customize (not a complete list; Auth0 supports additional prompts for MFA methods, passkeys, and other flows):

| Prompt | Screens |
|--------|---------|
| `login` | `login` |
| `login-id` | `login-id` |
| `login-password` | `login-password` |
| `signup` | `signup` |
| `signup-id` | `signup-id` |
| `signup-password` | `signup-password` |
| `consent` | `consent` |
| `mfa` | `mfa-enroll-options`, `mfa-login-options`, `mfa-otp-challenge` |
| `reset-password` | `reset-password-request`, `reset-password-email` |
| `device-flow` | `device-code-activation`, `device-code-confirmation` |

### API Behavior

The `PUT /api/v2/prompts/<prompt>/custom-text/<language>` endpoint **replaces** all custom text for that prompt and language. To update one screen without losing others, first GET the current text, merge your changes, then PUT the full object back.

`GET` returns only the keys you have explicitly set, not the full set of Auth0 default strings. An empty object (`{}`) means no custom text is set and Auth0's defaults are used.

```bash
# Get current text, modify, then set
CURRENT=$(auth0 api get "prompts/login/custom-text/en")
# Merge changes into $CURRENT
auth0 api put "prompts/login/custom-text/en" --data "$UPDATED"
```

### Delete Custom Text

Send an empty object to remove all custom text for a prompt:

```bash
auth0 api put "prompts/login/custom-text/en" --data '{}'
```

---
