'use strict';

import { Services } from '../services/index.js';
import { DBStartup } from './db.config.js';
import config from './env.config.js';
import { missingEnvVariables } from './env.manifest.js';

export const EnvConfig = config;

/**
 * Composition root. Everything the app needs is built here, once, and passed
 * down as a plain object — no module-level singletons, no service locator, no
 * `import` of a live connection from a random file.
 *
 * The order matters: environment first, logger second, database last. A missing
 * variable is reported by name before anything opens a file.
 */
export const StartupConfig = ({
  DatabaseSync,
  dirname,
  enums,
  Joi,
  lib,
  mkdirSync,
  randomUUID,
  spawn,
  watch,
  winston,
}) => {
  const env = config;

  const Logger = lib.Logger({ winston, env });

  Logger.info(`Starting ${env.app.name}@${env.app.version} (${env.app.commitSha})`);

  const missing = missingEnvVariables(process.env);

  if (missing.length) {
    const message = `STARTUP ERROR: missing environment variables - ${missing.join(', ')}`;
    Logger.error(message);
    throw new ReferenceError(message);
  }

  const { db } = DBStartup({ env, logger: Logger, DatabaseSync, mkdirSync, dirname });

  const services = Services({ env, Logger, spawn, watch });

  return {
    // Injected so a test can pin time; every event timestamp comes from here.
    clock: () => new Date().toISOString(),
    db,
    enums,
    env,
    eventBus: lib.EventBus(),
    generateSchemaObject: lib.GenerateSchemaObject,
    Joi,
    Logger,
    randomUUID,
    responseHandler: lib.ResponseHandler(Logger),
    routeProcessor: lib.RouteProcessor,
    services,
  };
};
