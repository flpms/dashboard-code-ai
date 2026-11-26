import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EventBus } from '../../../app/lib/event-bus.js';

describe('EventBus', () => {
  it('delivers to every subscriber until it unsubscribes', () => {
    const bus = EventBus();
    const heard = [];
    const stop = bus.subscribe(event => heard.push(['a', event]));
    bus.subscribe(event => heard.push(['b', event]));

    bus.publish(1);
    stop();
    bus.publish(2);

    assert.deepEqual(heard, [
      ['a', 1],
      ['b', 1],
      ['b', 2],
    ]);
  });

  it('drops a subscriber that throws and keeps serving the rest', () => {
    const bus = EventBus();
    const heard = [];
    bus.subscribe(() => {
      throw new Error('socket closed');
    });
    bus.subscribe(event => heard.push(event));

    bus.publish('x');

    assert.deepEqual(heard, ['x']);
    assert.equal(bus.size(), 1);
  });
});
