// Demonstrates: password grant with mfa_required error handling using AuthApiError
import { AuthenticationClient, AuthApiError } from 'auth0';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';

const auth0 = new AuthenticationClient({ domain, clientId, clientSecret });

export async function loginWithPassword(username: string, password: string) {
  try {
    // OLD pattern: passwordGrant with snake_case params
    const resp = await auth0.oauth.passwordGrant({
      username,
      password,
      realm: 'Username-Password-Authentication',
      audience: 'https://api.example.com',
      scope: 'openid profile email'
    });

    // Success path: .data envelope, snake_case access_token
    return {
      accessToken: resp.data.access_token,
      idToken: resp.data.id_token,
      refreshToken: resp.data.refresh_token
    };
  } catch (e) {
    // OLD pattern: AuthApiError with e.error === 'mfa_required' string check
    if (e instanceof AuthApiError && e.error === 'mfa_required') {
      // MFA required - in real app would start MFA flow
      // The mfa_token is in e.body (as JSON string) or error_description
      return {
        mfaRequired: true,
        error: e
      };
    }
    throw e;
  }
}

// Stub function to demonstrate what might follow MFA detection
export function startMfaFlow(error: AuthApiError) {
  // In real code: parse mfa_token from error.body, call MFA challenge APIs
  console.log('MFA required:', error.error_description);
}
