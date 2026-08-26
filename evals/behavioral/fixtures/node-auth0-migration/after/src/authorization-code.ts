// Migrated: authorization code exchange using getTokenByCode with URL + PKCE
import { AuthClient } from '@auth0/auth0-auth-js';
import { Request, Response } from 'express';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';

const authClient = new AuthClient({ domain, clientId, clientSecret });

// Simulated Express callback handler
export async function handleCallback(req: Request, res: Response) {
  // NEW pattern: build a URL object from the incoming request
  // getTokenByCode expects a URL (parses code + state from query)
  const protocol = req.protocol;
  const host = req.get('host') || 'app.example.com';
  const url = new URL(`${protocol}://${host}${req.originalUrl}`);

  // PKCE codeVerifier must have been stored at login (in session or state)
  // Retrieve it from session for the exchange
  const codeVerifier = (req as any).session?.codeVerifier ?? '';

  // NEW pattern: getTokenByCode with URL and codeVerifier
  const tokens = await authClient.getTokenByCode(url, { codeVerifier });

  // CRITICAL: tokens.expiresAt is already absolute Unix SECONDS
  // Multiply by 1000 to convert seconds → milliseconds (NOT Date.now() + ...)
  const sessionTokens = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken,
    expiresAtMs: tokens.expiresAt * 1000
  };

  // Store in session (app manages its own session)
  (req as any).session = { tokens: sessionTokens };

  res.redirect('/');
}
