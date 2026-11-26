'use strict';

/**
 * Follows `docker events` for the life of the collector and hands every line to
 * whoever started it.
 *
 * Docker is optional: on a machine without it the spawn fails once, the
 * collector logs why, and every other instrument keeps working.
 */

const ARGS = Object.freeze(['events', '--format', '{{json .}}', '--filter', 'type=container']);

export const DockerWatcher = ({ enabled, Logger, spawn }) => {
  let child = null;

  /** @param {(line: string) => void} onLine */
  const start = onLine => {
    if (!enabled) return Logger.info('DockerWatcher::start - disabled by WATCH_DOCKER');

    child = spawn('docker', ARGS, { stdio: ['ignore', 'pipe', 'pipe'] });

    // stdout arrives in arbitrary chunks; only whole lines are events.
    let pending = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      const lines = `${pending}${chunk}`.split('\n');
      pending = lines.pop() ?? '';
      lines.filter(Boolean).forEach(onLine);
    });

    child.on('error', error =>
      Logger.warn(`DockerWatcher::start - docker unavailable (${error.message})`)
    );
    child.on('exit', code => Logger.warn(`DockerWatcher - docker events exited (${code})`));

    Logger.info('DockerWatcher::start - following docker events');
  };

  const stop = () => {
    child?.kill();
    child = null;
  };

  return { start, stop };
};
