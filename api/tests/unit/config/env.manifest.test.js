import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ENV_MANIFEST,
  REQUIRED_ENV_VARIABLES,
  coerceEnv,
  missingEnvVariables,
} from '../../../app/config/env.manifest.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

const NAMES = Object.keys(ENV_MANIFEST);

// The copy of the list that cannot import the manifest. A name missing from it
// is a variable nobody can discover without reading the code.
const exampleNames = read('../../../.env.example')
  .split('\n')
  .map(line => line.match(/^([A-Z0-9_]+)=/)?.[1])
  .filter(Boolean);

describe('env manifest', () => {
  it('boots with no environment at all: nothing is required', () => {
    assert.deepEqual(REQUIRED_ENV_VARIABLES, []);
    assert.deepEqual(missingEnvVariables({}), []);
  });

  it('treats an empty string as missing, not as a value', () => {
    assert.equal(coerceEnv({ fallback: 4317, kind: 'number' }, ''), 4317);
  });

  it('gives every optional name a fallback or says why it may be unset', () => {
    const silent = Object.entries(ENV_MANIFEST)
      .filter(([, entry]) => entry.fallback === undefined && !/Unset/.test(entry.doc))
      .map(([name]) => name);
    assert.deepEqual(silent, []);
  });

  it('coerces by declared kind and falls back when absent', () => {
    assert.equal(coerceEnv({ kind: 'number' }, '8080'), 8080);
    assert.equal(coerceEnv({ kind: 'boolean' }, 'true'), true);
    assert.equal(coerceEnv({ kind: 'boolean' }, 'no'), false);
    assert.equal(coerceEnv({ fallback: 'info' }, undefined), 'info');
    assert.equal(coerceEnv({ fallback: 'info' }, ''), 'info');
  });

  it('documents every variable it declares', () => {
    const undocumented = Object.entries(ENV_MANIFEST)
      .filter(([, entry]) => !entry.doc)
      .map(([name]) => name);
    assert.deepEqual(undocumented, []);
  });

  it('is mirrored by .env.example', () => {
    assert.deepEqual(
      NAMES.filter(name => !exampleNames.includes(name)),
      []
    );
  });
});
