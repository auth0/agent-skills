
# Auth0 Spring Boot API Integration

Protect Spring Boot API endpoints with JWT access token validation using `com.auth0:auth0-springboot-api`. Features auto-configuration, scope-based authorization, and built-in DPoP (RFC 9449) support.

## Critical rules

- **DPoP `dpop-mode`:** `ALLOWED` accepts both Bearer and DPoP tokens; `REQUIRED` accepts only DPoP tokens and rejects standard Bearer; `DISABLED` accepts standard Bearer only. Pick the mode deliberately — `REQUIRED` will 401 any plain Bearer request. See the DPoP Authentication section for full config.

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/auth0-auth-java/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below. If the API call fails (e.g., no releases yet), use `1.0.0-beta.1`.

## Prerequisites

- Java 17+ and Spring Boot 3.2+
- Maven 3.6+ or Gradle 7+
- Auth0 API configured (not Application — must be API resource)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

| Use Case | Use Instead |
|----------|------------------|
| Server-rendered web applications (Spring MVC with sessions) | Use the Auth0 integration workflow for Spring Boot web apps with login UI (Regular Web Application) |
| Single Page Applications | Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth |
| Mobile applications | Use the Auth0 integration workflow for Android or iOS/Swift for native mobile |
| Non-Spring Java APIs | Use the Auth0 integration workflow for plain Spring Security |

## Quick Start Workflow

> **Agent instruction:** If the user's prompt already provides Auth0 credentials (domain, audience), use them directly — skip automatic setup and credential questions. Only offer setup options when credentials are missing.

### 1. Install SDK

**Gradle (build.gradle):**

```groovy
implementation 'com.auth0:auth0-springboot-api:1.0.0-beta.1'
```

**Maven (pom.xml):**

```xml
<dependency>
    <groupId>com.auth0</groupId>
    <artifactId>auth0-springboot-api</artifactId>
    <version>1.0.0-beta.1</version>
</dependency>
```

### 2. Create Auth0 API

You need an **API** (not Application) in Auth0.

> **STOP — ask the user before proceeding.**
>
> Ask exactly this question and wait for their answer before doing anything else:
>
> > "How would you like to create the Auth0 API resource?
> > 1. **Automated** — I'll run Auth0 CLI scripts that create the resource and write the values to your application.yml automatically.
> > 2. **Manual** — You create the API yourself in the Auth0 Dashboard (or via `auth0 apis create`) and provide me the Domain and Audience.
> >
> > Which do you prefer? (1 = Automated / 2 = Manual)"
>
> Do NOT proceed to any setup steps until the user has answered. Do NOT default to manual.

**If the user chose Automated**, follow the Setup Guide section below for complete CLI scripts. The automated path writes `application.yml` for you — skip Step 3 below and proceed directly to Step 4.

**If the user chose Manual**, follow the Setup Guide section below (Manual Setup). Then continue with Step 3.

Quick reference for manual API creation:

```bash
# Using Auth0 CLI
auth0 apis create \
  --name "My Spring Boot API" \
  --identifier https://my-springboot-api
```

Or create manually in Auth0 Dashboard → Applications → APIs

### 3. Configure application.yml

```yaml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"
```

**Important:** Domain must NOT include `https://`. The library constructs the issuer URL automatically.

Or use `application.properties`:

```properties
auth0.domain=your-tenant.auth0.com
auth0.audience=https://my-springboot-api
```

