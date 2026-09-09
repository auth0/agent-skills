# Integration & Enforcement — Java (Spring Boot)

How to wire org-aware login and enforce tenant isolation from the token in Spring Boot apps. Full
SDK setup lives in `auth0-springboot-api`; this file covers only the B2B additions: passing
`organization`/`invitation` on login and `org_id`-scoped enforcement.

## The enforcement contract (read this first)

On every protected request the backend MUST:

1. **Validate** the access token (signature, `iss`, `aud`, `exp`) — standard JWT validation.
2. **Read `org_id`** from the validated token. This is the active tenant.
3. **Scope all data access** to that `org_id` (tenant filter on every query).
4. **Check authorization relative to `org_id`** — roles/permissions in the token were issued for
   the org the user logged into; treat them as valid only for that org.

Never read the tenant from the URL, a path segment, a body field, or a client header. Those are
attacker-controlled. The token's `org_id` is the only trustworthy tenant statement.

---

## Login: passing `organization` and `invitation`

Spring Boot apps serving a frontend redirect: forward `organization` and `invitation` query params
to the `/authorize` URL. With `spring-security-oauth2-client`:

```java
@GetMapping("/login")
public void login(
    HttpServletResponse response,
    @RequestParam(required = false) String organization,
    @RequestParam(required = false) String invitation
) throws IOException {
    UriComponentsBuilder builder = UriComponentsBuilder
        .fromUriString("https://your-tenant.us.auth0.com/authorize")
        .queryParam("client_id", clientId)
        .queryParam("redirect_uri", redirectUri)
        .queryParam("response_type", "code")
        .queryParam("scope", "openid profile email");

    if (organization != null) builder.queryParam("organization", organization);
    if (invitation != null)   builder.queryParam("invitation", invitation);

    response.sendRedirect(builder.build().toUriString());
}
```

---

## Enforcement: `org_id`-scoped middleware

### Security configuration

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
```

### Controller: extracting `org_id` and scoping data

```java
import com.auth0.authentication.api.Auth0AuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class MembersController {

    private static final String NS = "https://your-app.com";

    @GetMapping("/members")
    public ResponseEntity<List<Member>> listMembers(Authentication authentication) {
        if (!(authentication instanceof Auth0AuthenticationToken auth0Token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String orgId = (String) auth0Token.getClaim("org_id");   // the ONLY source of tenant identity
        if (orgId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        @SuppressWarnings("unchecked")
        List<String> roles = (List<String>) auth0Token.getClaim(NS + "/roles");
        if (roles == null || !roles.contains("org-admin")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        List<Member> members = memberRepository.findAllByOrgId(orgId);  // tenant filter
        return ResponseEntity.ok(members);
    }
}
```

### Require org context via a reusable aspect

For consistent enforcement across controllers, extract the org-scoping check into a Spring aspect:

```java
@Component
@Aspect
public class OrgContextAspect {

    @Around("@annotation(RequireOrg)")
    public Object enforceOrg(ProceedingJoinPoint pjp) throws Throwable {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof Auth0AuthenticationToken token)) throw new ResponseStatusException(UNAUTHORIZED);

        String orgId = (String) token.getClaim("org_id");
        if (orgId == null) throw new ResponseStatusException(FORBIDDEN, "Org context required");

        // Store in a request-scoped bean so service layer can access it
        OrgContext.set(orgId);
        try {
            return pjp.proceed();
        } finally {
            OrgContext.clear();
        }
    }
}
```

Then in your service layer use `OrgContext.get()` instead of accepting `orgId` as a parameter
from the controller — this prevents callers from supplying a different org id.

---

## Why `org_id`, not the user's membership list

A user can belong to many orgs. The Management API can list *all* their memberships, but that is
not the active tenant — the active tenant is whichever org they authenticated into, which Auth0
records as `org_id` in the issued token. Authorizing against the membership list instead of the
token's `org_id` re-introduces the cross-tenant access bug this whole setup exists to prevent.
