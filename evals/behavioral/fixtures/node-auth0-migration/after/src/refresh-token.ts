// Migrated: refresh token grant using getTokenByRefreshToken
import { AuthClient } from '@auth0/auth0-auth-js';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';

const authClient = new AuthClient({ domain, clientId, clientSecret });

export async function refreshTokens(refreshToken: string) {
  // NEW pattern: getTokenByRefreshToken with camelCase params
  const tokens = await authClient.getTokenByRefreshToken({ refreshToken });

  // CRITICAL: tokens.expiresAt is already absolute Unix SECONDS
  // Multiply by 1000 to convert seconds → milliseconds (NOT Date.now() + ...)
  const expiresAtMs = tokens.expiresAt * 1000;

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAtMs
  };
}
