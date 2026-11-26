'use strict';

/**
 * The shape the API promises. A serializer is the reason a new internal field
 * does not leak the day it is added: what is not listed here is not sent.
 */
export const serializeItem = document => ({
  id: String(document._id),
  name: document.name,
  description: document.description ?? null,
  status: document.status,
  tags: document.tags ?? [],
  createdAt: document.createdAt,
  updatedAt: document.updatedAt ?? null,
});

export const serializeItemList = documents => documents.map(serializeItem);
