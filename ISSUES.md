# Known gaps

What this template deliberately leaves unfinished, and what to do about each.

Nothing here is a bug — everything runs, every test passes. These are the
decisions a template cannot make for you, and the places where the honest answer
is "replace this before it holds real data".

---

## Before production

### 1. Password hashing is a placeholder

`api/app/lib/password.js` uses SHA-256. **That is not an acceptable password
hash** — it is fast, which is exactly what an offline cracker wants.

Replace both functions in that one file:

```bash
cd api && npm i argon2
```

```javascript
import argon2 from 'argon2';

export const hashPassword = plain => argon2.hash(plain);
export const verifyPassword = (candidate, storedHash) =>
  storedHash ? argon2.verify(storedHash, candidate) : Promise.resolve(false);
```

Both become async: `use-cases/auth.js` and `scripts/seed-admin.js` need `await`.
Nothing else changes — that is why they live in one module.

If the project authenticates through passkeys or an identity provider, delete
`password.js`, the `signIn` use case and its route instead.

### 2. There is no refresh token

`signIn` issues one JWT with a fixed lifetime (`JWT_EXPIRES_IN`, default 2h).
When it expires the user signs in again. `ApiClient` notices the 401 and clears
the session, so the failure is graceful — but for a long-lived app it is a poor
experience.

Adding refresh means a second token, a store for revocation, and a rotation
endpoint. Deliberately out of scope: it is a real design decision, not a default.

### 3. No rate limiting

`POST /v1/auth/token` accepts unlimited attempts. Register `@fastify/rate-limit`
on the auth routes at minimum, or handle it at the reverse proxy.

Behind a proxy, set Fastify's `trustProxy` first: without it `request.ip` is the
proxy's address, and a per-IP limit throttles every user at once.

### 4. The seed script prints a password to stdout

`scripts/seed-admin.js` is a bootstrap tool. It generates a password and prints
it once. That is fine for the first account on a fresh install and wrong for
anything else — there is no invite flow, no password reset, no email.

---

## Rough edges

### 5. The API has no type-check gate

The web app runs `svelte-check` under `strict` + `checkJs`, and it reports zero
errors. The API has no equivalent: its safety comes from the integration test
that boots the real router.

Adding a `tsconfig.json` with `checkJs` to `api/` is a contained piece of work
and would catch the same class of mistake. See
[ADR 0005](docs/adr/0005-javascript-with-jsdoc-types.md).

### 6. Adding an environment variable still touches two files

The manifest is the source of truth, but the release workflow's `env:` block
must list each name for GitHub Actions to expose it. There is no way around that
in Actions' syntax.

The gap is caught rather than prevented — and caught on the pull request:
`tests/unit/config/env.manifest.test.js` fails when `.env.example` or
`release-api.yml` does not mention a manifest name. `check-env.js` still fails the
release, naming the variable, if anything slips past. Documented in [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md).

### 7. No database migrations

Mongo is schemaless and the repositories create documents as they go. There is no
migration runner and no index creation. Before the first real deploy, decide
where indexes live — at minimum `{ tenantId: 1, deleted: 1 }` on every collection
and a unique index on `users.email`.

### 8. The history collection is written, never read

`history.repository.js` records every update, and nothing exposes it. It is
there because an audit trail is far cheaper to start than to backfill. Add a
read route when a screen needs it.

### 9. Web state is not cached between screens

Each page fetches what it shows. Simple, correct, and it re-fetches on every
navigation. If that becomes a problem, add a query cache — do not add a global
data store.

### 10. Storage is wired but unused

`services/storage-file.service.js` is complete (upload, signed URL, delete) and
nothing calls it. It is left in because "add file upload" is a common second
week, and because it demonstrates the pattern of isolating a vendor behind one
module. The upload pattern to build on it — one documents endpoint, references
instead of URLs — is in [`api/ARCHITECTURE.md`](api/ARCHITECTURE.md#files-and-object-storage). Delete it and its manifest entries if the project has no files.

---

### 11. Two Dependabot alerts stay open on purpose

**`typescript@7`** — `svelte-check@4.7.6` crashes on it (TypeScript 7 is the Go
port, and the compiler API it exposes is not the one svelte-check loads). Pinned
to `^5.9.3` until svelte-check supports it. Close the PR; revisit when
`svelte-check@5` lands.

**`cookie` (low, development scope)** — reached only through
`@sveltejs/kit`'s own dependency tree. `npm audit --omit=dev` reports zero
vulnerabilities, which is why the Security workflow stays green, and Dependabot
cannot patch it without downgrading `@sveltejs/adapter-static` to 0.0.17. An
`overrides` entry would silence it at the cost of pinning a transitive dependency
of a framework that will fix it on its own schedule. Left alone deliberately.

## Deliberate omissions

Things left out on purpose, listed so nobody spends an afternoon wondering
whether they were forgotten.

| Not here | Why |
| --- | --- |
| TypeScript | JSDoc + `checkJs` gives the checking without a build step ([ADR 0005](docs/adr/0005-javascript-with-jsdoc-types.md)) |
| A component library | `bits-ui`, `shadcn-svelte` and friends are a real choice with real lock-in. Four primitives are enough to start. |
| i18n | Copy is Portuguese, inline. Extracting it before knowing whether a second language is coming is speculative work. |
| A monorepo tool | Two `package.json` files and `npm --prefix` cover it. Turborepo/Nx earn their keep at more packages than this. |
| Server-side rendering | The app is an authenticated dashboard: nothing to prerender, nothing to index. If that changes, the path is the BFF hybrid — see [ADR 0006](docs/adr/0006-separate-api-deployable.md), which compares all three models. |
| Observability | No tracing, no metrics. Winston writes structured JSON in production, which is the hook to ship into whatever you use. |
| Docker for the web app | The build is static files. A container to serve them adds a moving part. |

---

## Inherited, and fixed here

These were real defects in the system this template came from. They are listed so
the fixes are not silently undone by someone porting code back:

| | Fixed by |
| --- | --- |
| Tenant isolation absent — role checked, tenant not | `api/app/v1/authorization/tenant-scope.hook.js` |
| Express error handler declared with 3 parameters, so it never ran | Fastify's `setErrorHandler` in `api/app/error-handler.js`, which has no arity to get wrong, with its own unit test ([ADR 0007](docs/adr/0007-fastify-over-express.md)) |
| `express.json()` parsing every body before authentication ran | Guards are `onRequest` hooks; Fastify parses the body only after they pass |
| CORS falling back to `*` on an empty variable | `api/app/lib/cors.js` — an empty allow-list refuses |
| Release `.env` assembled by ~45 hand-written `echo` lines | `api/app/config/env.manifest.js` + `scripts/render-env.js` |
| `npm install` in the Dockerfile with the lockfile beside it | `npm ci` in a two-stage build |
| Mongo published on all interfaces | `127.0.0.1:27017:27017` |
| Type checking disabled in CI after it went red | `npm run check` is a gate, and it is green |
| Deploy building on the production host from a `git pull` | Image built in CI, pushed to GHCR, pulled by the server |

Full detail, with reproductions: [`AUDIT-CARDONIUM.md`](AUDIT-CARDONIUM.md).
