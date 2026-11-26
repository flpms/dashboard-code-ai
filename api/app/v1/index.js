'use strict';

import routesJSON from './routes.json' with { type: 'json' };

import CheckAuthToken from './authorization/check-token.hook.js';
import Permissions from './authorization/permission.hook.js';
import RequireTenantScope from './authorization/tenant-scope.hook.js';
import { Controllers } from './controller/index.js';
import { Repositories } from './repositories/index.js';
import { Schemas } from './schemas/index.js';
import { Serializers } from './serializers/index.js';
import { UseCases } from './use-cases/index.js';

// What the guards establish about a request, declared up front. Fastify keeps
// request objects one shape when their properties are known in advance, and the
// list doubles as the answer to "what may a handler rely on?".
const REQUEST_FACTS = Object.freeze(['tokenPayload', 'user', 'tenantId']);

/**
 * Version 1 of the API, as a Fastify plugin mounted under `/v1`.
 *
 * Wiring, in dependency order. Each layer receives the one below it already
 * built — repositories know nothing of use cases, use cases know nothing of
 * HTTP, controllers know nothing of Mongo.
 */
export const RoutesV1 = deps => async app => {
  const { routeProcessor, ...dependencies } = deps;

  REQUEST_FACTS.forEach(name => app.decorateRequest(name, null));

  const repositories = Repositories(dependencies);

  const useCases = UseCases({ ...dependencies, repositories, serializers: Serializers });

  routeProcessor({
    ...dependencies,
    app,
    controllers: Controllers({ ...dependencies, ...useCases }),
    permissions: Permissions({ ...dependencies, repositories }),
    requireAuthToken: CheckAuthToken(dependencies),
    requireTenantScope: RequireTenantScope(dependencies),
    schemas: Schemas(dependencies),
  })(routesJSON);
};
