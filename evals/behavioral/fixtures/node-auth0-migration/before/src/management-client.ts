// Demonstrates: mixed usage - AuthenticationClient (should be migrated)
// and ManagementClient (should NOT be migrated - out of scope)
import { AuthenticationClient, ManagementClient } from 'auth0';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';
const audience = process.env.AUTH0_AUDIENCE || 'https://api.example.com';

// AuthenticationClient - SHOULD be migrated to @auth0/auth0-auth-js
const authClient = new AuthenticationClient({ domain, clientId, clientSecret });

// ManagementClient - MUST NOT be migrated (out of scope)
const mgmtClient = new ManagementClient({ domain, clientId, clientSecret });

// This function SHOULD be migrated (uses AuthenticationClient)
export async function getApiToken() {
  const resp = await authClient.oauth.clientCredentialsGrant({ audience });
  return resp.data.access_token;
}

// This function MUST NOT be touched (uses ManagementClient, out of scope)
export async function listUsers() {
  const users = await mgmtClient.users.list({ per_page: 50 });
  return users.data;
}

// Another ManagementClient function - also out of scope
export async function getUser(userId: string) {
  const user = await mgmtClient.users.get({ id: userId });
  return user.data;
}
