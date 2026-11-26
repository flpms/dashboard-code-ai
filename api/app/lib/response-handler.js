'use strict';

/**
 * The single place that knows about HTTP status codes.
 *
 * Use cases never touch `reply`. They receive an `onFinish` object and call the
 * outcome by name — `onFinish.OK(payload)`, `onFinish.NOT_FOUND(message)` — so
 * business code stays readable and the transport stays swappable.
 *
 * Every writer returns the `reply`. Fastify's reply is a thenable that settles
 * once the response is written, so an async handler that returns it can never
 * be answered twice.
 */

// status code -> how the response is written. A `success` entry logs at info and
// sends a body; a failure logs at warn/error and sends `{ message }`.
const OUTCOMES = Object.freeze({
  OK: { status: 200, kind: 'success' },
  CREATED: { status: 201, kind: 'success' },
  ACCEPTED: { status: 202, kind: 'success' },
  NO_CONTENT: { status: 204, kind: 'success' },
  BAD_REQUEST: { status: 400, kind: 'failure' },
  UNAUTHORIZED: { status: 401, kind: 'failure' },
  FORBIDDEN: { status: 403, kind: 'failure' },
  NOT_FOUND: { status: 404, kind: 'failure' },
  CONFLICT: { status: 409, kind: 'failure' },
  UNPROCESSABLE: { status: 422, kind: 'failure' },
  TOO_MANY_REQUESTS: { status: 429, kind: 'failure' },
  UNHANDLED_ERROR: { status: 500, kind: 'failure' },
  SERVICE_UNAVAILABLE: { status: 503, kind: 'failure' },
});

const messageOf = payload =>
  typeof payload === 'string' ? payload : (payload?.message ?? 'Error');

const WRITERS = Object.freeze({
  success: (logger, request, reply) => (status, payload) => {
    logger.info(`[${request.method}] ${request.url} - ${status}`);
    return reply.code(status).send(payload);
  },
  failure: (logger, request, reply) => (status, payload) => {
    logger.warn(`[${request.method}] ${request.url} - ${status}`);
    return reply.code(status).send({ message: messageOf(payload) });
  },
});

export const ResponseHandler = logger => (request, reply) =>
  Object.fromEntries(
    Object.entries(OUTCOMES).map(([name, { status, kind }]) => [
      name,
      payload => WRITERS[kind](logger, request, reply)(status, payload),
    ])
  );

export const RESPONSE_OUTCOMES = OUTCOMES;
