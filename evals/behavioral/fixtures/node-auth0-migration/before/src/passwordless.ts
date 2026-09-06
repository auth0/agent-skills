// Demonstrates: passwordless start (sendEmail, sendSMS with snake_case phone_number)
// and verify (loginWithEmail, loginWithSMS)
import { AuthenticationClient } from 'auth0';

const domain = process.env.AUTH0_DOMAIN || 'example.auth0.com';
const clientId = process.env.AUTH0_CLIENT_ID || 'client-id';
const clientSecret = process.env.AUTH0_CLIENT_SECRET || 'client-secret';

const auth0 = new AuthenticationClient({ domain, clientId, clientSecret });

// Passwordless email start
export async function startPasswordlessEmail(email: string) {
  // OLD pattern: sendEmail with 'code' send type
  await auth0.passwordless.sendEmail({
    email,
    send: 'code'
  });
}

// Passwordless SMS start
export async function startPasswordlessSMS(phoneNumber: string) {
  // OLD pattern: sendSMS with snake_case phone_number
  await auth0.passwordless.sendSMS({
    phone_number: phoneNumber
  });
}

// Passwordless email verify
export async function verifyPasswordlessEmail(email: string, code: string) {
  // OLD pattern: loginWithEmail returns JSONApiResponse with .data envelope
  const resp = await auth0.passwordless.loginWithEmail({
    email,
    code,
    audience: 'https://api.example.com',
    scope: 'openid profile email'
  });

  // Trap: .data envelope + snake_case access_token
  return {
    accessToken: resp.data.access_token,
    idToken: resp.data.id_token
  };
}

// Passwordless SMS verify
export async function verifyPasswordlessSMS(phoneNumber: string, code: string) {
  // OLD pattern: loginWithSMS with snake_case phone_number
  const resp = await auth0.passwordless.loginWithSMS({
    phone_number: phoneNumber,
    code
  });

  return {
    accessToken: resp.data.access_token,
    idToken: resp.data.id_token
  };
}
