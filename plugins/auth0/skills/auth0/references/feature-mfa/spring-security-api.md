# Spring Security (resource server) — MFA (API-side scope gate)

**Minimum version:** Spring Boot 3.3.x / Spring Security 6 (`spring-boot-starter-oauth2-resource-server`).

Framework-specific surface only. The shared mechanic, tenant config, `amr`/error tables, and MFA API endpoints live in the shared MFA reference. This is a **resource-server** API: it does not run MFA. The tenant issues the step-up scope (e.g. `transfer:funds`) only after the user completes MFA, and the API's job is to reject a caller lacking that scope with a `403`. Gating a sensitive route on the step-up scope *is* the enforcement.

Use the current Spring Security OAuth2 resource-server approach. The legacy `auth0-spring-security-api` library is unmaintained — its `JwtWebSecurityConfigurer` and `WebSecurityConfigurerAdapter` were **removed** in Spring Security 6; do not use them. Do not hand-parse the JWT with `io.jsonwebtoken` (jjwt) or `com.auth0.jwt` (java-jwt).

Spring maps the space-delimited `scope` claim to `SCOPE_`-prefixed authorities. Enforce with a `SecurityFilterChain` bean using `oauth2ResourceServer(jwt)` and `hasAuthority("SCOPE_<scope>")` — not `hasRole` (which expects the `ROLE_` prefix) and not by splitting the scope claim in the controller:

```java
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(authorize -> authorize
                // GET /api/balance — requires the read:balance scope.
                .requestMatchers(HttpMethod.GET, "/api/balance").hasAuthority("SCOPE_read:balance")
                // POST /api/transfers — requires BOTH write:transfers and the
                // step-up scope transfer:funds.
                .requestMatchers(HttpMethod.POST, "/api/transfers")
                    .access(allOf(
                        hasAuthority("SCOPE_write:transfers"),
                        hasAuthority("SCOPE_transfer:funds")))
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(withDefaults()));
        return http.build();
    }
}
```

`allOf` / `hasAuthority` come from `AuthorizationManagers` / `AuthorityAuthorizationManager` (`import static ...access.AuthorizationManagers.allOf;` and `...access.AuthorityAuthorizationManager.hasAuthority;`). Equivalent option: a `@PreAuthorize("hasAuthority('SCOPE_write:transfers') and hasAuthority('SCOPE_transfer:funds')")` on the controller method. Whichever you pick, keep the existing `SCOPE_write:transfers` requirement and apply the `transfer:funds` gate **only** to `POST /api/transfers` — leave `GET /api/balance` on `SCOPE_read:balance`.

Set the issuer (`spring.security.oauth2.resourceserver.jwt.issuer-uri`, `https://<domain>/`) and `audiences` in `application.yml`, never hardcoded in source.
