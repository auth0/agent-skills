# Auth0 Cap'n Web API Reference

API reference for Cap'n Web RPC authentication.

---

## Client Configuration

```javascript
import { Auth0Client } from '@auth0/auth0-spa-js';

const auth0 = new Auth0Client({
  domain: 'your-tenant.auth0.com',
  clientId: 'your-client-id',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: 'https://your-api-identifier'
  }
});
```

---

## Server JWT Validation

```javascript
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://your-tenant.auth0.com/.well-known/jwks.json'
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    callback(null, key.publicKey || key.rsaPublicKey);
  });
}

jwt.verify(token, getKey, {
  audience: 'your-audience',
  issuer: 'https://your-tenant.auth0.com/',
  algorithms: ['RS256']
}, (err, decoded) => {
  // Handle result
});
```

---

## RPC Method Definition

```javascript
server.methods({
  async methodName(connection, ...args) {
    // connection.user contains decoded JWT
    return { result: 'data' };
  }
});
```

---

## References

- [jsonwebtoken Documentation](https://github.com/auth0/node-jsonwebtoken)
- Return to [main skill guide](../SKILL.md)
