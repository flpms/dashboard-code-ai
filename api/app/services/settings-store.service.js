'use strict';

/**
 * The settings a person changes from the dashboard's menu, kept in a small
 * JSON file beside the database so they survive a restart.
 *
 * The environment gives the defaults; what was saved from the menu wins over
 * them, because it is the later and more deliberate choice. Only the keys in
 * `defaults` are read back, so a stale or hand-edited file cannot inject a
 * setting the collector does not know. With no `path` (an in-memory
 * database) nothing is written and the settings last as long as the process.
 */
export const SettingsStore = ({ path, defaults, fs, dirname, Logger }) => {
  const known = Object.keys(defaults);

  const pick = source =>
    Object.fromEntries(
      known
        .filter(key => typeof source?.[key] === typeof defaults[key])
        .map(key => [key, source[key]])
    );

  const load = () => {
    if (!path || !fs.existsSync(path)) return {};
    try {
      return pick(JSON.parse(fs.readFileSync(path, 'utf8')));
    } catch (error) {
      Logger.warn(`SettingsStore::ignoring ${path} - ${error.message}`);
      return {};
    }
  };

  let saved = load();

  /** @returns {Record<string, any>} the effective settings */
  const get = () => ({ ...defaults, ...saved });

  /**
   * @param {Record<string, any>} patch  only known keys of the right type are kept
   * @returns {Record<string, any>} the effective settings after the change
   */
  const update = patch => {
    const next = { ...saved, ...pick(patch) };
    if (path) {
      fs.mkdirSync(dirname(path), { recursive: true });
      fs.writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
    }
    saved = next;
    return get();
  };

  return { get, update };
};
