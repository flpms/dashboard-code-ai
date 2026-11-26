import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { FileWatcher } from '../../../app/services/file-watcher.service.js';
import { fakeLogger } from '../../helpers/fakes.js';

const fakeWatch = () => {
  const opened = [];
  const watch = (cwd, options) => {
    const handlers = {};
    const watcher = {
      cwd,
      options,
      closed: false,
      on: (event, handler) => {
        handlers[event] = handler;
        return watcher;
      },
      emit: (event, path) => handlers[event]?.(path),
      close: () => {
        watcher.closed = true;
      },
    };
    opened.push(watcher);
    return watcher;
  };
  return { watch, opened };
};

const build = (overrides = {}) => {
  const { watch, opened } = fakeWatch();
  let now = 0;
  const service = FileWatcher({
    enabled: true,
    Logger: fakeLogger(),
    watch,
    now: () => now,
    ...overrides,
  });
  const reports = [];
  service.start(change => reports.push(change));
  return { service, opened, reports, tick: ms => (now += ms) };
};

describe('FileWatcher', () => {
  it('never descends into dependency or build folders', () => {
    const { service } = build();
    assert.equal(service.isIgnored('/repo/node_modules/x/index.js'), true);
    assert.equal(service.isIgnored('/repo/.git/HEAD'), true);
    assert.equal(service.isIgnored('/repo/src/app.js'), false);
  });

  it('opens one watcher per session and closes it on unwatch', () => {
    const { service, opened } = build();

    service.watch('s1', '/repo');
    service.watch('s1', '/repo');
    service.unwatch('s1');

    assert.equal(opened.length, 1);
    assert.equal(opened[0].closed, true);
  });

  it('reports a burst of writes once, then stays quiet for the window', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const { service, opened, reports, tick } = build();

    service.watch('s1', '/repo');
    opened[0].emit('change', '/repo/a.js');
    opened[0].emit('change', '/repo/a.js');
    mock.timers.tick(300);

    tick(1000);
    opened[0].emit('change', '/repo/a.js');
    mock.timers.tick(300);

    tick(6000);
    opened[0].emit('change', '/repo/a.js');
    mock.timers.tick(300);

    assert.deepEqual(reports, [
      { sessionId: 's1', path: '/repo/a.js' },
      { sessionId: 's1', path: '/repo/a.js' },
    ]);
    mock.timers.reset();
  });

  it('does nothing when disabled', () => {
    const { service, opened } = build({ enabled: false });
    service.watch('s1', '/repo');
    assert.equal(opened.length, 0);
  });
});
