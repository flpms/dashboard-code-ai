# 3. Tenant isolation in a guard, not by convention

**Status:** accepted

## Context

Multi-tenant APIs commonly check the caller's *role* and then scope the query to
whatever `:tenantId` the URL carries. An authenticated `admin` of tenant A then
reads tenant B's data by editing the URL: the role matches, the query is scoped
as written, and the response is a clean 200.

The failure is invisible to a test suite that uses one tenant, and invisible in
review because each individual use case looks correct.

## Decision

A dedicated `onRequest` guard, `tenant-scope.hook.js`, runs on every route whose
row declares `tenant: true`. It compares the authenticated user's `tenantId` with
the one in the path, allows only the roles in `CROSS_TENANT_ROLES` to cross, and
publishes the checked value as `request.tenantId`. Downstream code reads it from
there, never from `request.params`.

(Originally an Express middleware; the decision is unchanged by
[ADR 0007](0007-fastify-over-express.md), and the file name keeps the old word so
existing links survive.)

Repositories then take `tenantId` as an explicit parameter on every read.

## Consequences

- The check exists once, not per use case, and cannot be forgotten by a new
  resource that copies an existing controller.
- `docs/adr` and the `architecture-review` skill both carry a grep that lists
  `:tenantId` routes missing the flag.
- Cross-tenant administration must be explicit, through the role list.
- One extra database read per request, for the user. Cache it only with a
  revocation story.
