import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { enums } from '../../../app/enums/index.js';
import { Serializers } from '../../../app/v1/serializers/index.js';
import { Settings } from '../../../app/v1/use-cases/settings.js';
import { captureOutcome, fakeLogger } from '../../helpers/fakes.js';

const env = {
  app: { version: '1.2.3', host: '127.0.0.1', port: 4317 },
  claude: { home: '/home/dev/.claude' },
  watchers: { docker: true, files: true, security: false, transcripts: true },
};

const URL = 'http://127.0.0.1:4317/v1/hooks';

const fakeServices = ({ install = 'installed', remove = 'removed' } = {}) => {
  const calls = [];
  let saved = { autoInstallHooks: true, backfillHours: 6 };
  let installed = false;
  return {
    calls,
    hooksInstaller: {
      status: url => ({
        installed,
        readable: true,
        settingsPath: `${env.claude.home}/settings.json`,
        url,
      }),
      install: url => {
        calls.push(['install', url]);
        installed = install !== 'failed';
        return install;
      },
      remove: url => {
        calls.push(['remove', url]);
        if (remove !== 'failed') installed = false;
        return remove;
      },
    },
    settingsStore: {
      get: () => saved,
      update: patch => (saved = { ...saved, ...patch }),
    },
    transcriptWatcher: {
      rescan: options => {
        calls.push(['rescan', options]);
        return { transcripts: 3, read: 1, newSessions: 1 };
      },
    },
  };
};

const build = services =>
  Settings({ enums, env, Logger: fakeLogger(), serializers: Serializers, services });

describe('Settings', () => {
  it('shows the saved settings, the hooks and what comes from the environment', async () => {
    const outcome = captureOutcome();
    await build(fakeServices()).getSettings({ data: {}, onFinish: outcome.onFinish });

    assert.equal(outcome.last().name, 'OK');
    assert.deepEqual(outcome.last().payload, {
      settings: { autoInstallHooks: true, backfillHours: 6 },
      hooks: {
        installed: false,
        readable: true,
        url: URL,
        settingsPath: '/home/dev/.claude/settings.json',
      },
      collector: {
        version: '1.2.3',
        host: '127.0.0.1',
        port: 4317,
        claudeHome: '/home/dev/.claude',
      },
      watchers: { docker: true, files: true, security: false, transcripts: true },
    });
  });

  it('saves a change', async () => {
    const outcome = captureOutcome();
    await build(fakeServices()).updateSettings({
      data: { backfillHours: 24 },
      onFinish: outcome.onFinish,
    });
    assert.equal(outcome.last().payload.settings.backfillHours, 24);
  });

  it('installs the hooks at this collector address', async () => {
    const services = fakeServices();
    const outcome = captureOutcome();
    await build(services).installHooks({ data: {}, onFinish: outcome.onFinish });

    assert.deepEqual(services.calls, [['install', URL]]);
    assert.equal(outcome.last().payload.hooks.installed, true);
  });

  it('turns automatic installation off when the hooks are removed', async () => {
    const outcome = captureOutcome();
    await build(fakeServices()).removeHooks({ data: {}, onFinish: outcome.onFinish });

    assert.equal(outcome.last().name, 'OK');
    assert.equal(outcome.last().payload.settings.autoInstallHooks, false);
  });

  it('refuses, and keeps the setting, when settings.json cannot be read', async () => {
    const services = fakeServices({ install: 'failed', remove: 'failed' });
    const install = captureOutcome();
    const remove = captureOutcome();
    await build(services).installHooks({ data: {}, onFinish: install.onFinish });
    await build(services).removeHooks({ data: {}, onFinish: remove.onFinish });

    assert.equal(install.last().name, 'UNPROCESSABLE');
    assert.equal(remove.last().name, 'UNPROCESSABLE');
    assert.equal(services.settingsStore.get().autoInstallHooks, true);
  });

  it('rescans the transcripts with the saved window', async () => {
    const services = fakeServices();
    services.settingsStore.update({ backfillHours: 2 });
    const outcome = captureOutcome();
    await build(services).refreshSessions({ data: {}, onFinish: outcome.onFinish });

    assert.deepEqual(services.calls, [['rescan', { backfillMs: 2 * 3_600_000 }]]);
    assert.deepEqual(outcome.last().payload, { transcripts: 3, read: 1, newSessions: 1 });
  });

  it('answers a generic failure when a service throws', async () => {
    const services = fakeServices();
    services.transcriptWatcher.rescan = () => {
      throw new Error('EACCES');
    };
    const outcome = captureOutcome();
    await build(services).refreshSessions({ data: {}, onFinish: outcome.onFinish });

    assert.equal(outcome.last().name, 'SERVICE_UNAVAILABLE');
    assert.equal(outcome.last().payload, enums.HTTP_MESSAGES.SERVICE_UNAVAILABLE);
  });
});
