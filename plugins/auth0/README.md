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
| [auth0](skills/auth0) | Adds Auth0 authentication to any app. Covers 35+ frameworks (React, Next.js, Vue, Angular, Express, Flask, FastAPI, Spring Boot, Swift, Android, Flutter, Laravel, Go, PHP, .NET MAUI, ASP.NET Core, React Native, Expo, Ionic, and more), MFA, Organizations, custom domains, ACUL screen generation, branding, debugging auth errors, security best practices, running a tenant security & configuration audit (CheckMate), and migration from other providers. | [SKILL.md](skills/auth0/SKILL.md) |

## Forcing the skill with `/auth0`

Auto-detection is reliable on capable models. On a smaller/faster model in a
session with **many** other skills installed, the assistant can occasionally
miss the trigger — most often on open-ended *questions* ("how do I…?") rather
than direct instructions. When that happens, name the skill explicitly:

```
/auth0 how do I configure brand colors in Auth0?
```

Naming the skill removes the selection step entirely, so it always activates.

## Migrating from the individual skills

Earlier versions shipped one skill per SDK/framework (`auth0-react`,
`auth0-nextjs`, `express-oauth2-jwt-bearer`, …). These are now **consolidated
into the single `auth0` skill** above, which routes to the same guidance by
detecting your framework. Plugin/marketplace installs swap in the consolidated
skill on the next update with nothing to do. **If you referenced an old skill by
name** — in your `CLAUDE.md`, another skill's `requires.skills`, or any
instruction file — those names no longer exist and the reference will dangle;
replace them with `auth0`. See the [repository README](../../README.md#migrating-from-the-individual-skills)
for full migration details.
