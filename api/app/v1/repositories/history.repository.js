'use strict';

/**
 * Append-only change log. Write-only from the app's point of view: nothing here
 * updates or deletes, so an audit trail cannot be quietly rewritten by a bug in
 * a use case.
 */
export const HistoryRepository = ({ db, collections, logger }) => {
  const name = collections.history;

  logger.info(`Start Collection - ${name}`);

  const collection = db.collection(name);

  return {
    addEntry: ({ tenantId, type, action, from, to, createdBy }) =>
      collection.insertOne({
        tenantId,
        type,
        action,
        from,
        to,
        createdBy,
        createdAt: new Date(),
      }),
    find: (tenantId, query, options) =>
      collection
        .find({ tenantId, ...query }, options)
        .sort({ createdAt: -1 })
        .toArray(),
  };
};