### 4. Configure Spring Security

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            Auth0AuthenticationFilter authFilter
    ) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public").permitAll()
                .requestMatchers("/api/protected").authenticated()
                .requestMatchers("/api/admin/**").hasAuthority("SCOPE_admin")
                .anyRequest().authenticated())
            .addFilterBefore(authFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

### 5. Protect Endpoints

```java
@RestController
@RequestMapping("/api")
public class ApiController {

    @GetMapping("/public")
    public ResponseEntity<Map<String, Object>> publicEndpoint() {
        return ResponseEntity.ok(Map.of("message", "Public endpoint - no token required"));
    }

    @GetMapping("/protected")
    public ResponseEntity<Map<String, Object>> protectedEndpoint(Authentication authentication) {
        Auth0AuthenticationToken token = (Auth0AuthenticationToken) authentication;
        return ResponseEntity.ok(Map.of(
            "user", authentication.getName(),
            "email", token.getClaim("email"),
            "scopes", token.getScopes()
        ));
    }
}
```

### 6. Test API

> **Agent instruction:** After writing all code, verify the build succeeds:
> ```bash
> ./gradlew bootRun
> ```
> or `./mvnw spring-boot:run`. If build fails, diagnose and fix. After 5-6 failed attempts, use `AskUserQuestion` to get help.

Test public endpoint:

```bash
curl http://localhost:8080/api/public
```

Test protected endpoint (requires access token):

```bash
curl http://localhost:8080/api/protected \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Get a test token via Client Credentials flow or Auth0 Dashboard → APIs → Test tab.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Domain includes `https://` | Use `your-tenant.auth0.com` format only — no scheme prefix |
| Audience doesn't match API Identifier | Must exactly match the API Identifier set in Auth0 Dashboard |
| Created Application instead of API in Auth0 | Must create API resource in Auth0 Dashboard → Applications → APIs |
| Missing `addFilterBefore` in SecurityConfig | `Auth0AuthenticationFilter` must be added before `UsernamePasswordAuthenticationFilter` |
| Using ID token instead of access token | Must use **access token** for API auth, not ID token |
| Checking `scope` claim in wrong format | Scopes map to `SCOPE_` prefixed authorities: use `hasAuthority("SCOPE_read:data")` |
| Spring Boot env var binding | Use `AUTH0_DOMAIN` not `AUTH0_DOMAIN` with underscores inside property names; Spring removes dashes and is case-insensitive |

## Scope-Based Authorization

See the Integration Guide section below for defining and enforcing scope-based access control via filter chain, `@PreAuthorize`, or programmatic checks.

## DPoP Support

Built-in proof-of-possession token binding per RFC 9449. See the Integration Guide section below for configuration modes (DISABLED, ALLOWED, REQUIRED).

## Related Capabilities

- Basic Auth0 setup and account creation → set it up with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)
- Spring Boot web apps with login UI (Regular Web Application) → the Auth0 integration workflow for Spring Boot web apps

## Quick Reference

**Configuration Properties (`application.yml`):**
- `auth0.domain` — Auth0 tenant domain, no `https://` prefix (required)
- `auth0.audience` — API Identifier from Auth0 API settings (required)
- `auth0.dpop-mode` — DPoP mode: `DISABLED`, `ALLOWED` (default), `REQUIRED`
- `auth0.dpop-iat-offset-seconds` — DPoP proof time window (default: 300)
- `auth0.dpop-iat-leeway-seconds` — DPoP proof time leeway (default: 30)

**User Claims (via `Auth0AuthenticationToken`):**
- `authentication.getName()` — User ID (subject / `sub` claim)
- `token.getClaim("email")` — Any specific claim by name
- `token.getClaims()` — All JWT claims as `Map<String, Object>`
- `token.getScopes()` — Scopes as `Set<String>`

**Common Use Cases:**
- Protect routes → `requestMatchers("/path").authenticated()` (see Step 4)
- Scope enforcement → `hasAuthority("SCOPE_read:data")` or `@PreAuthorize` (see the Integration Guide section below)
- DPoP token binding → see the Integration Guide section below
- Complete API reference → see the API Reference section below

## References

