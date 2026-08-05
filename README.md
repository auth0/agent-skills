![Auth0 Agent Skills](https://cdn.auth0.com/website/sdks/banners/agent-skills.png)

# Auth0 Agent Skills

[![License](https://img.shields.io/:license-apache-blue.svg?style=flat)](https://opensource.org/licenses/Apache-2.0)

AI agent skills that help coding assistants implement Auth0 authentication correctly. Works with [Claude Code](https://claude.ai/code), [Cursor](https://cursor.com), [Codex](https://openai.com/codex/), [GitHub Copilot](https://github.com/features/copilot), and [40+ other agents](https://agentskills.io/clients) that support the [Agent Skills](https://agentskills.io) format.

[Documentation](https://auth0.com/docs/quickstart/agent-skills) · [Getting Started](#prerequisites) · [Feedback](#feedback)

## Prerequisites

- An [Auth0 account](https://auth0.com/signup) (free)
- An AI coding assistant (Claude Code, Cursor, Codex, GitHub Copilot, or any [Agent Skills-compatible](https://agentskills.io/clients) tool)

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

```bash
npx skills add auth0/agent-skills --agent github-copilot
```

### Codex / ChatGPT plugins

The repository includes an OpenAI-compatible skills-only plugin. Add this
repository's marketplace from `.agents/plugins/marketplace.json`, then install
**Auth0** from the Plugins UI. It tracks the published `main` snapshot.

For public availability, Auth0 must submit the plugin through the
[OpenAI plugin submission portal](https://platform.openai.com/plugins). Approval
is required before it appears in the universal ChatGPT and Codex directory.

### Any Agent (Skills CLI)

The [Skills CLI](https://github.com/vercel-labs/skills) works with Claude Code, Cursor, Copilot, Codex, and [40+ other agents](https://agentskills.io/clients):

```bash
npx skills add auth0/agent-skills
```

Target specific agents with `--agent`:

```bash
npx skills add auth0/agent-skills --agent claude-code cursor
```

### ClawHub Marketplace

Install the Auth0 skill from [ClawHub.ai](https://clawhub.ai/search?q=auth0):

```bash
npx clawhub install auth0
```

Or browse and install from the [ClawHub web UI](https://clawhub.ai) — search for "auth0".


## What happens after install

When you ask your AI assistant something like "add Auth0 login to my app," the assistant:

1. Loads the single `auth0` skill, whose **router** reads your project files (`package.json`, `requirements.txt`, `build.gradle`, etc.)
2. Detects your framework and loads the matching reference files (e.g., the Next.js reference for a Next.js project)
3. Follows the step-by-step instructions to install the right SDK, create auth routes, configure environment variables, and wire up login/logout

You don't pick anything manually — framework detection handles it.

### Forcing the skill with `/auth0`

Auto-detection is reliable on capable models. If you're on a smaller/faster
model in a session with **many** other skills installed, the assistant can
occasionally miss the trigger — most often on open-ended *questions* ("how do
I…?") rather than direct instructions. When that happens, invoke the skill
explicitly:

```
/auth0 how do I configure brand colors in Auth0?
```

Naming the skill removes the selection step entirely, so it always activates.

## Migrating from the individual skills

Earlier versions shipped one skill per SDK/framework (`auth0-react`,
`auth0-nextjs`, `express-oauth2-jwt-bearer`, …). These are now **consolidated
into the single `auth0` skill** above, which routes to the same guidance by
detecting your framework.

- **Plugin / marketplace installs (Claude Code, Cursor):** nothing to do — your
  next update swaps in the consolidated skill automatically.
- **ClawHub installs:** existing installs keep working; `npx clawhub install
  auth0` gets you the consolidated skill.
- **If you referenced an old skill by name** — in your `CLAUDE.md`, another
  skill's `requires.skills`, or any instruction file — those names
  (`auth0-react`, etc.) no longer exist and the reference will dangle. Replace
  them with `auth0`.

## Coverage

A single `auth0` skill covers web, mobile, desktop, and API authentication
across all of the frameworks below. You install one skill; its router detects
your framework and loads the matching guidance — you don't choose a
per-framework skill.

| Area | SDK | Frameworks |
|-------|-----|------------|
| **Quickstart Router** | — | Detects your framework and loads the right reference files |
| **Migration** | — | Migrate from Firebase, Cognito, Supabase, Clerk, or custom auth |
| **MFA** | — | TOTP, SMS, email, push, WebAuthn |
| **ACUL Screen Generation** | [`@auth0/auth0-acul-react`](https://github.com/auth0/universal-login) | Custom Universal Login screens and theming |
| **React** | [`@auth0/auth0-react`](https://github.com/auth0/auth0-react) | React SPAs (Vite, CRA) |
| **Vue** | [`@auth0/auth0-vue`](https://github.com/auth0/auth0-vue) | Vue 3 |
| **Angular** | [`@auth0/auth0-angular`](https://github.com/auth0/auth0-angular) | Angular 13+ |
| **Vanilla JS** | [`@auth0/auth0-spa-js`](https://github.com/auth0/auth0-spa-js) | Any SPA (also Svelte, SolidJS) |
| **Next.js** | [`@auth0/nextjs-auth0`](https://github.com/auth0/nextjs-auth0) | Next.js 13+ (App Router & Pages Router) |
| **Nuxt** | [`@auth0/auth0-nuxt`](https://github.com/auth0/auth0-nuxt) | Nuxt 3/4 |
| **Express** | [`express-openid-connect`](https://github.com/auth0/express-openid-connect) | Express.js |
| **Flask** | [`auth0-server-python`](https://github.com/auth0/auth0-server-python) | Flask |
| **Fastify** | [`@auth0/auth0-fastify`](https://github.com/auth0/auth0-fastify) | Fastify |
| **Hono** | [`@auth0/auth0-hono`](https://github.com/auth0/auth0-hono) | Hono (Node.js, Cloudflare Workers, Deno, Bun) |
| **Java Servlet** | [`mvc-auth-commons`](https://github.com/auth0/auth0-java-mvc-common) | Java Servlet |
| **Express API** | [`express-oauth2-jwt-bearer`](https://github.com/auth0/node-oauth2-jwt-bearer) | Node.js/Express APIs |
| **Fastify API** | [`@auth0/auth0-fastify`](https://github.com/auth0/auth0-fastify) | Fastify APIs |
| **FastAPI** | [`auth0-fastapi-api`](https://github.com/auth0/auth0-fastapi-api) | Python FastAPI |
| **Spring Boot API** | [`auth0-springboot-api`](https://github.com/auth0/auth0-auth-java) | Spring Boot |
| **ASP.NET Core** | [`Auth0.AspNetCore.Authentication`](https://github.com/auth0/auth0-aspnetcore-authentication) | ASP.NET Core MVC, Razor Pages, Blazor Server |
| **ASP.NET Core API** | [`Auth0.AspNetCore.Authentication`](https://github.com/auth0/auth0-aspnetcore-authentication) | ASP.NET Core |
| **Ionic Angular** | [`@auth0/auth0-angular`](https://github.com/auth0/auth0-angular) + Capacitor | Ionic Angular + Capacitor (iOS/Android) |
| **Ionic Vue** | [`@auth0/auth0-vue`](https://github.com/auth0/auth0-vue) | Ionic Vue + Capacitor (iOS/Android) |
| **Ionic React** | [`@auth0/auth0-react`](https://github.com/auth0/auth0-react) + Capacitor | Ionic React + Capacitor (iOS/Android) |
| **React Native** | [`react-native-auth0`](https://github.com/auth0/react-native-auth0) | React Native CLI (bare workflow) |
| **Expo** | [`react-native-auth0`](https://github.com/auth0/react-native-auth0) | Expo (managed workflow) |
| **Android** | [`Auth0.Android`](https://github.com/auth0/Auth0.Android) | Android (Kotlin/Java) |
| **iOS/macOS** | [`Auth0.swift`](https://github.com/auth0/Auth0.swift) | Swift (iOS, macOS, tvOS, watchOS, visionOS) |
| **Flutter** | [`auth0_flutter`](https://github.com/auth0/auth0-flutter) | Flutter mobile (iOS/Android, Dart) |
| **Flutter Web** | [`auth0_flutter`](https://github.com/auth0/auth0-flutter) | Flutter Web (Dart) |
| **.NET MAUI** | [`Auth0.OidcClient.MAUI`](https://github.com/auth0/auth0-oidc-client-net) | .NET MAUI (iOS, Android, macOS, Windows) |
| **.NET Android** | [`Auth0.OidcClient.AndroidX`](https://github.com/auth0/auth0-oidc-client-net) | .NET Android (Xamarin) |
| **.NET iOS** | [`Auth0.OidcClient.iOS`](https://github.com/auth0/auth0-oidc-client-net) | .NET iOS (Xamarin) |
| **.NET Winforms** | [`Auth0.OidcClient.WinForms`](https://github.com/auth0/auth0-oidc-client-net) | .NET WinForms applications |
| **WPF** | [`Auth0.OidcClient.WPF`](https://github.com/auth0/Auth0.OidcClient.WPF) | .NET WPF |
| **iOS/macOS Migration** | [`Auth0.swift`](https://github.com/auth0/Auth0.swift) | Upgrade to the latest major version of Auth0.swift |

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
