#!/usr/bin/env node
'use strict';

/**
 * Verifies a rendered `.env` before the deploy touches the server.
 *
 * Runs without node_modules — it parses the file itself and the manifest
 * imports nothing. A missing name fails the release *by name*, instead of
 * booting an API that only discovers the gap on the first request that needs it.
 *
 * Usage: node scripts/check-env.js [envPath]         (default: ./.env)
 */

import { readFileSync } from 'node:fs';

import {
  ENV_MANIFEST,
  ENV_VARIABLE_NAMES,
  missingEnvVariables,
} from '../app/config/env.manifest.js';

const path = process.argv[2] || '.env';

const unquote = value => value.replace(/^'(.*)'$/s, '$1').replace(/^"(.*)"$/s, '$1');

const parse = contents =>
  Object.fromEntries(
    contents
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), unquote(line.slice(index + 1).trim())];
      })
      .filter(([name]) => name)
  );

const parsed = parse(readFileSync(path, 'utf8'));

const missing = missingEnvVariables(parsed);

const unknown = Object.keys(parsed).filter(
  name => !ENV_VARIABLE_NAMES.includes(name) && name !== 'COMMIT_SHA'
);

unknown.forEach(name =>
  console.warn(`warning: ${name} is not in the manifest — is it still used?`)
);

if (missing.length) {
  console.error(`${path} is missing required variables:`);
  missing.forEach(name => console.error(`  - ${name}: ${ENV_MANIFEST[name].doc}`));
  process.exit(1);
}

console.log(`${path}: all ${missingEnvVariables({}).length} required variables present.`);
