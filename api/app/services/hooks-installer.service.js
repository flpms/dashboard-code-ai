'use strict';

import { hasCollectorHooks, withCollectorHooks } from '../v1/domain/hook-settings.js';

/**
 * Makes sure Claude Code reports to this collector, without a manual step.
 *
 * At boot, adds the collector's HTTP hooks to the user-level settings file
 * (~/.claude/settings.json) when they are missing, keeping everything else in
 * it. The previous file is saved once as `settings.json.bak`. When the hooks
 * are already there nothing is written, so a restart never touches the file.
 *
 * Claude Code reads hooks when a session starts: sessions already open keep
 * running without them. The transcript watcher covers those.
 */
export const HooksInstaller = ({ enabled, settingsPath, fs, dirname, Logger }) => {
  const read = () => {
    if (!fs.existsSync(settingsPath)) return {};
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  };

  /**
   * @param {string} url  where the hooks should post, e.g. http://127.0.0.1:4317/v1/hooks
   * @returns {'disabled'|'present'|'installed'|'failed'}
   */
  const ensure = url => {
    if (!enabled) return 'disabled';

    try {
      const settings = read();
      if (hasCollectorHooks(settings, url)) {
        Logger.info(`HooksInstaller::present in ${settingsPath}`);
        return 'present';
      }

      fs.mkdirSync(dirname(settingsPath), { recursive: true });
      const backup = `${settingsPath}.bak`;
      if (fs.existsSync(settingsPath) && !fs.existsSync(backup))
        fs.copyFileSync(settingsPath, backup);
      fs.writeFileSync(
        settingsPath,
        `${JSON.stringify(withCollectorHooks(settings, url), null, 2)}\n`
      );

      Logger.info(
        `HooksInstaller::installed in ${settingsPath} → ${url}. New Claude Code sessions report here.`
      );
      return 'installed';
    } catch (error) {
      // An unreadable settings file is the user's to fix; never overwrite it.
      Logger.warn(`HooksInstaller::failed for ${settingsPath} - ${error.message}`);
      return 'failed';
    }
  };

  return { ensure };
};
