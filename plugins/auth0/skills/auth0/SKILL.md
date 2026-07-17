---
name: auth0
description: Use when adding, fixing, or improving authentication in any app — login, logout, signup, route protection, JWT/access token validation, refresh token rotation, MFA, passkeys, step-up auth, SSO, RBAC, Organizations for B2B multi-tenant SaaS, custom login domains, ACUL, or Universal Login branding. Use even if Auth0 isn't mentioned — any time a developer asks how to authenticate users, secure an API, debug a 401, CORS error, callback URL mismatch, redirect loop, or 429 rate limit, or migrate from Clerk, NextAuth.js, Firebase Auth, Supabase, Cognito, or Passport.js. Covers React, Next.js, Vue, Nuxt, Angular, Express, Flask, FastAPI, Spring Boot, Go, Swift, Android, Flutter, PHP, Laravel, ASP.NET Core, React Native, Expo, Ionic, and all Auth0 SDKs.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '2.0.1'
  openclaw:
    emoji: "\U0001F510"
    homepage: https://github.com/auth0/agent-skills
    requires:
      bins:
        - auth0
    os:
      - darwin
      - linux
    install:
      - id: brew
        kind: brew
        formula: auth0/auth0-cli/auth0
        bins: [auth0]
        label: 'Install Auth0 CLI (brew)'
---

# Auth0

Detect intent → detect framework → detect tooling → load 2–3 reference files.

---

## Step 1: Detect intent

