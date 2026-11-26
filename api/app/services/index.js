'use strict';

import { DockerWatcher } from './docker-watcher.service.js';
import { FileWatcher } from './file-watcher.service.js';
import { SecurityAuditor } from './security-auditor.service.js';

/**
 * External systems the collector listens to. Each receives the process-level
 * primitive it needs (`spawn`, `watch`) instead of importing it, so a test
 * drives it with a fake child process or a fake watcher.
 */
export const Services = ({ env, existsSync, join, Logger, spawn, watch }) => ({
  dockerWatcher: DockerWatcher({ enabled: env.watchers.docker, Logger, spawn }),
  fileWatcher: FileWatcher({ enabled: env.watchers.files, Logger, watch }),
  securityAuditor: SecurityAuditor({
    enabled: env.watchers.security,
    existsSync,
    join,
    Logger,
    spawn,
  }),
});
