'use strict';

/**
 * Test doubles built by hand, on purpose.
 *
 * Everything in this codebase takes its collaborators as arguments, so a fake
 * is a plain object — no mocking framework, no module interception, no
 * `jest.mock` that breaks when a file moves.
 */

export const fakeLogger = () => {
  const lines = { debug: [], error: [], info: [], verbose: [], warn: [] };
  const record = level => message => lines[level].push(String(message));
  return {
    lines,
    debug: record('debug'),
    error: record('error'),
    info: record('info'),
    verbose: record('verbose'),
    warn: record('warn'),
  };
};

/** Captures the outcome a use case chose, instead of writing to a socket. */
export const captureOutcome = () => {
  const calls = [];
  const outcomes = [
    'OK',
    'CREATED',
    'ACCEPTED',
    'NO_CONTENT',
    'BAD_REQUEST',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'UNPROCESSABLE',
    'UNHANDLED_ERROR',
    'SERVICE_UNAVAILABLE',
  ];
  const onFinish = Object.fromEntries(
    outcomes.map(name => [name, payload => calls.push({ name, payload })])
  );
  return { onFinish, calls, last: () => calls.at(-1) };
};

/**
 * Minimal Fastify-like reply that records what was sent. `sent` stays false
 * when a hook lets the request through — that is how a test tells "passed"
 * from "refused".
 */
export const fakeReply = () => {
  const reply = {
    statusCode: 200,
    body: undefined,
    sent: false,
    headers: {},
    code(status) {
      reply.statusCode = status;
      return reply;
    },
    header(name, value) {
      reply.headers[name] = value;
      return reply;
    },
    send(payload) {
      reply.body = payload;
      reply.sent = true;
      return reply;
    },
  };
  return reply;
};
