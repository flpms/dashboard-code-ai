# 6. The API is a separate deployable, not front-end framework routes

**Status:** accepted

## Context

SvelteKit and Next.js ship a server layer: `+server.js` / `+page.server.js` on
one side, Route Handlers and Server Actions on the other. The question comes up
early in every project — why keep a separate Fastify service if the UI framework
already knows how to talk to the database?

The answer is not about taste, nor about "clean architecture". It is about one
structural property: **in this template, your code is called by your code.**
`api/app/index.js` is the process's `main()`. It decides the start-up order,
builds the dependency graph and hands everything, ready, to the layers.

In the framework model, `main()` belongs to the framework. Your route module is
a *callback* invoked with a signature you do not choose. Everything that follows
— the coupling and the per-invocation lifecycle — comes from that inversion.

## Decision

The API is a separate process, with explicit composition
([ADR 0001](0001-layered-architecture-with-manual-di.md)) and routes as data
([ADR 0002](0002-routes-as-data.md)). SvelteKit's server layer remains available
for the BFF pattern, not for business rules.

## The three models

**A — Separate API** (this template): its own process, one or more consumers.

**B — Backend in the framework**: `+server.js` / Route Handlers reach the
database directly. One deployable.

**C — Hybrid (BFF)**: model A's API still exists; the framework's server layer is
a thin proxy that holds the cookie and calls the API server-side.

### Architecture and maintenance

| Dimension | A — Separate API | B — Backend in the framework | C — Hybrid (BFF) |
| --- | --- | --- | --- |
| Composition | One composition root, explicit, runs once | None: the handler signature is fixed, so dependencies arrive by `import` | The API's, intact; the BFF holds no state |
| Dependency injection | By parameter — visible in the signature | By module — invisible; recoverable through `event.locals` | By parameter, in the API |
| Per-route policy | A row in `routes.json`; boot fails on a mismatch | A global `handle()` re-deriving it from the path — an `if` ladder that **fails open** | The API's |
| Portable business rules | Yes: `{ data, onFinish }` knows nothing of HTTP | No: coupled to `$env/static/private`, `cookies()`, `RequestEvent` | Yes |
| Test double | An object literal; no mocking framework | `vi.mock` of a module, which breaks when the file moves | An object literal |
| Cost of an integration test | The real server over a fake `db`, through `inject()` | Start the dev server or forge a `RequestEvent` | Same as A |
| Where rules tend to live | In use cases, by construction | In the route file, by the framework's gravity | In use cases |

### Operations

| Dimension | A — Separate API | B — Backend in the framework | C — Hybrid (BFF) |
| --- | --- | --- | --- |
| Lifecycle | Explicit boot: validate env, connect, only then serve | Per invocation; state survives only at module scope (`globalThis.__db ??=` in dev) | A's |
| Missing variable | **Refuses to start**, naming the variable | The first request that needs it breaks | A's |
| Connection pool | One per process, sized deliberately | N isolates × pool; what drives PgBouncer, Prisma Accelerate, Neon's HTTP driver | One, in the API |
| Shutdown | `SIGTERM` drains and closes the pool | No reliable hook | A's |
| Health check | Its own endpoint; the deploy waits for green | The platform's, over the UI | A's |
| Operational surface | Two deployables, two pipelines | One | Two |
| Rollback | Change the image tag | Redeploy the whole application | Independent per side |

### Product and team

| Dimension | A — Separate API | B — Backend in the framework | C — Hybrid (BFF) |
| --- | --- | --- | --- |
| Second consumer (mobile, partner, CLI) | Just another client | Becomes maintaining `/api` inside a UI project | Just another client |
| Deploy coupling | None: each side at its own pace | A CSS change redeploys the payment endpoint | None |
| CORS | Needs an allow-list | Does not exist | Not in the browser; the API talks only to the BFF |
| Types across the boundary | Duplicated (Joi in the API, Zod on the web) | Shared for free | Duplicated |
| Request waterfall | The SPA fetches after mounting | Server `load` removes it | Server `load` removes it |
| Token in the browser | In `localStorage`, readable by JavaScript | httpOnly cookie | httpOnly cookie |
| Small team, one app | Real cost: two of everything | Real advantage: fewer parts | Intermediate cost |
| As it grows | Grows without a rewrite | The rewrite arrives with the second consumer | Grows without a rewrite |

## How to choose

| If… | Model |
| --- | --- |
| There is (or will be within 12 months) a second consumer | **A** or **C** |
| Authorization is multi-tenant or role-based in a non-trivial way | **A** or **C** — per-route policy must be data, not a path `if` |
| The backend needs jobs, queues, a warm cache or a sized pool | **A** |
| Backend and UI need different deploy cadences | **A** |
| SEO or first paint matter, and the API already exists | **C** |
| The token must not be readable by JavaScript | **C** |
| One consumer, one team, CRUD, no mobile and no partner | **B** — co-location is a real gain, not laziness |
| A prototype where two deployables cost more than the coupling | **B** |

## Consequences

- Two pipelines, two `package.json`, two `npm ci`. That is the price, and it is
  paid in [`docs/DEPLOY.md`](../DEPLOY.md).
- Validation rules exist twice — Joi in the API, Zod on the web. Deliberately:
  the client copy is for feedback, the server copy is the one that protects the
  database.
- No SSR today. The app is an authenticated dashboard: nothing to index, nothing
  to prerender. If that changes, the path is **C**, not **B** — the BFF is added
  without touching the API.
- If the project is genuinely of type **B**, most of this architecture still
  applies: layers under `src/lib/server/` (the Kit's Vite plugin refuses to import
  them from the client — real enforcement, better than a lint rule), a memoised
  container hung on `event.locals` in `handle()` to bring back injection by
  parameter, use cases kept as `{ data, onFinish }`, and the policy table keyed
  by `event.route.id` (the filesystem pattern, stable), never by `url.pathname`.

  What cannot be recovered: failing at boot, draining on `SIGTERM`, a single pool,
  and a route table that cannot silently diverge from the directory tree.
