'use strict';

/**
 * Joi as Fastify's validator.
 *
 * Fastify runs validation as its own lifecycle phase, after the `onRequest`
 * guards and before the handler. Whatever the validator returns as `value`
 * *replaces* `request.params`, `request.query` and `request.body` — so by the
 * time a controller runs, those hold the coerced values with every undeclared
 * field stripped. A field nobody declared cannot reach a Mongo document.
 */

const OPTIONS = Object.freeze({ abortEarly: false, stripUnknown: true });

/**
 * Called by Fastify once per route and request part, at boot.
 *
 * @param {{ schema: any, method: string, url: string, httpPart: string }} route
 * @returns {(data: unknown) => { value?: unknown, error?: Error }}
 * @throws {TypeError} when the schema is not a Joi schema
 */
export const JoiValidatorCompiler = ({ schema, method, url, httpPart }) => {
  if (typeof schema?.validate !== 'function') {
    throw new TypeError(
      `Schema for ${httpPart} of ${method} ${url} has no validate(). Did you forget Joi.object()?`
    );
  }

  return data => schema.validate(data, OPTIONS);
};

/**
 * `body.name: "name" is required` — one line per failure, prefixed by the part
 * of the request that failed. Fastify tags the error with that part.
 *
 * @param {{ details?: { path: (string|number)[], message: string }[], validationContext?: string }} error
 * @returns {string[]}
 */
export const validationDetails = error =>
  (error.details ?? []).map(
    detail => `${error.validationContext}.${detail.path.join('.')}: ${detail.message}`
  );
