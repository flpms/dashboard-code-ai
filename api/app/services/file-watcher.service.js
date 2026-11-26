'use strict';

/**
 * Watches each session's working directory and reports changed files.
 *
 * Tool hooks already say which files an agent edited. The watcher exists for
 * everything else: a formatter, a code generator, `npm install`, a script the
 * agent ran through Bash. Those writes are invisible to hooks.
 *
 * Directories that churn without meaning anything to a reviewer are never
 * descended into — watching node_modules would spend thousands of inotify
 * handles to report noise.
 */

const IGNORED_SEGMENTS = Object.freeze(
  new Set([
    '.git',
    'node_modules',
    '.svelte-kit',
    '.next',
    '.turbo',
    '.cache',
    'dist',
    'build',
    'coverage',
    '__pycache__',
    '.venv',
    'target',
  ])
);

const isIgnored = path => path.split(/[\\/]/).some(segment => IGNORED_SEGMENTS.has(segment));

// Editors write a file in several steps; one report per burst is enough.
const DEBOUNCE_MS = 300;

// A file written continuously (a log, a test report being streamed) would
// otherwise produce an event every burst. One per path per window is what a
// person can read.
const QUIET_MS = 5_000;

const REPORTED = Object.freeze(['add', 'change', 'unlink']);

export const FileWatcher = ({ enabled, Logger, watch, now = Date.now }) => {
  const watchers = new Map();
  const timers = new Map();
  const lastReported = new Map();
  let report = () => {};

  /** @param {(change: { sessionId: string, path: string }) => void} onChange */
  const start = onChange => {
    report = onChange;
  };

  const schedule = (sessionId, path) => {
    const key = `${sessionId}:${path}`;
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        if (now() - (lastReported.get(key) ?? -Infinity) < QUIET_MS) return;
        lastReported.set(key, now());
        report({ sessionId, path });
      }, DEBOUNCE_MS)
    );
  };

  const watchSession = (sessionId, cwd) => {
    if (!enabled || watchers.has(sessionId)) return;

    const watcher = watch(cwd, { ignored: isIgnored, ignoreInitial: true, persistent: true });

    REPORTED.forEach(event => watcher.on(event, path => schedule(sessionId, path)));
    watcher.on('error', error => Logger.warn(`FileWatcher::${sessionId} - ${error.message}`));

    watchers.set(sessionId, watcher);
    Logger.info(`FileWatcher::watch ${cwd} for ${sessionId}`);
  };

  const unwatch = sessionId => {
    watchers.get(sessionId)?.close();
    watchers.delete(sessionId);
  };

  const stopAll = () => {
    [...watchers.keys()].forEach(unwatch);
    [...timers.values()].forEach(clearTimeout);
    timers.clear();
  };

  return { start, watch: watchSession, unwatch, stopAll, isIgnored };
};
