# Testing

```bash
npm run verify            # everything, from the repository root

cd api  && npm test                 # unit, with coverage
        && npm run test:integration # real router over a fake database
cd web  && npm test                 # Vitest
        && npm run test:e2e         # Playwright against the built app
```

---

## API

**Unit** — `api/tests/unit/`, Node's built-in runner. No framework, no database,
no network: every unit already receives its collaborators, so a double is a plain
object from `tests/helpers/fakes.js`.

```javascript
const { onFinish, last } = captureOutcome();

await build({ items: { findOne: async () => ({ _id: id, name: 'dup' }) } })
  .createItem({ data: { tenantId, name: 'dup' }, onFinish });

assert.equal(last().name, 'CONFLICT');
```

Cover, for every use case: the happy path, **each refusal**, and a repository
that throws — the last must become `SERVICE_UNAVAILABLE`, never a leaked stack.

Guards are called directly with a fake request and `fakeReply()`; a guard that
lets the request through leaves `reply.sent` false.

**Integration** — `api/tests/integration/routes.spec.js` boots the real `Server`
(`app/server.js`) over a fake `db` and drives it with `app.inject()` — no port,
no network. This is what catches the mistakes a unit test structurally cannot
see:

- a controller renamed out from under its route row;
- a schema that no longer matches its route;
- guards registered in the wrong order — an anonymous invalid body must be a
  401, not a 400;
- an undeclared field reaching the stored document;
- **the cross-tenant refusal** — a valid token, the right role, the wrong tenant.

That last case deserves its own line in every new resource's tests. A suite that
only ever uses one tenant will pass while the API leaks.

---

## Web

**Unit** — Vitest + jsdom. Services are tested with an injected `fetchImpl`, so
nothing hits the network:

```javascript
const fetchImpl = vi.fn(async () => response(200, { ok: true }));
await ApiClient({ getToken: () => 't', fetchImpl }).get('/v1/items');
expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
```

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
