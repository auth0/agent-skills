// Migrated: passwordless send via the authClient.passwordless sub-client; verify via AuthClient
import { AuthClient } from '@auth0/auth0-auth-js';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';

// AuthClient owns both the passwordless sub-client (send) and the verify→token methods
const authClient = new AuthClient({ domain, clientId, clientSecret });

// Passwordless email start
export async function startPasswordlessEmail(email: string) {
  // NEW pattern: authClient.passwordless.sendEmail with camelCase params
  await authClient.passwordless.sendEmail({
    email,
    send: 'code'
  });
}

// Passwordless SMS start
export async function startPasswordlessSMS(phoneNumber: string) {
  // NEW pattern: authClient.passwordless.sendSms (lowercase 'ms') with camelCase phoneNumber
  await authClient.passwordless.sendSms({
    phoneNumber
  });
}

// Passwordless email verify
export async function verifyPasswordlessEmail(email: string, code: string) {
  // NEW pattern: AuthClient.getTokenByPasswordlessEmail (verify → token)
  const tokens = await authClient.getTokenByPasswordlessEmail({
    email,
    code,
    audience: 'https://api.example.com',
    scope: 'openid profile email'
  });

  // TokenResponse with camelCase fields
  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken
  };
}

// Passwordless SMS verify
export async function verifyPasswordlessSMS(phoneNumber: string, code: string) {
  // NEW pattern: AuthClient.getTokenByPasswordlessSms with camelCase phoneNumber
  const tokens = await authClient.getTokenByPasswordlessSms({
    phoneNumber,
    code
  });

  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken
  };
}
