![Auth0 Agent Skills](https://cdn.auth0.com/website/sdks/banners/agent-skills.png)

# Auth0 Agent Skills

[![License](https://img.shields.io/:license-apache-blue.svg?style=flat)](https://opensource.org/licenses/Apache-2.0)

AI agent skills that help coding assistants implement Auth0 authentication correctly. Works with [Claude Code](https://claude.ai/code), [Cursor](https://cursor.com), [GitHub Copilot](https://github.com/features/copilot), and [40+ other agents](https://agentskills.io/clients) that support the [Agent Skills](https://agentskills.io) format.

[Documentation](https://auth0.com/docs/quickstart/agent-skills) · [Getting Started](#prerequisites) · [Feedback](#feedback)

## Prerequisites

- An [Auth0 account](https://auth0.com/signup) (free)
- An AI coding assistant (Claude Code, Cursor, GitHub Copilot, or any [Agent Skills-compatible](https://agentskills.io/clients) tool)

## Install

### Claude Code

Auth0 is on the official Claude Code plugins marketplace:

```
/plugin install auth0@claude-plugins-official
```

Or type `/plugin` in a session, go to **Discover**, and search "Auth0".

From the terminal (no session needed):

```bash
claude plugin install auth0@claude-plugins-official
```

### Cursor

Auth0 is on the [Cursor marketplace](https://cursor.com/marketplace/auth0). Open the listing and click **Add** to install.

You can also install via `Cursor Settings → Rules → Add Rule → Remote Rule (GitHub)` and enter this repository URL.

### GitHub Copilot

```bash
npx skills add auth0/agent-skills --agent github-copilot
```

### Any Agent (Skills CLI)

The [Skills CLI](https://github.com/vercel-labs/skills) works with Claude Code, Cursor, Copilot, Codex, and [40+ other agents](https://agentskills.io/clients):

```bash
npx skills add auth0/agent-skills
```

Target specific agents with `--agent`:

```bash
npx skills add auth0/agent-skills --agent claude-code cursor
```

## What happens after install

When you ask your AI assistant something like "add Auth0 login to my app," the assistant:

1. Loads the **quickstart router** skill, which reads your project files (`package.json`, `requirements.txt`, `build.gradle`, etc.)
2. Detects your framework and selects the matching skill (e.g., `auth0-nextjs` for a Next.js project)
3. Follows the skill's step-by-step instructions to install the right SDK, create auth routes, configure environment variables, and wire up login/logout

You don't pick skills manually — framework detection handles it.

## Skills

24 skills covering web, mobile, and API authentication.

| Skill | SDK | Frameworks |
|-------|-----|------------|
| **Quickstart Router** | — | Detects your framework and routes to the right skill |
| **Migration** | — | Migrate from Firebase, Cognito, Supabase, Clerk, or custom auth |
| **MFA** | — | TOTP, SMS, email, push, WebAuthn |
| **ACUL Screen Generator** | [`@auth0/auth0-acul-react`](https://github.com/auth0/universal-login) | Custom Universal Login screens and theming |
| **React** | [`@auth0/auth0-react`](https://github.com/auth0/auth0-react) | React SPAs (Vite, CRA) |
| **Vue** | [`@auth0/auth0-vue`](https://github.com/auth0/auth0-vue) | Vue 3 |
| **Angular** | [`@auth0/auth0-angular`](https://github.com/auth0/auth0-angular) | Angular 13+ |
| **Vanilla JS** | [`@auth0/auth0-spa-js`](https://github.com/auth0/auth0-spa-js) | Any SPA (also Svelte, SolidJS) |
| **Next.js** | [`@auth0/nextjs-auth0`](https://github.com/auth0/nextjs-auth0) | Next.js 13+ (App Router & Pages Router) |
| **Nuxt** | [`@auth0/auth0-nuxt`](https://github.com/auth0/auth0-nuxt) | Nuxt 3/4 |
| **Express** | [`express-openid-connect`](https://github.com/auth0/express-openid-connect) | Express.js |
| **Flask** | [`auth0-server-python`](https://github.com/auth0/auth0-server-python) | Flask |
| **Fastify** | [`@auth0/auth0-fastify`](https://github.com/auth0/auth0-fastify) | Fastify |
| **Java Servlet** | [`mvc-auth-commons`](https://github.com/auth0/auth0-java-mvc-common) | Java Servlet |
| **Express API** | [`express-oauth2-jwt-bearer`](https://github.com/auth0/node-oauth2-jwt-bearer) | Node.js/Express APIs |
| **Fastify API** | [`@auth0/auth0-fastify`](https://github.com/auth0/auth0-fastify) | Fastify APIs |
| **FastAPI** | [`auth0-fastapi-api`](https://github.com/auth0/auth0-fastapi-api) | Python FastAPI |
| **Spring Boot API** | [`auth0-springboot-api`](https://github.com/auth0/auth0-auth-java) | Spring Boot |
| **ASP.NET Core API** | [`Auth0.AspNetCore.Authentication`](https://github.com/auth0/auth0-aspnetcore-authentication) | ASP.NET Core |
| **React Native** | [`react-native-auth0`](https://github.com/auth0/react-native-auth0) | React Native CLI (bare workflow) |
| **Expo** | [`react-native-auth0`](https://github.com/auth0/react-native-auth0) | Expo (managed workflow) |
| **Ionic Vue** | [`@auth0/auth0-vue`](https://github.com/auth0/auth0-vue) | Ionic Vue + Capacitor (iOS/Android) |
| **Android** | [`Auth0.Android`](https://github.com/auth0/Auth0.Android) | Android (Kotlin/Java) |
| **iOS/macOS** | [`Auth0.swift`](https://github.com/auth0/Auth0.swift) | Swift (iOS, macOS, tvOS, watchOS, visionOS) |

## Example prompts

```
Add Auth0 authentication to my app
```

```
Set up Auth0 in my Next.js project with protected routes
```

```
Add multi-factor authentication with TOTP
```

```
Migrate from Firebase Auth to Auth0
```

```
Secure my Express API with Auth0 JWT validation
```

## Feedback

- [Open an issue](https://github.com/auth0/agent-skills/issues) to report bugs or request new skills
- See [contribution guidelines](https://github.com/auth0/open-source-template/blob/master/GENERAL-CONTRIBUTING.md) and [code of conduct](https://github.com/auth0/open-source-template/blob/master/CODE-OF-CONDUCT.md)
- Security vulnerabilities: [Responsible Disclosure Program](https://auth0.com/responsible-disclosure-policy)

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
