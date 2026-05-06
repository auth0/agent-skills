# Auth0

Build faster with enterprise-grade identity. This plugin brings Auth0's authentication and authorization platform into your development workflow — detecting your stack, scaffolding the right integration, and guiding you through production-ready implementation.

## Enterprise features, ready to deploy

- **Single Sign-On & Organizations** — Federated login flows, self-serve admin consoles, and multi-tenant identity management at scale.
- **Multifactor Authentication** — Contextual MFA policies with TOTP, SMS, push, WebAuthn, and risk-based step-up challenges.
- **Role-Based Access Control** — Fine-grained authorization with permissions, roles, and custom claims across your APIs.
- **Custom Login Experiences** — From no-code to pro-code: generate branded Universal Login screens matching your design system.
- **User Migration** — Move from Firebase, AWS Cognito, Supabase, Clerk, or custom auth with zero-downtime trickle migration.
- **API Protection** — JWT validation, token exchange, and OAuth2 best practices across Node, Python, .NET, Java, and Go.

## Framework-aware implementation

The plugin detects your stack and integrates the right Auth0 SDK — Next.js, React, Vue, Angular, Express, FastAPI, Spring Boot, Swift, Android, and 25+ others. No boilerplate. Current patterns.

## How to use

Tell the plugin what you need in plain English:

- "Add authentication to this app"
- "Set up enterprise SSO with SAML"
- "Add MFA to the login flow"
- "Migrate users from Cognito"
- "Protect this API with role-based access"
- "Create a custom login page"

## Installation

**Via Claude Code:**

```bash
/install-plugin auth0
```

**Via Skills CLI:**

```bash
npx skills add auth0/agent-skills/plugins/auth0
```

## Skills

| Skill | Description |
|-------|-------------|
| [auth0-quickstart](skills/auth0-quickstart) | Detects your framework and guides through a complete Auth0 integration from scratch. |
| [auth0-migration](skills/auth0-migration) | Migrate from Firebase, Cognito, Supabase, Clerk, or custom auth systems. |
| [auth0-mfa](skills/auth0-mfa) | Implement MFA with TOTP, SMS, email, push, WebAuthn, and adaptive policies. |
| [acul-screen-generator](skills/acul-screen-generator) | Generate branded login screens with Advanced Customization for Universal Login. |
| [auth0-react](skills/auth0-react) | React SPA integration with hooks, protected routes, and API calls. |
| [auth0-nextjs](skills/auth0-nextjs) | Next.js 13+ with App Router, middleware, and Server Components. |
| [auth0-vue](skills/auth0-vue) | Vue 3 SPA with composables and navigation guards. |
| [auth0-angular](skills/auth0-angular) | Angular 13+ with route guards and HTTP interceptors. |
| [auth0-nuxt](skills/auth0-nuxt) | Nuxt 3/4 with server-side sessions and route middleware. |
| [auth0-express](skills/auth0-express) | Express.js session-based auth with built-in routes. |
| [auth0-fastify](skills/auth0-fastify) | Fastify session-based auth with hooks. |
| [auth0-flask](skills/auth0-flask) | Flask session-based auth with login/callback flows. |
| [auth0-react-native](skills/auth0-react-native) | React Native with deep linking and biometric auth. |
| [auth0-expo](skills/auth0-expo) | Expo managed workflow with Config Plugin and EAS builds. |
| [auth0-android](skills/auth0-android) | Native Android (Kotlin/Java) with Web Auth and biometrics. |
| [auth0-swift](skills/auth0-swift) | Native iOS/macOS (Swift) with Web Auth and biometrics. |
| [auth0-springboot-api](skills/auth0-springboot-api) | Spring Boot API with JWT validation and DPoP support. |
| [auth0-java-mvc-common](skills/auth0-java-mvc-common) | Java Servlet web apps with session-based auth. |
| [auth0-aspnetcore-api](skills/auth0-aspnetcore-api) | ASP.NET Core API with JWT validation and DPoP. |
| [auth0-fastapi-api](skills/auth0-fastapi-api) | FastAPI with JWT validation and permission checks. |
| [auth0-fastify-api](skills/auth0-fastify-api) | Fastify API with JWT Bearer validation. |
| [express-oauth2-jwt-bearer](skills/express-oauth2-jwt-bearer) | Express API with JWT validation and RBAC. |
| [auth0-spa-js](skills/auth0-spa-js) | Vanilla JS, Svelte, SolidJS — framework-agnostic SPA auth. |
| [auth0-cli](skills/auth0-cli) | Auth0 CLI reference for terminal-based management. |
