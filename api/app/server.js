'use strict';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify from 'fastify';

import { ErrorHandler } from './error-handler.js';
import lib from './lib/index.js';
import { RoutesV1 } from './v1/index.js';

// Fastify takes the limit in bytes.
const BODY_LIMIT = 5 * 1024 * 1024;

/**
 * The HTTP server, fully configured and not yet listening.
 *
 * Kept apart from `index.js` so the integration test boots exactly this —
 * security headers, CORS, validation, error handling and every route — over a
 * fake database, through `app.inject()`, with no port opened.
 *
 * Order matters: the validator compiler and the error handler are inherited
 * by the plugins registered after them, so both come before the routes.
 */
export const Server = async dependencies => {
  const { enums, env, Logger } = dependencies;

  // Fastify's own logger stays off. Winston is the one logger; see
  // lib/access-log.js for the per-request line.
  const app = Fastify({ logger: false, bodyLimit: BODY_LIMIT });

  await app.register(helmet);
  await app.register(cors, lib.CorsOptions({ env, Logger }));

  app.setValidatorCompiler(lib.JoiValidatorCompiler);
  app.addHook('onResponse', lib.AccessLog(Logger));

  ErrorHandler({ app, enums, env, Logger, validationDetails: lib.validationDetails });

  await app.register(RoutesV1(dependencies), { prefix: '/v1' });

  return app;
};
