'use strict';

/**
 * The endpoint the dashboard and the hook installer poll to see whether the
 * collector is up. It answers from memory only — a health check that queries the database turns a
 * slow query into a restart loop.
 */
export const HealthController = ({ env, responseHandler }) => ({
  healthCheck: (request, reply) =>
    responseHandler(request, reply).OK({
      name: env.app.name,
      version: env.app.version,
      commit: env.app.commitSha,
      status: 'ok',
      uptime: Math.round(process.uptime()),
    }),
});
