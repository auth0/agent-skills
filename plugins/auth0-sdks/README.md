# auth0-sdks

Framework-specific Auth0 SDK integration skills with complete implementation guides for login, logout, session management, protected routes, and API access.

## Installation

**Via Claude Code:**

First, add the Auth0 marketplace if you haven't already:

```bash
/plugin marketplace add auth0/agent-skills
```

Then install the plugin:

```bash
/plugin install auth0-sdks@auth0-agent-skills
```

**Via Skills CLI:**

```bash
npx skills add auth0/agent-skills/plugins/auth0-sdks
```

## Skills

| Skill | Description | Documentation |
|-------|-------------|---------------|
| [auth0-react](skills/auth0-react) | Integrates `@auth0/auth0-react` into React SPAs (Vite or Create React App). Covers provider setup, login/logout, protected routes, and API calls with access tokens using React hooks. | [SKILL.md](skills/auth0-react/SKILL.md) |
| [auth0-vue](skills/auth0-vue) | Integrates `@auth0/auth0-vue` into Vue 3 SPAs (Vite or Vue CLI). Covers plugin installation, composables, navigation guards, and API calls with access tokens. | [SKILL.md](skills/auth0-vue/SKILL.md) |
| [auth0-angular](skills/auth0-angular) | Integrates `@auth0/auth0-angular` into Angular 13+ applications. Covers module setup, route guards, HTTP interceptors for token attachment, and Angular service usage. | [SKILL.md](skills/auth0-angular/SKILL.md) |
| [auth0-nextjs](skills/auth0-nextjs) | Integrates `@auth0/nextjs-auth0` (v4) into Next.js 13+ applications. Supports App Router and Pages Router. Covers middleware, Server Components, session management, and protected pages. | [SKILL.md](skills/auth0-nextjs/SKILL.md) |
| [auth0-nuxt](skills/auth0-nuxt) | Integrates `@auth0/auth0-nuxt` into Nuxt 3/4 applications. Covers module configuration, server-side sessions with encrypted cookies, route middleware, and composable usage. | [SKILL.md](skills/auth0-nuxt/SKILL.md) |
| [auth0-express](skills/auth0-express) | Integrates `express-openid-connect` into Express.js web applications. Covers session-based authentication with built-in `/login`, `/logout`, and `/callback` routes, and protecting routes with middleware. | [SKILL.md](skills/auth0-express/SKILL.md) |
| [auth0-fastify](skills/auth0-fastify) | Integrates `@auth0/auth0-fastify` into Fastify web applications with view engines. Covers session-based authentication, built-in auth routes, and protecting routes with hooks. | [SKILL.md](skills/auth0-fastify/SKILL.md) |
| [auth0-fastify-api](skills/auth0-fastify-api) | Integrates `@auth0/auth0-fastify-api` into stateless Fastify APIs. Covers JWT Bearer token validation, scope and permission checks, and securing API endpoints without sessions. | [SKILL.md](skills/auth0-fastify-api/SKILL.md) |
| [auth0-react-native](skills/auth0-react-native) | Integrates `react-native-auth0` into React Native CLI (bare workflow) applications (iOS and Android). Covers native deep linking setup, login/logout flows, biometric authentication, and secure token storage. | [SKILL.md](skills/auth0-react-native/SKILL.md) |
| [auth0-expo](skills/auth0-expo) | Integrates `react-native-auth0` into Expo (managed workflow) mobile apps. Covers Expo Config Plugin setup, custom scheme deep linking, login/logout flows, biometric authentication, and EAS builds. | [SKILL.md](skills/auth0-expo/SKILL.md) |
| [auth0-android](./skills/auth0-android/) | Integrates `com.auth0.android:auth0` into native Android applications (Kotlin/Java). Covers Web Auth login/logout, biometric-protected credential storage, and MFA. | [SKILL.md](skills/auth0-android/SKILL.md) |
| [auth0-swift](skills/auth0-swift) | Integrates `Auth0.swift` into native iOS/macOS applications (Swift). Covers Web Auth login/logout, biometric-protected credential storage, and MFA. | [SKILL.md](skills/auth0-swift/SKILL.md) |
| [auth0-aspnetcore-api](skills/auth0-aspnetcore-api) | Secures ASP.NET Core Web API endpoints with JWT Bearer token validation using `Auth0.AspNetCore.Authentication.Api`. Covers scope/permission checks, DPoP proof-of-possession token binding, and stateless auth for REST APIs. | [SKILL.md](skills/auth0-aspnetcore-api/SKILL.md) |
| [auth0-fastapi-api](skills/auth0-fastapi-api) | Secures FastAPI API endpoints with JWT Bearer token validation using `auth0-fastapi-api`. Covers scope/permission checks, DPoP proof-of-possession token binding, and stateless auth for REST APIs. | [SKILL.md](skills/auth0-fastapi-api/SKILL.md) |
| [express-oauth2-jwt-bearer](skills/express-oauth2-jwt-bearer) | Secures Node.js/Express API endpoints with JWT Bearer token validation using `express-oauth2-jwt-bearer`. Covers scope and permission-based RBAC, claim validation, DPoP support, and stateless auth for REST APIs. | [SKILL.md](skills/express-oauth2-jwt-bearer/SKILL.md) |
