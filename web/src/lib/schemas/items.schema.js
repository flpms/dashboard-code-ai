import { z } from 'zod';

/**
 * The innermost layer: field rules, and nothing else. No imports from services,
 * stores or components — that is what lets the same schema run in a form, in a
 * test, and (unchanged) in a future server route.
 *
 * These mirror the API's Joi schemas on purpose. Client validation is for
 * feedback; the API's copy is the one that actually protects the database.
 */

export const ITEM_STATUS = /** @type {const} */ (['draft', 'active', 'archived']);

export const itemSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres.').max(120, 'Máximo de 120 caracteres.'),
  description: z.string().trim().max(2000, 'Máximo de 2000 caracteres.').default(''),
  status: z.enum(ITEM_STATUS).default('draft'),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
});

export const itemUpdateSchema = itemSchema.partial();

/** @typedef {z.infer<typeof itemSchema>} Item */
