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
 * variable is reported by name before anything opens a socket.
 */
export const StartupConfig = async ({
  Joi,
  jwt,
  lib,
  MongoClient,
  ObjectId,
  randomUUID,
  storage,
  getSignedUrl,
  winston,
  enums,
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

  const { db, dbClient } = await DBStartup({ env, logger: Logger, MongoClient });

  const services = Services({ env, Logger, storage, getSignedUrl });

  return {
    db,
    dbClient,
    enums,
    env,
    generateSchemaObject: lib.GenerateSchemaObject,
    Joi,
    jwt,
    Logger,
    ObjectId,
    randomUUID,
    responseHandler: lib.ResponseHandler(Logger),
    routeProcessor: lib.RouteProcessor,
    services,
  };
};
