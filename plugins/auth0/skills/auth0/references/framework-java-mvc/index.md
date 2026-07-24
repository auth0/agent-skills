# Auth0 Java MVC Common — reference hub

Add Auth0 authentication to Java Servlet web applications using `com.auth0:mvc-auth-commons`. Provides `AuthenticationController` for building authorize URLs and handling callbacks, with session-based authentication and support for Organizations and Multiple Custom Domains.

<!-- Shared prerequisites: version-fetch instruction, prerequisites, and
     when-NOT-to-use. Read this first (hop 1), then follow the dispatch table
     below to the one leaf for your intent. (Carved from the original
     framework-java-mvc.md.) -->

> **Agent instruction:** Before providing SDK setup instructions, fetch the latest release version by running:
> ```bash
> gh api repos/auth0/auth0-java-mvc-common/releases/latest --jq '.tag_name'
> ```
> Use the returned version in all dependency lines instead of any hardcoded version below. If the API call fails, use `1.12.0`.

## Prerequisites

- Java 8+ (Java 17+ recommended)
- Servlet container (Tomcat, Jetty, etc.) with javax.servlet 3+
- Maven 3.6+ or Gradle 7+
- Auth0 Regular Web Application configured
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

| Use Case | Recommended Skill |
|----------|-------------------|
| Spring Boot web applications with auto-configuration | Use Spring Boot + Okta starter for auto-configured Spring Boot login |
| Spring Boot REST APIs (stateless JWT) | Use the Auth0 integration workflow for Spring Boot REST APIs (JWT Bearer token validation) |
| Single Page Applications | Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth |
| Mobile applications | Use the Auth0 integration workflow for Android or Swift for native mobile |
| Machine-to-machine API calls | Use Auth0 Management API SDK for server-to-server |

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-java-mvc/integrate.md` |

**Then, as needed for your task:**
- Tenant setup / application provisioning, secret management, project structure, and advanced framework patterns (logout, Organizations, MCD, custom scopes, filters, claims, error handling) all live in `integrate.md` (Setup and Integration Patterns sections).
- Full API / configuration lookup, testing checklist, security considerations: `Read: references/framework-java-mvc/api-reference.md`
- Any other task (guidance, debugging, Organizations, provider migration): start with `Read: references/framework-java-mvc/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
