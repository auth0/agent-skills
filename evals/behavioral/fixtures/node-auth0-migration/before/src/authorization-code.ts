// Demonstrates: authorization code exchange parsing req.query.code manually
import { AuthenticationClient } from 'auth0';
import { Request, Response } from 'express';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';
const redirectUri = process.env.REDIRECT_URI || 'https://app.example.com/callback';

const auth0 = new AuthenticationClient({ domain, clientId, clientSecret });

// Simulated Express callback handler
export async function handleCallback(req: Request, res: Response) {
  // OLD pattern: manually parse req.query.code
  const code = req.query.code as string;

  if (!code) {
    throw new Error('No authorization code in callback');
  }

  // OLD pattern: authorizationCodeGrant with code and redirect_uri
  const resp = await auth0.oauth.authorizationCodeGrant({
    code,
    redirect_uri: redirectUri
  });

  // Trap: .data envelope, snake_case fields
  const tokens = {
    accessToken: resp.data.access_token,
    refreshToken: resp.data.refresh_token,
    idToken: resp.data.id_token,
    // Trap: expires_in relative seconds
    expiresAtMs: Date.now() + resp.data.expires_in * 1000
  };

  // Store in session (app manages its own session)
  (req as any).session = { tokens };

  res.redirect('/');
}
