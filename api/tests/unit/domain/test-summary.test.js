import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseTestSummary } from '../../../app/v1/domain/test-summary.js';

describe('parseTestSummary', () => {
  it('reads vitest', () => {
    const output =
      ' Test Files  1 failed | 4 passed (5)\n      Tests  2 failed | 41 passed | 1 skipped (44)\n';
    assert.deepEqual(parseTestSummary(output), {
      runner: 'vitest',
      passed: 41,
      failed: 2,
      skipped: 1,
    });
  });

  it('reads jest', () => {
    const output = 'Tests:       1 failed, 5 passed, 6 total\nSnapshots:   0 total';
    assert.deepEqual(parseTestSummary(output), {
      runner: 'jest',
      passed: 5,
      failed: 1,
      skipped: 0,
    });
  });

  it('reads node --test in both reporters', () => {
    const spec = 'ℹ tests 13\nℹ pass 12\nℹ fail 1\nℹ skipped 0';
    const tap = '# tests 3\n# pass 3\n# fail 0';
    assert.deepEqual(parseTestSummary(spec), { runner: 'node', passed: 12, failed: 1, skipped: 0 });
    assert.deepEqual(parseTestSummary(tap), { runner: 'node', passed: 3, failed: 0, skipped: 0 });
  });

  it('reads pytest', () => {
    const output = '======== 1 failed, 5 passed, 2 skipped in 0.12s ========';
    assert.deepEqual(parseTestSummary(output), {
      runner: 'pytest',
      passed: 5,
      failed: 1,
      skipped: 2,
    });
  });

  it('returns null when no runner summary is present', () => {
    assert.equal(parseTestSummary('npm ERR! missing script: test'), null);
    assert.equal(parseTestSummary(undefined), null);
  });
});
