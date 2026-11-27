import { describe, expect, it, vi } from 'vitest';

import { SessionsService } from './sessions.service.js';

const fakeClient = () => ({
  request: vi.fn(),
  get: vi.fn(async path =>
    path.startsWith('/v1/sessions?') ? { sessions: [{ id: 's1' }] } : { events: [], last: 0 }
  ),
  post: vi.fn(async () => ({ transcripts: 1, read: 1, newSessions: 1 })),
  put: vi.fn(),
  patch: vi.fn(),
  remove: vi.fn(),
  subscribe: vi.fn(() => () => {}),
});

describe('SessionsService', () => {
  it('unwraps the session list', async () => {
    const client = fakeClient();
    expect(await SessionsService(client).list()).toEqual([{ id: 's1' }]);
    expect(client.get).toHaveBeenCalledWith('/v1/sessions?limit=50');
  });

  it('asks for events after a sequence number, encoding the id', async () => {
    const client = fakeClient();
    await SessionsService(client).events('a/b', { after: 7 });
    expect(client.get).toHaveBeenCalledWith('/v1/sessions/a%2Fb/events?after=7');
  });

  it('opens the stream on the collector', () => {
    const client = fakeClient();
    const onevent = vi.fn();
    SessionsService(client).stream(onevent);
    expect(client.subscribe).toHaveBeenCalledWith('/v1/stream', {
      onmessage: onevent,
      onstatus: undefined,
    });
  });

  it('asks the collector to rescan for new sessions', async () => {
    const client = fakeClient();
    expect(await SessionsService(client).refresh()).toEqual({
      transcripts: 1,
      read: 1,
      newSessions: 1,
    });
    expect(client.post).toHaveBeenCalledWith('/v1/sessions/refresh');
  });
});
