import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ObjectId } from 'mongodb';

import RequireTenantScope from '../../../app/v1/authorization/tenant-scope.hook.js';
import { enums } from '../../../app/enums/index.js';
import { fakeLogger, fakeReply } from '../../helpers/fakes.js';

const tenantA = new ObjectId();
const tenantB = new ObjectId();

const build = () => RequireTenantScope({ Logger: fakeLogger(), enums, ObjectId });

const requestFor = ({ tenantId, role, own }) => ({
  method: 'GET',
  url: `/v1/tenant/${tenantId}/items`,
  params: { tenantId: String(tenantId) },
  user: { email: 'user@example.com', role, tenantId: own },
});

describe('RequireTenantScope', () => {
  it('lets a user through to their own tenant', async () => {
    const request = requestFor({ tenantId: tenantA, role: 'admin', own: tenantA });
    const reply = fakeReply();

    await build()(request, reply);

    assert.equal(reply.sent, false);
    assert.equal(String(request.tenantId), String(tenantA));
  });

  it('refuses an admin reaching into another tenant', async () => {
    const request = requestFor({ tenantId: tenantB, role: 'admin', own: tenantA });
    const reply = fakeReply();

    await build()(request, reply);

    assert.equal(reply.statusCode, 403);
    assert.equal(request.tenantId, undefined);
  });

  it('lets a super-admin cross tenants', async () => {
    const reply = fakeReply();

    await build()(requestFor({ tenantId: tenantB, role: 'super-admin', own: tenantA }), reply);

    assert.equal(reply.sent, false);
  });

  it('answers 400 for a tenant id that is not an ObjectId', async () => {
    const reply = fakeReply();
    await build()({ params: { tenantId: 'not-an-id' } }, reply);
    assert.equal(reply.statusCode, 400);
  });

  it('answers 500 when the route forgot to authenticate first', async () => {
    const reply = fakeReply();
    await build()({ method: 'GET', url: '/x', params: { tenantId: String(tenantA) } }, reply);
    assert.equal(reply.statusCode, 500);
  });
});
