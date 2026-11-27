'use strict';

import {
  hasCollectorHooks,
  withCollectorHooks,
  withoutCollectorHooks,
} from '../v1/domain/hook-settings.js';

/**
 * Makes sure Claude Code reports to this collector, without a manual step.
 *
 * At boot, adds the collector's HTTP hooks to the user-level settings file
 * (~/.claude/settings.json) when they are missing, keeping everything else in
 * it. The previous file is saved once as `settings.json.bak`. When the hooks
 * are already there nothing is written, so a restart never touches the file.
 * The settings menu installs and removes them on demand through the same
 * functions.
 *
 * Claude Code reads hooks when a session starts: sessions already open keep
 * running without them. The transcript watcher covers those.
 */
export const HooksInstaller = ({ settingsPath, fs, dirname, Logger }) => {
  const read = () => {
    if (!fs.existsSync(settingsPath)) return {};
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  };

  const write = settings => {
    fs.mkdirSync(dirname(settingsPath), { recursive: true });
    const backup = `${settingsPath}.bak`;
    if (fs.existsSync(settingsPath) && !fs.existsSync(backup))
      fs.copyFileSync(settingsPath, backup);
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  };

  /**
   * @param {string} url
   * @returns {{ installed: boolean, readable: boolean, settingsPath: string }}
   */
  const status = url => {
    try {
      return { installed: hasCollectorHooks(read(), url), readable: true, settingsPath };
    } catch {
      return { installed: false, readable: false, settingsPath };
    }
  };

  /**
   * @param {string} url  where the hooks should post, e.g. http://127.0.0.1:4317/v1/hooks
   * @returns {'present'|'installed'|'failed'}
   */
  const install = url => {
    try {
      const settings = read();
      if (hasCollectorHooks(settings, url)) {
        Logger.info(`HooksInstaller::present in ${settingsPath}`);
        return 'present';
      }

      write(withCollectorHooks(settings, url));
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

  /**
   * Takes out exactly what `install` added; the user's own hooks stay.
   *
   * @param {string} url
   * @returns {'absent'|'removed'|'failed'}
   */
  const remove = url => {
    try {
      if (!fs.existsSync(settingsPath)) return 'absent';
      const settings = read();
      const cleaned = withoutCollectorHooks(settings, url);
      if (JSON.stringify(cleaned) === JSON.stringify(settings)) return 'absent';

      write(cleaned);
      Logger.info(`HooksInstaller::removed from ${settingsPath}`);
      return 'removed';
    } catch (error) {
      Logger.warn(`HooksInstaller::remove failed for ${settingsPath} - ${error.message}`);
      return 'failed';
    }
  };

  /**
   * The boot-time call: installs only when automatic installation is on.
   *
   * @param {string} url
   * @param {{ enabled?: boolean }} [options]
   * @returns {'disabled'|'present'|'installed'|'failed'}
   */
  const ensure = (url, { enabled = true } = {}) => (enabled ? install(url) : 'disabled');

  return { ensure, install, remove, status };
};
