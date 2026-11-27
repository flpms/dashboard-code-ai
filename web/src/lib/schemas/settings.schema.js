import { z } from 'zod';

/**
 * The settings menu's form, mirroring the collector's Joi rule: the backfill
 * window goes from 0 to a week, in hours.
 */
export const settingsSchema = z.object({
  autoInstallHooks: z.boolean(),
  backfillHours: z.coerce
    .number({ error: 'Informe um número de horas.' })
    .min(0, 'Use 0 ou mais horas.')
    .max(168, 'No máximo 168 horas (uma semana).'),
});
