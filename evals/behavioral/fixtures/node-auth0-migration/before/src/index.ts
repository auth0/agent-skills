// Main entry point demonstrating all patterns
import express from 'express';
import { getM2MToken } from './client-credentials';
import { refreshTokens } from './refresh-token';
import { startPasswordlessEmail, verifyPasswordlessEmail } from './passwordless';
import { handleCallback } from './authorization-code';
import { loginWithPassword } from './password-grant-mfa';
import { getApiToken, listUsers } from './management-client';

const app = express();
app.use(express.json());

// Client credentials endpoint
app.get('/api/m2m-token', async (req, res) => {
  try {
    const result = await getM2MToken();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Refresh token endpoint
app.post('/api/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const result = await refreshTokens(refreshToken);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Passwordless start endpoint
app.post('/api/passwordless/start', async (req, res) => {
  try {
    const { email } = req.body;
    await startPasswordlessEmail(email);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Passwordless verify endpoint
app.post('/api/passwordless/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    const result = await verifyPasswordlessEmail(email, code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// OAuth callback
app.get('/callback', handleCallback);

// Password grant with MFA
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await loginWithPassword(username, password);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Management API (out of scope, should not be migrated)
app.get('/api/users', async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
