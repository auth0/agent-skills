# Claude Code Plugin Architecture

This repository provides a **single Claude Code plugin** managed by a marketplace.json file.

## Architecture Overview

### Marketplace File

One `marketplace.json` at the root level lists the plugin:

```json
{
  "name": "auth0-agent-skills",
  "plugins": [
    {
      "name": "auth0",
      "source": "plugins/auth0",
      ...
    }
  ]
}
```

### One Plugin, One Skill

**Plugin: auth0** — a single unified `auth0` skill.

The plugin ships exactly one skill, `auth0`, built as a **router + reference
pool**:

- `SKILL.md` is a router. It detects intent → framework → tooling and then
  loads the 2–3 matching reference files. Routing is file-based and
  deterministic (it reads `package.json`, `composer.json`, `go.mod`,
  `*.csproj`, `pubspec.yaml`, etc.), not a model guess.
- `references/` is a pool of on-demand Markdown docs; large ones are grouped into
  hub+leaf directories (a `<stem>/` with `index.md` + document-section leaves):
  - `feature-*` — a capability spanning frameworks (MFA, Organizations,
    custom domains, ACUL, branding, migration, DPoP).
  - `framework-*` — one SDK/framework integration (React, Next.js, Vue,
    Nuxt, Angular, Express, Flask, FastAPI, Spring Boot, Go, Swift, Android,
    Flutter, Laravel, PHP, ASP.NET Core, React Native, Expo, Ionic, .NET MAUI,
    WinForms, WPF, and more).
  - `tooling-*.md` — CLI / MCP / Terraform.
  - `pattern-*.md` — cross-cutting guidance (security, token handling,
    multi-tenant, rate limiting, common errors).

One skill means one `description` competing for activation. Navigation is a
depth-2 tree: a flat reference or a group leaf links to nothing, and the only
second hop is a group's hub `index.md` dispatching to a leaf in its own directory.
See [`docs/architecture.md`](./docs/architecture.md) for the full rationale,
routing flow, and the CI-enforced reachability invariant.

---

## Directory Structure

```
auth0/agent-skills/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace metadata
├── .cursor-plugin/
│   └── marketplace.json          # Cursor marketplace metadata
├── plugins/
│   └── auth0/                    # Single unified plugin
│       ├── .claude-plugin/
│       │   └── plugin.json       # Claude plugin config
│       ├── .cursor-plugin/
│       │   └── plugin.json       # Cursor plugin config
│       ├── .codex-plugin/
│       │   └── plugin.json       # Codex plugin config
│       ├── README.md
│       └── skills/
│           └── auth0/                 # The single unified skill
│               ├── SKILL.md           # Router (intent → framework → tooling)
│               ├── references/        # feature-*, framework-*, tooling-*,
│               │                      #   pattern-* (large ones are <stem>/ groups)
│               ├── assets/            # Templates (e.g. ACUL screens)
│               └── scripts/           # validate-skill.sh, reachability check
├── docs/
│   └── architecture.md               # Why one skill + routing details
├── .gitignore
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── PLUGIN.md
└── README.md
```

---

## File Purposes

### .claude-plugin/marketplace.json

**Purpose**: Master marketplace listing for the plugin

**Location**: `.claude-plugin/marketplace.json`

**Contains**:
- Repository metadata (name, version, author, license)
- Plugin configuration with source path
- Skills are auto-discovered from the `skills/` directory within the plugin

### plugins/auth0/.claude-plugin/plugin.json

**Purpose**: Plugin-specific configuration

**Contains**:
- Plugin name, display name, and version
- Plugin description
- Skills are auto-discovered from the `skills/` directory

---

## Installation Methods

### Method 1: Marketplace (Recommended)

1. Open Claude Code
2. Navigate to **Settings > Plugins**
3. Search "Auth0"
4. Install "Auth0 Agent Skills"

### Method 2: CLI Installation

```bash
# Install the auth0 skill
npx skills add auth0/agent-skills
```

### Method 3: Manual Installation

```bash
git clone https://github.com/auth0/agent-skills.git
cd agent-skills

# Copy the auth0 skill
cp -r plugins/auth0/skills/auth0 ~/.claude/skills/
```

---

## Use Cases

User installs "Auth0 Agent Skills" from the marketplace -> gets the plugin with
the single `auth0` skill. When the user asks to add or fix authentication, the
router detects their framework and loads the matching reference files — there is
no per-framework skill to pick.

---

## Publishing

### Update Version

Edit `.claude-plugin/marketplace.json` and `plugins/auth0/.claude-plugin/plugin.json`.

### Create Release

```bash
git add .
git commit -m "Release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

---

## Support

- **GitHub Issues**: https://github.com/auth0/agent-skills/issues
- **Email**: support@auth0.com
- **Documentation**: README.md for usage, PLUGIN.md for architecture
