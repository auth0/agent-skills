# Auth0 ASP.NET Core Web App — reference hub

Add login, logout, and user profile to an ASP.NET Core MVC, Razor Pages, or Blazor Server application using `Auth0.AspNetCore.Authentication`.

<!-- Shared prerequisites: prerequisites and when-NOT-to-use notes. Read this
     first (hop 1), then follow the dispatch table below to the one leaf for
     your intent. (Carved from the original framework-aspnetcore-auth.md.) -->

## Prerequisites

- ASP.NET Core application (.NET 8 or higher)
- Auth0 Regular Web Application configured (not an API - must be an Application)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **ASP.NET Core Web APIs with JWT Bearer validation** - Use the ASP.NET Core Web API integration workflow for JWT-protected REST APIs
- **Blazor WebAssembly** - Requires OIDC client-side auth; see the Auth0 Blazor WebAssembly quickstart
- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Next.js applications** - Use the Auth0 integration workflow for Next.js, which handles both client and server
- **Python web apps** - Use the Auth0 integration workflow for Flask or see the Django quickstart

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-aspnetcore-auth/integrate.md` |

**Then, as needed for your task:**
- Full API / configuration lookup (options, builders, claims, cookies, testing): `Read: references/framework-aspnetcore-auth/api-reference.md`
- Tenant setup / app provisioning (CLI + manual, dashboard config): `Read: references/framework-aspnetcore-auth/setup.md`
- Advanced framework patterns (protected routes, calling APIs, custom login, Blazor auth, error handling): `Read: references/framework-aspnetcore-auth/patterns.md`
- Any other task (guidance, debugging, Organizations): start with `Read: references/framework-aspnetcore-auth/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
