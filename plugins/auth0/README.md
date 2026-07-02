# auth0

Auth0 skills for setting up authentication, migrating from other providers, implementing Multi-Factor Authentication (MFA), framework-specific SDK integrations and CLI.

## Installation

**Via Claude Code:**

First, add the Auth0 marketplace if you haven't already:

```bash
/plugin marketplace add auth0/agent-skills
```

Then install the plugin:

```bash
/plugin install auth0@auth0-agent-skills
```

**Via Skills CLI:**

```bash
npx skills add auth0/agent-skills/plugins/auth0
```

## Skills

| Skill | Description | Documentation |
|-------|-------------|---------------|
| [auth0](skills/auth0) | Adds Auth0 authentication to any app. Covers 35+ frameworks (React, Next.js, Vue, Angular, Express, Flask, FastAPI, Spring Boot, Swift, Android, Flutter, Laravel, Go, PHP, .NET MAUI, ASP.NET Core, React Native, Expo, Ionic, and more), MFA, Organizations, custom domains, ACUL screen generation, branding, debugging auth errors, security best practices, and migration from other providers. | [SKILL.md](skills/auth0/SKILL.md) |
