/**
 * Sign-in against the API. Returns the token and profile; storing them is the
 * caller's job — a service that writes to a store cannot be tested without one.
 *
 * @import { HttpClient, SessionUser } from '$lib/types.js'
 */

/**
 * @param {HttpClient} client
 */
export const AuthService = client => {
  /**
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ token: string, user: SessionUser }>}
   */
  const signIn = credentials => client.post('/v1/auth/token', credentials);

  /**
   * @returns {Promise<{ email: string, role: string, tenantId: string, expiresAt: string }>}
   */
  const verify = () => client.get('/v1/auth/verify');

  return { signIn, verify };
};
