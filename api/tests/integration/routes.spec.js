import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

import { enums } from '../../app/enums/index.js';
import lib from '../../app/lib/index.js';
import { Server } from '../../app/server.js';
import { fakeLogger } from '../helpers/fakes.js';

/**
 * Boots the real server over a fake database.
 *
 * This is the test that catches wiring mistakes a unit test cannot see: a route
 * whose controller was renamed, a schema that no longer matches its route, a
 * guard registered in the wrong order. It is the same `Server` the process
 * runs — headers, CORS, validation, error handling — driven through
 * `app.inject()`: no Mongo, no network, no open port.
 */

const JWT_SECRET = 'test-secret';
const WEB_ORIGIN = 'https://app.example.com';
const tenantId = new ObjectId();
const otherTenant = new ObjectId();

const users = {
  'admin@example.com': {
    _id: new ObjectId(),
    email: 'admin@example.com',
    role: 'admin',
    tenantId,
    deleted: false,
  },
};

// What reached the database, so a test can see past the serializer.
const inserted = [];

const fakeCollection = documents => ({
  countDocuments: async () => documents.length,
  find: () => ({ sort: () => ({ toArray: async () => documents }) }),
  findOne: async query => documents.find(doc => doc.email === query.email) ?? null,
  insertOne: async document => {
    inserted.push(document);
    return { insertedId: new ObjectId() };
  },
  updateOne: async () => ({ matchedCount: 1 }),
});

const fakeDb = {
  collection: name =>
    name === 'users' ? fakeCollection(Object.values(users)) : fakeCollection([]),
};

const env = {
  app: {
    env: 'test',
    name: 'template-api',
    version: '0.0.0',
    commitSha: 'test',
    corsAllowedOrigins: WEB_ORIGIN,
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: '1h',
  },
  db: { collections: { users: 'users', items: 'items', history: 'history' } },
  storage: { buckets: {} },
};

const Logger = fakeLogger();

let app;

const tokenFor = email =>
  jwt.sign({ email, role: 'admin', tenantId: String(tenantId) }, JWT_SECRET);

const call = (url, { token, method = 'GET', body, headers = {} } = {}) =>
  app.inject({
    method,
    url,
    headers: { ...(token && { authorization: `Bearer ${token}` }), ...headers },
    ...(body && { payload: body }),
  });

describe('v1 routes', () => {
  before(async () => {
    app = await Server({
      db: fakeDb,
      enums,
      env,
      generateSchemaObject: lib.GenerateSchemaObject,
      Joi,
      jwt,
      Logger,
      ObjectId,
      randomUUID,
      responseHandler: lib.ResponseHandler(Logger),
      routeProcessor: lib.RouteProcessor,
      services: {},
    });
    await app.ready();
  });

  after(() => app.close());

  it('serves the health check without a token, with or without the slash', async () => {
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

  it('refuses a protected route with no Authorization header', async () => {
    assert.equal((await call(`/v1/tenant/${tenantId}/items`)).statusCode, 401);
  });

  it('refuses a forged token', async () => {
    const forged = jwt.sign({ email: 'admin@example.com' }, 'wrong-secret');
    const response = await call(`/v1/tenant/${tenantId}/items`, { token: forged });
    assert.equal(response.statusCode, 401);
  });

  it('refuses an anonymous caller before validating the body', async () => {
    const response = await call(`/v1/tenant/${tenantId}/items`, { method: 'POST', body: {} });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().details, undefined);
  });

  it('serves a tenant the caller belongs to', async () => {
    const response = await call(`/v1/tenant/${tenantId}/items`, {
      token: tokenFor('admin@example.com'),
    });
    assert.equal(response.statusCode, 200);
    assert.ok(Array.isArray(response.json().items));
  });

  it('refuses another tenant even with a valid token and the right role', async () => {
    const response = await call(`/v1/tenant/${otherTenant}/items`, {
      token: tokenFor('admin@example.com'),
    });
    assert.equal(response.statusCode, 403);
  });

  it('rejects an invalid body before it reaches a use case', async () => {
    const response = await call(`/v1/tenant/${tenantId}/items`, {
      token: tokenFor('admin@example.com'),
      method: 'POST',
      body: { name: 'x' },
    });
    assert.equal(response.statusCode, 400);
    assert.match(JSON.stringify(response.json()), /body\.name/);
  });

  it('stores the validated body: defaults applied, undeclared fields gone', async () => {
    const response = await call(`/v1/tenant/${tenantId}/items`, {
      token: tokenFor('admin@example.com'),
      method: 'POST',
      body: { name: 'Widget', tenantId: String(otherTenant), role: 'super-admin' },
    });

    const stored = inserted.at(-1);

    assert.equal(response.statusCode, 201);
    assert.equal(stored.status, 'draft');
    assert.equal(stored.role, undefined);
    assert.equal(String(stored.tenantId), String(tenantId));
  });

  it('answers 404 as JSON for an unknown path', async () => {
    const response = await call('/v1/nope');
    assert.equal(response.statusCode, 404);
    assert.ok(response.json().message);
  });
});
