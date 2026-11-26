'use strict';

import { verifyPassword } from '../../lib/password.js';

/**
 * Sign-in and token verification.
 *
 * Credential handling lives in `lib/password.js` — a deliberate placeholder to
 * be swapped for argon2id before this holds a real account (or dropped entirely
 * if the project authenticates through a passkey/IdP). What must survive any
 * replacement is the constant-time comparison and the single generic failure
 * message.
 */
export const Auth = dependencies => {
  const {
    enums: { HTTP_MESSAGES },
    env,
    jwt,
    Logger,
    repositories: { usersRepository },
  } = dependencies;

  const signIn = async ({ data: { email, password }, onFinish }) => {
    Logger.verbose('Auth::signIn');
    try {
      const user = await usersRepository.findOne({ email, deleted: false });

      // Same answer whether the account is unknown or the password is wrong.
      // Anything else turns this endpoint into a user-enumeration tool.
      if (!user || !verifyPassword(password, user.passwordHash)) {
        Logger.warn(`Auth::signIn - refused for ${email}`);
        return onFinish.UNAUTHORIZED(HTTP_MESSAGES.UNAUTHORIZED);
      }

      const token = jwt.sign(
        { email: user.email, role: user.role, tenantId: String(user.tenantId) },
        env.app.jwtSecret,
        { expiresIn: env.app.jwtExpiresIn }
      );

      return onFinish.OK({
        token,
        user: {
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: String(user.tenantId),
        },
      });
    } catch (error) {
      Logger.error(`Auth::signIn - ${error.message}`);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  const verifyToken = async ({ data: { tokenPayload }, onFinish }) =>
    onFinish.OK({
      email: tokenPayload.email,
      role: tokenPayload.role,
      tenantId: tokenPayload.tenantId,
      expiresAt: new Date(tokenPayload.exp * 1000).toISOString(),
    });

  return { signIn, verifyToken };
};
