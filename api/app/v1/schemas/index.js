'use strict';

import { AuthSchema } from './auth.schema.js';
import { ItemsSchema } from './items.schema.js';

/**
 * Every schema file, indexed by HTTP method. `generateSchemaObject` throws on a
 * duplicate route name, so two files cannot silently claim the same endpoint.
 */
export const Schemas = ({ Joi, generateSchemaObject }) =>
  generateSchemaObject([AuthSchema(Joi), ItemsSchema(Joi)])({
    delete: {},
    get: {},
    patch: {},
    post: {},
    put: {},
  });
