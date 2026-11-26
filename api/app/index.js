'use strict';

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import chalk from 'chalk';
import { watch } from 'chokidar';
import Joi from 'joi';
import winston from 'winston';

import { StartupConfig } from './config/index.js';
import { enums } from './enums/index.js';
import lib from './lib/index.js';
import { Server } from './server.js';

const start = async () => {
  const dependencies = StartupConfig({
    DatabaseSync,
    dirname,
    enums,
    existsSync,
    join,
    Joi,
    lib,
    mkdirSync,
    randomUUID,
    spawn,
    watch,
    winston,
  });

  const { db, env, Logger } = dependencies;

  const app = await Server(dependencies);

  // Stop accepting, let in-flight hooks finish, stop the watchers (onClose),
  // then close the database file.
  const shutdown = signal => async () => {
    Logger.info(`${signal} received, shutting down`);
    await app.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));

  await app.listen({ port: env.app.port, host: env.app.host });

  Logger.info(`Collector listening on http://${env.app.host}:${env.app.port}/v1`);

  return app;
};

start().catch(error => {
  console.error(chalk.red(error.stack || error.message));
  process.exit(1);
});
