import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';

import Joi from 'joi';

import { DBStartup } from '../../app/config/db.config.js';
import { enums } from '../../app/enums/index.js';
import lib from '../../app/lib/index.js';
import { Server } from '../../app/server.js';
import { fakeClock, fakeFileWatcher, fakeLogger } from '../helpers/fakes.js';

/**
 * Boots the real server over an in-memory SQLite database.
 *
 * This is the test that catches wiring mistakes a unit test cannot see: a route
 * whose controller was renamed, a schema that no longer matches its route, a
 * guard registered in the wrong order. It is the same `Server` the process
 * runs — headers, CORS, validation, error handling — driven through
 * `app.inject()`, plus one real socket for the event stream.
 */

const WEB_ORIGIN = 'http://localhost:5173';

const env = {
  app: {
    env: 'test',
    name: 'collector',
    version: '0.0.0',
    commitSha: 'test',
    corsAllowedOrigins: WEB_ORIGIN,
  },
  db: { path: ':memory:' },
  watchers: { docker: false, files: false },
};

const Logger = fakeLogger();

let app;

const call = (url, { method = 'GET', body, headers = {}, remoteAddress } = {}) =>
  app.inject({
    method,
    url,
    headers,
    ...(remoteAddress && { remoteAddress }),
    ...(body && { payload: body }),
  });

const hook = (name, fields = {}) => ({
  hook_event_name: name,
  session_id: 'sess-1',
  cwd: '/repo',
  ...fields,
});

describe('v1 routes', () => {
  before(async () => {
    const { db } = DBStartup({ env, logger: Logger, DatabaseSync, mkdirSync: () => {}, dirname });
    app = await Server({
      clock: fakeClock(),
      db,
      enums,
      env,
      eventBus: lib.EventBus(),
      generateSchemaObject: lib.GenerateSchemaObject,
      Joi,
      Logger,
      randomUUID,
      responseHandler: lib.ResponseHandler(Logger),
      routeProcessor: lib.RouteProcessor,
      services: {
        dockerWatcher: { start: () => {}, stop: () => {} },
        fileWatcher: fakeFileWatcher(),
      },
    });
    await app.ready();
  });

  after(() => app.close());

  it('serves the health check, with or without the slash', async () => {
    const [bare, slashed] = await Promise.all([call('/v1'), call('/v1/')]);
    assert.equal(bare.statusCode, 200);
    assert.equal(slashed.statusCode, 200);
    assert.equal(bare.json().status, 'ok');
  });

  it('sends the security headers', async () => {
    const response = await call('/v1');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  });

  it('allows the configured web origin and no other', async () => {
    const allowed = await call('/v1', { headers: { origin: WEB_ORIGIN } });
    const stranger = await call('/v1', { headers: { origin: 'https://evil.example' } });

    assert.equal(allowed.headers['access-control-allow-origin'], WEB_ORIGIN);
    assert.equal(stranger.headers['access-control-allow-origin'], undefined);
  });

  it('refuses a caller from another machine before reading the body', async () => {
    const response = await call('/v1/hooks', {
      method: 'POST',
      body: {},
      remoteAddress: '10.0.0.7',
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().details, undefined);
  });

  it('accepts a hook with 204 and an empty body', async () => {
    const response = await call('/v1/hooks', { method: 'POST', body: hook('SessionStart') });
    assert.equal(response.statusCode, 204);
    assert.equal(response.body, '');
  });

  it('rejects a hook without a session id, naming the field', async () => {
    const response = await call('/v1/hooks', {
      method: 'POST',
      body: { hook_event_name: 'Stop' },
    });
    assert.equal(response.statusCode, 400);
    assert.match(JSON.stringify(response.json()), /body\.session_id/);
  });

  it('lists sessions and their events in order, without undeclared fields', async () => {
    await call('/v1/hooks', {
      method: 'POST',
      body: hook('PreToolUse', {
        tool_name: 'Read',
        tool_use_id: 'r1',
        tool_input: { file_path: '/repo/a.js' },
        permission_mode: 'default',
      }),
    });

    const sessions = (await call('/v1/sessions')).json().sessions;
    const { events, last } = (await call('/v1/sessions/sess-1/events')).json();

    assert.equal(sessions[0].id, 'sess-1');
    assert.deepEqual(
      events.map(event => event.kind),
      ['session.start', 'tool.start']
    );
    assert.equal(last, events.at(-1).seq);
    assert.equal(JSON.stringify(events).includes('permission_mode'), false);
  });

  it('pages the event log with `after`', async () => {
    const { events } = (await call('/v1/sessions/sess-1/events?after=1')).json();
    assert.deepEqual(
      events.map(event => event.seq),
      [2]
    );
  });

  it('rejects a malformed session id', async () => {
    const response = await call('/v1/sessions/bad%20id/events');
    assert.equal(response.statusCode, 400);
  });

  it('streams new events to an open dashboard', async () => {
    await app.listen({ port: 0, host: '127.0.0.1' });
    const { port } = app.server.address();
    const controller = new AbortController();

    const response = await fetch(`http://127.0.0.1:${port}/v1/stream`, {
      signal: controller.signal,
      headers: { origin: WEB_ORIGIN },
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const readUntil = async (text, buffer = '') => {
      if (buffer.includes(text)) return buffer;
      const { value, done } = await reader.read();
      if (done) return buffer;
      return readUntil(text, buffer + decoder.decode(value));
    };

    await readUntil(': connected');
    await call('/v1/hooks', { method: 'POST', body: hook('Stop') });
    const received = await readUntil('turn.end');

    assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
    assert.equal(response.headers.get('access-control-allow-origin'), WEB_ORIGIN);
    assert.match(received, /data: \{.*"kind":"turn\.end"/);

    controller.abort();
  });

  it('answers 404 as JSON for an unknown path', async () => {
    const response = await call('/v1/nope');
    assert.equal(response.statusCode, 404);
    assert.ok(response.json().message);
  });
});
