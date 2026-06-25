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

### One Plugin, All Skills

**Plugin: auth0** — All Auth0 agent skills in a single plugin.

Core skills:
- `auth0-quickstart` - Framework detection and routing
- `auth0-migration` - Migrate from other auth providers
- `auth0-mfa` - Multi-Factor Authentication
- `acul-screen-generator` - Custom Universal Login screens and theming

Frontend framework skills:
- `auth0-react` - React SPAs
- `auth0-vue` - Vue.js 3
- `auth0-angular` - Angular 12+
- `auth0-spa-js` - Vanilla JS SPAs
- `auth0-flutter-web` - Flutter Web (Dart)

Backend/fullstack framework skills:
- `auth0-nextjs` - Next.js
- `auth0-nuxt` - Nuxt 3/4
- `auth0-express` - Express.js
- `auth0-flask` - Flask
- `auth0-fastify` - Fastify web applications
- `auth0-fastify-api` - Fastify API authentication
- `auth0-fastapi-api` - FastAPI API authentication
- `auth0-java-mvc-common` - Java Servlet web applications
- `auth0-springboot-api` - Spring Boot API authentication
- `auth0-aspnetcore-authentication` - ASP.NET Core MVC, Razor Pages, Blazor Server web applications
- `auth0-aspnetcore-api` - ASP.NET Core API authentication
- `express-oauth2-jwt-bearer` - Node.js/Express API JWT Bearer validation

Mobile skills:
- `auth0-ionic-angular` - Ionic Angular + Capacitor (iOS/Android)
- `auth0-ionic-react` - Ionic React + Capacitor (iOS/Android)
- `auth0-ionic-vue` - Ionic Vue + Capacitor (iOS/Android)
- `auth0-android` - Android (Kotlin/Java)
- `auth0-android-major-migration` - Auth0.Android major version upgrades (v3 → v4)
- `auth0-swift` - iOS/macOS (Swift)
- `auth0-swift-major-migration` - Auth0.swift major version upgrades
- `auth0-react-native` - React Native CLI (bare workflow)
- `auth0-expo` - Expo (managed workflow)
- `auth0-maui` - .NET MAUI cross-platform (iOS, Android, macOS, Windows)
- `auth0-net-android` - .NET Android (Xamarin)
- `auth0-net-ios` - .NET iOS (Xamarin)

Desktop Application skills:
- `auth0-winforms` - .NET WinForms applications
- `auth0-wpf` - .NET WPF applications
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
│           ├── auth0-quickstart/
│           ├── auth0-migration/
│           ├── auth0-mfa/
│           ├── acul-screen-generator/
│           ├── auth0-react/
│           ├── auth0-vue/
│           ├── auth0-angular/
│           ├── auth0-spa-js/
│           ├── auth0-flutter-web/
│           ├── auth0-nextjs/
│           ├── auth0-nuxt/
│           ├── auth0-express/
│           ├── auth0-flask/
│           ├── auth0-fastify/
│           ├── auth0-fastify-api/
│           ├── auth0-fastapi-api/
│           ├── auth0-java-mvc-common/
│           ├── auth0-springboot-api/
│           ├── auth0-aspnetcore-authentication/
│           ├── auth0-aspnetcore-api/
│           ├── express-oauth2-jwt-bearer/
│           ├── auth0-ionic-angular/
│           ├── auth0-ionic-vue/
│           ├── auth0-ionic-react/
│           ├── auth0-react-native/
│           ├── auth0-expo/
│           ├── auth0-android/
│           ├── auth0-android-major-migration/
│           ├── auth0-swift/
│           ├── auth0-maui/
│           ├── auth0-net-android/
│           ├── auth0-winforms/
│           ├── auth0-net-ios/
│           └── auth0-wpf/
│           └── auth0-swift-major-migration/
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
# Install all skills
npx skills add auth0/agent-skills

# Install individual skill
npx skills add auth0/agent-skills/plugins/auth0/skills/auth0-quickstart
```

### Method 3: Manual Installation

```bash
git clone https://github.com/auth0/agent-skills.git
cd agent-skills

# Copy all skills
cp -r plugins/auth0/skills/* ~/.claude/skills/
```

---

## Use Cases

### Install Everything (Most Common)
User installs "Auth0 Agent Skills" from marketplace -> gets the plugin with all 31 skills.

### Install One Framework
Developer working on React app -> uses CLI to install just `auth0-react` skill.

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
