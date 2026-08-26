// Migrated: password grant with MFA detection using isMfaRequiredError guard
import { AuthClient, isMfaRequiredError, MfaRequiredError } from '@auth0/auth0-auth-js';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';

const authClient = new AuthClient({ domain, clientId, clientSecret });

export async function loginWithPassword(username: string, password: string) {
  try {
    // NEW pattern: getTokenByPassword with camelCase params
    const tokens = await authClient.getTokenByPassword({
      username,
      password,
      realm: 'Username-Password-Authentication',
      audience: 'https://api.example.com',
      scope: 'openid profile email'
    });

    // Success path: TokenResponse with camelCase fields
    return {
      accessToken: tokens.accessToken,
      idToken: tokens.idToken,
      refreshToken: tokens.refreshToken
    };
  } catch (e) {
    // NEW pattern: isMfaRequiredError type guard (replaces the old error-type + string check)
    if (isMfaRequiredError(e)) {
      // MFA required - in real app would start MFA flow
      return {
        mfaRequired: true,
        error: e
      };
    }
    throw e;
  }
}

// Stub function updated to accept MfaRequiredError type
export function startMfaFlow(error: MfaRequiredError) {
  // In real code: extract mfaToken from error, call MFA challenge APIs
  console.log('MFA required:', error.message);
}
