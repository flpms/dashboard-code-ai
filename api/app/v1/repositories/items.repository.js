'use strict';

/**
 * Data access for one collection. Repositories are thin on purpose: they take a
 * query and hand back documents. No business rules, no HTTP, no logging of
 * anything but the collection they opened.
 *
 * Every method takes `tenantId` explicitly rather than closing over it — the
 * scoping is visible at every call site, so a missing tenant filter is a
 * reviewable diff instead of an invisible default.
 */
export const ItemsRepository = ({ db, collections, logger }) => {
  const name = collections.items;

  logger.info(`Start Collection - ${name}`);

  const collection = db.collection(name);

  const scoped = (tenantId, query = {}) => ({ ...query, tenantId, deleted: false });

  return {
    countDocuments: (tenantId, query) => collection.countDocuments(scoped(tenantId, query)),
    insertOne: document => collection.insertOne(document),
    findOne: (tenantId, query) => collection.findOne(scoped(tenantId, query)),
    find: (tenantId, query, options) =>
      collection.find(scoped(tenantId, query), options).sort({ createdAt: -1 }).toArray(),
    updateOne: (tenantId, query, data) =>
      collection.updateOne(scoped(tenantId, query), { $set: data }),
    softDelete: (tenantId, query, deletedBy) =>
      collection.updateOne(scoped(tenantId, query), {
        $set: { deleted: true, deletedAt: new Date(), deletedBy },
      }),
  };
};
