# Auth0 Cap'n Web Integration Guide

Advanced patterns for Cap'n Web RPC authentication.

---

## Token Refresh

```javascript
// Client-side
let rpcClient;

async function ensureValidToken() {
  try {
    const token = await getAccessToken();

    if (!rpcClient || tokenExpired(token)) {
      rpcClient = await createSecureRPCClient();
    }

    return rpcClient;
  } catch (error) {
    // Token refresh failed, redirect to login
    await login();
  }
}

// Use before RPC calls
const client = await ensureValidToken();
await client.call('getPrivateData');
```

---

## Permission-Based RPC Methods

```javascript
// Server-side
server.methods({
  async adminMethod(connection) {
    const permissions = connection.user.permissions || [];

    if (!permissions.includes('read:admin')) {
      throw new Error('Insufficient permissions');
    }

    return { data: 'admin data' };
  }
});
```

---

## Connection State Management

```javascript
// Server-side
const activeConnections = new Map();

server.onConnect = async (connection, request) => {
  // Verify token
  const token = extractToken(request);
  const user = await verifyToken(token);

  connection.user = user;
  activeConnections.set(user.sub, connection);
};

server.onDisconnect = (connection) => {
  if (connection.user) {
    activeConnections.delete(connection.user.sub);
  }
};
```

---

## References

- Return to [main skill guide](../SKILL.md)
