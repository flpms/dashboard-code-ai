'use strict';

/**
 * The single source of truth for the environment.
 *
 * Two things read this file and nothing else:
 *   1. `env.config.js`   — builds the typed config object the app injects.
 *   2. `StartupConfig`   — refuses to boot when a required name is missing.
 *
 * The collector runs on a developer's machine, so every name has a fallback
 * that works out of the box; `required` stays available for the day one
 * cannot.
 *
 * This module imports nothing on purpose, so tooling can read it without
 * node_modules present.
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
  PORT: { kind: 'number', fallback: 4317, doc: 'HTTP port the collector listens on' },
  // Loopback by default: the collector receives every tool call an agent makes,
  // arguments included. Exposing it on the network is a decision, not a default.
  HOST: { fallback: '127.0.0.1', doc: 'Interface the collector binds to' },
  LOG_LEVEL: { fallback: 'info', doc: 'winston level: error|warn|info|verbose|debug' },
  LOG_PATH: { doc: 'Directory for log files. Unset = console only.' },

  CORS_ALLOWED_ORIGINS: {
    fallback: 'http://localhost:5173,http://127.0.0.1:5173',
    doc: 'Comma-separated origins allowed to call the API. "*" disables the allow-list.',
  },

  WEB_ROOT: {
    doc: 'Built dashboard (web/build) to serve at "/". Unset = API only.',
  },

  DB_PATH: {
    fallback: 'data/events.db',
    doc: 'SQLite file holding every event. ":memory:" keeps nothing between runs.',
  },

  WATCH_DOCKER: {
    kind: 'boolean',
    fallback: true,
    doc: 'Follow `docker events` and attribute containers to sessions',
  },
  WATCH_SECURITY: {
    kind: 'boolean',
    fallback: true,
    doc: 'Run `npm audit` when a session starts and when its dependencies change',
  },
  WATCH_FILES: {
    kind: 'boolean',
    fallback: true,
    doc: 'Watch each session working directory for changes made outside tool calls',
  },
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
