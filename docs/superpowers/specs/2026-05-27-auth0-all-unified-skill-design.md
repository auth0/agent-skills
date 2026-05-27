# Design: `auth0-all` Unified Skill

## Goal

Create a single skill (`auth0-all`) that consolidates all 33 existing Auth0 agent skills into one self-contained skill, optimized for minimal context loading. This enables benchmarking via evals to compare agent performance when using one unified skill vs. many individual skills.

## Architecture

### Router Pattern

The SKILL.md acts as a **thin router** (~300-400 lines). It never contains code examples or deep integration guides. Instead, it:

1. Helps the agent identify which framework/domain the user needs
2. Points to the correct reference files for that framework
3. Provides a disambiguation table for common confusion points

Reference files are only loaded when the agent explicitly reads them, keeping context costs proportional to what's actually needed.

### Directory Structure

```
plugins/auth0/skills/auth0-all/
├── SKILL.md                              # Router (~300-400 lines)
└── references/
    ├── quickstart-quickstart.md          # From auth0-quickstart SKILL.md
    ├── quickstart-setup.md
    ├── quickstart-api.md
    ├── quickstart-integration.md
    ├── cli-quickstart.md                 # From auth0-cli SKILL.md
    ├── cli-commands.md
    ├── migration-quickstart.md           # From auth0-migration SKILL.md
    ├── migration-code-patterns.md
    ├── migration-user-import.md
    ├── mfa-quickstart.md                 # From auth0-mfa SKILL.md
    ├── mfa-api.md
    ├── mfa-setup.md
    ├── mfa-integration.md
    ├── mfa-examples.md
    ├── branding-quickstart.md            # From auth0-branding SKILL.md
    ├── branding-*.md                     # (9 reference files)
    ├── custom-domains-quickstart.md      # From auth0-custom-domains SKILL.md
    ├── custom-domains-*.md               # (13 reference files)
    ├── acul-quickstart.md                # From acul-screen-generator SKILL.md
    ├── acul-*.md                         # (6 reference files)
    ├── nextjs-quickstart.md              # From auth0-nextjs SKILL.md
    ├── nextjs-api.md
    ├── nextjs-integration.md
    ├── nextjs-setup.md
    ├── nuxt-quickstart.md
    ├── nuxt-api.md
    ├── nuxt-integration.md              # (includes route-protection + examples)
    ├── nuxt-setup.md
    ├── react-quickstart.md
    ├── react-api.md
    ├── react-integration.md
    ├── react-setup.md
    ├── vue-quickstart.md
    ├── vue-api.md
    ├── vue-integration.md
    ├── vue-setup.md
    ├── angular-quickstart.md
    ├── angular-api.md
    ├── angular-integration.md
    ├── angular-setup.md
    ├── spa-js-quickstart.md
    ├── spa-js-api.md
    ├── spa-js-integration.md
    ├── spa-js-setup.md
    ├── express-quickstart.md
    ├── express-api.md
    ├── express-integration.md
    ├── express-setup.md
    ├── flask-quickstart.md
    ├── flask-api.md
    ├── flask-integration.md
    ├── flask-setup.md
    ├── fastify-quickstart.md
    ├── fastify-api.md                    # (no refs dir, content from SKILL.md)
    ├── fastify-api-quickstart.md
    ├── fastify-api-api.md                # (no refs dir, content from SKILL.md)
    ├── fastapi-api-quickstart.md
    ├── fastapi-api-api.md
    ├── fastapi-api-integration.md
    ├── fastapi-api-setup.md
    ├── java-mvc-quickstart.md
    ├── java-mvc-api.md
    ├── java-mvc-integration.md
    ├── java-mvc-setup.md
    ├── aspnetcore-auth-quickstart.md
    ├── aspnetcore-auth-api.md
    ├── aspnetcore-auth-integration.md
    ├── aspnetcore-auth-setup.md
    ├── aspnetcore-api-quickstart.md
    ├── aspnetcore-api-api.md
    ├── aspnetcore-api-integration.md
    ├── aspnetcore-api-setup.md
    ├── php-quickstart.md
    ├── php-api.md
    ├── php-integration.md
    ├── php-setup.md
    ├── php-api-quickstart.md
    ├── php-api-api.md
    ├── php-api-integration.md
    ├── php-api-setup.md
    ├── express-jwt-quickstart.md         # From express-oauth2-jwt-bearer
    ├── express-jwt-api.md
    ├── express-jwt-integration.md
    ├── express-jwt-setup.md
    ├── springboot-api-quickstart.md
    ├── springboot-api-api.md
    ├── springboot-api-integration.md
    ├── springboot-api-setup.md
    ├── go-jwt-quickstart.md
    ├── go-jwt-api.md
    ├── go-jwt-integration.md
    ├── go-jwt-setup.md
    ├── react-native-quickstart.md
    ├── react-native-api.md
    ├── react-native-integration.md
    ├── react-native-setup.md
    ├── expo-quickstart.md
    ├── expo-api.md
    ├── expo-integration.md
    ├── expo-setup.md
    ├── ionic-angular-quickstart.md
    ├── ionic-angular-api.md
    ├── ionic-angular-integration.md
    ├── ionic-angular-setup.md
    ├── ionic-react-quickstart.md
    ├── ionic-react-api.md
    ├── ionic-react-integration.md
    ├── ionic-react-setup.md
    ├── ionic-vue-quickstart.md
    ├── ionic-vue-api.md
    ├── ionic-vue-integration.md
    ├── ionic-vue-setup.md
    ├── android-quickstart.md
    ├── android-api.md
    ├── android-integration.md
    ├── android-setup.md
    ├── swift-quickstart.md
    ├── swift-api.md
    ├── swift-integration.md
    └── swift-setup.md
```

