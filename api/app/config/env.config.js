'use strict';

import 'dotenv/config';

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
    url: raw.APP_URL,
    logLevel: raw.LOG_LEVEL,
    logPath: raw.LOG_PATH,
    corsAllowedOrigins: raw.CORS_ALLOWED_ORIGINS,
    jwtSecret: raw.JWT_SECRET,
    jwtExpiresIn: raw.JWT_EXPIRES_IN,
    commitSha: process.env.COMMIT_SHA || 'unknown',
  },
  db: {
    databaseURL: raw.MONGO_CONNECTION,
    collections: {
      users: raw.USERS_COLLECTION,
      items: raw.ITEMS_COLLECTION,
      history: raw.HISTORY_COLLECTION,
    },
  },
  storage: {
    endpoint: raw.STORAGE_ENDPOINT,
    region: raw.STORAGE_REGION,
    accessKeyId: raw.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: raw.STORAGE_SECRET_ACCESS_KEY,
    signedUrlTtl: raw.STORAGE_SIGNED_URL_TTL,
    buckets: {
      files: raw.STORAGE_FILES_BUCKET,
    },
  },
});

export default config;
