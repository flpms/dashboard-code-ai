import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { enums } from '../../../app/enums/index.js';
import { RequireLoopback } from '../../../app/v1/guards/loopback.hook.js';
import { fakeLogger, fakeReply } from '../../helpers/fakes.js';

const guard = RequireLoopback({ enums, Logger: fakeLogger() });
const request = ip => ({ ip, method: 'GET', url: '/v1/sessions' });

describe('RequireLoopback', () => {
  it('lets this machine through over IPv4 and IPv6', async () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      const reply = fakeReply();
      await guard(request(ip), reply);
      assert.equal(reply.sent, false, ip);
    }
  });

  it('refuses any other address with 403', async () => {
    const reply = fakeReply();
    await guard(request('192.168.0.20'), reply);
    assert.equal(reply.statusCode, 403);
  });
});
