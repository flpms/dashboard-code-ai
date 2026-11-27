import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, it } from 'node:test';

import Joi from 'joi';

import { DBStartup } from '../../app/config/db.config.js';
import { inlineScriptHashes } from '../../app/dashboard.js';
import { enums } from '../../app/enums/index.js';
import lib from '../../app/lib/index.js';
import { Server } from '../../app/server.js';
import { fakeClock, fakeFileWatcher, fakeLogger, fakeSecurityAuditor } from '../helpers/fakes.js';

/**
 * The collector serving a dashboard build from WEB_ROOT: one process, one
 * origin. A throwaway build stands in for web/build.
 */

const BOOT_SCRIPT = 'window.__boot = true;';
const INDEX = `<!doctype html><html><head></head><body><script>${BOOT_SCRIPT}</script></body></html>`;

const webRoot = mkdtempSync(join(tmpdir(), 'dashboard-'));
mkdirSync(join(webRoot, '_app', 'immutable'), { recursive: true });
writeFileSync(join(webRoot, 'index.html'), INDEX);
writeFileSync(join(webRoot, '_app', 'immutable', 'start.abc123.js'), 'export {};');

const env = {
  app: {
    env: 'test',
    name: 'collector',
    version: '0.0.0',
    commitSha: 'test',
    corsAllowedOrigins: '',
    webRoot,
  },
  db: { path: ':memory:' },
  watchers: { docker: false, files: false, security: false },
};

const Logger = fakeLogger();

let app;

describe('dashboard served by the collector', () => {
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
        securityAuditor: fakeSecurityAuditor(),
        transcriptWatcher: { start: () => {}, stop: async () => {} },
      },
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
    rmSync(webRoot, { recursive: true, force: true });
  });

  it('serves the page at "/" with a policy that allows exactly its boot script', async () => {
    const response = await app.inject({ url: '/' });
    const [hash] = inlineScriptHashes(INDEX);

    assert.equal(response.statusCode, 200);
    assert.match(response.body, /window.__boot/);
    assert.ok(response.headers['content-security-policy'].includes(`script-src 'self' ${hash}`));
    assert.ok(!response.headers['content-security-policy'].includes('upgrade-insecure-requests'));
    assert.equal(response.headers['cache-control'], 'no-cache');
  });

  it('lets the browser keep hashed assets forever', async () => {
    const response = await app.inject({ url: '/_app/immutable/start.abc123.js' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['cache-control'], 'public, max-age=31536000, immutable');
  });

  it('refuses the page to another machine', async () => {
    const response = await app.inject({ url: '/', remoteAddress: '10.0.0.7' });
    assert.equal(response.statusCode, 403);
  });

  it('still answers the API beside it', async () => {
    const response = await app.inject({ url: '/v1/sessions' });
    assert.equal(response.statusCode, 200);
  });

  it('keeps unknown API paths a JSON 404', async () => {
    const response = await app.inject({ url: '/v1/nope' });
    assert.equal(response.statusCode, 404);
    assert.equal(typeof response.json().message, 'string');
  });
});
