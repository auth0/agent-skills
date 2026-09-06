// Migrated: client-credentials grant using getTokenByClientCredentials with fullResponse
import { AuthClient } from '@auth0/auth0-auth-js';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';
const audience = process.env.AUTH0_AUDIENCE || 'https://api.example.com';

const authClient = new AuthClient({ domain, clientId, clientSecret });

export async function getM2MToken() {
  // NEW pattern: getTokenByClientCredentials with fullResponse to access raw response
  const { data, response } = await authClient.getTokenByClientCredentials(
    { audience, fullResponse: true }
  );

  // Read rate-limit header from raw response
  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');

  // CRITICAL: data.expiresAt is already absolute Unix SECONDS
  // Multiply by 1000 to convert seconds → milliseconds (NOT Date.now() + ...)
  const expiresAtMs = data.expiresAt * 1000;

  return {
    accessToken: data.accessToken,
    expiresAtMs,
    rateLimitRemaining
  };
}