- [Auth0 Java Spring Security API Quickstart](https://auth0.com/docs/quickstart/backend/java-spring-security5)
- [SDK GitHub Repository](https://github.com/auth0/auth0-auth-java)
- [Spring Security Documentation](https://docs.spring.io/spring-security/reference/)
- [Access Tokens Guide](https://auth0.com/docs/secure/tokens/access-tokens)
- [DPoP RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449)

---

# API Reference & Testing

Complete reference for `com.auth0:auth0-springboot-api` configuration options and auto-configuration classes.

---

## Configuration Reference

### application.yml Properties

```yaml
auth0:
  domain: "your-tenant.auth0.com"        # Required: Auth0 tenant domain (no https://)
  audience: "https://api.example.com"     # Required: API identifier / audience
  dpop-mode: ALLOWED                      # Optional: DISABLED | ALLOWED | REQUIRED (default: ALLOWED)
  dpop-iat-offset-seconds: 300            # Optional: DPoP proof time window (default: 300)
  dpop-iat-leeway-seconds: 30             # Optional: DPoP proof time leeway (default: 30)
```

### application.properties Equivalent

```properties
auth0.domain=your-tenant.auth0.com
auth0.audience=https://api.example.com
auth0.dpopMode=ALLOWED
auth0.dpopIatOffsetSeconds=300
auth0.dpopIatLeewaySeconds=30
```

### Environment Variables

```bash
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.example.com
AUTH0_DPOPMODE=ALLOWED
AUTH0_DPOPIATOFFSETSECONDS=300
AUTH0_DPOPIATLEEWAYSECONDS=30
```

> **Note:** Spring Boot environment variable binding removes dashes and is case-insensitive. Do not use underscores to separate words within a property name (e.g., use `AUTH0_DPOPMODE`, not `AUTH0_DPOP_MODE`).

---

## Auth0Properties

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `domain` | `String` | Yes | — | Auth0 tenant domain. Format: `your-tenant.auth0.com` (no `https://` prefix) |
| `audience` | `String` | Yes | — | API Identifier from Auth0 Dashboard |
| `dpopMode` | `DPoPMode` | No | `ALLOWED` | Controls which token types are accepted |
| `dpopIatOffsetSeconds` | `Long` | No | `300` | Maximum age of DPoP proof `iat` claim in seconds |
| `dpopIatLeewaySeconds` | `Long` | No | `30` | Additional leeway for DPoP proof time validation |
| `domains` | `List<String>` | No | — | Additional trusted Auth0 domains (for Multiple Custom Domains) |
| `cacheMaxEntries` | `Integer` | No | — | Maximum entries in the JWKS cache |
| `cacheTtlSeconds` | `Long` | No | — | TTL in seconds for JWKS cache entries |

### Auto-Configuration Beans

The SDK auto-configuration also supports custom beans:

| Bean | Description |
|------|-------------|
| `DomainResolver` | Custom domain resolution for Multiple Custom Domains (MCD). Provide a `@Bean` of type `DomainResolver` to route requests to different Auth0 domains based on the request. |
| `AuthCache` | Custom cache implementation for JWKS or token verification results. Provide a `@Bean` of type `AuthCache` to override the default in-memory cache. |

### DPoPMode Enum

| Value | Description |
|-------|-------------|
| `DPoPMode.DISABLED` | Standard JWT Bearer only — rejects DPoP tokens |
| `DPoPMode.ALLOWED` | Accept both DPoP-bound and standard Bearer tokens (default) |
| `DPoPMode.REQUIRED` | Only accept DPoP-bound tokens — rejects standard Bearer |

---

## Auto-Configuration Classes

### Auth0AutoConfiguration

Automatically creates `AuthOptions` and `AuthClient` beans from `Auth0Properties`.

```java
// AuthOptions bean — built from application.yml
@Bean
public AuthOptions authOptions(Auth0Properties properties) {
    AuthOptions.Builder builder = new AuthOptions.Builder()
        .domain(properties.getDomain())
        .audience(properties.getAudience());

    if (properties.getDpopMode() != null) {
        builder.dpopMode(properties.getDpopMode());
    }
    if (properties.getDpopIatLeewaySeconds() != null) {
        builder.dpopIatLeewaySeconds(properties.getDpopIatLeewaySeconds());
    }
    if (properties.getDpopIatOffsetSeconds() != null) {
        builder.dpopIatOffsetSeconds(properties.getDpopIatOffsetSeconds());
    }
    return builder.build();
}

// AuthClient bean — main entry point for verifying HTTP requests
@Bean
@ConditionalOnMissingBean
public AuthClient authClient(AuthOptions options) {
    return AuthClient.from(options);
}
```

### Auth0SecurityAutoConfiguration

Automatically creates the `Auth0AuthenticationFilter` bean.

```java
@Bean
@ConditionalOnMissingBean
public Auth0AuthenticationFilter authAuthenticationFilter(
        AuthClient authClient, Auth0Properties auth0Properties) {
    return new Auth0AuthenticationFilter(authClient, auth0Properties);
}
```

### Auth0AuthenticationFilter

A `OncePerRequestFilter` that:
1. Extracts the `Authorization` header
2. Calls `AuthClient.verifyRequest()` to validate the JWT (and DPoP proof if present)
3. Sets `Auth0AuthenticationToken` in the `SecurityContextHolder`
4. On failure, returns appropriate HTTP status and `WWW-Authenticate` header

---

## Auth0AuthenticationToken

Extends `AbstractAuthenticationToken`. Created after successful JWT validation.

| Method | Return Type | Description |
|--------|-------------|-------------|
| `getName()` | `String` | User ID (`sub` claim from JWT) |
| `getClaims()` | `Map<String, Object>` | All JWT claims |
| `getClaim(String claimName)` | `Object` | Specific claim value, or `null` |
| `getScopes()` | `Set<String>` | Parsed scopes from `scope` claim |
| `getAuthorities()` | `Collection<GrantedAuthority>` | `SCOPE_` prefixed authorities from JWT scopes |

**Authority mapping:** The `scope` claim `"read:data write:data"` becomes authorities `SCOPE_read:data` and `SCOPE_write:data`. If no scopes are present, a default `ROLE_USER` authority is assigned.

---

## Claims Reference

### Standard JWT Claims

| Claim | Description | Access |
|-------|-------------|--------|
| `sub` | User ID (subject) | `authentication.getName()` or `token.getClaim("sub")` |
| `scope` | Space-separated scopes | `token.getScopes()` or `token.getClaim("scope")` |
| `aud` | Audience (API identifier) | `token.getClaim("aud")` |
| `iss` | Issuer (Auth0 tenant URL) | `token.getClaim("iss")` |
| `exp` | Expiration timestamp | `token.getClaim("exp")` |
| `iat` | Issued-at timestamp | `token.getClaim("iat")` |

### Auth0-Specific Claims

| Claim | Description |
|-------|-------------|
| `permissions` | Array of RBAC permissions (if Enable RBAC is on) |
| `email` | User email (if requested in scope) |
| `https://example.com/*` | Custom claims added via Auth0 Actions (namespaced) |

---

## Complete Minimal Example

```java
// src/main/java/com/example/SecurityConfig.java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            Auth0AuthenticationFilter authFilter
    ) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public").permitAll()
                .requestMatchers("/api/admin/**").hasAuthority("SCOPE_admin")
                .anyRequest().authenticated())
            .addFilterBefore(authFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}

// src/main/java/com/example/ApiController.java
@RestController
@RequestMapping("/api")
public class ApiController {

    @GetMapping("/public")
    public ResponseEntity<Map<String, Object>> publicEndpoint() {
        return ResponseEntity.ok(Map.of("message", "Public endpoint"));
    }

    @GetMapping("/protected")
    public ResponseEntity<Map<String, Object>> protectedEndpoint(Authentication authentication) {
        Auth0AuthenticationToken token = (Auth0AuthenticationToken) authentication;
        return ResponseEntity.ok(Map.of(
            "user", authentication.getName(),
            "scopes", token.getScopes()
        ));
    }

    @GetMapping("/admin/dashboard")
    public ResponseEntity<Map<String, Object>> adminEndpoint(Authentication authentication) {
        return ResponseEntity.ok(Map.of(
            "message", "Admin access granted",
            "user", authentication.getName()
        ));
    }
}
```

```yaml
# src/main/resources/application.yml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"

spring:
  application:
    name: auth0-api
```

---

## Testing Checklist

1. **Public endpoint returns 200 without token:**
   ```bash
   curl http://localhost:8080/api/public
   ```

2. **Protected endpoint returns 401 without token:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/protected
   # Expected: 401
   ```

3. **Protected endpoint returns 200 with valid token:**
   ```bash
   curl http://localhost:8080/api/protected \
     -H "Authorization: Bearer $TOKEN"
   ```
   Capture the token into a shell variable and reference `$TOKEN` rather than
   pasting the raw token inline — inline token values leak into shell history
   and terminal scrollback. See [Testing with curl](#testing-with-curl) below.

4. **Scope-protected endpoint returns 403 with insufficient scope:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/admin/dashboard \
     -H "Authorization: Bearer TOKEN_WITHOUT_ADMIN_SCOPE"
   # Expected: 403
   ```

5. **DPoP token accepted (if dpop-mode is `ALLOWED` or `REQUIRED`):**
   ```bash
   curl http://localhost:8080/api/protected \
     -H "Authorization: DPoP YOUR_DPOP_TOKEN" \
     -H "DPoP: YOUR_DPOP_PROOF"
   ```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 `invalid_token` | Audience mismatch | Verify `auth0.audience` matches API Identifier exactly |
| 401 `invalid_issuer` | Domain has `https://` prefix | Use `your-tenant.auth0.com` format only |
| 403 Forbidden | Token missing required scope | Request token with correct scopes; check `hasAuthority` values |
| No `Auth0AuthenticationFilter` bean | Missing auto-configuration | Ensure `auth0-springboot-api` is on classpath and `auth0.domain`/`auth0.audience` are set |
| DPoP `invalid_dpop_proof` | Proof validation failed | Check DPoP proof format, `iat` claim within time window |
| Token expired | Short-lived test token | Request a fresh token from Auth0 Dashboard or CLI |
| Multiple Authorization headers | Duplicate header sent | Send exactly one `Authorization` header per request |

---

## Security Considerations

- **No client secret needed** — This library validates JWTs via JWKS (public key), not client credentials
- **Never hardcode domain or audience** — Use `application.yml` or environment variables
- **Use HTTPS in production** — Auth0 requires HTTPS for token issuance; API should also use HTTPS
- **Stateless sessions** — Always configure `SessionCreationPolicy.STATELESS` for API endpoints
- **Use minimal scopes** — Only enforce scopes your API actually needs
- **Keep packages updated** — Regularly update `auth0-springboot-api` for security patches
- **DPoP for high-security APIs** — Enable `dpop-mode: REQUIRED` to prevent token theft

---

## References

- [Auth0 Java Spring Security API Quickstart](https://auth0.com/docs/quickstart/backend/java-spring-security5)
- [SDK GitHub Repository](https://github.com/auth0/auth0-auth-java)
- [Spring Security Documentation](https://docs.spring.io/spring-security/reference/)
- [DPoP RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449)

---

# Auth0 Spring Boot API Integration Patterns

Advanced integration patterns for Spring Boot API applications using `auth0-springboot-api`.

---

## Scope-Based Authorization

The library maps JWT scopes to Spring Security authorities with a `SCOPE_` prefix. A token with `scope: "read:messages write:messages"` produces authorities `SCOPE_read:messages` and `SCOPE_write:messages`.

### Option 1: Security Filter Chain (Recommended)

Define scope requirements in your security configuration:

```java
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            Auth0AuthenticationFilter authFilter
    ) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public").permitAll()
                .requestMatchers("/api/admin/**").hasAuthority("SCOPE_admin")
                .requestMatchers("/api/users/**").hasAuthority("SCOPE_read:users")
                .anyRequest().authenticated())
            .addFilterBefore(authFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }
}
```

### Option 2: Method-Level Security with @PreAuthorize

Requires `@EnableMethodSecurity` on a configuration class:

```java
@Configuration
@EnableMethodSecurity
public class MethodSecurityConfig {
    // Enables @PreAuthorize annotations
}
```

```java
@RestController
@RequestMapping("/api/users")
public class UserManagementController {

    @GetMapping
    @PreAuthorize("hasAuthority('SCOPE_read:users')")
    public ResponseEntity<List<User>> getUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('SCOPE_write:users')")
    public ResponseEntity<User> createUser(@RequestBody User user) {
        return ResponseEntity.ok(userService.createUser(user));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SCOPE_delete:users')")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }
}
```

### Option 3: Programmatic Scope Check

Use `getScopes()` on the token for custom logic:

```java
@GetMapping("/admin")
public ResponseEntity<Map<String, Object>> adminEndpoint(Authentication authentication) {
    if (authentication instanceof Auth0AuthenticationToken auth0Token) {
        Set<String> scopes = auth0Token.getScopes();

        if (!scopes.contains("admin") || !scopes.contains("read:admin")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "insufficient_scope"));
        }

        return ResponseEntity.ok(Map.of("message", "Admin access granted"));
    }

    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
}
```

### Define Permissions in Auth0

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Permissions** tab
4. Add permissions matching your scope names (e.g., `read:users`, `write:users`)

### Request Tokens with Scopes

```bash
curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-springboot-api",
    "grant_type": "client_credentials",
    "scope": "read:users write:users"
  }'
```

---

## DPoP Authentication

[DPoP](https://www.rfc-editor.org/rfc/rfc9449.html) (Demonstrating Proof of Possession) binds tokens to a specific client key pair, preventing token theft.

### Configuration Modes

#### ALLOWED Mode (Default)

Accepts both Bearer and DPoP tokens:

```yaml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"
  dpop-mode: ALLOWED
```

#### `REQUIRED` Mode

Only accepts DPoP tokens — rejects standard Bearer:

```yaml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"
  dpop-mode: REQUIRED
```

#### DISABLED Mode

Standard JWT Bearer only — rejects DPoP tokens:

```yaml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"
  dpop-mode: DISABLED
```

### Fine-Tuning DPoP Time Validation (Optional)

The defaults work for most use cases. Only adjust these if you need to handle clock skew or network delays:

```yaml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"
  dpop-mode: ALLOWED
  dpop-iat-offset-seconds: 300  # Optional: max age of DPoP proof (default: 300)
  dpop-iat-leeway-seconds: 30   # Optional: additional time leeway (default: 30)
```

### How DPoP Works in Controllers

DPoP validation is handled by the `Auth0AuthenticationFilter` before the request reaches your controller. Your controller code is the same regardless of whether the client used Bearer or DPoP:

```java
@GetMapping("/sensitive")
public ResponseEntity<Map<String, Object>> sensitiveEndpoint(Authentication authentication) {
    // Works the same for both Bearer and DPoP tokens
    if (authentication instanceof Auth0AuthenticationToken auth0Token) {
        return ResponseEntity.ok(Map.of(
            "user", authentication.getName(),
            "scopes", auth0Token.getScopes(),
            "message", "Access granted"
        ));
    }
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
}
```

### DPoP WWW-Authenticate Headers

The library automatically generates RFC-compliant `WWW-Authenticate` headers on failures:

```http
# ALLOWED mode (default)
WWW-Authenticate: Bearer realm="api", DPoP algs="ES256"

# REQUIRED mode
WWW-Authenticate: DPoP algs="ES256"

# DPoP-specific errors
WWW-Authenticate: DPoP error="invalid_dpop_proof", error_description="DPoP proof validation failed"
```

### Enable DPoP on Auth0 API

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Enable DPoP binding requirement

---

## Accessing User Claims

### From Controller Parameter

```java
@GetMapping("/profile")
public ResponseEntity<Map<String, Object>> getUserProfile(Authentication authentication) {
    if (authentication instanceof Auth0AuthenticationToken auth0Token) {
        return ResponseEntity.ok(Map.of(
            "sub", String.valueOf(auth0Token.getClaim("sub")),
            "email", String.valueOf(auth0Token.getClaim("email")),
            "scope", String.valueOf(auth0Token.getClaim("scope")),
            "scopes", auth0Token.getScopes()
        ));
    }
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
}
```

### Common JWT Claims

| Claim | Description |
|-------|-------------|
| `sub` | User ID (subject) |
| `scope` | Space-separated list of granted scopes |
| `aud` | Audience (your API identifier) |
| `iss` | Issuer (your Auth0 tenant URL) |
| `exp` | Expiration timestamp |
| `iat` | Issued-at timestamp |

Custom claims added via Auth0 Actions use namespaced keys, e.g., `https://example.com/role`.

---

## Error Handling

### BaseAuthException Hierarchy

The library uses `BaseAuthException` subclasses for different error conditions:

| Exception | HTTP Status | Cause |
|-----------|-------------|-------|
| `MissingAuthorizationException` | 400 | No or multiple `Authorization` headers |
| `VerifyAccessTokenException` | 401 | JWT validation failed (expired, bad signature, wrong audience) |
| `InvalidAuthSchemeException` | 400 | Wrong auth scheme for configured DPoP mode |
| `InvalidDpopProofException` | 400 | DPoP proof validation failed |
| `InsufficientScopeException` | 403 | Valid token but missing required scope |

The `Auth0AuthenticationFilter` handles all exceptions automatically, setting the appropriate HTTP status and `WWW-Authenticate` header. No custom exception handling is needed in controllers for auth errors.

### Custom Error Responses

For non-auth errors in your controllers, use standard Spring patterns:

```java
@ExceptionHandler(Exception.class)
public ResponseEntity<Map<String, Object>> handleError(Exception e) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", e.getMessage()));
}
```

### Standard Error Responses

| Status | Cause | Fix |
|--------|-------|-----|
| 401 | Missing or invalid token | Include valid `Authorization: Bearer <token>` header |
| 401 | Expired token | Request a fresh access token |
| 401 | Wrong audience | Token's `aud` claim must match your API Identifier |
| 403 | Insufficient scope | Token must include required scopes |

---

## Mixed Public and Protected Endpoints

```java
@RestController
@RequestMapping("/api")
public class MixedController {

    // Public - no auth needed
    @GetMapping("/public")
    public ResponseEntity<Map<String, Object>> publicEndpoint() {
        return ResponseEntity.ok(Map.of("message", "Public endpoint"));
    }

    // Protected - requires valid JWT
    @GetMapping("/private")
    public ResponseEntity<Map<String, Object>> privateEndpoint(Authentication authentication) {
        return ResponseEntity.ok(Map.of(
            "message", "Private endpoint",
            "user", authentication.getName()
        ));
    }

    // Protected with scope
    @GetMapping("/messages")
    @PreAuthorize("hasAuthority('SCOPE_read:messages')")
    public ResponseEntity<Map<String, Object>> messagesEndpoint() {
        return ResponseEntity.ok(Map.of("messages", List.of("Hello", "World")));
    }
}
```

---

## CORS Configuration

For APIs consumed by browser-based SPAs, configure CORS **before** the auth filter:

```java
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            Auth0AuthenticationFilter authFilter
    ) throws Exception {
        return http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public").permitAll()
                .anyRequest().authenticated())
            .addFilterBefore(authFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:3000"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "DPoP"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
```

---

## Testing

### Integration Testing with MockMvc

```java
@SpringBootTest
@AutoConfigureMockMvc
class ApiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void publicEndpoint_returns200() throws Exception {
        mockMvc.perform(get("/api/public"))
            .andExpect(status().isOk());
    }

    @Test
    void protectedEndpoint_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/protected"))
            .andExpect(status().isUnauthorized());
    }
}
```

### Testing with curl

```bash
# Get a test token
TOKEN=$(auth0 test token --audience https://my-springboot-api --json | jq -r '.access_token')

# Test protected endpoint
curl http://localhost:8080/api/protected \
  -H "Authorization: Bearer $TOKEN"
```

---

## Security Considerations

- **Stateless sessions** — Always use `SessionCreationPolicy.STATELESS` for API endpoints
- **No client secret** — This library validates JWTs via JWKS; no client secret is stored or needed
- **CORS before auth** — Configure CORS middleware before the auth filter in the security chain
- **Use HTTPS in production** — Auth0 requires HTTPS for token issuance
- **Minimal scopes** — Only enforce scopes your API actually needs
- **DPoP for high-security** — Enable `dpop-mode: REQUIRED` for APIs handling sensitive data

---

---

# Auth0 Spring Boot API Setup Guide

Setup instructions for Spring Boot API applications using `auth0-springboot-api`.

---

## Auth0 Configuration

> **Agent instruction:**
>
> **Check if Auth0 domain and audience are already in the user's prompt first.**
> If the prompt contains Auth0 domain and audience, use them directly — skip to "Write Configuration" below. Do NOT call `AskUserQuestion` to re-confirm.
>
> **If Auth0 configuration is NOT provided**, use `AskUserQuestion` to ask:
> "How would you like to configure Auth0?"
> - Option A: "Automatic setup using Auth0 CLI (recommended)"
> - Option B: "Manual setup" — provide domain and audience manually
>
> **If Automatic Setup:**
>
> 1. **Pre-flight checks:**
>    - Verify Auth0 CLI is installed: `auth0 --version`
>    - Verify logged in: `auth0 tenants list --csv --no-input`
>    - If any check fails, guide user to install/login, or fall back to manual setup
>
> 2. **Create the API resource using Auth0 CLI:**
>    ```bash
>    auth0 apis create --name "My Spring Boot API" --identifier https://my-springboot-api --json
>    ```
>    Then write the returned domain and audience to `application.yml`.
>
> **If Manual Setup:**
>
> Ask the user for:
> - Auth0 Domain (e.g., `your-tenant.auth0.com`)
> - API Audience / Identifier (e.g., `https://my-springboot-api`)
>
> Write the configuration file with provided values.

---

## Quick Setup (Automated)

Uses the Auth0 CLI to create an Auth0 API resource and configure your project.

### Step 1: Install Auth0 CLI and create API resource

```bash
# Install Auth0 CLI (macOS)
brew install auth0/auth0-cli/auth0

# Login
auth0 login --no-input

# Create an Auth0 API resource
auth0 apis create \
  --name "My Spring Boot API" \
  --identifier https://my-springboot-api \
  --json
```

Note the `identifier` value — this is your Audience.

### Step 2: Get your domain

```bash
auth0 tenants list
```

Your domain is shown in the output (e.g., `your-tenant.auth0.com`).

### Step 3: Write configuration

Add to `src/main/resources/application.yml`:

```yaml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"
```

Or `src/main/resources/application.properties`:

```properties
auth0.domain=your-tenant.auth0.com
auth0.audience=https://my-springboot-api
```

---

## Manual Setup

### Install Dependency

**Gradle (build.gradle):**

```groovy
implementation 'com.auth0:auth0-springboot-api:1.0.0-beta.1'
```

**Maven (pom.xml):**

```xml
<dependency>
    <groupId>com.auth0</groupId>
    <artifactId>auth0-springboot-api</artifactId>
    <version>1.0.0-beta.1</version>
</dependency>
```

### Create Auth0 API Resource

1. Go to Auth0 Dashboard → Applications → APIs
2. Click **Create API**
3. Set a **Name** and an **Identifier** (e.g., `https://my-springboot-api`)
4. Note the Identifier — this is your `audience`

### Configure application.yml

```yaml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"
```

**Important:** Domain format is `your-tenant.auth0.com` — do NOT include `https://`.

### Get Auth0 Configuration

- **Domain:** Auth0 Dashboard → Settings → Domain (or `auth0 tenants list`)
- **Audience:** The identifier you set when creating the API resource

---

## Post-Setup Steps

1. **Verify audience matches** — The `auth0.audience` value must exactly match your API Identifier in Auth0 Dashboard
2. **Add SecurityConfig** — Create a `SecurityConfig.java` class with `Auth0AuthenticationFilter` added before `UsernamePasswordAuthenticationFilter`
3. **Build and test** — Run `./gradlew bootRun` (or `./mvnw spring-boot:run`) and test endpoints

---

## Environment-Specific Configuration

This library validates JWTs via JWKS (public key verification). **No client secret is needed.**

The `domain` and `audience` values are not secrets — they are public identifiers. However, they typically differ per environment:

### Development

Use `application.yml` or `application.properties` directly:

```yaml
auth0:
  domain: "your-tenant.auth0.com"
  audience: "https://my-springboot-api"
```

### Production

Use environment variables (override `application.yml`):

```bash
export AUTH0_DOMAIN=your-tenant.auth0.com
export AUTH0_AUDIENCE=https://my-springboot-api
```

Or use Spring profiles (`application-prod.yml`).

---

## Getting a Test Token

### Via Auth0 Dashboard

1. Go to Auth0 Dashboard → Applications → APIs
2. Select your API
3. Click the **Test** tab
4. Click **Copy Token** to get a test access token

### Via Auth0 CLI (Client Credentials)

```bash
auth0 test token \
  --audience https://my-springboot-api
```

### Via curl (Client Credentials Flow)

```bash
curl -X POST https://your-tenant.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "audience": "https://my-springboot-api",
    "grant_type": "client_credentials"
  }'
```

---

## Verification

1. Application starts without errors: `./gradlew bootRun`
2. Public endpoint accessible without token: `curl http://localhost:8080/api/public`
3. Protected endpoint returns 401 without token: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/protected`
4. Protected endpoint returns 200 with valid token

---

## Troubleshooting

**401 Unauthorized - "invalid_token":** Verify that the `auth0.audience` in config exactly matches your API Identifier in Auth0 Dashboard.

**401 Unauthorized - "invalid_issuer":** Ensure `auth0.domain` does not include `https://` — use `your-tenant.auth0.com` format only.

**No Auth0AuthenticationFilter bean found:** Ensure `auth0-springboot-api` dependency is on the classpath and both `auth0.domain` and `auth0.audience` are configured.

**Token expired:** Test tokens from the Dashboard are short-lived. Request a fresh token.

---
