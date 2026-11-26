import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';

import { DockerWatcher } from '../../../app/services/docker-watcher.service.js';
import { fakeLogger } from '../../helpers/fakes.js';

const fakeSpawn = () => {
  const children = [];
  const spawn = (command, args) => {
    const child = new EventEmitter();
    child.command = command;
    child.args = args;
    child.stdout = new EventEmitter();
    child.stdout.setEncoding = () => {};
    child.killed = false;
    child.kill = () => {
      child.killed = true;
    };
    children.push(child);
    return child;
  };
  return { spawn, children };
};

describe('DockerWatcher', () => {
  it('hands over whole lines even when chunks split them', () => {
    const { spawn, children } = fakeSpawn();
    const lines = [];

    DockerWatcher({ enabled: true, Logger: fakeLogger(), spawn }).start(line => lines.push(line));

    children[0].stdout.emit('data', '{"a":1}\n{"b"');
    children[0].stdout.emit('data', ':2}\n');

    assert.deepEqual(lines, ['{"a":1}', '{"b":2}']);
    assert.equal(children[0].command, 'docker');
    assert.ok(children[0].args.includes('type=container'));
  });

  it('logs instead of crashing when docker is missing', () => {
    const { spawn, children } = fakeSpawn();
    const Logger = fakeLogger();

    DockerWatcher({ enabled: true, Logger, spawn }).start(() => {});
    children[0].emit('error', new Error('spawn docker ENOENT'));

    assert.match(Logger.lines.warn[0], /docker unavailable/);
  });

  it('kills the child on stop and spawns nothing when disabled', () => {
    const { spawn, children } = fakeSpawn();
    const watcher = DockerWatcher({ enabled: true, Logger: fakeLogger(), spawn });
    watcher.start(() => {});
    watcher.stop();
    assert.equal(children[0].killed, true);

    const idle = fakeSpawn();
    DockerWatcher({ enabled: false, Logger: fakeLogger(), spawn: idle.spawn }).start(() => {});
    assert.equal(idle.children.length, 0);
  });
});
