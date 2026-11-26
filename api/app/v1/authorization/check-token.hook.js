'use strict';

/**
 * Authentication: proves *who* is calling. Nothing about permissions here.
 *
 * Every refusal returns the same body and the same status. Telling a caller
 * apart — "no header" vs "expired" vs "bad signature" — hands an attacker a
 * free oracle.
 *
 * Runs as an `onRequest` hook. A refusal returns the `reply`, which is what
 * stops Fastify from running the next hook; letting the request through
 * returns nothing.
 */
export default ({ Logger, env, enums: { HTTP_MESSAGES }, jwt }) => {
  const { jwtSecret } = env.app;

  const refuse = (request, reply, reason) => {
    Logger.warn(`NOT AUTHORIZED::${reason}: ${request.ip} "${request.method} ${request.url}"`);
    return reply.code(401).send({ message: HTTP_MESSAGES.UNAUTHORIZED });
  };

  return async (request, reply) => {
    const header = request.headers.authorization;

    if (!header) return refuse(request, reply, 'MISSING HEADER');

    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) return refuse(request, reply, 'BAD SCHEME');

    try {
      request.tokenPayload = jwt.verify(token, jwtSecret);
    } catch (error) {
      return refuse(request, reply, `INVALID TOKEN (${error.name})`);
    }
  };
};
