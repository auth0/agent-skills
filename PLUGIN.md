# Claude Code Plugin Architecture

This repository provides **two separate Claude Code plugins** managed by a single marketplace.json file.

## Architecture Overview

### Single Marketplace File

One `marketplace.json` at the root level lists both plugins:

```json
{
  "name": "auth0-agent-skills",
  "plugins": [
    {
      "name": "auth0",
      "path": "plugins/auth0",
      ...
    },
    {
      "name": "auth0-sdks",
      "path": "plugins/auth0-sdks",
      ...
    }
  ]
}
```

### Two Plugins, Each with Skills

**Plugin 1: auth0** (Core Skills)
- `auth0-quickstart` - Framework detection
- `auth0-migration` - Migrate from other providers
- `auth0-mfa` - Multi-Factor Authentication

**Plugin 2: auth0-sdks** (SDK Skills)
- `auth0-react` - React SPAs
- `auth0-nextjs` - Next.js
- `auth0-vue` - Vue.js 3
- `auth0-angular` - Angular 12+
- `auth0-express` - Express.js
- `auth0-react-native` - React Native & Expo

---

## Directory Structure

```
auth0/agent-skills/
├── .claude-plugin/
│   └── marketplace.json          # Single marketplace file listing both plugins
├── plugins/
│   ├── auth0/                    # Core Plugin
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json       # Plugin config
│   │   └── skills/               # Skills directory
│   │       ├── auth0-quickstart/
│   │       ├── auth0-migration/
│   │       └── auth0-mfa/
│   └── auth0-sdks/               # SDK Plugin
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin config
│       └── skills/               # Skills directory
│           ├── auth0-react/
│           ├── auth0-nextjs/
│           ├── auth0-vue/
│           ├── auth0-angular/
│           ├── auth0-express/
│           └── auth0-react-native/
├── PLUGIN.md
├── README.md
└── LICENSE
```

---

## File Purposes

### .claude-plugin/marketplace.json

**Purpose**: Master marketplace listing for both plugins

**Location**: `.claude-plugin/marketplace.json`

**Contains**:
- Repository metadata (name, version, author, license)
- Array of plugins with their configurations
- Each plugin definition includes:
  - Plugin name (required, kebab-case)
  - Plugin source path (required) - e.g., `plugins/auth0`
  - Plugin description, version, keywords, category
  - Skills are auto-discovered from the `skills/` directory within each plugin

**Example**:
```json
{
  "name": "auth0-agent-skills",
  "displayName": "Auth0 Agent Skills",
  "version": "1.0.0",
  "plugins": [
    {
      "name": "auth0",
      "source": "plugins/auth0",
      "description": "Essential Auth0 skills including quickstarts, migration from other providers, and Multi-Factor Authentication (MFA).",
      "version": "1.0.0",
      "keywords": ["auth0", "quickstart", "migration", "mfa", "security"],
      "category": "authentication"
    },
    {
      "name": "auth0-sdks",
      "source": "plugins/auth0-sdks",
      "description": "Framework-specific Auth0 SDK integration skills for React, Next.js, Vue, Angular, Express, and React Native with complete implementation guides.",
      "version": "1.0.0",
      "keywords": ["auth0", "sdk", "react", "nextjs", "vue", "angular", "express", "react-native"],
      "category": "integration"
    }
  ]
}
```

### plugins/*/\.claude-plugin/plugin.json

**Purpose**: Plugin-specific configuration

**Location**:
- `plugins/auth0/.claude-plugin/plugin.json`
- `plugins/auth0-sdks/.claude-plugin/plugin.json`

**Contains**:
- Plugin name, display name, and version
- Plugin description
- Skills are auto-discovered from the `skills/` directory

**Example** (`plugins/auth0/.claude-plugin/plugin.json`):
```json
{
  "name": "auth0",
  "displayName": "Auth0 Skills",
  "version": "1.0.0",
  "description": "Essential Auth0 skills including quickstarts, migration from other providers, and Multi-Factor Authentication (MFA)."
}
```

---

## Installation Methods

### Method 1: Marketplace (Recommended)

