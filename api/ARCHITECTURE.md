# API architecture

Node 24+, Fastify 5, MongoDB, Joi. ES modules. No build step: what you read is
what runs.

---

## Request lifecycle

Fastify's lifecycle is the layer order. The guards run as `onRequest` hooks,
before the body is read; validation is Fastify's own phase, after them.

```
HTTP request
   │
   ├─ @fastify/helmet    security headers
   ├─ @fastify/cors      origin allow-list, built once at boot
   ├─ routing            no match → the not-found handler, JSON 404
   │
   ├─ onRequest  (built from routes.json by lib/route-processor.js)
   │     ├─ requireAuthToken     auth: true      → who is calling
   │     ├─ permissions(roles)   roles: [...]    → may they, at all
   │     └─ requireTenantScope   tenant: true    → may they, here
   │
   ├─ body parsing       5 MB ceiling → 400 · 413 · 415
   ├─ validation         validate: true → Joi replaces params, query and body
   │
   ├─ CONTROLLER   request → { data, onFinish }
   ├─ USE CASE     rules; picks exactly one outcome
   ├─ REPOSITORY   one collection, scoped by tenant
   ├─ SERIALIZER   the shape the API promises
   │
   ├─ onResponse         access log (lib/access-log.js)
   └─ error-handler.js   anything thrown or rejected above
```

The order is not incidental. Authentication precedes authorization, and
authorization precedes validation: an unauthenticated caller must never learn
which fields a schema expects — and, because the guards run before parsing,
cannot make the server read a 5 MB body either.

---

## Layers

### `app/v1/routes.json` — the routing table

```json
"createItem": {
  "path": "/tenant/:tenantId/items",
  "method": "post",
  "auth": true,
  "roles": ["super-admin", "admin", "member"],
  "tenant": true,
  "validate": true
}
```

The key is the name of the controller, the schema and the use case.

`lib/route-processor.js` turns each flag into an `onRequest` guard through a
lookup table, in a fixed order, and registers the row with `app.route()`. Adding
a capability is a key in that table, not an `if`. It throws at boot, naming the
route, when a row has no controller, an unknown method, `validate: true` without
a schema, or a schema without `validate: true` — never a silent 404 or an
unvalidated body in production.

### `app/v1/schemas/` — validation

Joi, keyed by route name then method. `lib/request-validation.js` plugs Joi in as
Fastify's validator compiler (`abortEarly: false`, `stripUnknown: true`), and
Fastify **replaces** `request.params`, `request.query` and `request.body` with
what Joi returns: coerced, defaulted, and stripped of every undeclared field. A
field nobody declared never reaches a Mongo document.

A route that reads input must be `validate: true`. Outside production the 400
carries `details` (`body.name: "name" is required`); in production it does not.

### `app/v1/controller/` — translation

Read the validated request, take the tenant from `request.tenantId`, convert
ids, call the use case, pass `onFinish`, return what it returns. Nothing else. A
controller with an `if` about business meaning has a rule in the wrong layer.

### `app/v1/use-cases/` — the rules

Receives `{ data, onFinish }`, calls exactly one outcome and returns it. Never
sees `request` or `reply`, which is what would let the same function run from a
queue worker or a CLI without a rewrite.

Expected refusals are outcomes (`NOT_FOUND`, `CONFLICT`). Unexpected failures
become `SERVICE_UNAVAILABLE` with a generic message; the exception goes to the
log with the use-case name (`Items::createItem`).

### `lib/response-handler.js` — the only place that knows status codes

A table of outcome → `{ status, kind }`. Successes send the payload and log at
`info`; failures send `{ message }` and log at `warn`. Every writer returns the
`reply`: Fastify's reply is a thenable that settles once the response is
written, so an async handler that returns it cannot answer twice.

### `app/v1/repositories/` — data access

One collection each. Every read takes `tenantId` as a parameter and applies
`deleted: false`. Explicit rather than closed-over, so a missing scope is
visible in review. Deletion is soft (`deleted`, `deletedAt`, `deletedBy`), and
updates append to the history collection.

### `app/v1/serializers/` — the public shape

Explicit field lists. What is not listed does not leave the process — which is
what stops a new internal column leaking the day it is added.

### `app/services/` — external systems

One module per system, and the only place that knows the vendor. Swapping S3 for
R2 for MinIO is a change in `storage-file.service.js`. The vendor's vocabulary
ends there: use cases never see a vendor field name.

---

## Composition root, server and process

`app/config/index.js` (`StartupConfig`) builds everything once, in order:
environment → logger → required-variable check → database → services →
dependency object. Then `v1/index.js`, a Fastify plugin mounted at `/v1`, wires
the layers:

