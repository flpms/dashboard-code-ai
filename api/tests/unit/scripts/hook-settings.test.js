import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COLLECTOR_HOOKS,
  DEFAULT_COLLECTOR_URL,
  withCollectorHooks,
  withoutCollectorHooks,
} from '../../../scripts/hook-settings.js';

const userSettings = Object.freeze({
  permissions: { allow: ['Bash(npm test)'] },
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: './guard.sh' }] }],
  },
});

const oursIn = settings =>
  Object.values(settings.hooks ?? {})
    .flat()
    .flatMap(group => group.hooks)
    .filter(hook => hook.url === DEFAULT_COLLECTOR_URL);

describe('hook settings', () => {
  it('adds one HTTP hook per collector event and keeps the user’s own', () => {
    const next = withCollectorHooks(userSettings);

    assert.equal(oursIn(next).length, COLLECTOR_HOOKS.length);
    assert.deepEqual(next.permissions, userSettings.permissions);
    assert.equal(next.hooks.PreToolUse[0].hooks[0].command, './guard.sh');
  });

  it('is idempotent: installing twice does not duplicate', () => {
    const twice = withCollectorHooks(withCollectorHooks(userSettings));
    assert.equal(oursIn(twice).length, COLLECTOR_HOOKS.length);
  });

  it('uninstall removes exactly what install added', () => {
    assert.deepEqual(withoutCollectorHooks(withCollectorHooks(userSettings)), userSettings);
  });

  it('leaves no empty hooks object behind on a file that had none', () => {
    assert.deepEqual(withoutCollectorHooks(withCollectorHooks({})), {});
  });

  it('does not mutate its input', () => {
    const copy = structuredClone(userSettings);
    withCollectorHooks(copy);
    assert.deepEqual(copy, userSettings);
  });
});
