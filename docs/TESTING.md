# Testing

```bash
npm run verify            # everything, from the repository root

cd api  && npm test                 # unit, with coverage
        && npm run test:integration # real server over in-memory SQLite
cd web  && npm test                 # Vitest
        && npm run test:e2e         # Playwright against the built app
```

---

## API

**Unit** — `api/tests/unit/`, Node's built-in runner. No framework, no database,
no network: every unit already receives its collaborators, so a double is a plain
object from `tests/helpers/fakes.js`.

```javascript
const { collector, published } = buildCollector();
const { onFinish, last } = captureOutcome();

await collector.ingestHook({ data: hook('SessionStart'), onFinish });

assert.equal(last().name, 'NO_CONTENT');
assert.equal(published[0].kind, 'session.start');
```

Parsing in `v1/domain/` (hook normaliser, transcript lines, `npm audit`, test
summaries, `docker events`) is tested against real samples of the tool's output
kept in `tests/fixtures/`. Services that touch the disk, such as the hooks
installer and the transcript watcher, get a temporary folder as `CLAUDE_HOME`,
never the real `~/.claude`.

Cover, for every use case: the happy path, **each refusal**, and a repository
that throws — the last must become `SERVICE_UNAVAILABLE`, never a leaked stack.

Guards are called directly with a fake request and `fakeReply()`; a guard that
lets the request through leaves `reply.sent` false.

**Integration** — `api/tests/integration/routes.spec.js` boots the real `Server`
(`app/server.js`) over an in-memory SQLite database and drives it with
`app.inject()`, plus one real socket for the event stream. This is what catches the mistakes a unit test structurally cannot
see:

- a controller renamed out from under its route row;
- a schema that no longer matches its route;
- guards registered in the wrong order — a caller from another machine must get
  a 403 before its body is read, not a 400;
- an undeclared field reaching the stored event;
- **the loopback refusal** — the same request from a non-loopback address.

That last case deserves its own line for every new route. A suite that only
ever calls from `127.0.0.1` will pass while the route leaks.

---

## Web

**Unit** — Vitest + jsdom. Services are tested with an injected `fetchImpl`, so
nothing hits the network:

```javascript
const client = fakeClient();
await SessionsService(client).events('a/b', { after: 7 });
expect(client.get).toHaveBeenCalledWith('/v1/sessions/a%2Fb/events?after=7');
```

`buildSessionModel` is the heart of the dashboard: every instrument is a field it
derives, so a new instrument starts with a test in `session-model.test.js`
built from a literal event log.

**Components** — Testing Library. Query by role and label; assert what a user
sees. Never assert on a class name — that tests Tailwind, not the component.

Every panel deserves two tests: the empty state renders, and one interaction
calls the right callback with the right argument.

**E2E** — Playwright, against `npm run build && npm run preview`, not the dev
server: a bug that only appears after bundling is exactly what a smoke test is
for. Stub the API with `page.route` so the suite stays deterministic.

---

## What not to test

- Log lines. They change, and asserting on them makes logging costly.
- Private helpers. Test them through the exported function that uses them.
- Framework behaviour. Svelte renders; Fastify routes. Test your code.

## Coverage targets

Services ≥ 80 %, schemas ≥ 90 %, utilities ≥ 80 %, overall ≥ 70 %. Targets, not
gates: a number reached by asserting nothing is worse than a lower honest one.
