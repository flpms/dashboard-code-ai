# API architecture

The collector. Node 24+, Fastify 5, SQLite through `node:sqlite`, Joi. ES
modules. No build step: what you read is what runs.

It receives Claude Code's HTTP hooks, watches Docker, the session folder and
the project's dependencies, stores everything as an append-only event log, and
streams it to the dashboard over Server-Sent Events. It runs on the developer's
machine and answers only to that machine.

---

## Request lifecycle

Fastify's lifecycle is the layer order. The guard runs as an `onRequest` hook,
before the body is read; validation is Fastify's own phase, after it.

```
HTTP request
   │
   ├─ @fastify/helmet    security headers
   ├─ @fastify/cors      origin allow-list, built once at boot
   ├─ routing            no match → the not-found handler, JSON 404
   │
   ├─ onRequest  (built from routes.json by lib/route-processor.js)
   │     └─ requireLoopback      local: true     → is this machine calling?
   │
   ├─ body parsing       5 MB ceiling → 400 · 413 · 415
   ├─ validation         validate: true → Joi replaces params, query and body
   │
   ├─ CONTROLLER   request → { data, onFinish }
   ├─ USE CASE     rules; picks exactly one outcome
   ├─ REPOSITORY   one table, prepared statements
   ├─ SERIALIZER   the shape the API promises
   │
   ├─ onResponse         access log (lib/access-log.js)
   └─ error-handler.js   anything thrown or rejected above
```

The guard precedes parsing on purpose: a caller from another machine never
gets as far as making the server read a body.

---

## Layers

### `app/v1/routes.json`: the routing table

```json
"ingestHook": {
  "path": "/hooks",
  "method": "post",
  "local": true,
  "validate": true
}
```

The key is the name of the controller, the schema and the use case.

`lib/route-processor.js` turns each flag into an `onRequest` guard through a
lookup table, in a fixed order, and registers the row with `app.route()`. Adding
a capability is a key in that table, not an `if`. It throws at boot, naming the
route, when a row has no controller, an unknown method, `validate: true` without
a schema, or a schema without `validate: true`.

**Every route is `local: true`.** The events hold every command, path and
prompt an agent touched. `HOST` defaults to `127.0.0.1`, and the guard is the
second wall for the day someone binds to `0.0.0.0`.

### `app/v1/schemas/`: validation

Joi, keyed by route name then method. `lib/request-validation.js` plugs Joi in as
Fastify's validator compiler (`abortEarly: false`, `stripUnknown: true`), and
Fastify **replaces** `request.params`, `request.query` and `request.body` with
what Joi returns: coerced, defaulted, and stripped of every undeclared field.

Hook payloads are untrusted input. `collector.schema.js` declares only the
fields the collector reads, each string bounded; whatever else Claude Code
sends is dropped before the controller runs.

### `app/v1/controller/`: translation

Read the validated request, call the use case, pass `onFinish`, return what it
returns. Nothing else. `streamEvents` is the one exception: an SSE stream never
finishes, so it takes the socket over with `reply.hijack()`, writes what the
event bus publishes, keeps the connection alive every 15 s, and unsubscribes
when the browser leaves.

### `app/v1/use-cases/`: the rules

Receives `{ data, onFinish }`, calls exactly one outcome and returns it. Never
sees `request` or `reply`, which is what lets the watchers feed the same
`Collector` (`recordDockerLine`, `recordFileChange`, `recordAudit`) without
HTTP.

Expected refusals are outcomes. Unexpected failures become
`SERVICE_UNAVAILABLE` with a generic message; the exception goes to the log
with the use-case name (`Collector::ingestHook`).

### `app/v1/domain/`: pure logic

No I/O, no dependencies, fully unit-tested: turning a hook into events
(`hook-normalizer.js`), naming a tool's category, reading a test runner's
summary line, parsing a `docker events` line or an `npm audit` report. Anything
that is "given this text, what happened?" lives here.

### `lib/response-handler.js`: the only place that knows status codes

A table of outcome → `{ status, kind }`. Successes send the payload and log at
`info`; failures send `{ message }` and log at `warn`. Every writer returns the
`reply`, so an async handler that returns it cannot answer twice.

