'use strict';

/**
 * Options for `@fastify/cors`, built once at boot from CORS_ALLOWED_ORIGINS.
 *
 * An empty list is a refusal, not a wildcard: a deploy that forgot the variable
 * should break in the browser console during smoke-testing, not quietly serve
 * `Access-Control-Allow-Origin: *` to the whole internet. An empty array
 * matches no origin, so the header is simply never sent.
 */

const parseOrigins = raw =>
  String(raw || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

export const CorsOptions = ({ env, Logger }) => {
  const allowed = parseOrigins(env.app.corsAllowedOrigins);
  const allowAny = allowed.includes('*');

  if (allowAny && env.app.env === 'production') {
    Logger.warn('CORS_ALLOWED_ORIGINS is "*" in production — every site can call this API.');
  }

  return {
    origin: allowAny ? '*' : allowed,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    maxAge: 600,
  };
};