**Install Both Plugins:**
1. Open Claude Code
2. Navigate to **Settings → Plugins**
3. Search "Auth0"
4. Install "Auth0 Agent Skills" (installs both plugins)

**Install Individual Plugin:**
- Search for "Auth0 Core Skills" or "Auth0 SDK Skills"
- Install the specific plugin you need

### Method 2: CLI Installation

```bash
# Install all skills from both plugins
npx skills add auth0/agent-skills

# Install specific plugin
npx skills add auth0/agent-skills/plugins/auth0
npx skills add auth0/agent-skills/plugins/auth0-sdks

# Install individual skill
npx skills add auth0/agent-skills/plugins/auth0/skills/auth0-quickstart
```

### Method 3: Manual Installation

```bash
git clone https://github.com/auth0/agent-skills.git
cd agent-skills

# Copy all skills
cp -r plugins/auth0/skills/* ~/.claude/skills/
cp -r plugins/auth0-sdks/skills/* ~/.claude/skills/
```

---

## Benefits of This Architecture

### Single Marketplace Entry
✅ **Unified discovery** - Users find both plugins under one entry
✅ **Consistent branding** - One Auth0 listing in marketplace
✅ **Easier management** - Single metadata file to maintain
✅ **Bundle option** - Can install all at once

### Separate Plugins
✅ **Flexibility** - Users can install only what they need
✅ **Smaller downloads** - Each plugin is focused
✅ **Independent updates** - Update SDK skills without core
✅ **Clear boundaries** - Logical separation of concerns

### Skills in Plugin Directories
✅ **Self-contained** - Each plugin includes its own skills
✅ **No shared dependencies** - Skills belong to their plugin
✅ **Easy distribution** - Plugin is a complete package
✅ **Clear ownership** - Obvious which skills belong to which plugin

---

## Plugin Independence

Both plugins are **fully independent** and can be installed separately:

- **auth0** plugin: Core skills (quickstart, migration, MFA)
- **auth0-sdks** plugin: Framework-specific integrations

**Benefits:**
- ✅ Install only what you need
- ✅ No forced dependencies
- ✅ Maximum flexibility
- ✅ Smaller installations

**Recommendation:** Install both for complete Auth0 coverage, but either plugin works standalone.

---

## Publishing to Marketplace

### Update Version

Edit `marketplace.json`:
```json
{
  "version": "1.1.0",
  "plugins": [
    {
      "name": "auth0",
      "version": "1.1.0",
      ...
    },
    {
      "name": "auth0-sdks",
      "version": "1.1.0",
      ...
    }
  ]
}
```

Also update each `plugins/*/plugin.json`.

### Create Release

```bash
git add .
git commit -m "Release v1.1.0"
git tag v1.1.0
git push origin main --tags
```

### Submit to Marketplace

1. Submit repository to Claude Code marketplace
2. Marketplace will read `marketplace.json`
3. Both plugins will be listed under "Auth0 Agent Skills"
4. Users can install one or both plugins

---

## Use Cases

### Install Everything (Most Common)
User installs "Auth0 Agent Skills" from marketplace → gets both plugins with all 9 skills

### Install Core Only
User only needs framework detection and MFA → installs just `auth0` plugin (3 skills)

### Install SDKs Only
User already has quickstart setup → installs just `auth0-sdks` plugin (6 skills)
Note: Will auto-install `auth0` due to dependency

### Install One Framework
Developer working on React app → uses CLI to install just `auth0-react` skill

---

## Pricing Model

Both plugins marked as **"paid"**:

```json
{
  "pricing": "paid"
}
```

Indicates enterprise/customer-only distribution with Auth0 support.

---

## Support

- **GitHub Issues**: https://github.com/auth0/agent-skills/issues
- **Email**: support@auth0.com
- **Documentation**: README.md for usage, PLUGIN.md for architecture

---

## Version History

- **v1.0.0** - Initial marketplace release
  - Single marketplace.json listing both plugins
  - Plugins in their own directories with their skills
  - Clear separation: core (3 skills) vs SDKs (6 skills)
  - Progressive disclosure for large skills
  - Skills auto-discovery within plugins
  - Plugin independence (no forced dependencies)
