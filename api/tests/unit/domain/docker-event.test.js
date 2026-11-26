import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseDockerLine } from '../../../app/v1/domain/docker-event.js';

const line = overrides =>
  JSON.stringify({
    Type: 'container',
    Action: 'start',
    Actor: { ID: 'abcdef1234567890', Attributes: { name: 'db', image: 'postgres:17' } },
    timeNano: 1_764_156_000_000_000_000,
    ...overrides,
  });

describe('parseDockerLine', () => {
  it('keeps lifecycle actions with name, image and a short id', () => {
    assert.deepEqual(parseDockerLine(line()), {
      kind: 'container.start',
      containerId: 'abcdef123456',
      name: 'db',
      image: 'postgres:17',
      exitCode: null,
      ts: new Date(1_764_156_000_000).toISOString(),
    });
  });

  it('carries the exit code of a dying container', () => {
    const event = parseDockerLine(
      line({ Action: 'die', Actor: { ID: 'x', Attributes: { name: 'db', exitCode: '137' } } })
    );
    assert.equal(event.kind, 'container.die');
    assert.equal(event.exitCode, 137);
  });

  it('drops noise, other object types and broken lines', () => {
    assert.equal(parseDockerLine(line({ Action: 'exec_start: sh' })), null);
    assert.equal(parseDockerLine(line({ Type: 'network' })), null);
    assert.equal(parseDockerLine('not json'), null);
  });
});
