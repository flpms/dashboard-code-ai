import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { enums } from '../../app/enums/index.js';
import { ErrorHandler } from '../../app/error-handler.js';
import { validationDetails } from '../../app/lib/request-validation.js';
import { fakeLogger, fakeReply } from '../helpers/fakes.js';

const request = { method: 'POST', url: '/v1/items' };

const build = nodeEnv => {
  const handlers = {};
  const app = {
    setNotFoundHandler: handler => Object.assign(handlers, { notFound: handler }),
    setErrorHandler: handler => Object.assign(handlers, { error: handler }),
  };

  ErrorHandler({
    app,
    enums,
    env: { app: { env: nodeEnv } },
    Logger: fakeLogger(),
    validationDetails,
  });

  return handlers;
};

const validationError = () =>
  Object.assign(new Error('"name" is required'), {
    code: 'FST_ERR_VALIDATION',
    statusCode: 400,
    validationContext: 'body',
    details: [{ path: ['name'], message: '"name" is required' }],
  });

describe('ErrorHandler', () => {
  it('answers a validation failure with 400 and the fields outside production', () => {
    const reply = fakeReply();
    build('development').error(validationError(), request, reply);

    assert.equal(reply.statusCode, 400);
    assert.deepEqual(reply.body.details, ['body.name: "name" is required']);
  });

  it('withholds the fields in production', () => {
    const reply = fakeReply();
    build('production').error(validationError(), request, reply);

    assert.equal(reply.statusCode, 400);
    assert.equal(reply.body.details, undefined);
  });

  it('repeats the status and message of a request Fastify refused', () => {
    const reply = fakeReply();
    const tooLarge = Object.assign(new Error('Request body is too large'), { statusCode: 413 });

    build('production').error(tooLarge, request, reply);

    assert.equal(reply.statusCode, 413);
    assert.equal(reply.body.message, 'Request body is too large');
  });

  it('never repeats the message of an unexpected error', () => {
    const reply = fakeReply();
    build('development').error(new Error('connection string with a password'), request, reply);

    assert.equal(reply.statusCode, 500);
    assert.equal(reply.body.message, enums.HTTP_MESSAGES.UNHANDLED_ERROR);
  });

  it('answers an unknown path with a JSON 404', () => {
    const reply = fakeReply();
    build('production').notFound(request, reply);

    assert.equal(reply.statusCode, 404);
    assert.equal(reply.body.message, enums.HTTP_MESSAGES.NOT_FOUND);
  });
});
