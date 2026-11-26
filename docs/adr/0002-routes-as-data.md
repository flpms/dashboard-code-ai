# 2. Routes as data

**Status:** accepted

## Context

Route definitions spread across files drift. Whether an endpoint requires
authentication, which roles reach it, and whether its body is validated end up
stated in three different idioms, and answering "what does this API expose, and
to whom?" means reading every file.

## Decision

`app/v1/routes.json` is a table: one row per endpoint, with `path`, `method`,
`auth`, `roles`, `tenant` and `validate`. `lib/route-processor.js` maps each flag
to an `onRequest` guard through a lookup table, in one fixed order, attaches the
route's Joi schema when `validate` is set, and fails at boot if a row names a
controller that does not exist or its `validate` flag and schema disagree.

## Consequences

- The whole surface — and its authorization — is one reviewable file.
- Adding a capability is a key in the builders table plus a position in the
  order array. No `if` is edited.
- A renamed controller fails the process at startup, naming the route, instead
  of becoming a 404 in production. So does a schema nobody switched on, which
  would otherwise let an unvalidated body through.
- Genuinely unusual endpoints do not fit the table and need an explicit escape
  hatch. So far none have.
