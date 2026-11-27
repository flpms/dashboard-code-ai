import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { describe, it } from 'node:test';

import { HooksInstaller } from '../../../app/services/hooks-installer.service.js';
import { COLLECTOR_HOOKS } from '../../../app/v1/domain/hook-settings.js';
import { fakeLogger } from '../../helpers/fakes.js';

const PATH = '/home/dev/.claude/settings.json';
const URL = 'http://127.0.0.1:4317/v1/hooks';

const memoryFs = (files = {}) => {
  const store = new Map(Object.entries(files));
  return {
    store,
    writes: 0,
    existsSync: path => store.has(path),
    readFileSync: path => store.get(path),
    writeFileSync(path, text) {
      this.writes += 1;
      store.set(path, text);
    },
    copyFileSync: (from, to) => store.set(to, store.get(from)),
    mkdirSync: () => {},
  };
};

const installer = fs => HooksInstaller({ settingsPath: PATH, fs, dirname, Logger: fakeLogger() });

describe('HooksInstaller', () => {
  it('adds every collector hook and keeps what was there, with a backup', () => {
    const original = JSON.stringify({ permissions: { allow: ['Bash(ls)'] } });
    const fs = memoryFs({ [PATH]: original });

    assert.equal(installer(fs).ensure(URL), 'installed');

    const settings = JSON.parse(fs.store.get(PATH));
    assert.deepEqual(settings.permissions, { allow: ['Bash(ls)'] });
    assert.deepEqual(Object.keys(settings.hooks).sort(), [...COLLECTOR_HOOKS].sort());
    assert.equal(fs.store.get(`${PATH}.bak`), original);
  });

  it('creates the file when Claude Code has none yet', () => {
    const fs = memoryFs();
    assert.equal(installer(fs).ensure(URL), 'installed');
    assert.ok(JSON.parse(fs.store.get(PATH)).hooks.PreToolUse);
  });

  it('writes nothing when the hooks are already there', () => {
    const fs = memoryFs();
    installer(fs).ensure(URL);
    const writes = fs.writes;

    assert.equal(installer(fs).ensure(URL), 'present');
    assert.equal(fs.writes, writes);
  });

  it('never overwrites a settings file it cannot parse', () => {
    const fs = memoryFs({ [PATH]: '{ not json' });
    assert.equal(installer(fs).ensure(URL), 'failed');
    assert.equal(fs.store.get(PATH), '{ not json');
  });

  it('does nothing when switched off', () => {
    const fs = memoryFs();
    assert.equal(installer(fs).ensure(URL, { enabled: false }), 'disabled');
    assert.equal(fs.store.size, 0);
  });

  it('reports whether the hooks are in place', () => {
    const fs = memoryFs();
    assert.deepEqual(installer(fs).status(URL), {
      installed: false,
      readable: true,
      settingsPath: PATH,
    });
    installer(fs).install(URL);
    assert.equal(installer(fs).status(URL).installed, true);
    assert.equal(installer(memoryFs({ [PATH]: '{' })).status(URL).readable, false);
  });

  it("removes only its own hooks, keeping the user's", () => {
    const own = { type: 'command', command: 'echo hi' };
    const fs = memoryFs({ [PATH]: JSON.stringify({ hooks: { Stop: [{ hooks: [own] }] } }) });
    installer(fs).install(URL);

    assert.equal(installer(fs).remove(URL), 'removed');
    assert.deepEqual(JSON.parse(fs.store.get(PATH)).hooks, { Stop: [{ hooks: [own] }] });
    assert.equal(installer(fs).remove(URL), 'absent');
  });

  it('removes nothing from a missing or unreadable file', () => {
    assert.equal(installer(memoryFs()).remove(URL), 'absent');
    const fs = memoryFs({ [PATH]: '{ not json' });
    assert.equal(installer(fs).remove(URL), 'failed');
    assert.equal(fs.store.get(PATH), '{ not json');
  });
});
