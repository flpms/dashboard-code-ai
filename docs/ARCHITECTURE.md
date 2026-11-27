# Architecture

Two apps in one repository: a local collector (Node/Fastify on SQLite) that
receives Claude Code hooks and transcripts, Docker events, file changes and
`npm audit` results, and a SvelteKit dashboard that draws them live. They share no code and no build — only a
contract, and the conventions in this document.

```
Claude Code ── HTTP hooks ──┐
Claude Code ── transcripts ─┤
docker events ──────────────┼──► api/  collector ── SSE + REST ──► web/  dashboard
file watcher ───────────────┤          SQLite (append-only log)
npm audit ──────────────────┘
```

In production (`npm start` or Docker) they are one process: the collector
serves the built dashboard at `/` (`WEB_ROOT`), so the page calls the origin
that served it. In development they are two, and the dashboard reaches the
collector through `PUBLIC_API_URL` and the CORS allow-list.

Details per side: [`api/ARCHITECTURE.md`](../api/ARCHITECTURE.md),
[`web/ARCHITECTURE.md`](../web/ARCHITECTURE.md).

---

## The six ideas

### 1. Layers, with a one-way dependency rule

Each layer knows only the one beneath it. The rule is not aesthetic: it is what
makes a change local. Swapping Mongo for SQLite touched repositories only. Swapping
REST for GraphQL touches controllers. Neither touches the rules in between.

```
API   routes.json → guards → validation → controller → use case → repository → database
Web   page        → panel      → service    → schema
```

### 2. Dependencies are arguments

Every unit is a factory function that receives its collaborators:

```javascript
export const ItemsRepository = ({ db, collections, logger }) => ({ /* ... */ });
```

There is exactly one composition root per app — `api/app/config/index.js`, and
the page component on the web. Nothing else imports a connection, reads
`process.env`, or reaches for a global.

The payoff is testing: a fake is a plain object. The API's test suites run with
no database, no network and no mocking framework.

### 3. Behaviour is data

Routes are rows in `routes.json`. Guard chains, HTTP outcomes, status messages,
UI variants and status labels are all lookup tables. Adding a case is adding a
row; the control flow never grows.

See the [`code-style`](../.claude/skills/code-style/SKILL.md) skill.

### 4. Local by construction

The collector sees every command, path and output an agent produces. It binds to
`127.0.0.1`, and every route carries `local: true`, which refuses any caller that
is not loopback even if someone binds it to `0.0.0.0`
([ADR 0008](adr/0008-local-collector-with-sqlite.md)).

The event log is append-only. The dashboard never stores session state of its
own: it re-derives what it draws from the log, so a reconnect is "fetch what I
missed", never "reconcile two copies".

### 5. Fail at boot, not at the first request

A missing environment variable, a route without a controller, a `validate` flag
without a schema, a schema without the flag: the API refuses to start and names
the cause. A mistake found at boot is found by the deploy; one found by a
request is found by a user.

### 6. Explicit boundaries, both ways

Nothing enters without a schema, and undeclared fields are stripped before a
controller sees the request. Nothing leaves without a serializer. Nothing secret
reaches the browser: every `PUBLIC_` variable is compiled into the bundle.

---

## Cross-cutting conventions

| Concern | Decision |
| --- | --- |
| Language | JavaScript + ESM. Types via JSDoc, checked by `svelte-check` on the web. |
| HTTP server | Fastify 5. Guards are `onRequest` hooks; validation is Fastify's own phase ([ADR 0007](adr/0007-fastify-over-express.md)). |
| Access | No accounts and no tokens: every route is `local: true` and refuses any caller that is not loopback ([ADR 0008](adr/0008-local-collector-with-sqlite.md)). |
| Validation | Joi on the API (hook payloads are untrusted; undeclared fields are stripped), Zod on the web (events from the stream are checked before they are drawn). |
| Storage | SQLite through `node:sqlite`, append-only `events` table, every value bound with `?`. Nothing is updated or deleted. |
| Live updates | Server-Sent Events on `/v1/stream`. A reconnecting page asks for events after the last sequence number it has. |
| Errors | Use cases pick a named outcome; only `response-handler.js` knows status codes. 5xx bodies say nothing specific. |
| Outside processes | `docker events`, `npm audit` and the file and transcript watchers are injected services; a spawned process gets an argument array and a timeout, and its output is parsed in `v1/domain/`. |
| Claude Code settings | The collector writes only its own hooks into `settings.json`, keeps a `.bak`, and never overwrites a file it cannot parse. |
| Config | One manifest per app; `process.env` is read in one file ([ENVIRONMENT.md](ENVIRONMENT.md)). |
| Logging | Winston; Fastify's logger is off. Every use case and service logs its own name. |
| Feedback | Every load shows loading, failure and empty. |