### Naming Convention

| Source skill | Prefix | Example |
|---|---|---|
| `auth0-nextjs` | `nextjs-` | `nextjs-api.md` |
| `auth0-react` | `react-` | `react-integration.md` |
| `auth0-spa-js` | `spa-js-` | `spa-js-api.md` |
| `auth0-cli` | `cli-` | `cli-commands.md` |
| `auth0-mfa` | `mfa-` | `mfa-quickstart.md` |
| `auth0-aspnetcore-authentication` | `aspnetcore-auth-` | `aspnetcore-auth-api.md` |
| `auth0-aspnetcore-api` | `aspnetcore-api-` | `aspnetcore-api-api.md` |
| `express-oauth2-jwt-bearer` | `express-jwt-` | `express-jwt-api.md` |
| `go-jwt-middleware` | `go-jwt-` | `go-jwt-api.md` |
| `acul-screen-generator` | `acul-` | `acul-quickstart.md` |
| `auth0-custom-domains` | `custom-domains-` | `custom-domains-quickstart.md` |

### SKILL.md Content

```markdown
---
name: auth0-all
description: Use when adding authentication to any application using Auth0 — covers all frameworks (React, Next.js, Vue, Nuxt, Angular, Express, Flask, FastAPI, Fastify, ASP.NET Core, Spring Boot, Go, PHP, Java, Swift, Android, React Native, Expo, Ionic), Auth0 CLI, MFA, migrations, branding, custom domains, and ACUL screen generation.
license: Apache-2.0
metadata:
  author: Auth0 <support@auth0.com>
  version: '1.0.0'
---

# Auth0 — Unified Skill

[Router instructions]
[Disambiguation table]
[Category sections with 1-line entries + reference links]
[Top common mistakes]
```

#### SKILL.md Sections

1. **How to Use This Skill** (5 lines) — Explains: find your framework below, read the quickstart reference, load api/integration/setup references as needed.

2. **Disambiguation** (~20 lines) — Table resolving common confusion:
   - React SPA vs Next.js
   - Fastify web app vs Fastify API
   - ASP.NET Core web app vs API
   - Express web app vs Express JWT bearer (API)
   - PHP web vs PHP API
   - React Native (bare) vs Expo (managed)
   - Ionic (Angular/React/Vue variants)

3. **Platform & Tools** (~30 lines)
   - Quickstart — framework detection and routing → `quickstart-quickstart.md`
   - CLI — manage tenant from terminal → `cli-quickstart.md`, `cli-commands.md`
   - Migration — migrate from other auth providers → `migration-quickstart.md`, `migration-code-patterns.md`, `migration-user-import.md`
   - MFA — multi-factor auth → `mfa-quickstart.md`, `mfa-api.md`, `mfa-setup.md`, `mfa-integration.md`, `mfa-examples.md`
   - Branding — universal login customization → `branding-quickstart.md`, `branding-*.md`
   - Custom Domains — configure custom domains → `custom-domains-quickstart.md`, `custom-domains-*.md`
   - ACUL Screen Generator — generate login screens → `acul-quickstart.md`, `acul-*.md`

