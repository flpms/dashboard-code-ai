import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { describe, it } from 'node:test';

import { SettingsStore } from '../../../app/services/settings-store.service.js';
import { fakeLogger } from '../../helpers/fakes.js';

const PATH = '/data/settings.json';
const DEFAULTS = Object.freeze({ autoInstallHooks: true, backfillHours: 6 });

const memoryFs = (files = {}) => {
  const store = new Map(Object.entries(files));
  return {
    store,
    existsSync: path => store.has(path),
    readFileSync: path => store.get(path),
    writeFileSync: (path, text) => store.set(path, text),
    mkdirSync: () => {},
  };
};

const settings = (fs, path = PATH) =>
  SettingsStore({ path, defaults: DEFAULTS, fs, dirname, Logger: fakeLogger() });

describe('SettingsStore', () => {
  it('starts from the environment defaults', () => {
    assert.deepEqual(settings(memoryFs()).get(), DEFAULTS);
  });

  it('saves a change and reads it back after a restart', () => {
    const fs = memoryFs();
    assert.deepEqual(settings(fs).update({ backfillHours: 24 }), {
      autoInstallHooks: true,
      backfillHours: 24,
    });
    assert.equal(settings(fs).get().backfillHours, 24);
  });

  it('keeps only known keys of the right type', () => {
    const fs = memoryFs({
      [PATH]: JSON.stringify({ backfillHours: 'lots', autoInstallHooks: false, port: 1 }),
    });
    assert.deepEqual(settings(fs).get(), { autoInstallHooks: false, backfillHours: 6 });
    assert.deepEqual(settings(fs).update({ shell: 'rm -rf' }), {
      autoInstallHooks: false,
      backfillHours: 6,
    });
  });

  it('falls back to the defaults when the file is not JSON', () => {
    assert.deepEqual(settings(memoryFs({ [PATH]: '{' })).get(), DEFAULTS);
  });

  it('writes nothing without a path', () => {
    const fs = memoryFs();
    const store = settings(fs, null);
    assert.equal(store.update({ backfillHours: 1 }).backfillHours, 1);
    assert.equal(fs.store.size, 0);
  });
});
