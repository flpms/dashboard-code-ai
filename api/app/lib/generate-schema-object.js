'use strict';

/**
 * Flips schema files from "by route" to "by HTTP method", which is the shape
 * the route processor looks things up in.
 *
 *   { createItem: { post: {...} } }  ->  { post: { createItem: {...} } }
 */

const keys = object => Object.keys(object);

const indexByMethod = target => schema =>
  keys(schema).forEach(route =>
    keys(schema[route]).forEach(method => {
      if (!target[method]) {
        throw new ReferenceError(`Schema for "${route}" declares unsupported method "${method}"`);
      }
      if (target[method][route]) {
        throw new ReferenceError(`Duplicate schema for ${method} "${route}"`);
      }
      target[method][route] = schema[route][method];
    })
  );

export const GenerateSchemaObject = schemas => target => {
  schemas.forEach(indexByMethod(target));
  return target;
};
