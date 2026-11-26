'use strict';

/**
 * In-process fan-out from the use cases to every open dashboard stream.
 *
 * A Set of listeners closed over by the factory, not a module-level emitter:
 * each server (and each test) gets its own bus, so one test's subscribers
 * never hear another's events.
 */
export const EventBus = () => {
  const listeners = new Set();

  const publish = event =>
    listeners.forEach(listener => {
      // One broken stream must not stop the others from hearing the event.
      try {
        listener(event);
      } catch {
        listeners.delete(listener);
      }
    });

  const subscribe = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return { publish, subscribe, size: () => listeners.size };
};
