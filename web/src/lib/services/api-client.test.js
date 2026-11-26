import { describe, expect, it, vi } from 'vitest';

import { ApiClient, ApiError } from './api-client.js';

const response = (status, body, { text } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (text !== undefined ? text : JSON.stringify(body)),
});

const build = (fetchImpl, overrides = {}) =>
  ApiClient({ getToken: () => 'token-123', fetchImpl, ...overrides });

describe('ApiClient', () => {
  it('sends the bearer token when there is one', async () => {
    const fetchImpl = vi.fn(async () => response(200, { ok: true }));

    await build(fetchImpl).get('/v1/items');

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });

  it('omits the header when there is no token', async () => {
    const fetchImpl = vi.fn(async () => response(200, {}));

    await ApiClient({ getToken: () => null, fetchImpl }).get('/v1/items');

    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('returns null for 204 instead of throwing on an empty body', async () => {
    const result = await build(async () => response(204, null, { text: '' })).remove('/v1/items/1');
    expect(result).toBeNull();
  });

  it('throws ApiError carrying the status', async () => {
    const failing = build(async () => response(404, { message: 'Not found' }));

    await expect(failing.get('/v1/items/1')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
    });
  });

  it('falls back to a friendly message when the API sends none', async () => {
    const failing = build(async () => response(503, {}));

    await expect(failing.get('/v1/items')).rejects.toThrow(/indisponível/i);
  });

  it('notifies once on 401 so the caller can clear the session', async () => {
    const onUnauthorized = vi.fn();
    const failing = build(async () => response(401, {}), { onUnauthorized });

    await expect(failing.get('/v1/items')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('survives a non-JSON error body', async () => {
    const failing = build(async () => response(500, null, { text: '<html>gateway</html>' }));

    await expect(failing.get('/v1/items')).rejects.toThrow('<html>gateway</html>');
  });
});

describe('ApiClient.subscribe', () => {
  const fakeEventSource = () => {
    const opened = [];
    function FakeEventSource(url) {
      this.url = url;
      this.closed = false;
      this.close = () => {
        this.closed = true;
      };
      opened.push(this);
    }
    return { FakeEventSource, opened };
  };

  it('parses each message and reports the connection state', () => {
    const { FakeEventSource, opened } = fakeEventSource();
    const onmessage = vi.fn();
    const onstatus = vi.fn();

    ApiClient({ fetchImpl: vi.fn(), EventSourceImpl: FakeEventSource }).subscribe('/v1/stream', {
      onmessage,
      onstatus,
    });

    const [source] = opened;
    source.onopen();
    source.onmessage({ data: '{"seq":1}' });
    source.onerror();

    expect(source.url).toMatch(/\/v1\/stream$/);
    expect(onmessage).toHaveBeenCalledWith({ seq: 1 });
    expect(onstatus.mock.calls).toEqual([['open'], ['error']]);
  });

  it('drops a malformed message without breaking the stream', () => {
    const { FakeEventSource, opened } = fakeEventSource();
    const onmessage = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const close = ApiClient({ fetchImpl: vi.fn(), EventSourceImpl: FakeEventSource }).subscribe(
      '/v1/stream',
      { onmessage }
    );
    opened[0].onmessage({ data: 'not json' });
    close();

    expect(onmessage).not.toHaveBeenCalled();
    expect(opened[0].closed).toBe(true);
    spy.mockRestore();
  });
});
