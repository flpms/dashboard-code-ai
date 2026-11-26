'use strict';

/**
 * Reads the summary line a test runner prints and turns it into counts.
 *
 * Only the summary, never the per-test lines: every runner prints one, it is
 * stable across versions, and it is what a person looks at first. Each runner
 * is a row — supporting a new one is a new entry, not a new branch.
 */

const count = (text, pattern) => Number(text.match(pattern)?.[1] ?? 0);

const RUNNERS = Object.freeze([
  {
    // "Tests  2 failed | 41 passed | 1 skipped (44)"
    runner: 'vitest',
    detect: /^\s*Tests\s+.*\(\d+\)\s*$/m,
    parse: text => {
      const line = text.match(/^\s*Tests\s+(.*\(\d+\))\s*$/m)?.[1] ?? '';
      return {
        passed: count(line, /(\d+) passed/),
        failed: count(line, /(\d+) failed/),
        skipped: count(line, /(\d+) (?:skipped|todo)/),
      };
    },
  },
  {
    // "Tests:       1 failed, 5 passed, 6 total"
    runner: 'jest',
    detect: /^Tests:\s+.*\d+ total/m,
    parse: text => {
      const line = text.match(/^Tests:\s+(.*)$/m)?.[1] ?? '';
      return {
        passed: count(line, /(\d+) passed/),
        failed: count(line, /(\d+) failed/),
        skipped: count(line, /(\d+) skipped/),
      };
    },
  },
  {
    // node --test (spec or TAP reporter): "ℹ pass 12" / "# pass 12"
    runner: 'node',
    detect: /^(?:ℹ|#) pass \d+/m,
    parse: text => ({
      passed: count(text, /^(?:ℹ|#) pass (\d+)/m),
      failed: count(text, /^(?:ℹ|#) fail (\d+)/m),
      skipped: count(text, /^(?:ℹ|#) skipped (\d+)/m),
    }),
  },
  {
    // "===== 1 failed, 5 passed, 2 skipped in 0.12s ====="
    runner: 'pytest',
    detect: /^=+ .*(passed|failed).* in [\d.]+s/m,
    parse: text => {
      const line = text.match(/^=+ (.* in [\d.]+s)/m)?.[1] ?? '';
      return {
        passed: count(line, /(\d+) passed/),
        failed: count(line, /(\d+) failed/),
        skipped: count(line, /(\d+) skipped/),
      };
    },
  },
]);

/**
 * @param {string} output  stdout and stderr of the run, joined
 * @returns {{ runner: string, passed: number, failed: number, skipped: number } | null}
 */
export const parseTestSummary = output => {
  const text = String(output ?? '');
  const match = RUNNERS.find(({ detect }) => detect.test(text));

  if (!match) return null;

  return { runner: match.runner, ...match.parse(text) };
};
