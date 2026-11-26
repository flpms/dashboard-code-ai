'use strict';

/**
 * The single source of truth for the environment.
 *
 * Three things read this file and nothing else:
 *   1. `env.config.js`   — builds the typed config object the app injects.
 *   2. `StartupConfig`   — refuses to boot when a required name is missing.
 *   3. `scripts/render-env.js` — writes the `.env` the release ships, from the
 *      CI environment, so a deploy cannot forget a line the code needs.
 *
 * That last point is the reason the manifest exists. Hand-written deploy steps
 * that `echo NAME=$NAME >> .env` one line at a time drift: someone adds a
 * variable to the code, forgets the echo, and the service boots with
 * `undefined` — failing later, inside a use case, far from the cause.
 *
 * This module imports nothing on purpose: the release script runs it before
 * `npm ci`, without node_modules present.
 */

/** @typedef {'string'|'number'|'boolean'} EnvKind */

/**
 * @typedef {Object} EnvEntry
 * @property {EnvKind}  [kind]     How the raw string is coerced. Default 'string'.
 * @property {boolean}  [required] Boot fails without it. Default false.
 * @property {*}        [fallback] Used when the variable is absent.
 * @property {boolean}  [secret]   Never printed by tooling.
 * @property {string}   doc        Why this variable exists.
 */

/** @type {Record<string, EnvEntry>} */
export const ENV_MANIFEST = Object.freeze({
  NODE_ENV: { fallback: 'development', doc: 'development | test | production' },
  PORT: { kind: 'number', required: true, doc: 'HTTP port the API listens on' },
  LOG_LEVEL: { fallback: 'info', doc: 'winston level: error|warn|info|verbose|debug' },
  LOG_PATH: { doc: 'Directory for log files. Unset = console only.' },

  APP_URL: { required: true, doc: 'Public URL of the web app, used to build links' },
  CORS_ALLOWED_ORIGINS: {
    required: true,
    doc: 'Comma-separated origins allowed to call the API. "*" disables the allow-list.',
  },

  JWT_SECRET: { required: true, secret: true, doc: 'HMAC key used to sign access tokens' },
  JWT_EXPIRES_IN: { fallback: '2h', doc: 'Access token lifetime, e.g. 15m, 2h, 7d' },

  MONGO_CONNECTION: { required: true, secret: true, doc: 'Full mongodb:// connection string' },

  // Consumed by docker-compose.yml, not by the application. They belong here
  // anyway: render-env.js only writes names the manifest declares, so leaving
  // them out would ship a .env whose compose file silently falls back to its
  // defaults — a production database with the placeholder password.
  MONGO_INITDB_ROOT_USERNAME: { doc: 'Mongo container bootstrap user (compose only)' },
  MONGO_INITDB_ROOT_PASSWORD: {
    secret: true,
    doc: 'Mongo container bootstrap password (compose only)',
  },
  MONGO_INITDB_DATABASE: { doc: 'Database created on first container start (compose only)' },
  API_IMAGE: { doc: 'Image tag compose runs. Set by the deploy; local builds omit it.' },

  // One name per collection. A repository opens its collection by this value;
  // an empty name silently queries the wrong place, so each is required.
  USERS_COLLECTION: { required: true, doc: 'Collection holding users' },
  ITEMS_COLLECTION: { required: true, doc: 'Collection holding the example resource' },
  HISTORY_COLLECTION: { required: true, doc: 'Append-only audit trail of changes' },

  STORAGE_ENDPOINT: { doc: 'S3-compatible endpoint. Unset = AWS default.' },
  STORAGE_REGION: { fallback: 'auto', doc: 'S3 region ("auto" for Cloudflare R2)' },
  STORAGE_ACCESS_KEY_ID: { secret: true, doc: 'S3 access key' },
  STORAGE_SECRET_ACCESS_KEY: { secret: true, doc: 'S3 secret key' },
  STORAGE_FILES_BUCKET: { doc: 'Bucket for uploaded files' },
  STORAGE_SIGNED_URL_TTL: { kind: 'number', fallback: 900, doc: 'Signed URL lifetime in seconds' },
});

export const REQUIRED_ENV_VARIABLES = Object.freeze(
  Object.entries(ENV_MANIFEST)
    .filter(([, entry]) => entry.required)
    .map(([name]) => name)
);

/** Names the manifest knows about, in declaration order. */
export const ENV_VARIABLE_NAMES = Object.freeze(Object.keys(ENV_MANIFEST));

/**
 * Required names that `source` does not provide. Works on `process.env` and on
 * a parsed `.env` file alike.
 *
 * @param {Record<string, string|undefined>} source
 * @returns {string[]} missing names, in manifest order
 */
export const missingEnvVariables = (source = {}) =>
  REQUIRED_ENV_VARIABLES.filter(name => {
    const value = source[name];
    return value === undefined || String(value).trim() === '';
  });

// Coercion is a lookup, not a switch: a new kind is a new key.
const COERCERS = Object.freeze({
  string: value => value,
  number: value => Number(value),
  boolean: value => value === 'true' || value === true,
});

/**
 * Applies kind + fallback to one raw value.
 *
 * @param {EnvEntry} entry
 * @param {string|undefined} raw
 */
export const coerceEnv = (entry, raw) => {
  const absent = raw === undefined || raw === '';
  if (absent) return entry.fallback;
  return (COERCERS[entry.kind] || COERCERS.string)(raw);
};
