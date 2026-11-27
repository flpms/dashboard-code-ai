'use strict';

import { hookUrlFor } from '../domain/hook-settings.js';

const HOUR_MS = 3_600_000;

/**
 * What the dashboard's settings menu reads and changes, and its refresh
 * button.
 *
 * - The two saved settings (automatic hook installation, the backfill window)
 *   live in the settings store and win over the environment.
 * - Installing and removing the hooks edits Claude Code's settings file now;
 *   removing also turns automatic installation off, or the next boot would
 *   put them back.
 * - Refreshing rescans the transcripts folder with the saved window.
 *
 * Address, port and watchers come from the environment and are only shown:
 * changing them means restarting the collector.
 */
export const Settings = dependencies => {
  const {
    enums: { HTTP_MESSAGES },
    env,
    Logger,
    serializers: { serializeSettings },
    services: { hooksInstaller, settingsStore, transcriptWatcher },
  } = dependencies;

  const hookUrl = hookUrlFor(env.app.host, env.app.port);

  const snapshot = () =>
    serializeSettings({
      env,
      hookUrl,
      hooks: hooksInstaller.status(hookUrl),
      saved: settingsStore.get(),
    });

  // A use case either answers or reports a generic failure; the detail is logged.
  const guarded = (location, run) => async args => {
    try {
      return await run(args);
    } catch (error) {
      Logger.error(`Settings::${location} - ${error.message}`);
      return args.onFinish.SERVICE_UNAVAILABLE(HTTP_MESSAGES.SERVICE_UNAVAILABLE);
    }
  };

  const UNREADABLE = 'Claude Code settings.json is not valid JSON; fix it by hand';

  const getSettings = guarded('getSettings', ({ onFinish }) => onFinish.OK(snapshot()));

  const updateSettings = guarded('updateSettings', ({ data, onFinish }) => {
    settingsStore.update(data);
    return onFinish.OK(snapshot());
  });

  const installHooks = guarded('installHooks', ({ onFinish }) => {
    if (hooksInstaller.install(hookUrl) === 'failed') return onFinish.UNPROCESSABLE(UNREADABLE);
    return onFinish.OK(snapshot());
  });

  const removeHooks = guarded('removeHooks', ({ onFinish }) => {
    if (hooksInstaller.remove(hookUrl) === 'failed') return onFinish.UNPROCESSABLE(UNREADABLE);
    settingsStore.update({ autoInstallHooks: false });
    return onFinish.OK(snapshot());
  });

  const refreshSessions = guarded('refreshSessions', ({ onFinish }) =>
    onFinish.OK(
      transcriptWatcher.rescan({ backfillMs: settingsStore.get().backfillHours * HOUR_MS })
    )
  );

  return { getSettings, installHooks, refreshSessions, removeHooks, updateSettings };
};