4. **Frontend SPAs** (~20 lines)
   - React (Vite/CRA) → `react-quickstart.md`, `react-api.md`, `react-integration.md`, `react-setup.md`
   - Vue 3 → `vue-quickstart.md`, ...
   - Angular 12+ → `angular-quickstart.md`, ...
   - Vanilla JS (auth0-spa-js) → `spa-js-quickstart.md`, ...

5. **Fullstack Frameworks** (~40 lines)
   - Next.js (App Router + Pages Router) → `nextjs-quickstart.md`, ...
   - Nuxt 3/4 → `nuxt-quickstart.md`, ...
   - Express.js → `express-quickstart.md`, ...
   - Flask → `flask-quickstart.md`, ...
   - Fastify (web app) → `fastify-quickstart.md`
   - Java Servlet → `java-mvc-quickstart.md`, ...
   - ASP.NET Core (web app) → `aspnetcore-auth-quickstart.md`, ...
   - PHP (web app) → `php-quickstart.md`, ...

6. **Backend APIs** (~30 lines)
   - Express/Node JWT Bearer → `express-jwt-quickstart.md`, ...
   - Fastify API → `fastify-api-quickstart.md`
   - FastAPI → `fastapi-api-quickstart.md`, ...
   - Spring Boot API → `springboot-api-quickstart.md`, ...
   - ASP.NET Core API → `aspnetcore-api-quickstart.md`, ...
   - Go (go-jwt-middleware) → `go-jwt-quickstart.md`, ...
   - PHP API → `php-api-quickstart.md`, ...

7. **Mobile** (~30 lines)
   - React Native (bare workflow) → `react-native-quickstart.md`, ...
   - Expo (managed workflow) → `expo-quickstart.md`, ...
   - Ionic Angular → `ionic-angular-quickstart.md`, ...
   - Ionic React → `ionic-react-quickstart.md`, ...
   - Ionic Vue → `ionic-vue-quickstart.md`, ...
   - Android (Kotlin/Java) → `android-quickstart.md`, ...
   - iOS/macOS (Swift) → `swift-quickstart.md`, ...

8. **Common Mistakes** (~30 lines) — Universal mistakes condensed from all skills:
   - Wrong Auth0 app type (SPA vs Regular Web App vs Native)
   - Missing callback/logout URLs in dashboard
   - Using old SDK versions (v3 patterns in v4 SDKs)
   - Secrets in client-side code
   - Missing CORS configuration for APIs
   - Not validating tokens on the backend

### Reference File Content Rules

1. **`*-quickstart.md` files** — Contains the full SKILL.md content from the original skill (minus frontmatter). This is the "getting started" guide with install, configure, basic usage.

2. **Other reference files** (`*-api.md`, `*-integration.md`, `*-setup.md`, etc.) — Exact copies of the original reference files. No cross-references to other skills' files. Self-contained.

3. **Skills without a `references/` directory** (fastify, fastify-api) — Their entire SKILL.md content goes into `{prefix}-quickstart.md`. No other reference files needed.

4. **Skills with non-standard reference files** (nuxt has `route-protection.md` + `examples.md`) — These get merged into the most appropriate standard file or kept with their original name prefixed: `nuxt-route-protection.md`, `nuxt-examples.md`.

## Implementation Plan

1. Create `plugins/auth0/skills/auth0-all/` directory
2. Write the SKILL.md router
3. For each of the 33 existing skills:
   a. Copy SKILL.md content (minus frontmatter) into `references/{prefix}-quickstart.md`
   b. Copy each file from `references/` into `references/{prefix}-{original-name}.md`
4. Verify all links in SKILL.md point to files that exist
5. Test: total SKILL.md stays under 400 lines

## Success Criteria

- SKILL.md loads in under 400 lines (minimal context cost)
- Every reference file is self-contained (no broken cross-references)
- Agent can route from any Auth0-related prompt to the correct reference files
- No information is lost compared to using individual skills
- Suitable for eval benchmarking against the multi-skill approach

## Open Questions (Resolved)

- ~~Nested vs flat references~~ → Flat with prefixes
- ~~Router vs fat document~~ → Router pattern
- ~~Category-based vs decision-tree~~ → Category-based