```javascript
const repositories = Repositories(dependencies);
const useCases = UseCases({ ...dependencies, repositories, serializers });
const controllers = Controllers({ ...dependencies, ...useCases });
```

Repositories know nothing of use cases; use cases know nothing of HTTP;
controllers know nothing of Mongo. The plugin also declares, with
`decorateRequest`, the three facts the guards publish: `tokenPayload`, `user`,
`tenantId`.

`app/server.js` builds the Fastify instance — helmet, CORS, validator compiler,
access log, error handler, then `/v1` — and **does not listen**. The integration
test boots exactly this object. Fastify's own logger is off: Winston is the one
logger.

`app/index.js` is the process. It listens on `0.0.0.0` (Fastify's default,
`localhost`, is unreachable from outside a container), and on `SIGTERM` closes
Fastify — which stops accepting and lets in-flight requests finish — before
closing Mongo.

---

## Authentication and authorization

Three `onRequest` hooks in `v1/authorization/`, three separate questions.

1. **`check-token.hook`** — is the bearer token valid? Every refusal returns the
   same body and status; telling "expired" from "bad signature" hands an
   attacker an oracle.
2. **`permission.hook`** — does this identity hold one of the route's roles? The
   user is loaded **from the database**, not trusted from the token, so a role
   revoked five minutes ago does not survive in an hour-old token.
3. **`tenant-scope.hook`** — does this identity belong to the tenant in the URL?
   Roles listed in `CROSS_TENANT_ROLES` may cross; everyone else is pinned. The
   checked id lands on `request.tenantId`, and downstream code reads it from
   there, never from `request.params`.

A hook that refuses **returns the reply** (`return reply.code(403).send(…)`):
that is what stops Fastify from running the next hook. A hook that lets the
request through returns nothing.

Skipping step 3 on a `:tenantId` route is the single most damaging mistake
available in this codebase, and the one a single-tenant test suite cannot see.

---

## Errors and logging

`error-handler.js` installs Fastify's not-found handler (JSON 404) and error
handler, which sorts what reached it into three kinds:

| Kind       | Recognised by                           | Response                               |
| ---------- | --------------------------------------- | -------------------------------------- |
| validation | `code === 'FST_ERR_VALIDATION'`         | 400, `details` outside production      |
| client     | a 4xx Fastify set (bad JSON, too large) | that status, Fastify's message         |
| server     | anything else                           | 500, generic message; stack to the log |

Winston levels: `error` for unexpected failures with their location, `warn` for
refusals, `info` for lifecycle, mutations and the access line, `verbose` for
flow, `debug` for stacks. JSON in production; files only when `LOG_PATH` is set.
Never log a token, a password or a secret.

---

## Files and object storage

`services/storage-file.service.js` (upload, signed URL, delete) is wired and
unused. When the project needs uploads, follow one pattern:

- **One endpoint for every file**: `POST /tenant/:tenantId/documents`, where the
  body's `type` picks the bucket and the owner's repository through lookup
  tables, and `id` names the owning record. A new upload domain is a row in each
  table, not a new route, controller and use case.
- Object keys start with the tenant: `{tenantId}/{type}/{ownerId}/{timestamp}-{uuid}-{slug}`.
- The owner stores a **reference** (`{ name, type, size, contentType, storageFile }`)
  in a `documents` map. Look a document up by `type` or `name` among the values —
  never by its map key, which is a sanitised file name.
- **Never store a URL.** Sign on every read; signed URLs expire.
- A single-file type (a logo) replaces the previous entry in the same update; a
  type that needs history moves the previous entry to a history array in that
  same update.
- Parse multipart with `@fastify/multipart` and explicit `fileSize` / `files`
  limits.

---

## Environment

`app/config/env.manifest.js` declares every variable: kind, whether it is
required, its fallback, whether it is secret, and why it exists. Three consumers,
no fourth: `env.config.js`, `StartupConfig`, and `scripts/render-env.js`. A unit
test fails when `.env.example` or the release workflow is missing a name.

The app refuses to boot with a required variable missing, and says which one.

---

## Testing

```bash
npm test              # unit, with coverage
npm run test:integration
```

- **Unit** — fakes from `tests/helpers/fakes.js` (`fakeLogger`, `fakeReply`,
  `captureOutcome`). No database, no network, no mocking framework: every unit
  already takes its collaborators as arguments.
- **Integration** — `tests/integration/routes.spec.js` boots the real `Server`
  over a fake database and drives it with `app.inject()`: no port, no network.
  This is what catches wiring mistakes — a renamed controller, a schema that no
  longer matches its route, guards in the wrong order — and it proves the
  cross-tenant refusal, the 401 that precedes validation, and that an undeclared
  field never reaches the stored document.
