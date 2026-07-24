# Auth0 PHP Web App — reference hub

Add login, logout, and user profile to a PHP web application using `auth0/auth0-php`.

<!-- Shared prerequisites: prerequisites and when-NOT-to-use notes. Read this
     first (hop 1), then follow the dispatch table below to the one leaf for
     your intent. (Carved from the original framework-php.md.) -->

## Prerequisites

- PHP 8.2+ with extensions: `mbstring`, `openssl`, `json`
- Composer installed
- Auth0 Regular Web Application configured (not an API - must be an Application)
- If Auth0 isn't set up yet, set it up first with the Auth0 CLI (`auth0 login`, then `auth0 apps create`)

## When NOT to Use

- **PHP APIs with JWT Bearer validation** - Use the Auth0 PHP API integration workflow for stateless API token validation
- **Laravel applications** - Use a dedicated Laravel integration with `auth0/laravel-auth0`
- **Symfony applications** - Use a dedicated Symfony integration with `auth0/symfony`
- **Single Page Applications** - Use the Auth0 integration workflow for React, Vue, or Angular for client-side auth
- **Next.js applications** - Use the Auth0 integration workflow for Next.js, which handles both client and server
- **Node.js web apps** - Use the Auth0 integration workflow for Express or Fastify for session-based auth

---

## Choose your task

You arrived here for a specific intent. After reading the shared setup above,
read the leaf for your task:

| Intent | Read |
|---|---|
| integrate | `Read: references/framework-php/integrate.md` |

**Then, as needed for your task:**
- Full API / configuration lookup (SdkConfiguration, Auth0 class methods, credentials, session storage, exceptions): `Read: references/framework-php/api-reference.md`
- Tenant setup, CLI provisioning, manual setup, and advanced framework patterns (protected routes, calling external APIs, session management, organizations, error handling, Slim) all live in `integrate.md` (Setup and Integration Patterns sections).
- Any other task (guidance, debugging, Organizations): start with `Read: references/framework-php/integrate.md`

Read only the leaf (or leaves) your task needs — not all of them.
