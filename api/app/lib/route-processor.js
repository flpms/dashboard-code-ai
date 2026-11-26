'use strict';

/**
 * Turns `routes.json` into Fastify routes.
 *
 * A route is a data row, not code: the guard chain is *derived* from the flags
 * on the row, so there is exactly one place where "auth" or "roles" or
 * "validate" is turned into behaviour. Adding an endpoint never means editing
 * this file.
 */

// Each flag maps to the guard it contributes. Adding a new capability to
// routes.json means adding a key here — never an `if` inside the loop below.
const GUARD_BUILDERS = Object.freeze({
  auth: ({ requireAuthToken }) => requireAuthToken,
  roles: ({ permissions }, value) => permissions(value),
  tenant: ({ requireTenantScope }) => requireTenantScope,
});

// The order the guards run in. They run as `onRequest` hooks, before the body
// is parsed, and Fastify validates the payload only after every one of them
// passed. An anonymous caller can neither learn which fields a schema expects
// nor make the server parse a 5 MB body.
const GUARD_ORDER = Object.freeze(['auth', 'roles', 'tenant']);

const HTTP_METHODS = Object.freeze(['get', 'post', 'put', 'patch', 'delete']);

const buildGuards = (deps, route) =>
  GUARD_ORDER.filter(flag => Boolean(route[flag])).map(flag =>
    GUARD_BUILDERS[flag](deps, route[flag])
  );

const failAtBoot = (Logger, message) => {
  Logger.error(message);
  throw new ReferenceError(message);
};

// Fail at boot, naming the route and the missing piece. A route whose
// controller was renamed must not reach production as a silent 404, and a
// schema nobody switched on must not let an unvalidated body through.
const assertWellFormed = (Logger, key, route, controller, schema) => {
  const { method, path } = route;

  const missing = Object.entries({ path, method, controller })
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) failAtBoot(Logger, `Route "${key}" is missing: ${missing.join(', ')}`);

  if (!HTTP_METHODS.includes(method)) {
    failAtBoot(Logger, `Route "${key}" declares an unknown method: ${method}`);
  }

  if (route.validate && !schema) {
    failAtBoot(Logger, `Route "${key}" is marked validate:true but has no ${method} schema`);
  }

  if (!route.validate && schema) {
    failAtBoot(Logger, `Route "${key}" has a ${method} schema but is not marked validate:true`);
  }
};

export const RouteProcessor = dependencies => {
  const { app, controllers, Logger, schemas } = dependencies;

  Logger.verbose('enabling routes');

  return routes => {
    Object.entries(routes).forEach(([key, route]) => {
      const { method, path } = route;
      const controller = controllers[key];
      const schema = schemas[method]?.[key];

      assertWellFormed(Logger, key, route, controller, schema);

      const guards = buildGuards(dependencies, route);

      app.route({
        method: method.toUpperCase(),
        url: path,
        ...(guards.length && { onRequest: guards }),
        // A copy: Fastify annotates the schema object it is handed, and the
        // schemas table is shared.
        ...(schema && { schema: { ...schema } }),
        handler: controller,
      });

      Logger.info(`START ${method.toUpperCase()} ${path} - ready`);
    });

    return app;
  };
};
