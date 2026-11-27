'use strict';

import { CollectorSchema } from './collector.schema.js';
import { SettingsSchema } from './settings.schema.js';

/**
 * Every schema file, indexed by HTTP method. `generateSchemaObject` throws on a
 * duplicate route name, so two files cannot silently claim the same endpoint.
 */
export const Schemas = ({ Joi, generateSchemaObject }) =>
  generateSchemaObject([CollectorSchema(Joi), SettingsSchema(Joi)])({
    delete: {},
    get: {},
    patch: {},
    post: {},
    put: {},
  });
