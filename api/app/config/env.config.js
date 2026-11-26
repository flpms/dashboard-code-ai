'use strict';

import 'dotenv/config';

import { resolve } from 'node:path';

import packageJson from '../../package.json' with { type: 'json' };
import { ENV_MANIFEST, coerceEnv } from './env.manifest.js';

/**
 * Reads every name the manifest declares and coerces it once. Nothing in the
 * app touches `process.env` after this module — that is what makes the config
 * mockable in tests and auditable in review.
 */
const raw = Object.fromEntries(
  Object.entries(ENV_MANIFEST).map(([name, entry]) => [name, coerceEnv(entry, process.env[name])])
);

export const config = Object.freeze({
  app: {
    name: packageJson.name,
    version: packageJson.version,
    env: raw.NODE_ENV,
    port: raw.PORT,
    host: raw.HOST,
    logLevel: raw.LOG_LEVEL,
    logPath: raw.LOG_PATH,
    corsAllowedOrigins: raw.CORS_ALLOWED_ORIGINS,
    commitSha: process.env.COMMIT_SHA || 'unknown',
    // Resolved once, against the directory the collector was started from.
    webRoot: raw.WEB_ROOT ? resolve(raw.WEB_ROOT) : null,
  },
  db: {
    path: raw.DB_PATH,
  },
  watchers: {
    docker: raw.WATCH_DOCKER,
    files: raw.WATCH_FILES,
    security: raw.WATCH_SECURITY,
  },
});

export default config;
