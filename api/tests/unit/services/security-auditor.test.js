import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { describe, it, mock } from 'node:test';

import { SecurityAuditor } from '../../../app/services/security-auditor.service.js';
import { fakeLogger } from '../../helpers/fakes.js';

const fakeSpawn = () => {
  const children = [];
  const spawn = (command, args, options) => {
    const child = new EventEmitter();
    Object.assign(child, { command, args, options, stdout: new EventEmitter() });
    child.stdout.setEncoding = () => {};
    children.push(child);
    return child;
  };
  return { spawn, children };
};

const build = ({ lockfile = true, enabled = true } = {}) => {
  const { spawn, children } = fakeSpawn();
  const results = [];
  const auditor = SecurityAuditor({
    enabled,
    existsSync: () => lockfile,
    join,
    Logger: fakeLogger(),
    spawn,
  });
  auditor.start(result => results.push(result));
  return { auditor, children, results };
};

describe('SecurityAuditor', () => {
  it('coalesces a burst of requests into one audit after things settle', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const { auditor, children, results } = build();

    auditor.request('s1', '/repo');
    auditor.request('s1', '/repo');
    mock.timers.tick(5000);

    assert.equal(children.length, 1);
    assert.deepEqual(children[0].args, ['audit', '--json']);
    assert.equal(children[0].options.cwd, '/repo');

    children[0].stdout.emit('data', '{"metadata":');
    children[0].stdout.emit('data', '{}}');
    children[0].emit('close', 1);

    assert.deepEqual(results, [{ key: 's1', cwd: '/repo', output: '{"metadata":{}}' }]);
    mock.timers.reset();
  });

  it('skips a folder without a lockfile, and does nothing when disabled', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const withoutLock = build({ lockfile: false });
    const disabled = build({ enabled: false });

    withoutLock.auditor.request('s1', '/repo');
    disabled.auditor.request('s1', '/repo');
    mock.timers.tick(5000);

    assert.equal(withoutLock.children.length, 0);
    assert.equal(disabled.children.length, 0);
    mock.timers.reset();
  });
});
