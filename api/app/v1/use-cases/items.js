'use strict';

/**
 * Business rules for the example resource.
 *
 * A use case receives `{ data, onFinish }` and calls exactly one outcome on
 * `onFinish`. It never sees `request` or `reply`, which is what lets the same
 * function be driven from a queue worker or a CLI later without a rewrite.
 */
export const Items = dependencies => {
  const {
    enums: { HTTP_MESSAGES },
    Logger,
    repositories: { historyRepository, itemsRepository },
    serializers: { serializeItem, serializeItemList },
  } = dependencies;

  const logFailure = (location, error) => {
    Logger.error(`${location} - ${error.message}`);
    Logger.verbose(`${location} - ${error.stack}`);
  };

  const createItem = async ({ data, onFinish }) => {
    Logger.verbose('Items::createItem');
    try {
      const { tenantId, createdBy, ...attributes } = data;

      const duplicate = await itemsRepository.findOne(tenantId, { name: attributes.name });

      if (duplicate) return onFinish.CONFLICT(HTTP_MESSAGES.CONFLICT);

      const document = {
        ...attributes,
        tenantId,
        createdBy,
        createdAt: new Date(),
        deleted: false,
      };

      const { insertedId } = await itemsRepository.insertOne(document);

      Logger.info(`Items::createItem - created ${insertedId}`);

      return onFinish.CREATED(serializeItem({ ...document, _id: insertedId }));
    } catch (error) {
      logFailure('Items::createItem', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  const listItems = async ({ data, onFinish }) => {
    Logger.verbose('Items::listItems');
    try {
      const { tenantId, page, itemsPerPage, search } = data;

      // A filter is a value, not a branch: absent keys simply do not join the
      // query object, so there is no `if (search) query.name = ...` ladder.
      const query = {
        ...(search && { name: { $regex: search, $options: 'i' } }),
      };

      const [documents, total] = await Promise.all([
        itemsRepository.find(tenantId, query, {
          limit: itemsPerPage,
          skip: (page - 1) * itemsPerPage,
        }),
        itemsRepository.countDocuments(tenantId, query),
      ]);

      return onFinish.OK({
        items: serializeItemList(documents),
        page,
        total,
        totalPages: Math.ceil(total / itemsPerPage),
      });
    } catch (error) {
      logFailure('Items::listItems', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  const getItem = async ({ data: { tenantId, id }, onFinish }) => {
    Logger.verbose('Items::getItem');
    try {
      const document = await itemsRepository.findOne(tenantId, { _id: id });

      if (!document) return onFinish.NOT_FOUND(HTTP_MESSAGES.NOT_FOUND);

      return onFinish.OK(serializeItem(document));
    } catch (error) {
      logFailure('Items::getItem', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  const updateItem = async ({ data, onFinish }) => {
    Logger.verbose('Items::updateItem');
    try {
      const { tenantId, id, updatedBy, ...attributes } = data;

      const before = await itemsRepository.findOne(tenantId, { _id: id });

      if (!before) return onFinish.NOT_FOUND(HTTP_MESSAGES.NOT_FOUND);

      const changes = { ...attributes, updatedBy, updatedAt: new Date() };

      await Promise.all([
        itemsRepository.updateOne(tenantId, { _id: id }, changes),
        historyRepository.addEntry({
          tenantId,
          type: 'items',
          action: 'update',
          from: before,
          to: changes,
          createdBy: updatedBy,
        }),
      ]);

      return onFinish.OK(serializeItem({ ...before, ...changes }));
    } catch (error) {
      logFailure('Items::updateItem', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  const deleteItem = async ({ data: { tenantId, id, deletedBy }, onFinish }) => {
    Logger.verbose('Items::deleteItem');
    try {
      const { matchedCount } = await itemsRepository.softDelete(tenantId, { _id: id }, deletedBy);

      if (!matchedCount) return onFinish.NOT_FOUND(HTTP_MESSAGES.NOT_FOUND);

      return onFinish.NO_CONTENT();
    } catch (error) {
      logFailure('Items::deleteItem', error);
      return onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  return { createItem, deleteItem, getItem, listItems, updateItem };
};
