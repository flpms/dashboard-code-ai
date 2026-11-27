'use strict';

import { DockerWatcher } from './docker-watcher.service.js';
import { FileWatcher } from './file-watcher.service.js';
import { HooksInstaller } from './hooks-installer.service.js';
import { SecurityAuditor } from './security-auditor.service.js';
import { TranscriptWatcher } from './transcript-watcher.service.js';

/**
 * External systems the collector listens to. Each receives the process-level
 * primitive it needs (`spawn`, `watch`) instead of importing it, so a test
 * drives it with a fake child process or a fake watcher.
 */
export const Services = ({ dirname, env, existsSync, fs, join, Logger, spawn, watch }) => ({
  dockerWatcher: DockerWatcher({ enabled: env.watchers.docker, Logger, spawn }),
  fileWatcher: FileWatcher({ enabled: env.watchers.files, Logger, watch }),
  hooksInstaller: HooksInstaller({
    enabled: env.claude.autoInstallHooks,
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
  transcriptWatcher: TranscriptWatcher({
    enabled: env.watchers.transcripts,
    root: join(env.claude.home, 'projects'),
    backfillMs: env.claude.backfillMs,
    fs,
    Logger,
    watch,
  }),
});
