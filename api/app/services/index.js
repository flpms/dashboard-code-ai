'use strict';

import { DockerWatcher } from './docker-watcher.service.js';
import { FileWatcher } from './file-watcher.service.js';
import { HooksInstaller } from './hooks-installer.service.js';
import { SecurityAuditor } from './security-auditor.service.js';
import { SettingsStore } from './settings-store.service.js';
import { TranscriptWatcher } from './transcript-watcher.service.js';

const HOUR_MS = 3_600_000;

// Saved beside the database; an in-memory database keeps settings in memory too.
const settingsPathFor = (dbPath, dirname, join) =>
  dbPath === ':memory:' ? null : join(dirname(dbPath), 'panel-settings.json');

/**
 * External systems the collector listens to. Each receives the process-level
 * primitive it needs (`spawn`, `watch`) instead of importing it, so a test
 * drives it with a fake child process or a fake watcher.
 *
 * The settings store comes first: what was saved from the dashboard's menu
 * decides the backfill window the transcript watcher boots with.
 */
export const Services = ({ dirname, env, existsSync, fs, join, Logger, spawn, watch }) => {
  const settingsStore = SettingsStore({
    path: settingsPathFor(env.db.path, dirname, join),
    defaults: {
      autoInstallHooks: env.claude.autoInstallHooks,
      backfillHours: env.claude.backfillMs / HOUR_MS,
    },
    fs,
    dirname,
    Logger,
  });

  return {
    dockerWatcher: DockerWatcher({ enabled: env.watchers.docker, Logger, spawn }),
    fileWatcher: FileWatcher({ enabled: env.watchers.files, Logger, watch }),
    hooksInstaller: HooksInstaller({
      settingsPath: join(env.claude.home, 'settings.json'),
      fs,
      dirname,
      Logger,
    }),
    securityAuditor: SecurityAuditor({
      enabled: env.watchers.security,
      existsSync,
      join,
      Logger,
      spawn,
    }),
    settingsStore,
    transcriptWatcher: TranscriptWatcher({
      enabled: env.watchers.transcripts,
      root: join(env.claude.home, 'projects'),
      backfillMs: settingsStore.get().backfillHours * HOUR_MS,
      fs,
      join,
      Logger,
      watch,
    }),
  };
};
