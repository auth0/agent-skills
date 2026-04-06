![Auth0 Agent Skills](https://cdn.auth0.com/website/sdks/banners/agent-skills.png)

# Auth0 Agent Skills

[![License](https://img.shields.io/:license-apache-blue.svg?style=flat)](https://opensource.org/licenses/Apache-2.0)

📚 [Documentation](https://auth0.com/docs/quickstart/agent-skills) • 🚀 [Getting Started](#quick-start) • 💬 [Feedback](#feedback)

AI agent skills for Auth0 authentication integration. These skills help AI coding assistants (Claude Code, Cursor, Copilot) implement Auth0 correctly across any framework.

## What are Agent Skills?

Agent Skills are structured instructions that help AI agents implement features correctly. Each skill contains best practices, code patterns, and step-by-step guidance for Auth0 integration.

Learn more at [agentskills.io](https://agentskills.io) and [skills.sh](https://skills.sh)

## Quick Start

Get Auth0 up running in your app in minutes:

### Prerequisites
- An Auth0 account ([sign up free](https://auth0.com/signup))
- An AI coding assistant (Claude Code, Cursor, or GitHub Copilot)

### Steps

1. **Install the Auth0 skills** (choose one method):
   *Option 1: Via Skills CLI (fastest)*
   ```bash
   npx skills add auth0/agent-skills
   ```

   *Option 2: Via Claude Code marketplace*
   ```bash
   # Open Claude Code
   claude
   
   # Add the Auth0 marketplace
   /plugin marketplace add auth0/agent-skills

   # Install plugins
   /plugin install auth0@auth0-agent-skills
   /plugin install auth0-sdks@auth0-agent-skills
   ```

2. **Ask your AI assistant to add Auth0**:
   ```
    "Add authentication to my React app"
    "Implement login with Auth0"
    "Add MFA to my application"
   ```
  
That's it! Your AI assistant will setup Auth0 on your app and you will have production-ready authentication powered by Auth0.

## Installation

### Option 1: Claude Code Marketplace (Recommended for Enterprise)

We offer **two separate plugins** for flexible installation:

#### Step 1: Open Claude Code

```bash
claude
```

#### Step 2: Add the Auth0 Marketplace

Add the Auth0 agent skills marketplace to Claude Code:

```bash
# From GitHub
/plugin marketplace add auth0/agent-skills

# Or from local path
/plugin marketplace add /path/to/agent-skills
```

#### Step 3: Install Plugins

**Auth0 Core Skills Plugin**

Essential skills for getting started and advanced security:
- `auth0-quickstart` - Framework detection and routing
- `auth0-migration` - Migrate from other auth providers
- `auth0-mfa` - Multi-Factor Authentication

```bash
/plugin install auth0@auth0-agent-skills
```

**Auth0 SDK Skills Plugin**

Framework-specific implementation guides:
- `auth0-react` - React SPAs
- `auth0-nextjs` - Next.js (App Router & Pages Router)
- `auth0-nuxt` - Nuxt 3/4 applications
- `auth0-vue` - Vue.js 3
- `auth0-angular` - Angular 12+
- `auth0-express` - Express.js
- `auth0-fastify` - Fastify web applications
- `auth0-fastify-api` - Fastify API authentication
- `auth0-fastapi-api` - FastAPI API authentication
- `auth0-react-native` - React Native & Expo
- `auth0-android` - Android
- `auth0-swift` - Native iOS/macOS applications (Swift)

```bash
/plugin install auth0-sdks@auth0-agent-skills
```

**Recommendation**: Install both plugins for complete Auth0 integration coverage:

```bash
/plugin install auth0@auth0-agent-skills auth0-sdks@auth0-agent-skills
```

### Option 2: CLI Installation (Recommended for Developers)

Install all skills using the [Skills CLI](https://skills.sh):

```bash
# Install all skills from both plugins
npx skills add auth0/agent-skills

# Install skills from a specific plugin
npx skills add auth0/agent-skills/plugins/auth0
npx skills add auth0/agent-skills/plugins/auth0-sdks

# Install individual skills
npx skills add auth0/agent-skills/plugins/auth0/skills/auth0-quickstart
npx skills add auth0/agent-skills/plugins/auth0-sdks/skills/auth0-react
```

### Option 3: Manual Installation

Clone the repository and copy skills to your Claude configuration:

```bash
# Clone the repository
git clone https://github.com/auth0/agent-skills.git

# Copy all skills from both plugins
cp -r agent-skills/plugins/auth0/skills/* ~/.claude/skills/
cp -r agent-skills/plugins/auth0-sdks/skills/* ~/.claude/skills/

# Or copy to your project's Claude skills directory
cp -r agent-skills/plugins/*/skills/* .claude/skills/
```

## Available Skills

### Core Skills (auth0 plugin)

| Skill | Description | Version |
|-------|-------------|---------|
| [auth0-quickstart](./plugins/auth0/skills/auth0-quickstart/SKILL.md) | Framework detector and router | v1.0.0 |
| [auth0-migration](./plugins/auth0/skills/auth0-migration/SKILL.md) | Migrate from other auth providers | v1.0.0 |
| [auth0-mfa](./plugins/auth0/skills/auth0-mfa/SKILL.md) | Multi-Factor Authentication | v1.0.0 |

### Frontend Framework Skills (auth0-sdks plugin)

| Skill | Description | Version |
|-------|-------------|---------|
| [auth0-react](./plugins/auth0-sdks/skills/auth0-react/SKILL.md) | React SPAs (Vite, CRA) | v1.0.0 |
| [auth0-vue](./plugins/auth0-sdks/skills/auth0-vue/SKILL.md) | Vue.js 3 applications | v1.0.0 |
| [auth0-angular](./plugins/auth0-sdks/skills/auth0-angular/SKILL.md) | Angular 12+ applications | v1.0.0 |

### Backend Framework Skills (auth0-sdks plugin)

| Skill | Description | Version |
|-------|-------------|---------|
| [auth0-nextjs](./plugins/auth0-sdks/skills/auth0-nextjs/SKILL.md) | Next.js App Router & Pages Router | v1.0.0 |
| [auth0-nuxt](./plugins/auth0-sdks/skills/auth0-nuxt/SKILL.md) | Nuxt 3/4 applications | v1.0.0 |
| [auth0-express](./plugins/auth0-sdks/skills/auth0-express/SKILL.md) | Express.js web applications | v1.0.0 |
| [auth0-fastify](./plugins/auth0-sdks/skills/auth0-fastify/SKILL.md) | Fastify web applications | v1.0.0 |
| [auth0-fastify-api](./plugins/auth0-sdks/skills/auth0-fastify-api/SKILL.md) | Fastify API authentication | v1.0.0 |
| [auth0-fastapi-api](./plugins/auth0-sdks/skills/auth0-fastapi-api/SKILL.md) | FastAPI API authentication | v1.0.0 |

### Mobile Skills (auth0-sdks plugin)

| Skill | Description | Version |
|-------|-------------|---------|
| [auth0-react-native](./plugins/auth0-sdks/skills/auth0-react-native/SKILL.md) | React Native & Expo | v1.0.0 |
| [auth0-android](./plugins/auth0-sdks/skills/auth0-android/SKILL.md) | Android | v1.0.0 |
| [auth0-swift](./plugins/auth0-sdks/skills/auth0-swift/SKILL.md) | Native iOS/macOS (Swift) | v1.0.0 |

---

### auth0-quickstart

The quickstart skill is now a **lightweight router** that:
- Detects your framework automatically
- Guides you to the right framework-specific skill
- Sets up Auth0 CLI and creates applications
- Provides CLI quick reference and troubleshooting

### Framework-Specific Skills

Each framework has its own dedicated skill with:
- Framework-specific installation and setup
- Idiomatic code patterns and best practices
- Protected routes and authentication flows
- API integration examples
- Common issues and troubleshooting
- Security considerations

### auth0-migration

The migration skill covers:
- User export from existing providers (Firebase, Cognito, etc.)
- Bulk import to Auth0
- Code migration patterns (before/after examples)
- JWT validation updates
- Gradual migration strategies

### auth0-mfa

The MFA skill covers:
- Step-up authentication with `acr_values`
- `amr` claim validation
- Adaptive/risk-based MFA
- MFA enrollment flows
- Multiple factors (TOTP, SMS, Email, Push, WebAuthn)

### Supported Frameworks

| Frontend SPAs | Backend/Web Apps | Mobile | APIs |
|---------------|------------------|--------|------|
| React | Next.js | React Native | Express.js |
| Vue.js | SvelteKit | Expo | Fastify |
| Angular | Nuxt.js | Android (Kotlin) | Flask |
| | Remix | iOS (Swift) | FastAPI |
| | Fastify | | Django REST |
| | Ruby on Rails | | Go |
| | PHP/Laravel | | Spring Boot |
| | | | ASP.NET Core |

### Coming Soon

| Skill | Description |
|-------|-------------|
| auth0-passkeys | Passkeys and WebAuthn implementation |
| auth0-organizations | Multi-tenancy and B2B organizations |
| auth0-dpop | DPoP token binding |
| auth0-token-exchange | Custom Token Exchange (RFC 8693) |
| auth0-enterprise | PAR, CIBA, RAR, and enterprise features |


## Migration Support

The quickstart skill includes comprehensive migration guidance for moving from other auth providers:

- **User export/import** - Bulk user migration with password hash support
- **Code patterns** - Before/after examples for common auth patterns
- **Gradual migration** - Phased approach for production apps
- **JWT validation** - Update APIs to validate Auth0 tokens

## SDK Coverage

| Platform | SDK | Skill |
|----------|-----|-------|
| React | [@auth0/auth0-react](https://github.com/auth0/auth0-react) | auth0-react, auth0-mfa |
| Vue.js | [@auth0/auth0-vue](https://github.com/auth0/auth0-vue) | auth0-vue, auth0-mfa |
| Angular | [@auth0/auth0-angular](https://github.com/auth0/auth0-angular) | auth0-angular, auth0-mfa |
| Next.js | [@auth0/nextjs-auth0](https://github.com/auth0/nextjs-auth0) | auth0-nextjs, auth0-mfa |
| Nuxt.js | [@auth0/auth0-nuxt](https://github.com/auth0/auth0-nuxt) | auth0-nuxt |
| Express | [express-openid-connect](https://github.com/auth0/express-openid-connect) | auth0-express, auth0-mfa |
| Fastify | [@auth0/auth0-fastify](https://github.com/auth0/auth0-fastify) | auth0-fastify, auth0-mfa |
| Fastify API | [@auth0/auth0-fastify-api](https://github.com/auth0/auth0-fastify) | auth0-fastify-api |
| FastAPI | [auth0-fastapi-api](https://github.com/auth0/auth0-fastapi-api) | auth0-fastapi-api |
| React Native | [react-native-auth0](https://github.com/auth0/react-native-auth0) | auth0-react-native |
| Android | [Auth0.Android](https://github.com/auth0/Auth0.Android) | auth0-android |
| iOS/macOS | [Auth0.swift](https://github.com/auth0/Auth0.swift) | auth0-swift |

## Project Structure

```
auth0/agent-skills/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace metadata (lists both plugins)
├── plugins/
│   ├── auth0/                    # Core Plugin
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json       # Plugin configuration
│   │   └── skills/
│   │       ├── auth0-quickstart/
│   │       │   ├── SKILL.md
│   │       │   └── reference/
│   │       │       ├── cli.md
│   │       │       ├── concepts.md
│   │       │       └── environments.md
│   │       ├── auth0-migration/
│   │       │   ├── SKILL.md
│   │       │   └── reference/
│   │       │       ├── code-patterns.md
│   │       │       └── user-import.md
│   │       └── auth0-mfa/
│   │           ├── SKILL.md
│   │           └── reference/
│   │               ├── advanced.md
│   │               ├── api.md
│   │               ├── backend.md
│   │               └── examples.md
│   └── auth0-sdks/               # SDK Plugin
│       ├── .claude-plugin/
│       │   └── plugin.json       # Plugin configuration
│       └── skills/
│           ├── auth0-react/
│           │   ├── SKILL.md
│           │   └── reference/
│           │       ├── api.md
│           │       ├── integration.md
│           │       └── setup.md
│           ├── auth0-nextjs/
│           │   ├── SKILL.md
│           │   └── reference/
│           │       ├── api.md
│           │       ├── integration.md
│           │       └── setup.md
│           ├── auth0-vue/
│           │   ├── SKILL.md
│           │   └── reference/
│           │       ├── api.md
│           │       ├── integration.md
│           │       └── setup.md
│           ├── auth0-angular/
│           │   ├── SKILL.md
│           │   └── reference/
│           │       ├── api.md
│           │       ├── integration.md
│           │       └── setup.md
│           ├── auth0-nuxt/
│           │   ├── SKILL.md
│           │   └── references/
│           │       ├── examples.md
│           │       ├── route-protection.md
│           │       └── session-stores.md
│           ├── auth0-express/
│           │   ├── SKILL.md
│           │   └── reference/
│           │       ├── api.md
│           │       ├── integration.md
│           │       └── setup.md
│           ├── auth0-fastify/
│           │   └── SKILL.md
│           ├── auth0-fastify-api/
│           │   └── SKILL.md
│           ├── auth0-fastapi-api/
│           │   ├── SKILL.md
│           │   └── references/
│           │       ├── api.md
│           │       ├── integration.md
│           │       └── setup.md
│           ├── auth0-react-native/
│           │   ├── SKILL.md
│           │   └── reference/
│           │       ├── api.md
│           │       ├── patterns.md
│           │       └── setup.md
│           └── auth0-android/
│               ├── SKILL.md
│               ├── references/
│               │   ├── api.md
│               │   ├── integration.md
│               │   └── setup.md
│               ├── scripts/
│               │   ├── bootstrap.mjs
│               │   ├── package.json
│               │   └── utils/
│               │       ├── auth0-api.mjs
│               │       ├── change-plan.mjs
│               │       ├── clients.mjs
│               │       ├── connections.mjs
│               │       ├── discovery.mjs
│               │       ├── helpers.mjs
│               │       ├── strings-writer.mjs
│               │       └── validation.mjs
│               └── tests/
│                   ├── evals.json
│                   ├── graders.json
│                   └── prompt.md
│           └── auth0-swift/
│               ├── SKILL.md
│               └── references/
│                   ├── setup.md
│                   ├── api.md
│                   └── integration.md
├── .gitignore
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── PLUGIN.md
└── README.md
```

## Feedback

### Contributing

We appreciate feedback and contributions! Before you get started, please see:

- [Auth0's general contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md)
- [Auth0's code of conduct](https://github.com/auth0/open-source-template/blob/master/CODE-OF-CONDUCT.md)

### Raise an Issue

To provide feedback or report a bug, please [raise an issue](https://github.com/auth0/agent-skills/issues).

### Vulnerability Reporting

Please do not report security vulnerabilities on the public GitHub issue tracker. See the [Responsible Disclosure Program](https://auth0.com/responsible-disclosure-policy) for details.

---

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://cdn.auth0.com/website/sdks/logos/auth0_light_mode.png" width="150">
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.auth0.com/website/sdks/logos/auth0_dark_mode.png" width="150">
    <img alt="Auth0 Logo" src="https://cdn.auth0.com/website/sdks/logos/auth0_light_mode.png" width="150">
  </picture>
</p>

<p align="center">
  Auth0 is an easy to implement, adaptable authentication and authorization platform.<br>
  To learn more checkout <a href="https://auth0.com/why-auth0">Why Auth0?</a>
</p>

<p align="center">
  This project is licensed under the Apache 2.0 license. See the <a href="./LICENSE">LICENSE</a> file for more info.
</p>
