'use strict';

/**
 * One line per finished request, through the same logger as everything else.
 *
 * Fastify's built-in logger is switched off in `server.js`: two loggers means
 * two formats, two levels to configure and two places to look at 03:00.
 */
export const AccessLog = Logger => async (request, reply) => {
  Logger.info(
    `${request.ip} "${request.method} ${request.url}" ${reply.statusCode} | ${reply.elapsedTime.toFixed(1)} ms`
  );
};