Match the request against the **What the developer wants** column — it describes
the goal in plain language, not just the Auth0 term (someone who says *"make
users confirm with a code from their phone"* lands on `feature:mfa`). The
**Intent** you pick is a lookup key: in **Step 4** it appears verbatim as a
section heading (`### feature:mfa`) listing which reference files to load.

| What the developer wants (plain language + Auth0 term) | Intent |
|---|---|
| Add login, signup, sign-in, or "let users log in / create accounts" to an app | **integrate** |
| Require a second step after the password — a one-time code, SMS or email code, authenticator app, passkey, fingerprint/face (biometric), or security key; or re-confirm identity before a sensitive action. *Auth0: multi-factor authentication (MFA), two-factor (2FA), two-step verification, step-up authentication.* | **feature:mfa** |
| Let separate companies, teams, workspaces, or tenants each have their own users, members, roles, and login — typically a product sold to businesses. *Auth0: Organizations, multi-org, B2B SaaS.* | **feature:organizations** |
| Serve the login page from your own web address (e.g. `login.example.com`, `auth.company.com`) instead of the default Auth0 URL. *Auth0: custom domain.* | **feature:custom-domains** |
| Build fully custom login/signup screens with your own code or framework, beyond what theme settings allow. *Auth0: Advanced Customization for Universal Login (ACUL).* | **feature:acul** |
| Change how the login page looks — logo, colors, fonts, background, overall theme. *Auth0: branding, Universal Login customization.* | **feature:branding** |
| Bind tokens to the client so a stolen or leaked token can't be reused/replayed from another machine. *Auth0: DPoP (Demonstrating Proof-of-Possession), sender-constrained tokens.* | **feature:dpop** |
| Ask for best practices, "is this secure?", how to handle tokens safely, "how should I do X". *Auth0: guidance / security.* | **guidance** |
| Hit an error: 401 Unauthorized, 403 Forbidden, CORS, callback URL mismatch, redirect loop. *Auth0: debugging.* | **debug** |
| Hit rate limiting: 429 Too Many Requests, quota exceeded. *Auth0: rate limits.* | **debug:rate-limit** |
| Move an existing app off Clerk, NextAuth.js, Firebase, Cognito, Okta, Supabase, Passport.js, or another auth provider. *Auth0: provider migration.* | **migrate** |
| Upgrade the Auth0 SDK itself to a new major version (e.g. Auth0.swift v2→v3, Auth0.Android v3→v4) — breaking changes, deprecated APIs, "update to the latest SDK". *Auth0: SDK major-version upgrade.* | **upgrade-sdk** |
| Use the Auth0 CLI directly — "create an app/API with the `auth0` CLI", script tenant setup, or automate Auth0 config in CI — with no application framework in play. *Auth0: CLI / tooling-only.* | **tooling** |

---

## Step 2: Detect framework

> **Skip this step for the `tooling` intent** — a CLI-first request has no
> framework. Go to Step 3, load the tooling reference; only ask about a
> framework if the developer later pivots to integrating auth into an app.

Work top-down. **Stop at the first tier that yields a framework.**

### Tier 1 — Auth0 SDK already installed (strongest signal)

Read the project files. **Stop at the first match.**

### Node.js / JavaScript / TypeScript — check `package.json` → `dependencies`

Rows are most-specific first — an Ionic/Capacitor project also carries
`@auth0/auth0-angular` (etc.), so check the `@capacitor/browser` rows first.

| Package | Framework |
|---|---|
| `@capacitor/browser` + `@auth0/auth0-angular` | `ionic-angular` |
| `@capacitor/browser` + `@auth0/auth0-react` | `ionic-react` |
| `@capacitor/browser` + `@auth0/auth0-vue` | `ionic-vue` |
| `@auth0/nextjs-auth0` | `nextjs` |
| `@auth0/auth0-nuxt` | `nuxt` |
| `@auth0/auth0-react` | `react` |
| `@auth0/auth0-vue` | `vue` |
| `@auth0/auth0-angular` | `angular` |
| `@auth0/auth0-spa-js` | `spa-js` |
| `express-openid-connect` | `express` |
| `@auth0/auth0-fastify` | `fastify` |
| `@auth0/auth0-fastify-api` | `fastify-api` |
| `express-oauth2-jwt-bearer` | `express-jwt` |
| `react-native-auth0` + `app.json` or `app.config.js` present | `expo` |
| `react-native-auth0` (no Expo files) | `react-native` |

### Python — check `requirements.txt` or `pyproject.toml`

| Package | Framework |
|---|---|
| `auth0-server-python` | `flask` |
| `auth0-fastapi-api` | `fastapi-api` |

### Java / Kotlin — check `build.gradle` or `pom.xml`

| Dependency | Framework |
|---|---|
| `mvc-auth-commons` (`com.auth0:mvc-auth-commons`) | `java-mvc` |
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

`auth0/auth0-php` powers both PHP web apps and APIs; the mode is set via
`SdkConfiguration`'s `strategy`. The `STRATEGY_API` row is more specific — check
it first.

| Package | Framework |
|---|---|
| `auth0/auth0-php` + `SdkConfiguration::STRATEGY_API` (or `strategy: 'api'`) | `php-api` |
| `auth0/auth0-php` (no `STRATEGY_API` / `STRATEGY_REGULAR` or `strategy: 'webapp'`) | `php` |
| `auth0/login` (laravel, no `AuthorizationGuard`) | `laravel` |
| `auth0/login` + `AuthorizationGuard` | `laravel-api` |

> If `auth0/auth0-php` is installed but no `SdkConfiguration` strategy is set
> yet (fresh project), fall through to variant disambiguation below (intent:
> building/protecting an API → `php-api`, else `php`).

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

### Tier 2 — Framework from non-Auth0 workspace dependencies

If no Auth0 SDK matched, detect the framework from ordinary (non-Auth0)
dependencies. **Stop at the first match.** For a web-vs-API split, the base is
chosen here; the variant is resolved in "Variant disambiguation" below. Rows are
most-specific first — an Ionic project also carries `@angular/core` / `vue` /
`react`, so check the `@ionic/*` rows first (as in Tier 1).

| Signal | Base framework |
|---|---|
| `next` in `package.json` | `nextjs` |
| `nuxt` in `package.json` | `nuxt` |
| `@ionic/*` + `@angular/core` | `ionic-angular` |
| `@ionic/*` + `react` | `ionic-react` |
| `@ionic/*` + `vue` | `ionic-vue` |
| `@angular/core` in `package.json` | `angular` |
| `vue` in `package.json` (no `nuxt`) | `vue` |
| `expo` in `package.json` | `expo` |
| `react-native` (no `expo`) | `react-native` |
| `react` (no meta-framework above) | `react` (SPA) — see note |
| `express` in `package.json` | `express` (variant below) |
| `fastify` in `package.json` | `fastify` (variant below) |
| `flask` in `requirements.txt`/`pyproject.toml` | `flask` |
| `fastapi` in `requirements.txt`/`pyproject.toml` | `fastapi-api` |
| `spring-boot` in `pom.xml`/`build.gradle` | `springboot-api` |
| `laravel/framework` in `composer.json` | `laravel` (variant below) |
| `composer.json` present (no Laravel) | `php` (variant below) |
| `go.mod` present + HTTP server/router | `go` |
| `Package.swift` or `.xcodeproj` | `swift` |
| `pubspec.yaml` (Flutter, web disabled) | `flutter-native` |
| `pubspec.yaml` (Flutter, web enabled) | `flutter-web` |
| `*.csproj` referencing MAUI | `maui` |
| `*.csproj` (WinForms) | `winforms` |
| `*.csproj` (WPF) | `wpf` |
| `*.csproj` ASP.NET (web app or API) | `aspnetcore` (variant below) |

> **`react` note:** a plain React project maps to `react` for an SPA using the
> React SDK, or `spa-js` if the app is framework-agnostic vanilla JS. If unclear,
> ask before loading.

### Tier 3 — Framework from the prompt

If no workspace signal matched, read the developer's request for a framework or
language name and map it here. **Stop at the first match.**

| Developer mentions... | Framework |
|---|---|
| Next.js / `next` | `nextjs` |
| Nuxt | `nuxt` |
| Angular (not Ionic) | `angular` |
| Vue (not Nuxt/Ionic) | `vue` |
| React SPA (not Next.js) | `react` |
| vanilla JS / plain JS / no framework SPA | `spa-js` |
| Express (web app / server-rendered) | `express` |
| Express API / protect API routes | `express-jwt` |
| Fastify (web) / Fastify API | `fastify` / `fastify-api` |
| Flask | `flask` |
| FastAPI | `fastapi-api` |
| Spring Boot | `springboot-api` |
| Java MVC / servlet | `java-mvc` |
| ASP.NET Core web app / API | `aspnetcore-auth` / `aspnetcore-api` |
| MAUI / WinForms / WPF | `maui` / `winforms` / `wpf` |
| PHP web app / PHP API | `php` / `php-api` |
| Laravel web app / Laravel API | `laravel` / `laravel-api` |
| Go / Golang API | `go` |
| Swift / iOS | `swift` |
| Android / Kotlin | `android` |
| Flutter (native / web) | `flutter-native` / `flutter-web` |
| React Native / Expo | `react-native` / `expo` |
| Ionic (Angular/React/Vue) | `ionic-angular` / `ionic-react` / `ionic-vue` |

### Variant disambiguation (web app vs API)

Some frameworks have separate web-app and API references. When Tier 1 did not
pin the variant, choose **intent-first**:

| Base | Web-app variant | API variant | Choose API when… |
|---|---|---|---|
| express | `express` | `express-jwt` | protecting API routes / validating JWTs, no server-rendered UI |
| fastify | `fastify` | `fastify-api` | resource server / JWT validation only |
| php | `php` | `php-api` | building/protecting a PHP API, no web UI |
| laravel | `laravel` | `laravel-api` | API-only (token guard), no Blade UI |
| aspnetcore | `aspnetcore-auth` | `aspnetcore-api` | Web API / JWT bearer, no cookie login UI |

If intent is still ambiguous (both a UI and protected endpoints, or unclear),
**state what you detected and ask the developer** web app vs API before loading.

### If nothing matched

Ask the developer what framework/language they are using. Do not guess.

### Conflicts

If Tier 2 (workspace) and Tier 3 (prompt) disagree materially (e.g. the prompt
says "Next.js" but `package.json` has no `next`), **state the conflict and ask**
rather than silently picking. Workspace signals outrank the prompt when both are
present and consistent.

---

## Step 3: Detect tooling

Read the project file tree. This is a project-context decision, not a product preference.

| Project has... | Load |
|---|---|
| `terraform/` directory OR any `*.tf` files | `tooling-terraform.md` |
| Auth0 MCP server active in this agent session | `tooling-mcp.md` |
| Anything else (default) | `tooling-cli.md` |

---

## Step 4: Load reference files

Find the section below whose heading matches the **Intent** you picked in
Step 1, then read the reference files it lists.

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

### feature:dpop
```
Read: references/feature-dpop.md
Read: references/tooling-{tooling}.md
If a SPA framework is detected (vue/react/angular/spa-js): Read references/framework-{framework}.md
DPoP is SPA-only (no SSR: Next.js/Nuxt) — feature-dpop.md states the exclusion.
```

### guidance
```
Read: references/pattern-security.md
If framework detected: Read references/framework-{framework}.md (for SDK-specific guidance — token storage, session handling, route protection)
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
Read: references/tooling-{tooling}.md
If framework detected: Read references/framework-{framework}.md
```

### upgrade-sdk
```
Read: references/framework-{framework}.md
Follow its "Major Version Migration" section (e.g. Auth0.swift v3, Auth0.Android v4).
This is an Auth0 SDK version bump — NOT a provider migration. Do not load feature-migration.md.
If no framework is detected: ask which Auth0 SDK the developer is upgrading.
```

### tooling
```
Read: references/tooling-{tooling}.md
No framework file — this is a CLI/tooling-only task (create apps/APIs, script
tenant setup, automate config in CI). If the developer then wants to integrate
auth into an app, return to Step 1 with the integrate intent.
```
