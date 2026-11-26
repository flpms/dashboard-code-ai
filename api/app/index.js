'use strict';

import { randomUUID } from 'node:crypto';

import * as storage from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import chalk from 'chalk';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';
import winston from 'winston';

import { StartupConfig } from './config/index.js';
import { enums } from './enums/index.js';
import lib from './lib/index.js';
import { Server } from './server.js';

// Fastify listens on localhost by default. Inside a container that is the
// container's own loopback, and the published port would lead nowhere.
const HOST = '0.0.0.0';

const start = async () => {
  const dependencies = await StartupConfig({
    enums,
    getSignedUrl,
    Joi,
    jwt,
    lib,
    MongoClient,
    ObjectId,
    randomUUID,
    storage,
    winston,
  });

  const { env, Logger, dbClient } = dependencies;

  const app = await Server(dependencies);

  // Draining in order — stop accepting and let in-flight requests finish, then
  // close Mongo — is what keeps a rolling deploy from cutting a request in half.
  const shutdown = signal => async () => {
    Logger.info(`${signal} received, shutting down`);
    await app.close();
    await dbClient.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  await app.listen({ port: env.app.port, host: HOST });

  Logger.info(`App running at port ${env.app.port}`);

  return app;
};

start().catch(error => {
  console.error(chalk.red(error.stack || error.message));
  process.exit(1);
});