### `app/v1/repositories/`: data access

One table each, every query a prepared statement built once, every value bound
with `?`. `events` is append-only: a session is a log, and the dashboard is a
projection of it (`buildSessionModel` in `web/`). `sessions` is a summary kept
beside it so the session list is one indexed read.

The schema lives in `app/config/db.config.js` as `CREATE … IF NOT EXISTS`
statements, run at every boot. There is no migration tool, so every statement
must be safe on an existing file.

### `app/v1/serializers/`: the public shape

Explicit field lists, camelCase out. What is not listed does not leave the
process.

### `app/services/`: the outside world

One module per source, and the only place that spawns a process or touches the
file system: `docker-watcher` (`docker events`), `file-watcher` (chokidar on
each session's folder) and `security-auditor` (`npm audit --json`, coalesced
per folder). Each takes `spawn`, `watch` or `existsSync` as an argument, so the
tests drive them with fakes, and each has an `enabled` flag from the
environment.

---

## Composition root, server and process

`app/config/index.js` (`StartupConfig`) builds everything once, in order:
environment → logger → database → event bus → services → dependency object.
Then `v1/index.js`, a Fastify plugin mounted at `/v1`, wires the layers and
starts the watchers:

```javascript
const repositories = Repositories(dependencies);
const useCases = UseCases({ ...dependencies, repositories, serializers: Serializers, services });

services.dockerWatcher.start(useCases.recordDockerLine);
services.fileWatcher.start(useCases.recordFileChange);
services.securityAuditor.start(useCases.recordAudit);
```

The watchers stop in the plugin's `onClose`.

`app/server.js` builds the Fastify instance (helmet, CORS, validator compiler,
access log, error handler, then `/v1`) and **does not listen**. The integration
test boots exactly this object. Fastify's own logger is off: Winston is the one
logger.

When `WEB_ROOT` is set (`npm start` and the Docker image set it), `server.js`
also registers `app/dashboard.js`: the built dashboard served at `/`, behind the
same loopback guard, with a content security policy that allows exactly the
hash of SvelteKit's inline boot script. One process, one origin, no CORS.

`app/index.js` is the process. It listens on `HOST` (default `127.0.0.1`) and
`PORT` (default `4317`), and on `SIGTERM` closes Fastify, which lets in-flight
requests finish, before closing the database file.

---

## Attribution

Hooks carry `session_id` and `agent_id`, so tool calls land on the right agent
without guessing. The watchers do not, so the collector attributes what they
see by heuristics, kept in `use-cases/collector.js`:

- A subagent's parent is the latest `Agent`/`Task` call not yet claimed.
- A container belongs to the session whose `docker …` or test command started
  in the 2 minutes before it; failing that, to the most recent active session.
- A file change the watcher sees within 3 s of a tool edit to the same path is
  the echo of that edit, and is skipped.

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
refusals, `info` for lifecycle and the access line, `verbose` for flow, `debug`
for stacks. Never log a hook's prompt or tool input at `info`: they can hold
anything the person typed.

---

## Environment

`app/config/env.manifest.js` declares every variable: kind, fallback and why it
exists. Nothing is required; the collector starts with no `.env` at all.
`env.config.js` is the only reader of `process.env`, and a unit test fails when
`.env.example` is missing a name.

---

## Testing

```bash
npm test              # unit, with coverage
npm run test:integration
```

- **Unit**: fakes from `tests/helpers/fakes.js` (`fakeLogger`, `fakeReply`,
  `captureOutcome`, `fakeClock`, `fakeFileWatcher`, `fakeSecurityAuditor`) and
  an in-memory SQLite database (`tests/helpers/collector.js`). No network, no
  mocking framework: every unit already takes its collaborators as arguments.
- **Integration**: `tests/integration/routes.spec.js` boots the real `Server`
  and drives it with `app.inject()`: no port, no network. This is what catches
  wiring mistakes (a renamed controller, a schema that no longer matches its
  route) and it proves the 403 for a caller that is not this machine.
