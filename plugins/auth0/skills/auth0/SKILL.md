---
name: auth0
description: Use when adding, fixing, or improving authentication in any app — login, logout, signup, route protection, JWT and access token validation, refresh token rotation, MFA, 2FA, passkeys, step-up auth, SSO, RBAC and permissions, Organizations for B2B multi-tenant SaaS, custom login domains, ACUL, or Universal Login branding. Use even if Auth0 isn't mentioned — applies any time a developer asks how to authenticate users, secure an API, debug a 401 Unauthorized or CORS error, fix a callback URL mismatch or redirect loop, handle 429 rate limits, or migrate from Clerk, NextAuth.js, Firebase Auth, Supabase, Cognito, or Passport.js. Covers React, Next.js, Vue, Nuxt, Angular, Express, Flask, FastAPI, Spring Boot, Go, Swift, Android, Flutter, PHP, Laravel, ASP.NET Core, React Native, Expo, Ionic, and all Auth0 SDKs.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '2.0.0'
  openclaw:
    emoji: "\U0001F510"
    homepage: https://github.com/auth0/agent-skills
---

# Auth0

Detect intent → detect framework → detect tooling → load 2–3 reference files.

---

## Step 1: Detect intent

| Developer asks about... | Intent |
|---|---|
| Adding login, signup, auth, authentication to an app | **integrate** |
| MFA, 2FA, passkeys, step-up authentication | **feature:mfa** |
| Organizations, multi-org, B2B SaaS | **feature:organizations** |
| Custom domain (login.example.com, auth.company.com) | **feature:custom-domains** |
| ACUL, advanced custom universal login screens | **feature:acul** |
| Branding, login page appearance, logo, colors, theme | **feature:branding** |
| "best practice", "secure", token security, "how should I" | **guidance** |
| Error: 401, 403, CORS, callback URL mismatch, redirect loop | **debug** |
| Rate limit, 429, quota exceeded | **debug:rate-limit** |
| Migrating from Clerk, Firebase, Cognito, Okta, another provider | **migrate** |

---

## Step 2: Detect framework

Read the project files. **Stop at the first match.**

### Node.js / JavaScript / TypeScript — check `package.json` → `dependencies`

| Package | Framework |
|---|---|
| `@auth0/auth0-react` | `react` |
| `@auth0/nextjs-auth0` | `nextjs` |
| `@auth0/auth0-vue` | `vue` |
| `@auth0/auth0-angular` | `angular` |
| `@auth0/auth0-spa-js` | `spa-js` |
| `@auth0/auth0-nuxt` | `nuxt` |
| `express-openid-connect` or `@auth0/express-openid-connect` | `express` |
| `@auth0/auth0-fastify` | `fastify` |
| `@auth0/auth0-fastify-api` | `fastify-api` |
| `express-oauth2-jwt-bearer` | `express-jwt` |
| `react-native-auth0` + `app.json` or `app.config.js` present | `expo` |
| `react-native-auth0` (no Expo files) | `react-native` |
| `@capacitor/browser` + `@auth0/auth0-angular` | `ionic-angular` |
| `@capacitor/browser` + `@auth0/auth0-react` | `ionic-react` |
| `@capacitor/browser` + `@auth0/auth0-vue` | `ionic-vue` |

### Python — check `requirements.txt` or `pyproject.toml`

| Package | Framework |
|---|---|
| `authlib` or `python-jose` + `flask` | `flask` |
| `fastapi` + (`python-jose` or `authlib`) | `fastapi-api` |

### Java / Kotlin — check `build.gradle` or `pom.xml`

| Dependency | Framework |
|---|---|
| `auth0-java-mvc-common` | `java-mvc` |
| `spring-security-oauth2-resource-server` | `springboot-api` |

### .NET — check `*.csproj` or `NuGet.Config`

| Package | Framework |
|---|---|
| `Auth0.AspNetCore.Authentication` (no `.Api` suffix) | `aspnetcore-auth` |
| `Auth0.AspNetCore.Authentication.Api` | `aspnetcore-api` |
| `Auth0.OidcClient.MAUI` | `maui` |
| `Auth0.OidcClient.AndroidX` | `net-android` |
| `Auth0.OidcClient.iOS` | `net-ios` |
| `Auth0.OidcClient.WinForms` | `winforms` |
| `Auth0.OidcClient.WPF` | `wpf` |

### PHP — check `composer.json`

| Package | Framework |
|---|---|
| `auth0/auth0-php` | `php` |
| `auth0/login` (laravel, no `AuthorizationGuard`) | `laravel` |
| `auth0/login` + `AuthorizationGuard` | `laravel-api` |

### Go — check `go.mod`

| Module | Framework |
|---|---|
| `github.com/auth0/go-jwt-middleware` | `go` |

### Mobile (native)

| Signal | Framework |
|---|---|
| `Package.swift` or `.xcodeproj` + Auth0.swift | `swift` |
| `build.gradle` + `com.auth0.android:auth0` | `android` |
| `pubspec.yaml` + `auth0_flutter` + `flutter.web: false` | `flutter-native` |
| `pubspec.yaml` + `auth0_flutter` + web enabled | `flutter-web` |

If no match: ask the developer what framework/language they're using.

---

## Step 3: Detect tooling

Read the project file tree. This is a project-context decision, not a product preference.
The feature configuration is identical across all three tools.

| Project has... | Load |
|---|---|
| `terraform/` directory OR any `*.tf` files | `tooling-terraform.md` |
| Auth0 MCP server active in this agent session | `tooling-mcp.md` |
| Anything else (default) | `tooling-cli.md` |

---

## Step 4: Load reference files

### integrate
```
Read: references/framework-{framework}.md
Read: references/tooling-{tooling}.md
Follow the integration workflow in framework-{framework}.md.
Use tooling-{tooling}.md for all Auth0 tenant configuration steps.
```

### feature:mfa
```
Read: references/feature-mfa.md
Read: references/tooling-{tooling}.md
If framework detected: Read references/framework-{framework}.md (for SDK-side step-up trigger)
```

### feature:organizations
```
Read: references/feature-organizations.md
Read: references/tooling-{tooling}.md
If framework detected: Read references/framework-{framework}.md
If multi-tenant architecture / B2B SaaS design question: also Read references/pattern-multi-tenant.md
```

### feature:custom-domains
```
Read: references/feature-custom-domains.md
Read: references/tooling-{tooling}.md
```

### feature:acul
```
Read: references/feature-acul.md
Read: references/tooling-{tooling}.md
```

### feature:branding
```
Read: references/feature-branding.md
Read: references/tooling-{tooling}.md
```

### guidance
```
Read: references/pattern-security.md
If token handling / JWT vs opaque / storage: Read references/pattern-token-handling.md
If multi-tenant / B2B architecture: Read references/pattern-multi-tenant.md + references/feature-organizations.md
```

### debug
```
Read: references/pattern-common-errors.md
If framework detected: Read references/framework-{framework}.md
```

### debug:rate-limit
```
Read: references/pattern-rate-limiting.md
```

### migrate
```
Read: references/feature-migration.md
Read: references/tooling-cli.md
If framework detected: Read references/framework-{framework}.md
```
