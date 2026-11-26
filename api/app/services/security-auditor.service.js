'use strict';

/**
 * Runs `npm audit --json` in a session's folder and hands back its output.
 *
 * Audits are requested often (every lockfile write during an install burst)
 * and are slow (a registry round trip), so requests for the same folder are
 * coalesced: one run after things settle, never two at once. A folder without
 * a lockfile is skipped — npm audit needs one.
 */

// An install writes the lockfile several times; audit once it is done.
const SETTLE_MS = 5_000;

// A registry that does not answer must not leave a process behind.
const TIMEOUT_MS = 60_000;

export const SecurityAuditor = ({ enabled, existsSync, join, Logger, spawn }) => {
  const timers = new Map();
  const running = new Set();
  let report = () => {};

  /** @param {(result: { key: string, cwd: string, output: string }) => void} onResult */
  const start = onResult => {
    report = onResult;
  };

  const run = (key, cwd) => {
    if (running.has(cwd)) return schedule(key, cwd);
    if (!existsSync(join(cwd, 'package-lock.json'))) return;

    running.add(cwd);
    const child = spawn('npm', ['audit', '--json'], { cwd, timeout: TIMEOUT_MS });
    let output = '';

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
    });
    child.on('error', error => {
      running.delete(cwd);
      Logger.warn(`SecurityAuditor::run - ${error.message}`);
    });
    // npm audit exits 1 when it finds vulnerabilities; the JSON is the answer
    // either way, and an unparseable one is dropped by the use case.
    child.on('close', () => {
      running.delete(cwd);
      report({ key, cwd, output });
    });
  };

  /**
   * @param {string} key  who asked (a session id); passed back with the result
   * @param {string} cwd
   */
  const schedule = (key, cwd) => {
    if (!enabled || !cwd) return;
    clearTimeout(timers.get(cwd));
    timers.set(
      cwd,
      setTimeout(() => {
        timers.delete(cwd);
        run(key, cwd);
      }, SETTLE_MS)
    );
  };

  const stop = () => {
    [...timers.values()].forEach(clearTimeout);
    timers.clear();
  };

  return { start, request: schedule, stop };
};
