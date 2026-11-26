---
name: architecture-review
description: Review a change against this repository's layer rules, security invariants and style before it is merged. Use before opening a pull request, when asked to review a diff or check architecture adherence, or when deciding where a new piece of code belongs.
---

# Architecture review

Read `docs/ARCHITECTURE.md`, `api/ARCHITECTURE.md` and `web/ARCHITECTURE.md` for
the reasoning. This is the checklist.

---

## Step 1 — Which layer did it land in?

```bash
git diff --name-only origin/main...HEAD
```

Group the files by layer and ask, per file: does this file now know something it
should not?

**API**

| Layer | May know about | Must never |
| --- | --- | --- |
| `routes.json` | route names, flags | contain logic |
| Controller | `request`, `reply`, use cases | business rules, Mongo |
| Use case | repositories, services, serializers | `request`, `reply`, HTTP status codes |
| Repository | one collection | business rules, HTTP |
| Service | one external system | domain rules |
| Schema | Joi only | anything from the app |

**Web**

| Layer | May know about | Must never |
| --- | --- | --- |
| Page | everything below + session | contain raw `fetch` |
| Panel | components, props | services, stores, HTTP |
| Service | `ApiClient` | stores, other services, mutable state |
| Schema | Zod only | anything from the app |

A misplaced file is worth fixing before merge. It is what turns "add a field"
into a four-file archaeology exercise a year later.

---

## Step 2 — Security invariants

These are the ones that fail quietly, so check them explicitly.

- [ ] **Every route with `:tenantId` has `tenant: true`.** Without it, a valid
      token from tenant A reads tenant B — role passes, query is scoped to the
      URL, response is a clean 200.
      ```bash
      node -e "const r=require('./api/app/v1/routes.json');Object.entries(r).filter(([,v])=>v.path.includes(':tenantId')&&!v.tenant).forEach(([k])=>console.log('MISSING tenant:true ->',k))"
      ```
- [ ] **`roles` is the narrowest set that works.** Not the set that was easiest
      to paste.
- [ ] **Every route that reads input is `validate: true`.** Validation is what
      strips undeclared fields; without it `request.body` is the raw payload.
- [ ] **A guard that refuses returns the reply.** Without the `return`, Fastify
      runs the next hook.
- [ ] **Repository reads are scoped by `tenantId` and `deleted: false`.**
- [ ] **The response goes through a serializer.** Returning a raw document ships
      whatever field was added last.
- [ ] **No 5xx body carries a message from an exception.** Detail goes to the log.
- [ ] **No secret has a `PUBLIC_` prefix**, and no secret is logged.
- [ ] **Auth refusals are indistinguishable** — unknown user and wrong password
      answer the same thing, or the endpoint is a user-enumeration tool.
- [ ] **New environment variables are in the manifest**, not read ad hoc from
      `process.env`.

---

## Step 3 — Style

Run the `code-style` skill's checklist. The mechanical parts:

```bash
cd api && npm run lint && npm test && npm run test:integration
cd ../web && npm run lint && npm run check && npm test
```

`npm run check` must report **0 errors**. Anything else and the type annotations
stop being trusted, which is how a project ends up with seventy of them.

By eye:

- [ ] No `else`; guards are early returns.
- [ ] No `if`/`switch` chain choosing among known values — that is a table.
- [ ] No `class`, no reaching for dependencies, no mutated arguments.
- [ ] Comments explain *why*, not *what*.

---

## Step 4 — Tests

- [ ] Each new use case has a test for the happy path, **each refusal**, and a
      repository that throws.
- [ ] A new tenant-scoped route has an integration case proving the cross-tenant
      403. One tenant in every test is how this class of bug survives a green suite.
- [ ] A new component has a test for its empty state and one interaction.
- [ ] No test asserts on a log line or a private helper.

---

## Step 5 — The reviewer's questions

1. If this breaks in production at 03:00, what does the log say, and is it enough?
2. What happens on the second call? On a slow database? On a 500 from the API?
3. Which of these branches would a table replace?
4. Is anything here duplicated from a file three directories away?
5. Does anything new read `process.env`, a store, or a module-level singleton?
