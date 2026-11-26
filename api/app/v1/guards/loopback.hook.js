'use strict';

/**
 * Refuses any caller that is not this machine.
 *
 * The collector binds to 127.0.0.1 by default, which already keeps the network
 * out. This guard is the second lock for the day someone sets HOST=0.0.0.0 to
 * reach it from a container: hook payloads carry every command and file path
 * an agent touches, and nobody else should be able to read or forge them.
 */

const LOOPBACK = Object.freeze(new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']));

export const RequireLoopback =
  ({ enums: { HTTP_MESSAGES }, Logger }) =>
  async (request, reply) => {
    if (LOOPBACK.has(request.ip)) return;

    Logger.warn(`Loopback::refused ${request.ip} ${request.method} ${request.url}`);
    return reply.code(403).send({ message: HTTP_MESSAGES.FORBIDDEN });
  };
