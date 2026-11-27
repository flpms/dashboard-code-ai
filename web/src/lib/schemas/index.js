export { eventSchema } from './event.schema.js';
export { settingsSchema } from './settings.schema.js';

/**
 * Runs a schema and returns either the parsed value or a field → message map.
 *
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} input
 * @returns {{ success: true, data: T } | { success: false, errors: Record<string,string> }}
 */
export const validate = (schema, input) => {
  const result = schema.safeParse(input);

  if (result.success) return { success: true, data: result.data };

  // Field -> first message. A form shows one error per field; the rest is noise.
  const errors = result.error.issues.reduce(
    (acc, issue) => ({ [issue.path.join('.')]: issue.message, ...acc }),
    {}
  );

  return { success: false, errors };
};
