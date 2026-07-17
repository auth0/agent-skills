# Auth0 ACUL (Advanced Customization for Universal Login) — reference hub

Build fully custom login/signup screens with your own code or framework, beyond what theme settings allow. Covers the multi-phase ACUL Screen Generator workflow (CLI auth, project setup, screen scaffolding, theme extraction, code generation, build validation, dev-mode wiring), the ACUL React + JS SDK APIs, the `auth0 acul` CLI commands, the full screen catalog, and social-login + theming patterns.

<!-- Single-intent FEATURE group carved from the original feature-acul.md.
     The guide leaf is the entry point for every ACUL task: it holds the
     reference hierarchy, auth0-acul-samples architecture, prerequisites, and
     the full 9-phase generator workflow (Phase 0-8). The other leaves are
     on-demand lookups. Read the guide first (hop 1), then the leaf your task
     needs. Asset templates live under assets/acul/ (.tsx/.css/.ts) and are
     referenced directly by the leaves. -->

**Prerequisites (every ACUL task needs these):**

- Auth0 CLI installed: `brew install auth0`
- Custom domain configured on the Auth0 tenant (hard ACUL requirement)
- Node.js **≥ 22** (required by Auth0 CLI-generated ACUL projects)

ACUL is CLI-driven by design: the CLI scaffolds and previews the screen *code*, which neither Terraform nor the MCP server can do — so this workflow uses the Auth0 CLI regardless of the project's other tooling. The one declarative piece is the tenant-side toggle that switches a screen's rendering mode to `advanced`, which an infrastructure-as-code project can manage with the Terraform `auth0_prompt_screen_renderer` resource (`rendering_mode`). The Auth0 MCP server exposes **no** ACUL/prompt-screen tool.

## Choose your task

You arrived here for the ACUL intent. Start with the guide, which holds the reference hierarchy, auth0-acul-samples architecture, prerequisites, and the full 9-phase generator workflow (environment validation, intent detection, project setup, screen requirements, tech stack, theme extraction, code generation, build validation, dev-mode wiring):

| Intent | Read |
|---|---|
| feature:acul | `Read: references/feature-acul/guide.md` |

**Then, as needed for your task:**
- SDK API lookup (React `@auth0/auth0-acul-react` hooks + action functions, JS `@auth0/auth0-acul-js` manager classes, import paths, component structure): `Read: references/feature-acul/sdk-reference.md`
- `auth0 acul` CLI command and flag reference (`init`, `screen add`, `config`, `dev`, typical workflows): `Read: references/feature-acul/cli-reference.md`
- Screen catalog (all React + JS screens with samples availability and SDK URLs), social-login button patterns, and theming/design-token patterns: `Read: references/feature-acul/patterns.md`

Read only the leaf (or leaves) your task needs — not all of them.
