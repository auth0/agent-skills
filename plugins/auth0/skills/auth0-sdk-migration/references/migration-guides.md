# Auth0 SDK Migration Guide Reference

This reference maps each Auth0 SDK to its GitHub repository and migration guide file locations. Use these URLs to fetch the migration guide content when performing a major version upgrade.

---

## URL Pattern

Migration guides are fetched as raw markdown from GitHub:

```
https://raw.githubusercontent.com/auth0/{repo}/{branch}/{filename}
```

The default branch is `main` for all repositories listed below.

---

## Web SDKs

### Next.js — `@auth0/nextjs-auth0`

| Field | Value |
|---|---|
| **Repository** | `auth0/nextjs-auth0` |
| **npm package** | `@auth0/nextjs-auth0` |
| **Migration guides** | `V4_MIGRATION_GUIDE.md`, `V3_MIGRATION_GUIDE.md`, `V2_MIGRATION_GUIDE.md`, `V1_MIGRATION_GUIDE.md` |
| **Naming pattern** | `V{version}_MIGRATION_GUIDE.md` |
| **Current latest major** | v4 |

**Raw URLs:**
- v3 → v4: `https://raw.githubusercontent.com/auth0/nextjs-auth0/main/V4_MIGRATION_GUIDE.md`
- v2 → v3: `https://raw.githubusercontent.com/auth0/nextjs-auth0/main/V3_MIGRATION_GUIDE.md`
- v1 → v2: `https://raw.githubusercontent.com/auth0/nextjs-auth0/main/V2_MIGRATION_GUIDE.md`

---

### React — `@auth0/auth0-react`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-react` |
| **npm package** | `@auth0/auth0-react` |
| **Migration guides** | `MIGRATION_GUIDE.md` |
| **Naming pattern** | Single file covering all major version migrations |
| **Current latest major** | v2 |

**Raw URL:**
- `https://raw.githubusercontent.com/auth0/auth0-react/main/MIGRATION_GUIDE.md`

---

### Angular — `@auth0/auth0-angular`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-angular` |
| **npm package** | `@auth0/auth0-angular` |
| **Migration guides** | `MIGRATION_GUIDE.md` |
| **Naming pattern** | Single file covering all major version migrations |
| **Current latest major** | v2 |

**Raw URL:**
- `https://raw.githubusercontent.com/auth0/auth0-angular/main/MIGRATION_GUIDE.md`

---

### Vue — `@auth0/auth0-vue`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-vue` |
| **npm package** | `@auth0/auth0-vue` |
| **Migration guides** | `MIGRATION_GUIDE.md` |
| **Naming pattern** | Single file covering all major version migrations |
| **Current latest major** | v2 |

**Raw URL:**
- `https://raw.githubusercontent.com/auth0/auth0-vue/main/MIGRATION_GUIDE.md`

---

### SPA JS — `@auth0/auth0-spa-js`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-spa-js` |
| **npm package** | `@auth0/auth0-spa-js` |
| **Migration guides** | `MIGRATION_GUIDE.md` |
| **Naming pattern** | Single file covering all major version migrations |
| **Current latest major** | v2 |

**Raw URL:**
- `https://raw.githubusercontent.com/auth0/auth0-spa-js/main/MIGRATION_GUIDE.md`

---

### Nuxt — `@auth0/auth0-nuxt`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-nuxt` |
| **npm package** | `@auth0/auth0-nuxt` |
| **Migration guides** | Check `MIGRATION_GUIDE.md` or `CHANGELOG.md` in root |
| **Naming pattern** | TBD — new SDK, check repo for latest |

---

## Web Server SDKs

### Express — `express-openid-connect`

| Field | Value |
|---|---|
| **Repository** | `auth0/express-openid-connect` |
| **npm package** | `express-openid-connect` |
| **Migration guides** | `V2_MIGRATION_GUIDE.md` |
| **Naming pattern** | `V{version}_MIGRATION_GUIDE.md` |

**Raw URL:**
- v1 → v2: `https://raw.githubusercontent.com/auth0/express-openid-connect/main/V2_MIGRATION_GUIDE.md`

---

### Fastify — `@auth0/auth0-fastify`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-fastify` |
| **npm package** | `@auth0/auth0-fastify` |
| **Migration guides** | Check `MIGRATION_GUIDE.md` or `CHANGELOG.md` in root |
| **Naming pattern** | TBD — new SDK, check repo for latest |

---

## Mobile SDKs

### React Native — `react-native-auth0`

| Field | Value |
|---|---|
| **Repository** | `auth0/react-native-auth0` |
| **npm package** | `react-native-auth0` |
| **Migration guides** | `MIGRATION_GUIDE.md` |
| **Naming pattern** | Single file covering all major version migrations |
| **Current latest major** | v4 |

**Raw URL:**
- `https://raw.githubusercontent.com/auth0/react-native-auth0/main/MIGRATION_GUIDE.md`

---

### iOS/macOS Swift — `Auth0.swift`

