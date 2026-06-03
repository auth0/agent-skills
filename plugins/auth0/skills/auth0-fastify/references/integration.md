# Integration Guide

## Protected Routes

Use a `preHandler` hook to require authentication on any route:

```javascript
fastify.get('/dashboard', {
  preHandler: async (request, reply) => {
    const session = await fastify.auth0Client.getSession({ request, reply });
    if (!session) {
      return reply.redirect('/auth/login');
    }
  }
}, async (request, reply) => {
  const user = await fastify.auth0Client.getUser({ request, reply });
  return reply.view('dashboard.ejs', { user });
});
```

## Calling a Protected API

To call an external API protected by Auth0, configure an `audience` and retrieve the access token:

```javascript
// In plugin registration, add audience:
await fastify.register(fastifyAuth0, {
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl: process.env.APP_BASE_URL,
  sessionSecret: process.env.SESSION_SECRET,
  audience: process.env.AUTH0_AUDIENCE,
});

// In a route handler:
fastify.get('/api-data', {
  preHandler: async (request, reply) => {
    const session = await fastify.auth0Client.getSession({ request, reply });
    if (!session) return reply.redirect('/auth/login');
  }
}, async (request, reply) => {
  const { accessToken } = await fastify.auth0Client.getAccessToken({ request, reply });
  const response = await fetch('https://api.example.com/data', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  return reply.view('data.ejs', { data });
});
```

## Error Handling

Handle authentication errors by checking the session state and server logs:

```javascript
fastify.setErrorHandler(async (error, request, reply) => {
  if (error.statusCode === 401) {
    return reply.redirect('/auth/login');
  }
  fastify.log.error(error);
  return reply.status(500).send({ error: 'Internal Server Error' });
});
```
