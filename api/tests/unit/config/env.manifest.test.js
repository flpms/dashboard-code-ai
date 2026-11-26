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

// The two copies of the list that cannot import the manifest. A name missing
// from either fails the release at *Check environment*; failing here instead
// turns that into a red build on the pull request that caused it.
const exampleNames = read('../../../.env.example')
  .split('\n')
  .map(line => line.match(/^([A-Z0-9_]+)=/)?.[1])
  .filter(Boolean);

const releaseWorkflow = read('../../../../.github/workflows/release-api.yml');

describe('env manifest', () => {
  it('reports every required name a source does not provide', () => {
    const missing = missingEnvVariables({});
    assert.deepEqual(missing, [...REQUIRED_ENV_VARIABLES]);
  });

  it('treats an empty string as missing, not as a value', () => {
    const source = Object.fromEntries(REQUIRED_ENV_VARIABLES.map(name => [name, 'x']));
    assert.deepEqual(missingEnvVariables({ ...source, JWT_SECRET: '   ' }), ['JWT_SECRET']);
  });

  it('reports nothing when every required name is present', () => {
    const source = Object.fromEntries(REQUIRED_ENV_VARIABLES.map(name => [name, 'value']));
    assert.deepEqual(missingEnvVariables(source), []);
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

  // Anywhere in the file, not only the `env:` block: API_IMAGE is written by
  // the deploy step itself, because only that step knows the image tag.
  it('is mirrored by the release workflow', () => {
    assert.deepEqual(
      NAMES.filter(name => !new RegExp(`\\b${name}\\b`).test(releaseWorkflow)),
      []
    );
  });
});
