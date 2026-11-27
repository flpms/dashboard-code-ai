'use strict';

/**
 * The settings menu's one form. At least one field, each bounded: a week is
 * the widest backfill window the collector will read at once.
 */
export const SettingsSchema = Joi => ({
  updateSettings: {
    patch: {
      body: Joi.object({
        autoInstallHooks: Joi.boolean(),
        backfillHours: Joi.number().min(0).max(168),
      }).min(1),
    },
  },
});
