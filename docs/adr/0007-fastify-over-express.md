# 7. Fastify, not Express

**Status:** accepted

## Context

The API shipped on Express 5, inherited from the system this template was
derived from. Three properties the architecture depends on were held up by
convention alone:

1. **Guard order.** Authentication, then roles, then tenant, then validation —
   an unauthenticated caller must not learn which fields a schema expects. In
   Express that order is the position of functions in an array, and the global
   `express.json()` had already parsed every body before the first guard ran.
2. **Validated input.** Express has no validation phase. The template put the
   coerced values on `req.validated` and relied on every controller reading from
   there rather than from `req.body`, which still carried undeclared fields.
3. **Error handling.** Express recognises an error handler by its arity. A
   handler declared with three parameters is silently treated as ordinary
   middleware and never runs — the system this template came from shipped
   exactly that defect.

## Decision

Fastify 5.

- Guards are route-level `onRequest` hooks, generated from `routes.json` by the
  same table-driven processor, in the same fixed order.
- Joi is the validator compiler (`setValidatorCompiler`); what it returns
  replaces `request.params`, `request.query` and `request.body`.
- `setErrorHandler` and `setNotFoundHandler` replace the terminal middlewares.
- `@fastify/helmet` and `@fastify/cors` replace `helmet` and the hand-written
  CORS middleware; the allow-list policy (an empty list refuses) is unchanged.
- Fastify's logger stays off. Winston remains the one logger; the access line
  moves from `morgan` to an `onResponse` hook.
- `server.js` builds the instance without listening, and the integration test
  drives that same instance through `app.inject()`.

## Consequences

- The lifecycle enforces the order: the body is not even parsed until every
  guard has passed. A caller without a token cannot make the server read 5 MB.
- Controllers read `request.body` directly — it is already coerced and stripped.
  To keep the tripwire `req.validated` provided, the route processor now fails at
  boot when a schema exists for a route that is not `validate: true`.
- There is no arity trap, and the error classification has its own unit test.
- The integration suite opens no port.
- A guard that refuses **must** `return reply.code(…).send(…)`. The reply is a
  thenable that settles once the response is written; returning it is what stops
  the next hook. No lint rule checks this — the pattern is in every guard and in
  the `api-resource` skill.
- Fastify listens on `localhost` by default; the process passes `0.0.0.0`, or the
  container's published port leads nowhere.
- Fastify validates params, then body, then query, and reports the first part
  that fails rather than all of them.
- Joi, not JSON Schema: no AJV speed and no response schemas. Serializers stay
  explicit functions. Moving to JSON Schema later is contained to
  `lib/request-validation.js` and `schemas/`.
- Plugin encapsulation is real: hooks, decorators and handlers apply to the
  plugin that registered them and its children. The validator compiler and the
  error handler are set before `/v1` is registered for that reason.
- Behind a reverse proxy, `request.ip` is the proxy until `trustProxy` is set —
  which matters as soon as rate limiting keys on it.
