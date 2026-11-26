'use strict';

import { pagination, tenantParams, tenantResourceParams } from './commons/index.js';

const ITEM_STATUS = ['draft', 'active', 'archived'];

const messages = {
  'string.empty': 'Campo obrigatório.',
  'string.min': 'Mínimo de {#limit} caracteres.',
  'any.only': 'Valor não permitido.',
};

const itemBody = Joi =>
  Joi.object({
    name: Joi.string().trim().min(2).max(120).required().messages(messages),
    description: Joi.string().trim().max(2000).allow('').messages(messages),
    status: Joi.string()
      .valid(...ITEM_STATUS)
      .default('draft')
      .messages(messages),
    tags: Joi.array().items(Joi.string().trim().max(40)).max(20).default([]),
  });

export const ItemsSchema = Joi => ({
  createItem: {
    post: {
      params: tenantParams(Joi),
      body: itemBody(Joi),
    },
  },
  listItems: {
    get: {
      params: tenantParams(Joi),
      query: pagination(Joi),
    },
  },
  getItem: {
    get: {
      params: tenantResourceParams(Joi),
    },
  },
  updateItem: {
    patch: {
      params: tenantResourceParams(Joi),
      // `min(1)` is what turns an empty PATCH into a 400 instead of a no-op
      // that answers 200 and changes nothing.
      body: itemBody(Joi)
        .fork(['name'], field => field.optional())
        .min(1),
    },
  },
  deleteItem: {
    delete: {
      params: tenantResourceParams(Joi),
    },
  },
});

export const ITEM_STATUS_VALUES = Object.freeze(ITEM_STATUS);