| Field | Value |
|---|---|
| **Repository** | `auth0/Auth0.swift` |
| **Package** | `Auth0` (SPM), `Auth0` (CocoaPods) |
| **Migration guides** | `V2_MIGRATION_GUIDE.md` |
| **Naming pattern** | `V{version}_MIGRATION_GUIDE.md` |
| **Current latest major** | v2 |

**Raw URL:**
- v1 → v2: `https://raw.githubusercontent.com/auth0/Auth0.swift/main/V2_MIGRATION_GUIDE.md`

---

### Android — `Auth0.Android`

| Field | Value |
|---|---|
| **Repository** | `auth0/Auth0.Android` |
| **Package** | `com.auth0.android:auth0` (Maven) |
| **Migration guides** | `V3_MIGRATION_GUIDE.md`, `V2_MIGRATION_GUIDE.md` |
| **Naming pattern** | `V{version}_MIGRATION_GUIDE.md` |
| **Current latest major** | v3 |

**Raw URLs:**
- v2 → v3: `https://raw.githubusercontent.com/auth0/Auth0.Android/main/V3_MIGRATION_GUIDE.md`
- v1 → v2: `https://raw.githubusercontent.com/auth0/Auth0.Android/main/V2_MIGRATION_GUIDE.md`

---

## Backend / Management SDKs

### Node.js — `node-auth0`

| Field | Value |
|---|---|
| **Repository** | `auth0/node-auth0` |
| **npm package** | `auth0` |
| **Migration guides** | `v5_MIGRATION_GUIDE.md` |
| **Naming pattern** | `v{version}_MIGRATION_GUIDE.md` (lowercase v) |
| **Current latest major** | v5 |

**Raw URL:**
- v4 → v5: `https://raw.githubusercontent.com/auth0/node-auth0/main/v5_MIGRATION_GUIDE.md`

---

### Python — `auth0-python`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-python` |
| **PyPI package** | `auth0-python` |
| **Migration guides** | `v5_MIGRATION_GUIDE.md` |
| **Naming pattern** | `v{version}_MIGRATION_GUIDE.md` (lowercase v) |
| **Current latest major** | v5 |

**Raw URL:**
- v4 → v5: `https://raw.githubusercontent.com/auth0/auth0-python/main/v5_MIGRATION_GUIDE.md`

---

### Java — `auth0-java`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-java` |
| **Maven package** | `com.auth0:auth0` |
| **Migration guides** | `MIGRATION_GUIDE.md` |
| **Naming pattern** | Single file covering all major version migrations |

**Raw URL:**
- `https://raw.githubusercontent.com/auth0/auth0-java/main/MIGRATION_GUIDE.md`

---

### PHP — `auth0-PHP`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-PHP` |
| **Composer package** | `auth0/auth0-php` |
| **Migration guides** | `UPGRADE.md` |
| **Naming pattern** | Single `UPGRADE.md` file |

**Raw URL:**
- `https://raw.githubusercontent.com/auth0/auth0-PHP/main/UPGRADE.md`

---

### .NET — `auth0.net`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0.net` |
| **NuGet packages** | `Auth0.AuthenticationApi`, `Auth0.ManagementApi` |
| **Migration guides** | `V8_MIGRATION_GUIDE.md` |
| **Naming pattern** | `V{version}_MIGRATION_GUIDE.md` |
| **Current latest major** | v8 |

**Raw URL:**
- v7 → v8: `https://raw.githubusercontent.com/auth0/auth0.net/main/V8_MIGRATION_GUIDE.md`

---

## API / Resource Server SDKs

### Express JWT Bearer — `express-oauth2-jwt-bearer`

| Field | Value |
|---|---|
| **Repository** | `auth0/node-oauth2-jwt-bearer` |
| **npm package** | `express-oauth2-jwt-bearer` |
| **Migration guides** | Check `MIGRATION_GUIDE.md` or `CHANGELOG.md` in root |

---

### Spring Boot API — `auth0-spring-security-api`

| Field | Value |
|---|---|
| **Repository** | `auth0/auth0-spring-security-api` |
| **Maven package** | `com.auth0:auth0-spring-security-api` |
| **Migration guides** | Check `MIGRATION_GUIDE.md` or `CHANGELOG.md` in root |

---

## Fallback Strategy

If a migration guide file is not found at the expected location:

1. **Check root directory** — List files at `https://api.github.com/repos/auth0/{repo}/contents/` and look for filenames containing `migration`, `upgrade`, or `MIGRATION`
2. **Check docs/ directory** — Some repos put guides in `docs/`
3. **Check CHANGELOG.md** — Look for the section under the major version heading (e.g., `## [4.0.0]`) which lists breaking changes
4. **Check GitHub release notes** — Visit `https://github.com/auth0/{repo}/releases` and find the release tagged as the major version (e.g., `v4.0.0`) for release notes with breaking changes
5. **Check the README** — Some SDKs document migration steps in the main README under a "Migration" or "Upgrading" section
