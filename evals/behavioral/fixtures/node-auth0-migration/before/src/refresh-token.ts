// Demonstrates: refresh token grant with the expires_in trap
import { AuthenticationClient } from 'auth0';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';

const auth0 = new AuthenticationClient({ domain, clientId, clientSecret });

export async function refreshTokens(refreshToken: string) {
  // OLD pattern: refreshTokenGrant with snake_case refresh_token param
  const resp = await auth0.oauth.refreshTokenGrant({
    refresh_token: refreshToken
  });

  // Trap: Date.now() + expires_in arithmetic (relative -> absolute conversion)
  // This is the MOST DANGEROUS trap - if you rename expires_in to expiresAt
  // but keep the Date.now() +, you get a far-future deadline
  const expiresAtMs = Date.now() + resp.data.expires_in * 1000;

  return {
    accessToken: resp.data.access_token,
    refreshToken: resp.data.refresh_token,
    expiresAtMs
  };
}
