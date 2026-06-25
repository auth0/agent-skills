---
name: auth0
description: Use when adding authentication to any app, debugging auth errors (401, CORS, callback mismatch, token expiry), applying security best practices for tokens or multi-tenant architecture, adding enterprise features (MFA, Organizations, custom domains, ACUL), migrating from Clerk, Firebase Auth, Cognito, or another provider, or customizing Universal Login branding. Covers React, Next.js, Vue, Angular, Express, Flask, FastAPI, Spring Boot, Swift, Android, Flutter, Go, PHP, Laravel, ASP.NET Core, React Native, Expo, Ionic, and more.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '2.0.0'
  openclaw:
    emoji: "\U0001F510"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0 — Unified Skill

This skill covers all Auth0 SDKs and platform features. Find your framework or feature below, then load the relevant reference files for detailed guidance.

**How to use:** Each entry below links to reference files. Start with the `-quickstart.md` file for getting started, then load `-api.md`, `-integration.md`, or `-setup.md` as needed for deeper detail.

---

## Disambiguation

| If the user wants... | Use this section |
|---|---|
| Login for a React SPA (Vite, CRA, no SSR) | Frontend SPAs → React |
| Login for a Next.js app (SSR, App Router) | Fullstack → Next.js |
| Login for a Vue SPA (no Nuxt) | Frontend SPAs → Vue |
| Login for a Nuxt app | Fullstack → Nuxt |
| Protect an Express/Node API with JWT | Backend APIs → Express JWT Bearer |
| Login for an Express web app (sessions) | Fullstack → Express |
| Protect a Fastify API | Backend APIs → Fastify API |
| Login for a Fastify web app (sessions) | Fullstack → Fastify |
| Protect an ASP.NET Core API | Backend APIs → ASP.NET Core API |
| Login for an ASP.NET Core web app | Fullstack → ASP.NET Core (web app) |
| PHP web app with sessions | Fullstack → PHP |
| PHP stateless API | Backend APIs → PHP API |
| React Native (bare workflow, no Expo) | Mobile → React Native |
| Expo (managed workflow) | Mobile → Expo |
| Ionic with Angular/React/Vue | Mobile → Ionic (pick variant) |

---

## Platform & Tools

### Quickstart — Framework detection and initial setup
Detects your framework and routes to the correct setup workflow.
- [Quickstart Guide](references/quickstart-quickstart.md)
- [CLI Setup](references/quickstart-cli.md) | [Concepts](references/quickstart-concepts.md) | [Environments](references/quickstart-environments.md)

### CLI — Manage Auth0 from the terminal
Create apps, APIs, users, roles, organizations, actions, log streams, custom domains.
- [CLI Quickstart](references/cli-quickstart.md)
- [Full Command Reference](references/cli-cli.md)

### Migration — Migrate from another auth provider
Bulk user import, password migration, social connection migration.
- [Migration Guide](references/migration-quickstart.md)
- [Code Patterns](references/migration-code-patterns.md) | [User Import](references/migration-user-import.md)

### MFA — Multi-Factor Authentication
TOTP, SMS, push notifications, passkeys, step-up authentication.
- [MFA Guide](references/mfa-quickstart.md)
- [API](references/mfa-api.md) | [Advanced](references/mfa-advanced.md) | [Backend](references/mfa-backend.md) | [Examples](references/mfa-examples.md)

### Branding — Universal Login customization
Customize login pages, colors, logos, templates.
- [Branding Guide](references/branding-quickstart.md)
- [API](references/branding-api.md) | [Advanced](references/branding-advanced.md) | [Examples](references/branding-examples.md) | [Screens](references/branding-screens.md)
- Capabilities: [Brand](references/branding-capability-brand.md) | [Check](references/branding-capability-check.md) | [Manual](references/branding-capability-manual.md) | [Rollback](references/branding-capability-rollback.md) | [Voice](references/branding-capability-voice.md)

### Custom Domains — Configure custom domains for Auth0
Set up vanity domains for login pages.
- [Custom Domains Guide](references/custom-domains-quickstart.md)
- [API](references/custom-domains-api.md) | [Advanced](references/custom-domains-advanced.md) | [Examples](references/custom-domains-examples.md) | [Providers](references/custom-domains-providers.md)
- Capabilities: [Setup](references/custom-domains-capability-setup.md) | [Manage](references/custom-domains-capability-manage.md) | [Health](references/custom-domains-capability-health.md) | [Troubleshoot](references/custom-domains-capability-troubleshoot.md) | [Remove](references/custom-domains-capability-remove.md)
- Provider Guides: [Cloudflare](references/custom-domains-providers-cloudflare.md) | [Route53](references/custom-domains-providers-route53.md) | [Azure DNS](references/custom-domains-providers-azure-dns.md) | [Manual](references/custom-domains-providers-manual.md)

