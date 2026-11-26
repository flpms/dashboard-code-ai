import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeHook } from '../../../app/v1/domain/hook-normalizer.js';

const NOW = '2026-11-26T12:00:00.000Z';
const hook = (name, fields = {}) => ({ hook_event_name: name, session_id: 's1', ...fields });

describe('normalizeHook', () => {
  it('puts main-agent events on the main lane and subagent events on theirs', () => {
    const [main] = normalizeHook(hook('Stop'), NOW);
    const [sub] = normalizeHook(hook('Stop', { agent_id: 'a7', agent_type: 'Explore' }), NOW);

    assert.equal(main.agentId, 'main');
    assert.equal(sub.agentId, 'a7');
    assert.equal(sub.agentType, 'Explore');
  });

  it('opens a tool span with a one-line summary', () => {
    const [event] = normalizeHook(
      hook('PreToolUse', {
        tool_name: 'Bash',
        tool_use_id: 't1',
        tool_input: { command: 'docker compose up -d', description: 'Start the database' },
      }),
      NOW
    );

    assert.equal(event.kind, 'tool.start');
    assert.equal(event.spanId, 't1');
    assert.equal(event.category, 'docker');
    assert.equal(event.data.summary, 'Start the database');
  });

  it('derives a file change from a successful edit', () => {
    const events = normalizeHook(
      hook('PostToolUse', {
        tool_name: 'Edit',
        tool_use_id: 't2',
        tool_input: { file_path: '/repo/a.js' },
        tool_response: { success: true },
      }),
      NOW
    );

    assert.deepEqual(
      events.map(event => event.kind),
      ['tool.end', 'file.change']
    );
    assert.deepEqual(events[1].data, { path: '/repo/a.js', op: 'edit', source: 'tool' });
  });

  it('marks a failed tool and derives no file change from it', () => {
    const events = normalizeHook(
      hook('PostToolUseFailure', {
        tool_name: 'Write',
        tool_use_id: 't3',
        tool_input: { file_path: '/repo/b.js' },
        error: 'EACCES',
      }),
      NOW
    );

    assert.equal(events.length, 1);
    assert.equal(events[0].status, 'error');
    assert.equal(events[0].data.output, 'EACCES');
  });

  it('derives a test result from a test command output', () => {
    const events = normalizeHook(
      hook('PostToolUse', {
        tool_name: 'Bash',
        tool_use_id: 't4',
        tool_input: { command: 'npm test' },
        tool_response: { stdout: 'ℹ pass 9\nℹ fail 2', stderr: '' },
      }),
      NOW
    );

    const result = events.find(event => event.kind === 'test.result');
    assert.equal(result.data.passed, 9);
    assert.equal(result.data.failed, 2);
    assert.equal(result.data.command, 'npm test');
  });

  it('truncates long outputs', () => {
    const [event] = normalizeHook(
      hook('PostToolUse', {
        tool_name: 'Bash',
        tool_input: { command: 'cat big' },
        tool_response: { stdout: 'x'.repeat(5000) },
      }),
      NOW
    );
    assert.ok(event.data.output.length <= 2001);
  });

  it('records an unknown hook instead of dropping it', () => {
    const [event] = normalizeHook(hook('BrandNewHook'), NOW);
    assert.equal(event.kind, 'hook');
    assert.equal(event.name, 'BrandNewHook');
  });
});
