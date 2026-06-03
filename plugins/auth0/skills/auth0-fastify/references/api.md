# API Reference

## Plugin Options

| Option | Required | Description |
|--------|----------|-------------|
| `domain` | Yes | Auth0 tenant domain |
| `clientId` | Yes | Auth0 application Client ID |
| `clientSecret` | Yes | Auth0 application Client Secret |
| `appBaseUrl` | Conditional | Application URL (e.g. `http://localhost:3000`). Required when `domain` is a string; can be omitted when `domain` is provided as a resolver function |
| `sessionSecret` | Yes | Session encryption secret. The examples generate one with `openssl rand -hex 64` |
| `audience` | No | API audience identifier — required when calling protected APIs |
| `routes` | No | Customize auth route paths. Supported keys: `login`, `callback`, `logout`, `backchannelLogout`, `connect`, `connectCallback`, `unconnect`, `unconnectCallback` (defaults: `/auth/login`, `/auth/logout`, `/auth/callback`) |

## Client Methods

All methods are available on `fastify.auth0Client` after plugin registration.

| Method | Returns | Description |
|--------|---------|-------------|
| `getSession({ request, reply })` | session object, or `null` | Returns the current user session, or `null` if not authenticated |
| `getUser({ request, reply })` | user profile object | Returns the authenticated user's profile (name, email, picture) |
| `getAccessToken({ request, reply })` | `{ accessToken }` | Returns an access token for calling protected APIs — read it from `result.accessToken` |
| `logout(options, { request, reply })` | logout URL | Returns the Auth0 logout URL; redirect the user with `logoutUrl.href` |