### ACUL — Advanced Customization of Universal Login screens
Generate custom login/signup screens with React or vanilla JS.
- [ACUL Guide](references/acul-quickstart.md)
- [React SDK](references/acul-acul-react-sdk.md) | [JS SDK](references/acul-acul-js-sdk.md) | [CLI Commands](references/acul-cli-commands.md)
- [Screen Catalog](references/acul-screen-catalog.md) | [Social Providers](references/acul-social-providers.md) | [Theming](references/acul-theming-patterns.md)

---

## Frontend SPAs

### React — Vite/CRA single-page apps
`@auth0/auth0-react` for client-side React applications without server-side rendering.
- [React Quickstart](references/react-quickstart.md)
- [API](references/react-api.md) | [Integration](references/react-integration.md) | [Setup](references/react-setup.md)

### Vue — Vue 3 applications
`@auth0/auth0-vue` for Vue 3 single-page applications.
- [Vue Quickstart](references/vue-quickstart.md)
- [API](references/vue-api.md) | [Integration](references/vue-integration.md) | [Setup](references/vue-setup.md)

### Angular — Angular 12+ applications
`@auth0/auth0-angular` for Angular applications.
- [Angular Quickstart](references/angular-quickstart.md)
- [API](references/angular-api.md) | [Integration](references/angular-integration.md) | [Setup](references/angular-setup.md)

### Vanilla JS — auth0-spa-js
`@auth0/auth0-spa-js` for framework-agnostic SPAs.
- [SPA JS Quickstart](references/spa-js-quickstart.md)
- [API](references/spa-js-api.md) | [Integration](references/spa-js-integration.md) | [Setup](references/spa-js-setup.md)

---

## Fullstack Frameworks

### Next.js — App Router + Pages Router
`@auth0/nextjs-auth0` for Next.js 13+ with server-side sessions.
- [Next.js Quickstart](references/nextjs-quickstart.md)
- [API](references/nextjs-api.md) | [Integration](references/nextjs-integration.md) | [Setup](references/nextjs-setup.md)

### Nuxt — Nuxt 3/4
`@auth0/auth0-nuxt` for Nuxt applications with server-side auth.
- [Nuxt Quickstart](references/nuxt-quickstart.md)
- [Route Protection](references/nuxt-route-protection.md) | [Examples](references/nuxt-examples.md) | [Session Stores](references/nuxt-session-stores.md)

### Express — Express.js web apps
`@auth0/express-openid-connect` for Express apps with session-based login.
- [Express Quickstart](references/express-quickstart.md)
- [API](references/express-api.md) | [Integration](references/express-integration.md) | [Setup](references/express-setup.md)

### Flask — Python Flask web apps
Auth0 integration for Flask applications.
- [Flask Quickstart](references/flask-quickstart.md)
- [API](references/flask-api.md) | [Integration](references/flask-integration.md) | [Setup](references/flask-setup.md)

### Fastify — Fastify web apps (sessions)
Auth0 integration for Fastify web applications with session-based login.
- [Fastify Quickstart](references/fastify-quickstart.md)

### Java Servlet — Java MVC web apps
`auth0-java-mvc-common` for Java Servlet-based web applications.
- [Java MVC Quickstart](references/java-mvc-quickstart.md)
- [API](references/java-mvc-api.md) | [Integration](references/java-mvc-integration.md) | [Setup](references/java-mvc-setup.md)

### ASP.NET Core (web app) — Cookie-based authentication
`Auth0.AspNetCore.Authentication` for ASP.NET Core web apps.
- [ASP.NET Core Auth Quickstart](references/aspnetcore-auth-quickstart.md)
- [API](references/aspnetcore-auth-api.md) | [Integration](references/aspnetcore-auth-integration.md) | [Setup](references/aspnetcore-auth-setup.md)

### PHP (web app) — PHP session-based authentication
Auth0 PHP SDK for web applications with session management.
- [PHP Quickstart](references/php-quickstart.md)
- [API](references/php-api.md) | [Integration](references/php-integration.md) | [Setup](references/php-setup.md)

---

## Backend APIs

### Express JWT Bearer — Node.js/Express API protection
`express-oauth2-jwt-bearer` for stateless JWT validation in Express APIs.
- [Express JWT Quickstart](references/express-jwt-quickstart.md)
- [API](references/express-jwt-api.md) | [Integration](references/express-jwt-integration.md) | [Setup](references/express-jwt-setup.md)

### Fastify API — Fastify API protection
JWT validation for Fastify API endpoints.
- [Fastify API Quickstart](references/fastify-api-quickstart.md)

### FastAPI — Python FastAPI protection
JWT validation for FastAPI applications.
- [FastAPI Quickstart](references/fastapi-api-quickstart.md)
- [API](references/fastapi-api-api.md) | [Integration](references/fastapi-api-integration.md) | [Setup](references/fastapi-api-setup.md)

