import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ResponseHandler } from '../../../app/lib/response-handler.js';
import { fakeLogger, fakeReply } from '../../helpers/fakes.js';

const request = { method: 'GET', url: '/v1/items' };

describe('ResponseHandler', () => {
  it('maps each outcome to its status code', () => {
    const reply = fakeReply();
    const handler = ResponseHandler(fakeLogger())(request, reply);

    handler.CREATED({ id: '1' });
    assert.equal(reply.statusCode, 201);
    assert.deepEqual(reply.body, { id: '1' });

    handler.NOT_FOUND('Not found');
    assert.equal(reply.statusCode, 404);
    assert.deepEqual(reply.body, { message: 'Not found' });
  });

  it('returns the reply, so an async handler settles with the response', () => {
    const reply = fakeReply();
    assert.equal(ResponseHandler(fakeLogger())(request, reply).OK({}), reply);
  });

  it('logs successes at info and failures at warn', () => {
    const logger = fakeLogger();
    const handler = ResponseHandler(logger)(request, fakeReply());

    handler.OK({});
    handler.SERVICE_UNAVAILABLE('down');

    assert.equal(logger.lines.info.length, 1);
    assert.equal(logger.lines.warn.length, 1);
  });

  it('normalises an Error into a message field', () => {
    const reply = fakeReply();
    ResponseHandler(fakeLogger())(request, reply).BAD_REQUEST(new Error('bad input'));
    assert.deepEqual(reply.body, { message: 'bad input' });
  });
});
