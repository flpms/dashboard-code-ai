import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RouteProcessor } from '../../../app/lib/route-processor.js';
import { fakeLogger } from '../../helpers/fakes.js';

const fakeApp = () => {
  const registered = [];
  return { registered, route: options => registered.push(options) };
};

const deps = app => ({
  app,
  Logger: fakeLogger(),
  controllers: { listItems: 'CONTROLLER' },
  schemas: { get: { listItems: { params: 'PARAMS' } } },
  requireLoopback: 'LOOPBACK',
});

const listItems = flags => ({ listItems: { path: '/items', method: 'get', ...flags } });

describe('RouteProcessor', () => {
  it('turns the local flag into the loopback guard', () => {
    const app = fakeApp();

    RouteProcessor(deps(app))(listItems({ local: true, validate: true }));

    assert.deepEqual(app.registered[0].onRequest, ['LOOPBACK']);
  });

  it('hands Fastify the method, the path, the schema and the controller', () => {
    const app = fakeApp();

    RouteProcessor(deps(app))(listItems({ local: true, validate: true }));

    const [route] = app.registered;
    assert.equal(route.method, 'GET');
    assert.equal(route.url, '/items');
    assert.deepEqual(route.schema, { params: 'PARAMS' });
    assert.equal(route.handler, 'CONTROLLER');
  });

  it('omits the guards and the schema a route did not ask for', () => {
    const app = fakeApp();
    const dependencies = { ...deps(app), schemas: { get: {} } };

    RouteProcessor(dependencies)(listItems({ local: false }));

    assert.equal(app.registered[0].onRequest, undefined);
    assert.equal(app.registered[0].schema, undefined);
  });

  it('fails at boot when a controller is missing, naming the route', () => {
    assert.throws(
      () => RouteProcessor(deps(fakeApp()))({ ghost: { path: '/g', method: 'get' } }),
      /Route "ghost" is missing: controller/
    );
  });

  it('fails at boot when validate is declared without a schema', () => {
    const dependencies = { ...deps(fakeApp()), schemas: { get: {} } };
    assert.throws(
      () => RouteProcessor(dependencies)(listItems({ validate: true })),
      /marked validate:true but has no get schema/
    );
  });

  it('fails at boot when a schema exists but validate is off', () => {
    assert.throws(
      () => RouteProcessor(deps(fakeApp()))(listItems({ validate: false })),
      /has a get schema but is not marked validate:true/
    );
  });

  it('fails at boot on an unknown HTTP method', () => {
    assert.throws(
      () => RouteProcessor(deps(fakeApp()))({ listItems: { path: '/i', method: 'trace' } }),
      /unknown method: trace/
    );
  });
});
