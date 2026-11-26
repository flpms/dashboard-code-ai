'use strict';

/**
 * Controllers translate HTTP into a use-case call and nothing else.
 *
 * `streamEvents` is the one exception to the `onFinish` rule: a Server-Sent
 * Events stream never finishes. It takes the socket over from Fastify
 * (`reply.hijack()`), writes every event the bus publishes, and unsubscribes
 * when the browser goes away.
 */

// Proxies and some browsers drop an idle stream; a comment line every 15 s
// keeps it open without the dashboard seeing anything.
const KEEPALIVE_MS = 15_000;

const SSE_HEADERS = Object.freeze({
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
});

const ingestHookController =
  ({ ingestHook, responseHandler }) =>
  (request, reply) =>
    ingestHook({ data: request.body, onFinish: responseHandler(request, reply) });

const listSessionsController =
  ({ listSessions, responseHandler }) =>
  (request, reply) =>
    listSessions({ data: request.query, onFinish: responseHandler(request, reply) });

const listSessionEventsController =
  ({ listSessionEvents, responseHandler }) =>
  (request, reply) =>
    listSessionEvents({
      data: { ...request.query, sessionId: request.params.sessionId },
      onFinish: responseHandler(request, reply),
    });

const streamEventsController =
  ({ eventBus, Logger }) =>
  (request, reply) => {
    reply.hijack();

    // CORS and security headers were set on `reply` by their hooks; a hijacked
    // reply writes the raw socket, so they are copied over by hand.
    reply.raw.writeHead(200, { ...reply.getHeaders(), ...SSE_HEADERS });
    reply.raw.write(': connected\n\n');

    const send = event => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    const unsubscribe = eventBus.subscribe(send);
    const keepalive = setInterval(() => reply.raw.write(': keepalive\n\n'), KEEPALIVE_MS);

    Logger.verbose(`Collector::stream opened (${eventBus.size()} open)`);

    request.raw.on('close', () => {
      clearInterval(keepalive);
      unsubscribe();
      Logger.verbose(`Collector::stream closed (${eventBus.size()} open)`);
    });
  };

export const CollectorController = deps => ({
  ingestHook: ingestHookController(deps),
  listSessionEvents: listSessionEventsController(deps),
  listSessions: listSessionsController(deps),
  streamEvents: streamEventsController(deps),
});
