'use strict';

import { DockerWatcher } from './docker-watcher.service.js';
import { FileWatcher } from './file-watcher.service.js';

/**
 * External systems the collector listens to. Each receives the process-level
 * primitive it needs (`spawn`, `watch`) instead of importing it, so a test
 * drives it with a fake child process or a fake watcher.
 */
export const Services = ({ env, Logger, spawn, watch }) => ({
  dockerWatcher: DockerWatcher({ enabled: env.watchers.docker, Logger, spawn }),
  fileWatcher: FileWatcher({ enabled: env.watchers.files, Logger, watch }),
});
