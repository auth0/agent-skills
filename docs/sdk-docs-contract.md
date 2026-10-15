# SDK docs contract

Auth0 SDKs ship their own task-level docs so that **any** developer or coding
agent — with or without the `auth0` skill — can integrate correctly from what is
installed. The skill's framework references then stay thin and point here
instead of duplicating SDK content. Design: see
[`docs/architecture.md`](./architecture.md#sourcing-discipline-what-the-skill-owns).

## What an SDK ships

- **Location:** a `docs/` directory of Markdown at the SDK repo root. In a
  monorepo, `docs/` sits in the package's own directory (next to its
  `package.json`, `pyproject.toml`, …), so each package ships only its own docs.
- **Published:** included in the release artifact wherever the format allows it
  (npm `files`, composer archive, gem, wheel/sdist, …). Where the artifact can't
  carry Markdown (Android AAR, Swift SPM, NuGet), presence in the repo at the
  release tag is enough — agents fall back to GitHub at that tag.
- **Entry point:** `docs/README.md` — a table of contents, one line per file,
  saying what each file answers. Agents read it first, then only the files they
  need.
- **Versioning:** the `docs/` at a release tag describes that release. Never
  document unreleased behaviour on a release tag.

## Expected topics

| Topic | Must cover |
|---|---|
| Getting started | Install, configuration, env var names, minimal login + logout |
| Protecting routes / screens | The supported mechanisms for this platform |
| Calling APIs | Getting access tokens, audience/scopes, refresh |
| Error handling | Error types/codes, their causes, how to catch them |
| Migration | Only when a previous major version exists |
| Feature guides | Optional: MFA, organizations, passkeys, DPoP, … |

## Style

- Written for people and agents alike; no harness-specific frontmatter.
- Copy-pasteable code with explicit import paths.
- An **anti-patterns** list per guide (what not to do, and why).

## How agents find it

1. Local installed package: `node_modules/<pkg>/docs/`, `vendor/<pkg>/docs/`, …
2. Otherwise: `https://raw.githubusercontent.com/auth0/<repo>/<release-tag>/<package-dir>/docs/README.md`,
   where `<release-tag>` is the repo's tag for the installed version (usually
   `v<version>`) and `<package-dir>` is empty outside monorepos.
3. Auth0 concepts: `https://auth0.com/docs/<page>.md`

## Rollout

A framework reference in this repo is slimmed only once its SDK's row is
`shipped`, or `pilot` — slimmed early against the SDK's existing root Markdown
because it already covers the common path. Otherwise the reference stays as is. Repos below come from each
package's registry metadata (npm, PyPI, Packagist, pub.dev, NuGet, Maven
Central POM) as of 2026-10-15; `unverified` means the registry didn't confirm it.

| Reference | SDK package | Repo | Status | First version shipping `docs/` |
|---|---|---|---|---|
| framework-nextjs | `@auth0/nextjs-auth0` | auth0/nextjs-auth0 | not started (4.32.0 ships `skills/` + `guides/`, not `docs/`) | — |
| framework-react, framework-ionic-react | `@auth0/auth0-react` | auth0/auth0-react | not started (2.28.2 ships `README.md` only) | — |
| framework-spa-js | `@auth0/auth0-spa-js` | auth0/auth0-spa-js | not started (2.28.4 ships `README.md` only) | — |
| framework-angular, framework-ionic-angular | `@auth0/auth0-angular` | auth0/auth0-angular | not started | — |
| framework-vue, framework-ionic-vue | `@auth0/auth0-vue` | auth0/auth0-vue | not started | — |
| framework-nuxt | `@auth0/auth0-nuxt` | auth0/auth0-nuxt | not started | — |
| framework-tanstack-start | `@auth0/auth0-tanstack-start-react` | auth0/auth0-tanstack-start-react | not started | — |
| framework-auth0-api-js | `@auth0/auth0-api-js` | auth0/auth0-auth-js (monorepo) | not started | — |
| framework-auth0-auth-js | `@auth0/auth0-auth-js` | auth0/auth0-auth-js (monorepo) | not started | — |
| framework-auth0-server-js | `@auth0/auth0-server-js` | auth0/auth0-auth-js (monorepo) | not started | — |
| framework-fastify | `@auth0/auth0-fastify` | auth0/auth0-fastify (monorepo) | not started | — |
| framework-fastify-api | `@auth0/auth0-fastify-api` | auth0/auth0-fastify (monorepo) | not started | — |
| framework-express | `express-openid-connect` | auth0/express-openid-connect | not started | — |
| framework-express-jwt | `express-oauth2-jwt-bearer` | auth0/node-oauth2-jwt-bearer | not started | — |
| framework-node-auth0 | `auth0` | auth0/node-auth0 | not started | — |
| framework-react-native, framework-expo | `react-native-auth0` | auth0/react-native-auth0 | not started | — |
| framework-fastapi-api | `auth0-fastapi-api` (PyPI) | auth0/auth0-fastapi-api | not started | — |
| framework-server-python, framework-flask | `auth0-server-python` (PyPI) | auth0/auth0-server-python | not started | — |
| framework-php, framework-php-api | `auth0/auth0-php` (Packagist) | auth0/auth0-PHP | not started | — |
| framework-laravel, framework-laravel-api | `auth0/login` (Packagist) | auth0/laravel-auth0 | not started | — |
| framework-flutter-native, framework-flutter-web, framework-flutter-windows | `auth0_flutter` (pub.dev) | auth0/auth0-flutter | not started | — |
| framework-go | `github.com/auth0/go-jwt-middleware/v3` | auth0/go-jwt-middleware | not started | — |
| framework-aspnetcore-auth | `Auth0.AspNetCore.Authentication` (NuGet) | auth0/auth0-aspnetcore-authentication | not started | — |
| framework-aspnetcore-api | `Auth0.AspNetCore.Authentication.Api` (NuGet) | auth0/aspnetcore-api | not started | — |
| framework-maui, framework-net-android, framework-net-ios, framework-winforms, framework-wpf | `Auth0.OidcClient.*` (NuGet) | auth0/auth0-oidc-client-net | not started | — |
| framework-android | `com.auth0.android:auth0` (Maven) | auth0/Auth0.Android | not started | — |
| framework-java-mvc | `com.auth0:mvc-auth-commons` (Maven) | auth0/auth0-java-mvc-common | not started | — |
| framework-springboot-api | `com.auth0:auth0-springboot-api` (Maven) | auth0/auth0-auth-java | not started | — |
| framework-swift | `Auth0` (CocoaPods / SPM / Carthage) | auth0/Auth0.swift | pilot — slimmed against root `README.md` / `EXAMPLES.md` / `V3_MIGRATION_GUIDE.md` at 3.1.0; its `docs/` is generated DocC | — |
| framework-kmp | `com.auth0.kmp:*` (Maven) | unverified | not started | — |
