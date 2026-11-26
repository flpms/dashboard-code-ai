'use strict';

/**
 * Fragments shared by more than one schema. Keeping them here is what stops
 * "the id is a 24-char hex string" from being re-stated — and re-stated
 * slightly differently — in eight files.
 */

export const objectId = Joi => Joi.string().hex().length(24);

export const tenantParams = Joi =>
  Joi.object({
    tenantId: objectId(Joi).required(),
  });

export const tenantResourceParams = Joi =>
  Joi.object({
    tenantId: objectId(Joi).required(),
    id: objectId(Joi).required(),
  });

export const pagination = Joi =>
  Joi.object({
    page: Joi.number().integer().min(1).default(1),
    itemsPerPage: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().allow('').max(120),
  });
