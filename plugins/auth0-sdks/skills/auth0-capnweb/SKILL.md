---
name: auth0-capnweb
description: Use when adding authentication to Cap'n Web RPC applications (login, logout, secure WebSocket RPC calls) - integrates @auth0/auth0-spa-js client-side with JWT validation for WebSocket connections
---

# Auth0 Cap'n Web RPC Integration

Add authentication to Cap'n Web RPC applications using @auth0/auth0-spa-js with secure WebSocket RPC.

---

## Prerequisites

- Node.js 18+ installed
- Cap'n Web RPC knowledge
- Auth0 account configured with both Application and API
- If you don't have Auth0 set up yet, use the `auth0-quickstart` skill first

## When NOT to Use

- **REST APIs** - Use standard HTTP authentication
- **Traditional SPAs without RPC** - Use `auth0-vanilla-js` or framework-specific skills
- **Server-side rendered apps** - Use server-side authentication

---

## Quick Start Workflow

### 1. Install Dependencies

```bash
npm install capnweb ws @auth0/auth0-spa-js jsonwebtoken jwks-rsa dotenv
```

### 2. Configure Environment

Create `.env` file:

```bash
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=your-api-identifier
```

### 3. Create Client Authentication

Create `client/auth.js`:

```javascript
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0Client = new Auth0Client({
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE
  }
});

export async function login() {
  await auth0Client.loginWithRedirect();
}

export async function logout() {
  await auth0Client.logout({
    logoutParams: {
      returnTo: window.location.origin
    }
  });
}

export async function getAccessToken() {
  return await auth0Client.getTokenSilently();
}

export async function isAuthenticated() {
  return await auth0Client.isAuthenticated();
}
```

### 4. Create Secure RPC Client

Create `client/rpc.js`:

```javascript
import { createClient } from 'capnweb';
import { getAccessToken } from './auth.js';

export async function createSecureRPCClient() {
  const token = await getAccessToken();

  const client = createClient({
    url: 'ws://localhost:3000',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return client;
}
```

### 5. Create Secure RPC Server

Create `server/auth.js`:

```javascript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

export function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: `https://${process.env.AUTH0_DOMAIN}/`,
        algorithms: ['RS256']
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      }
    );
  });
}
```

Create `server/index.js`:

```javascript
import { createServer } from 'capnweb';
import { verifyToken } from './auth.js';

const server = createServer({
  port: 3000,

  // Middleware to verify JWT on connection
  onConnect: async (connection, request) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const decoded = await verifyToken(token);
      connection.user = decoded; // Attach user to connection
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
});

// Define RPC methods
server.methods({
  async getPrivateData(connection) {
    return {
      message: 'Private data',
      userId: connection.user.sub
    };
  }
});

server.start();
console.log('Secure RPC server running on ws://localhost:3000');
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing Audience | Set audience in both client and server configuration |
| No JWT validation on server | Always verify tokens on WebSocket connection |
| Hardcoded credentials | Use environment variables for all Auth0 config |
| Missing Authorization header | Send token in WebSocket connection headers |
| Not handling token expiry | Implement token refresh on client side |

---

## Related Skills

- `auth0-quickstart` - Basic Auth0 setup
- `auth0-vanilla-js` - For standard SPA authentication
- `auth0-mfa` - Add Multi-Factor Authentication

---

## Quick Reference

**Client Functions:**
- `login()` - Initiate login
- `logout()` - Log out user
- `getAccessToken()` - Get JWT for RPC calls
- `isAuthenticated()` - Check auth status

**Server Functions:**
- `verifyToken()` - Validate JWT
- `onConnect()` - Middleware for WebSocket auth
- `connection.user` - Access authenticated user data

**Common Use Cases:**
- Secure RPC methods → See Step 5 above
- Client authentication → See Step 3 above
- Token refresh → [Integration Guide](references/integration.md#token-refresh)
- Permission checks → [Integration Guide](references/integration.md#permissions)

---

## References

- [@auth0/auth0-spa-js Documentation](https://auth0.com/docs/libraries/auth0-spa-js)
- [Cap'n Web Documentation](https://capnweb.dev/)
- [WebSocket Security Best Practices](https://auth0.com/blog/real-time-apps-websockets-authentication/)
