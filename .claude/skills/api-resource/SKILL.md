---
name: api-resource
description: Add a complete REST resource to the API — route row, schema, controller, use case, repository, serializer and tests. Use whenever a new endpoint or a new table is needed in api/, or when asked to "add a resource", "create an endpoint", or "expose X in the API".
---

# Adding a resource to the collector

The API is a local collector: one SQLite file (`node:sqlite`), no accounts, no
tenants. The only caller allowed is this machine, and that is enforced per route.

Seven steps, always in this order. Going bottom-up means every layer you write
has something real underneath it. The running example is `markers`: notes a
person pins on a session's timeline. `sessions` is the real resource to copy
from; `grep -rl "sessions\|Sessions" api/app` lists the files to mirror.

---

## Order of work

### 1. Table → `app/config/db.config.js`

Add the `CREATE TABLE IF NOT EXISTS` (and its index) to the `SCHEMA` array.
Every statement must be safe to run on an existing file: the collector opens
the same database across upgrades, and there is no migration tool.

```javascript
`CREATE TABLE IF NOT EXISTS markers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  label TEXT NOT NULL
)`,
'CREATE INDEX IF NOT EXISTS markers_session ON markers (session_id, ts)',
```

`events` is append-only: the dashboard is a projection of it. If the new data
is something that *happened* in a session, prefer a new event `kind` over a new
table, and derive it in `buildSessionModel`.

### 2. Repository → `app/v1/repositories/markers.repository.js`

Thin. Prepared statements built once, plain functions out. No business rules,
no SQL anywhere else.

```javascript
export const MarkersRepository = ({ db, logger }) => {
  logger.info('Start Table - markers');

  const statements = {
    insert: db.prepare('INSERT INTO markers (id, session_id, ts, label) VALUES (?, ?, ?, ?)'),
    bySession: db.prepare('SELECT id, session_id, ts, label FROM markers WHERE session_id = ? ORDER BY ts'),
  };

  return {
    insert: ({ id, sessionId, ts, label }) => statements.insert.run(id, sessionId, ts, label),
    listBySession: sessionId => statements.bySession.all(sessionId),
  };
};
```

Always bind values with `?`. A string built into SQL is an injection the day a
path or command from a hook reaches it.

Register it in `repositories/index.js`.

### 3. Serializer → `app/v1/serializers/marker.serializer.js`

The shape the API promises, camelCase. Fields not listed here do not leave the
process, which is what stops a new internal column leaking the day it is added.

Register it in `serializers/index.js`.

### 4. Use case → `app/v1/use-cases/markers.js`

Business rules. Receives `{ data, onFinish }`, calls exactly one outcome.
Time and ids come from injected `clock` and `randomUUID`, so tests control them.

```javascript
export const Markers = ({ clock, enums: { HTTP_MESSAGES }, Logger, randomUUID, repositories, serializers }) => {
  const createMarker = async ({ data, onFinish }) => {
    try {
      const marker = { id: randomUUID(), ts: clock(), ...data };
      repositories.markersRepository.insert(marker);
      return onFinish.CREATED(serializers.serializeMarker(marker));
    } catch (error) {
      Logger.error(`Markers::createMarker - ${error.message}`);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  return { createMarker };
};
```

Never touches `request` or `reply`, and returns the outcome it called. If the
change should appear live, publish it on the `eventBus` the way `Collector`
does. Register it in `use-cases/index.js`.

### 5. Schema → `app/v1/schemas/markers.schema.js`

Keyed by **route name**, then by method. Reuse `schemas/commons/index.js`
(`sessionId`, `sessionParams`). Declare only the fields you read: validation
runs with `stripUnknown`, so everything else is dropped before the controller.

```javascript
export const MarkersSchema = Joi => ({
  createMarker: {
    post: {
      params: sessionParams(Joi),
      body: Joi.object({ label: Joi.string().min(1).max(200).required() }),
    },
  },
});
```

Bound every string with `.max()`. Hook payloads and anything else a local
process posts are untrusted input.

Register it in `schemas/index.js`. Duplicate route names throw at boot.

### 6. Controller → `app/v1/controller/markers.controller.js`

Translation only. `request.body`, `request.query` and `request.params` are
already the validated values: Fastify replaced them with what the Joi schema
returned, coerced and stripped. That holds only on a route marked
`validate: true`.

```javascript
const createMarkerController =
  ({ createMarker, responseHandler }) =>
  (request, reply) =>
    createMarker({
      data: { ...request.body, sessionId: request.params.sessionId },
      onFinish: responseHandler(request, reply),
    });
```

Register it in `controller/index.js`.

### 7. Route row → `app/v1/routes.json`

```json
"createMarker": {
  "path": "/sessions/:sessionId/markers",
  "method": "post",
  "local": true,
  "validate": true
}
```

The key must match the controller name exactly. A mismatch throws at boot,
naming the route. So does a schema without `validate: true`, or the reverse:
every route that reads params, query or body is `validate: true`.

**`local: true` on every route, no exceptions.** It runs the loopback guard,
which answers 403 to any caller that is not this machine. The collector holds
every command, path and prompt an agent touched; a route without the flag is
that history open to the network the moment someone sets `HOST=0.0.0.0`.

### 8. Tests

- `api/tests/unit/use-cases/markers.test.js`: rules, over an in-memory database
  (`DB_PATH=:memory:`, see `tests/helpers/collector.js`) or fakes from
  `tests/helpers/fakes.js`. Cover the happy path, each refusal, and a
  repository that throws (it must become `SERVICE_UNAVAILABLE`, never a leaked
  stack).
- Add cases to `api/tests/integration/routes.spec.js`: at minimum, a
  non-loopback caller gets 403 and an invalid body gets 400.

---

## Definition of done

```bash
cd api && npm run lint && npm test && npm run test:integration
```

- [ ] Table created with `IF NOT EXISTS`, or the data is an event kind instead.
- [ ] Every SQL value is bound with `?`; no SQL outside the repository.
- [ ] Serializer lists fields explicitly.
- [ ] Use case never sees `request`/`reply`; every path ends in one `onFinish` call.
- [ ] Route row has `local: true`.
- [ ] Schema declares only the fields read, every string bounded.
- [ ] Integration test proves the non-loopback 403.
