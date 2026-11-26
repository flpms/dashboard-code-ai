'use strict';

/**
 * Controllers translate HTTP into a use-case call and nothing else: read the
 * validated request, convert ids to ObjectId, hand over `onFinish`.
 *
 * By the time a handler runs, Fastify has replaced `request.params`, `.query`
 * and `.body` with what the route's Joi schema returned — coerced, defaulted,
 * and stripped of every undeclared field. The tenant comes from
 * `request.tenantId`, which the tenant-scope hook checked, never from params.
 *
 * If a controller grows an `if` about business meaning, that `if` belongs in
 * the use case.
 */

const createItemController =
  ({ createItem, responseHandler }) =>
  (request, reply) =>
    createItem({
      data: {
        ...request.body,
        tenantId: request.tenantId,
        createdBy: request.user._id,
      },
      onFinish: responseHandler(request, reply),
    });

const listItemsController =
  ({ listItems, responseHandler }) =>
  (request, reply) =>
    listItems({
      data: {
        ...request.query,
        tenantId: request.tenantId,
      },
      onFinish: responseHandler(request, reply),
    });

const getItemController =
  ({ getItem, ObjectId, responseHandler }) =>
  (request, reply) =>
    getItem({
      data: {
        tenantId: request.tenantId,
        id: new ObjectId(request.params.id),
      },
      onFinish: responseHandler(request, reply),
    });

const updateItemController =
  ({ updateItem, ObjectId, responseHandler }) =>
  (request, reply) =>
    updateItem({
      data: {
        ...request.body,
        tenantId: request.tenantId,
        id: new ObjectId(request.params.id),
        updatedBy: request.user._id,
      },
      onFinish: responseHandler(request, reply),
    });

const deleteItemController =
  ({ deleteItem, ObjectId, responseHandler }) =>
  (request, reply) =>
    deleteItem({
      data: {
        tenantId: request.tenantId,
        id: new ObjectId(request.params.id),
        deletedBy: request.user._id,
      },
      onFinish: responseHandler(request, reply),
    });

export const ItemsController = deps => ({
  createItem: createItemController(deps),
  deleteItem: deleteItemController(deps),
  getItem: getItemController(deps),
  listItems: listItemsController(deps),
  updateItem: updateItemController(deps),
});
