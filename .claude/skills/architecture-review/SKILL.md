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
| Controller | `request`, `reply`, use cases | business rules, SQL |
| Use case | repositories, services, serializers | `request`, `reply`, HTTP status codes |
| Repository | one table, prepared statements | business rules, HTTP, SQL built from strings |
| Domain (`v1/domain/`) | its input | I/O, dependencies, the clock |
| Service | one outside source (`spawn`, watcher) | domain rules |
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

- [ ] **Every route has `local: true`.** The collector holds every command,
      path and prompt an agent touched; a route without the guard hands that
      history to anyone on the network once `HOST` is not loopback.
      ```bash
      node -e "const r=require('./api/app/v1/routes.json');Object.entries(r).filter(([,v])=>!v.local).forEach(([k])=>console.log('MISSING local:true ->',k))"
      ```
- [ ] **Hook fields are declared before they are read.** A field the normalizer
      uses but `collector.schema.js` does not declare is silently stripped; a
      declared string without `.max()` is an unbounded write to disk.
- [ ] **Every route that reads input is `validate: true`.** Validation is what
      strips undeclared fields; without it `request.body` is the raw payload.
- [ ] **A guard that refuses returns the reply.** Without the `return`, Fastify
      runs the next hook.
- [ ] **Every SQL value is bound with `?`.** Paths and commands come from the
      agent; one interpolated into SQL is an injection.
- [ ] **A spawned process gets an argument array, never a shell string**, and
      a timeout. Its output is parsed in `v1/domain/`, not trusted as-is.
- [ ] **A link built from collected data is `https:` only** (`safeLink` in
      `web/`); an advisory URL or a path is not a safe `href`.
- [ ] **The response goes through a serializer.** Returning a raw document ships
      whatever field was added last.
- [ ] **No 5xx body carries a message from an exception.** Detail goes to the log.
- [ ] **No secret has a `PUBLIC_` prefix**, and no secret is logged.
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
- [ ] A new route has an integration case proving the 403 for a caller that is
      not this machine.
- [ ] New parsing in `v1/domain/` is tested against a real sample of the tool's
      output, kept in `api/tests/fixtures/`.
- [ ] A new component has a test for its empty state and one interaction.
- [ ] No test asserts on a log line or a private helper.

---

## Step 5 — Changelog and docs

- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]`, in the right section,
      saying what the person running the panel will see or have to do. Only a
      change nobody could notice skips it, with the `skip-changelog` label.
- [ ] Every doc the change makes wrong is updated in the same diff — use the
      map in `CONTRIBUTING.md#which-doc-to-update`. Grep the docs for any name
      that was renamed or removed.

---

## Step 6 — The reviewer's questions

1. If this breaks in the middle of someone's session, what does the log say, and is it enough?
2. What happens on the second call? On a burst of hooks? With the collector down (hooks must fail silently)?
3. Which of these branches would a table replace?
4. Is anything here duplicated from a file three directories away?
5. Does anything new read `process.env`, a store, or a module-level singleton?