### Spring Boot API — Java Spring Boot protection
`spring-security-oauth2-resource-server` for Spring Boot APIs.
- [Spring Boot Quickstart](references/springboot-api-quickstart.md)
- [API](references/springboot-api-api.md) | [Integration](references/springboot-api-integration.md) | [Setup](references/springboot-api-setup.md)

### ASP.NET Core API — JWT Bearer authentication
`Microsoft.AspNetCore.Authentication.JwtBearer` for ASP.NET Core APIs.
- [ASP.NET Core API Quickstart](references/aspnetcore-api-quickstart.md)
- [API](references/aspnetcore-api-api.md) | [Integration](references/aspnetcore-api-integration.md) | [Setup](references/aspnetcore-api-setup.md)

### Go — go-jwt-middleware
`go-jwt-middleware` for Go HTTP API protection.
- [Go JWT Quickstart](references/go-jwt-quickstart.md)
- [API](references/go-jwt-api.md) | [Integration](references/go-jwt-integration.md) | [Setup](references/go-jwt-setup.md)

### PHP API — Stateless JWT validation
Auth0 PHP SDK for stateless API token validation.
- [PHP API Quickstart](references/php-api-quickstart.md)
- [API](references/php-api-api.md) | [Integration](references/php-api-integration.md) | [Setup](references/php-api-setup.md)

---

## Mobile

### React Native — Bare workflow
`react-native-auth0` for React Native CLI projects.
- [React Native Quickstart](references/react-native-quickstart.md)
- [API](references/react-native-api.md) | [Patterns](references/react-native-patterns.md) | [Setup](references/react-native-setup.md)

### Expo — Managed workflow
`react-native-auth0` with Expo config plugin for managed Expo projects.
- [Expo Quickstart](references/expo-quickstart.md)
- [API](references/expo-api.md) | [Integration](references/expo-integration.md) | [Setup](references/expo-setup.md)

### Ionic Angular — Capacitor (iOS/Android)
`@auth0/auth0-angular` + `@auth0/capacitor` for Ionic Angular apps.
- [Ionic Angular Quickstart](references/ionic-angular-quickstart.md)
- [API](references/ionic-angular-api.md) | [Integration](references/ionic-angular-integration.md) | [Setup](references/ionic-angular-setup.md)

### Ionic React — Capacitor (iOS/Android)
`@auth0/auth0-react` + `@auth0/capacitor` for Ionic React apps.
- [Ionic React Quickstart](references/ionic-react-quickstart.md)
- [API](references/ionic-react-api.md) | [Integration](references/ionic-react-integration.md) | [Setup](references/ionic-react-setup.md)

### Ionic Vue — Capacitor (iOS/Android)
`@auth0/auth0-vue` + `@auth0/capacitor` for Ionic Vue apps.
- [Ionic Vue Quickstart](references/ionic-vue-quickstart.md)
- [API](references/ionic-vue-api.md) | [Integration](references/ionic-vue-integration.md) | [Setup](references/ionic-vue-setup.md)

### Android — Kotlin/Java
`Auth0.Android` for native Android apps.
- [Android Quickstart](references/android-quickstart.md)
- [API](references/android-api.md) | [Integration](references/android-integration.md) | [Setup](references/android-setup.md)

### Swift — iOS/macOS
`Auth0.swift` for native iOS and macOS apps.
- [Swift Quickstart](references/swift-quickstart.md)
- [API](references/swift-api.md) | [Integration](references/swift-integration.md) | [Setup](references/swift-setup.md)

---

## Common Mistakes

| Mistake | Fix |
|---|---|
| Wrong Auth0 application type | SPAs need "Single Page Application", server apps need "Regular Web Application", mobile needs "Native" |
| Missing callback URL in Auth0 Dashboard | Add your callback URL to Allowed Callback URLs (e.g., `http://localhost:3000/auth/callback`) |
| Missing logout URL in Auth0 Dashboard | Add your post-logout URL to Allowed Logout URLs |
| Using v3 SDK patterns with v4 SDK | Check quickstart for current SDK version patterns |
| Secrets in client-side code | Client IDs are public, but client secrets must stay server-side only |
| Missing CORS for API | Add your frontend origin to Allowed Web Origins in the Auth0 Dashboard |
| Not validating tokens on backend | Always validate JWT access tokens server-side, never trust client claims |
| AUTH0_DOMAIN includes https:// | Domain should be just `your-tenant.auth0.com`, no scheme prefix |
| Using .env instead of .env.local | Framework-specific env files (.env.local for Next.js) should be in .gitignore |
| Mixing up access tokens and ID tokens | Use ID tokens for user profile info, access tokens for API authorization |
