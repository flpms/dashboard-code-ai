'use strict';

/**
 * The two terminal handlers: an unmatched path becomes a JSON 404, and anything
 * thrown or rejected upstream becomes a logged response whose body says nothing
 * useful to an attacker.
 *
 * Three kinds of error reach here, told apart by what Fastify put on them:
 *
 *   validation  Joi refused the payload. 400, and outside production the list
 *               of fields, so a caller does not need the server log to learn
 *               which one was wrong.
 *   client      Fastify refused the request itself — malformed JSON, a body
 *               over the limit, an unsupported content type. Its status and
 *               message are safe to repeat.
 *   server      Everything else. 500 with a generic message; the detail goes to
 *               the log.
 */

const isClientError = error => error.statusCode >= 400 && error.statusCode < 500;

const kindOf = error => {
  if (error.code === 'FST_ERR_VALIDATION') return 'validation';
  if (isClientError(error)) return 'client';
  return 'server';
};

export const ErrorHandler = ({ app, enums: { HTTP_MESSAGES }, env, Logger, validationDetails }) => {
  const exposeDetails = env.app.env !== 'production';

  const RESPONSES = Object.freeze({
    validation: error => {
      const details = validationDetails(error);
      details.forEach(message => Logger.warn(message));
      return {
        status: 400,
        body: { message: HTTP_MESSAGES.BAD_REQUEST, ...(exposeDetails && { details }) },
      };
    },
    client: error => ({ status: error.statusCode, body: { message: error.message } }),
    server: error => {
      Logger.debug(error.stack);
      return { status: 500, body: { message: HTTP_MESSAGES.UNHANDLED_ERROR } };
    },
  });

  app.setNotFoundHandler((request, reply) => {
    Logger.warn(`[${request.method}] ${request.url} - 404 - unknown path`);
    return reply.code(404).send({ message: HTTP_MESSAGES.NOT_FOUND });
  });

  app.setErrorHandler((error, request, reply) => {
    const { status, body } = RESPONSES[kindOf(error)](error);

    Logger.error(`[${request.method}] ${request.url} - ${status} - ${error.message}`);

    return reply.code(status).send(body);
  });

  return app;
};
