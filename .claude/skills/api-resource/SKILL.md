---
name: api-resource
description: Add a complete REST resource to the API — route row, schema, controller, use case, repository, serializer and tests. Use whenever a new endpoint or a new collection is needed in api/, or when asked to "add a resource", "create an endpoint", or "expose X in the API".
---

# Adding a resource to the API

Seven files, always in this order. Going bottom-up means every layer you write
has something real underneath it.

The example resource `items` exists to be copied. `grep -rl "items\|Items" api/app`
lists exactly the files you are about to mirror.

---

## Order of work

### 1. Collection name → `app/config/env.manifest.js`

```javascript
ORDERS_COLLECTION: { required: true, doc: 'Collection holding orders' },
```

Then expose it in `env.config.js` under `db.collections.orders`.

Nothing else names a collection. A literal string here is how a query ends up
running against the wrong collection in one environment only.

### 2. Repository → `app/v1/repositories/orders.repository.js`

Thin. Takes a query, returns documents. No business rules.

```javascript
export const OrdersRepository = ({ db, collections, logger }) => {
  const name = collections.orders;
  logger.info(`Start Collection - ${name}`);
  const collection = db.collection(name);

  const scoped = (tenantId, query = {}) => ({ ...query, tenantId, deleted: false });

  return {
    countDocuments: (tenantId, query) => collection.countDocuments(scoped(tenantId, query)),
    find: (tenantId, query, options) => collection.find(scoped(tenantId, query), options).toArray(),
    findOne: (tenantId, query) => collection.findOne(scoped(tenantId, query)),
    insertOne: document => collection.insertOne(document),
    updateOne: (tenantId, query, data) => collection.updateOne(scoped(tenantId, query), { $set: data }),
  };
};
```

`tenantId` is a parameter on every read, never a closure. That is what makes a
missing tenant filter visible in review.

Register it in `repositories/index.js`.

### 3. Serializer → `app/v1/serializers/order.serializer.js`

The shape the API promises. Fields not listed here do not leave the process —
which is what stops a new internal column leaking the day it is added.

Register it in `serializers/index.js`.

### 4. Use case → `app/v1/use-cases/orders.js`

Business rules. Receives `{ data, onFinish }`, calls exactly one outcome.

```javascript
export const Orders = ({ enums: { HTTP_MESSAGES }, Logger, repositories, serializers }) => {
  const createOrder = async ({ data, onFinish }) => {
    try {
      /* rules here */
      return onFinish.CREATED(serializers.serializeOrder(document));
    } catch (error) {
      Logger.error(`Orders::createOrder - ${error.message}`);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  return { createOrder };
};
```

Never touches `request` or `reply`, and returns the outcome it called. Register
it in `use-cases/index.js`.

### 5. Schema → `app/v1/schemas/orders.schema.js`

Keyed by **route name**, then by method. Reuse `schemas/commons/index.js` for
`tenantParams`, `tenantResourceParams` and `pagination`.

```javascript
export const OrdersSchema = Joi => ({
  createOrder: { post: { params: tenantParams(Joi), body: orderBody(Joi) } },
  listOrders: { get: { params: tenantParams(Joi), query: pagination(Joi) } },
});
```

For PATCH, make fields optional and add `.min(1)` — otherwise an empty body
answers 200 and changes nothing.

Register it in `schemas/index.js`. Duplicate route names throw at boot.

### 6. Controller → `app/v1/controller/orders.controller.js`

Translation only. `request.body`, `request.query` and `request.params` are
already the validated values — Fastify replaced them with what the Joi schema
returned, coerced and stripped of undeclared fields. That holds only on a route
marked `validate: true`.

```javascript
const createOrderController =
  ({ createOrder, responseHandler }) =>
  (request, reply) =>
    createOrder({
      data: { ...request.body, tenantId: request.tenantId, createdBy: request.user._id },
      onFinish: responseHandler(request, reply),
    });
```

`request.tenantId` comes from the tenant-scope guard and is already an
ObjectId, already checked against the caller. Never build it from
`request.params`.

Register it in `controller/index.js`.

### 7. Route row → `app/v1/routes.json`

```json
"createOrder": {
  "path": "/tenant/:tenantId/orders",
  "method": "post",
  "auth": true,
  "roles": ["super-admin", "admin", "member"],
  "tenant": true,
  "validate": true
}
```

The key must match the controller name exactly. A mismatch throws at boot,
naming the route. So does a schema without `validate: true`, or the reverse:
every route that reads params, query or body is `validate: true`.

**`tenant: true` on every tenant-scoped path.** Without it a valid token from
tenant A reads tenant B's data — the role check passes, the query is scoped to
whatever the URL said, and the response is a clean 200.

### 8. Tests

- `api/tests/unit/use-cases/orders.test.js` — rules, with fake repositories from
  `tests/helpers/fakes.js`. Cover: the happy path, each refusal, and a
  repository that throws (it must become `SERVICE_UNAVAILABLE`, never a leaked
  stack).
- Add cases to `api/tests/integration/routes.spec.js` — at minimum: no token →
  401, another tenant → 403, invalid body → 400.

---

## Definition of done

```bash
cd api && npm run lint && npm test && npm run test:integration
```

- [ ] Collection declared in the manifest, not hardcoded.
- [ ] Repository scopes every read by `tenantId` and `deleted: false`.
- [ ] Serializer lists fields explicitly.
- [ ] Use case never sees `request`/`reply`; every path ends in one `onFinish` call.
- [ ] Route row has `tenant: true` if the path contains `:tenantId`.
- [ ] Roles on the row are the narrowest set that works.
- [ ] Integration test proves the cross-tenant refusal.
