import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ObjectId } from 'mongodb';

import { enums } from '../../../app/enums/index.js';
import { Serializers } from '../../../app/v1/serializers/index.js';
import { Items } from '../../../app/v1/use-cases/items.js';
import { captureOutcome, fakeLogger } from '../../helpers/fakes.js';

const tenantId = new ObjectId();

const build = ({ items = {}, history = {} } = {}) =>
  Items({
    enums,
    Logger: fakeLogger(),
    serializers: Serializers,
    repositories: {
      historyRepository: { addEntry: async () => ({}), ...history },
      itemsRepository: {
        countDocuments: async () => 0,
        find: async () => [],
        findOne: async () => null,
        insertOne: async () => ({ insertedId: new ObjectId() }),
        softDelete: async () => ({ matchedCount: 1 }),
        updateOne: async () => ({ matchedCount: 1 }),
        ...items,
      },
    },
  });

describe('Items use case', () => {
  it('creates an item and answers CREATED with the serialized shape', async () => {
    const { onFinish, last } = captureOutcome();

    await build().createItem({
      data: { tenantId, createdBy: new ObjectId(), name: 'Torquímetro', status: 'draft', tags: [] },
      onFinish,
    });

    assert.equal(last().name, 'CREATED');
    assert.equal(last().payload.name, 'Torquímetro');
    // The serializer is what keeps internals in: tenantId must not travel out.
    assert.equal(last().payload.tenantId, undefined);
  });

  it('refuses a duplicate name with CONFLICT', async () => {
    const { onFinish, last } = captureOutcome();

    await build({
      items: { findOne: async () => ({ _id: new ObjectId(), name: 'Torquímetro' }) },
    }).createItem({ data: { tenantId, name: 'Torquímetro' }, onFinish });

    assert.equal(last().name, 'CONFLICT');
  });

  it('answers NOT_FOUND instead of 200-with-null', async () => {
    const { onFinish, last } = captureOutcome();

    await build().getItem({ data: { tenantId, id: new ObjectId() }, onFinish });

    assert.equal(last().name, 'NOT_FOUND');
  });

  it('paginates with a computed page count', async () => {
    const { onFinish, last } = captureOutcome();

    await build({
      items: {
        find: async () => [
          { _id: new ObjectId(), name: 'A', status: 'active', createdAt: new Date() },
        ],
        countDocuments: async () => 42,
      },
    }).listItems({ data: { tenantId, page: 2, itemsPerPage: 20 }, onFinish });

    assert.equal(last().name, 'OK');
    assert.equal(last().payload.total, 42);
    assert.equal(last().payload.totalPages, 3);
  });

  it('turns a repository failure into SERVICE_UNAVAILABLE, never a leaked stack', async () => {
    const { onFinish, last } = captureOutcome();

    await build({
      items: {
        findOne: async () => {
          throw new Error('connection reset by peer');
        },
      },
    }).getItem({ data: { tenantId, id: new ObjectId() }, onFinish });

    assert.equal(last().name, 'SERVICE_UNAVAILABLE');
    assert.doesNotMatch(String(last().payload), /connection reset/);
  });

  it('writes an audit entry alongside an update', async () => {
    const entries = [];
    const { onFinish } = captureOutcome();

    await build({
      items: { findOne: async () => ({ _id: new ObjectId(), name: 'old', status: 'draft' }) },
      history: { addEntry: async entry => entries.push(entry) },
    }).updateItem({
      data: { tenantId, id: new ObjectId(), name: 'new', updatedBy: new ObjectId() },
      onFinish,
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0].action, 'update');
    assert.equal(entries[0].from.name, 'old');
  });
});
