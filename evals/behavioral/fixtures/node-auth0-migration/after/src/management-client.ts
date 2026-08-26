// Migrated: AuthenticationClient → AuthClient for auth operations
// ManagementClient UNTOUCHED (out of scope)
import { ManagementClient } from 'auth0';
import { AuthClient } from '@auth0/auth0-auth-js';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';
const audience = process.env.AUTH0_AUDIENCE || 'https://api.example.com';

// MIGRATED: AuthenticationClient → AuthClient from @auth0/auth0-auth-js
const authClient = new AuthClient({ domain, clientId, clientSecret });

// UNTOUCHED: ManagementClient remains from 'auth0' package (out of scope)
const mgmtClient = new ManagementClient({ domain, clientId, clientSecret });

// This function IS migrated (uses AuthClient)
export async function getApiToken() {
  const tokens = await authClient.getTokenByClientCredentials({ audience });
  return tokens.accessToken;
}

// This function MUST NOT be touched (uses ManagementClient, out of scope)
export async function listUsers() {
  const users = await mgmtClient.users.getAll({ per_page: 50 });
  return users.data;
}

// Another ManagementClient function - also out of scope
export async function getUser(userId: string) {
  const user = await mgmtClient.users.get({ id: userId });
  return user.data;
}
