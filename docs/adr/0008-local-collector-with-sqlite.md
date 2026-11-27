# 0008 — The API is a local collector on SQLite

**Status:** accepted · 2026-11-26

## Context

The repository started from a template whose API is a multi-tenant REST service
on MongoDB with JWT auth, deployed to a server. This project instruments AI
coding sessions on the developer's own machine: the data is that machine's
tool calls, the only reader is that developer, and setup has to be "run one
command".

## Decision

- The API is a **collector** that runs locally and binds to `127.0.0.1`.
- Storage is **SQLite** through `node:sqlite` (ships with Node): an append-only
  `events` table plus a `sessions` table. No server database, no container.
- **No auth, no tenancy.** The `auth` / `roles` / `tenant` route flags are
  replaced by one, `local`, which refuses any caller that is not loopback — a
  second lock for the day someone binds to `0.0.0.0`.
- Claude Code sends **HTTP hooks** straight to `POST /v1/hooks`. No shell
  script in between.
- The dashboard is fed by **Server-Sent Events** (`GET /v1/stream`) and
  re-derives everything it draws from the event log (`buildSessionModel`).
- The server deploy pipeline (release workflows, Dockerfile, compose,
  `DEPLOY.md`, `deploy-runbook`) is removed: nothing is deployed.
  *Amended 2026-11-26 (#18):* a new `Dockerfile` and `docker-compose.yml`
  package the panel to run **on the developer's machine**, with host networking
  so hooks still arrive from loopback. They are not a deploy to a server.

## Consequences

- The layering is unchanged: SQLite replaced Mongo inside repositories only,
  which is what ADR 0001 promised.
- Tests use a real in-memory SQLite database instead of a fake collection: same
  speed, and the SQL under test is the SQL that runs.
- `node:sqlite` still prints an experimental warning on Node 24.
- Multi-machine or team use (one collector for several developers) would need
  auth back. That is a new ADR, not a flag.
