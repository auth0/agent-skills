// Demonstrates: client-credentials grant with .data envelope, snake_case access_token,
// relative expires_in (the expiry trap: Date.now() + expires_in arithmetic)
import { AuthenticationClient } from 'auth0';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';
const audience = process.env.AUTH0_AUDIENCE || 'https://api.example.com';

const auth0 = new AuthenticationClient({ domain, clientId, clientSecret });

export async function getM2MToken() {
  // OLD pattern: clientCredentialsGrant with snake_case params
  const resp = await auth0.oauth.clientCredentialsGrant({
    audience
  });

  // Trap 1: .data envelope
  const token = resp.data.access_token;

  // Trap 2: expires_in is relative seconds, need to compute absolute deadline
  const expiresAtMs = Date.now() + resp.data.expires_in * 1000;

  return { accessToken: token, expiresAtMs };
}