---

## How an event travels

1. **Arrives.** Claude Code posts a hook to `POST /v1/hooks`, or the transcript
   watcher reads a new line from `~/.claude/projects/**/*.jsonl` and turns it
   into the payload the hook would have carried. Docker, the file watcher and
   `npm audit` produce their own events.
2. **Is checked.** The loopback guard runs before the body is read; Joi
   (`collector.schema.js`) validates and strips the payload.
3. **Is normalised.** `v1/domain/hook-normalizer.js` maps the hook to one or
   more events with a `kind` (`tool.start`, `tool.end`, `agent.start`,
   `test.result`, `file.change`, …). Pure functions, no I/O.
4. **Is stored.** The repository appends it to SQLite with a sequence number.
   A session that sends hooks is not read again from its transcript.
5. **Is announced.** The event bus pushes it to every open `/v1/stream`.
6. **Is drawn.** The page appends it to the session's event log and the
   dashboard re-derives everything it shows with `buildSessionModel(events)`
   (`web/src/lib/utils/session-model.js`). Components never keep their own copy.

---

## Repository layout

```
.
├── api/                  the collector (Fastify + SQLite)
│   ├── app/
│   │   ├── config/       composition root + environment manifest
│   │   ├── enums/        frozen constant tables
│   │   ├── lib/          route processor, validation, response handler, event bus, logger
│   │   ├── services/     hooks installer, transcript, file and Docker watchers, npm audit
│   │   ├── v1/           routes.json + guards + controller, use cases, repositories,
│   │   │                 serializers, schemas, domain (pure parsing)
│   │   ├── dashboard.js  serves the built dashboard when WEB_ROOT is set
│   │   └── server.js     the Fastify instance, not yet listening
│   ├── scripts/          hooks.js (install/uninstall), demo-session.js
│   └── tests/            unit + integration, fixtures from real tool output
├── web/                  the dashboard (SvelteKit SPA)
│   ├── src/lib/          components · panels · services · schemas · utils
│   ├── src/routes/       the dashboard page
│   └── e2e/              Playwright
├── docs/                 this file, environment, testing, ADRs
├── Dockerfile, docker-compose.yml
├── CHANGELOG.md          what changed, per pull request
├── CONTRIBUTING.md       pull request rules and which doc to update
└── .claude/skills/       the conventions, as skills an agent will follow
```

---

## Working here

**Branches** are `<type>-<short-description>`, lowercase, single hyphens:
`feat-orders-export`, `fix-signed-url-expiry`, `ci-cache-npm`. Types: `feat`,
`fix`, `ci`, `docs`, `refactor`. No slashes, no other prefixes.

**Done** means `npm run verify` is green — lint, type check at 0 errors, every
unit and integration suite — and the pull request carries its `CHANGELOG.md`
entry and the doc updates it needs ([CONTRIBUTING.md](../CONTRIBUTING.md)).

**Deviations.** When code breaks a rule here on purpose, write it down next to
the rule it breaks: *what* breaks it, *why* the rule did not fit, the *interim
solution* and its limits, and *when to reconcile*. Close with "do not add a
second exception without revisiting this note". One documented exception is a
trade-off; two undocumented ones are a second architecture.

---

## Decisions and their reasons

Recorded as ADRs in [`docs/adr/`](adr/). The short list:

| # | Decision | Why |
| --- | --- | --- |
| [0001](adr/0001-layered-architecture-with-manual-di.md) | Layers with manual DI | Testability without a framework; the dependency list is the signature. |
| [0002](adr/0002-routes-as-data.md) | Routes as data | One place decides how a flag becomes behaviour; boot fails on a mismatch. |
| [0003](adr/0003-tenant-isolation-in-middleware.md) | Tenant scope as a guard | *Superseded by 0008*: the collector has no tenants. Kept for the reasoning. |
| [0004](adr/0004-environment-manifest.md) | One environment manifest | Removes the class of bug where a deploy forgets a variable the code reads. |
| [0005](adr/0005-javascript-with-jsdoc-types.md) | JSDoc types, not TypeScript | Type checking without a build step, at a level the team will actually keep green. |
| [0006](adr/0006-separate-api-deployable.md) | API as a separate deployable | The framework owns `main()` in a SvelteKit/Next backend, so there is no composition root and route policy stops being data. Includes the full trade-off tables for all three models. |
| [0008](adr/0008-local-collector-with-sqlite.md) | Local collector on SQLite | The data is one developer's own sessions; setup must be one command. Auth, tenancy and the server deploy are gone. |
| [0007](adr/0007-fastify-over-express.md) | Fastify, not Express | The request lifecycle enforces the guard → validation order, validation strips input before the handler, and the error handler has no arity trap. |
