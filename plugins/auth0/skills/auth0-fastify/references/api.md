# API Reference

## Plugin Options

| Option | Required | Description |
|--------|----------|-------------|
| `domain` | Yes | Auth0 tenant domain |
| `clientId` | Yes | Auth0 application Client ID |
| `clientSecret` | Yes | Auth0 application Client Secret |
| `appBaseUrl` | Yes | Application URL (e.g. `http://localhost:3000`) |
| `sessionSecret` | Yes | Session encryption secret (min 64 chars) |
| `audience` | No | API audience identifier — required when calling protected APIs |
| `routes` | No | Customize auth route paths (default: `/auth/login`, `/auth/logout`, `/auth/callback`) |

## Client Methods

All methods are available on `fastify.auth0Client` after plugin registration.

| Method | Returns | Description |
|--------|---------|-------------|
| `getSession({ request, reply })` | `Session \| null` | Returns the current user session, or `null` if not authenticated |
| `getUser({ request, reply })` | `UserProfile` | Returns the authenticated user's profile (name, email, picture) |
| `getAccessToken({ request, reply })` | `{ token }` | Returns an access token for calling protected APIs |
| `logout(options, { request, reply })` | `void` | Clears the session and redirects to Auth0 logout |
