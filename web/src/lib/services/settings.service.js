/**
 * The collector's settings: read them, save a change, and put Claude Code's
 * hooks in or take them out. Stateless factory over `ApiClient`.
 *
 * @import { CollectorSettings, HttpClient } from '$lib/types.js'
 */

/**
 * @param {HttpClient} client
 */
export const SettingsService = client => {
  /** @returns {Promise<CollectorSettings>} */
  const get = () => client.get('/v1/settings');

  /**
   * @param {Partial<CollectorSettings['settings']>} changes
   * @returns {Promise<CollectorSettings>}
   */
  const update = changes => client.patch('/v1/settings', changes);

  /** @returns {Promise<CollectorSettings>} */
  const installHooks = () => client.put('/v1/settings/hooks');

  /** @returns {Promise<CollectorSettings>} */
  const removeHooks = () => client.remove('/v1/settings/hooks');

  return { get, installHooks, removeHooks, update };
};
