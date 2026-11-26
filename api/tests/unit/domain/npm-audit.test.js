import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  isDependencyFile,
  isInstallCommand,
  parseNpmAudit,
} from '../../../app/v1/domain/npm-audit.js';

const REPORT = readFileSync(new URL('../../fixtures/npm-audit.json', import.meta.url), 'utf8');

describe('parseNpmAudit', () => {
  it('counts vulnerabilities by severity from a real npm audit report', () => {
    const summary = parseNpmAudit(REPORT);

    assert.equal(summary.tool, 'npm');
    assert.equal(summary.total, 2);
    assert.deepEqual(summary.counts, { critical: 1, high: 1, moderate: 0, low: 0, info: 0 });
  });

  it('lists advisories worst first, with the link to each', () => {
    const { advisories } = parseNpmAudit(REPORT);

    assert.equal(advisories[0].severity, 'critical');
    assert.equal(advisories[0].package, 'minimist');
    assert.match(advisories[0].url, /^https:\/\/github\.com\/advisories\/GHSA-/);
    assert.ok(advisories.every(advisory => advisory.title));
  });

  it('returns null for anything that is not a report', () => {
    assert.equal(parseNpmAudit(''), null);
    assert.equal(parseNpmAudit('npm ERR! This command requires an existing lockfile.'), null);
    assert.equal(parseNpmAudit('{"error":{"code":"ENOLOCK"}}'), null);
  });
});

describe('when to audit', () => {
  it('recognises manifests and lockfiles by name', () => {
    assert.equal(isDependencyFile('/repo/package.json'), true);
    assert.equal(isDependencyFile('/repo/web/package-lock.json'), true);
    assert.equal(isDependencyFile('/repo/src/package.js'), false);
  });

  it('recognises install commands', () => {
    ['npm install', 'npm i lodash', 'pnpm add zod', 'yarn add react', 'npm ci'].forEach(command =>
      assert.equal(isInstallCommand(command), true, command)
    );
    assert.equal(isInstallCommand('npm test'), false);
    assert.equal(isInstallCommand(undefined), false);
  });
});
