import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCollector } from '../../helpers/collector.js';
import { captureOutcome } from '../../helpers/fakes.js';

const hook = (name, fields = {}) => ({
  hook_event_name: name,
  session_id: 's1',
  cwd: '/repo',
  ...fields,
});

const ingest = async (collector, payload) => {
  const outcome = captureOutcome();
  await collector.ingestHook({ data: payload, onFinish: outcome.onFinish });
  return outcome.last();
};

const eventsOf = async (collector, sessionId = 's1') => {
  const outcome = captureOutcome();
  await collector.listSessionEvents({
    data: { sessionId, after: 0, limit: 1000 },
    onFinish: outcome.onFinish,
  });
  return outcome.last().payload.events;
};

describe('Collector::ingestHook', () => {
  it('stores the event, answers 204 and announces it on the bus', async () => {
    const { collector, published } = buildCollector();

    const outcome = await ingest(collector, hook('SessionStart', { source: 'startup' }));

    assert.equal(outcome.name, 'NO_CONTENT');
    assert.equal(published.length, 1);
    assert.equal(published[0].kind, 'session.start');
    assert.equal(published[0].seq, 1);
  });

  it('starts watching the session folder on first sight, once', async () => {
    const { collector, fileWatcher } = buildCollector();

    await ingest(collector, hook('UserPromptSubmit', { prompt: 'oi' }));
    await ingest(collector, hook('Stop'));

    assert.deepEqual(fileWatcher.calls, [['watch', 's1', '/repo']]);
  });

  it('ends the session and stops its watcher on SessionEnd', async () => {
    const { collector, fileWatcher } = buildCollector();

    await ingest(collector, hook('SessionStart'));
    await ingest(collector, hook('SessionEnd', { reason: 'exit' }));

    const outcome = captureOutcome();
    await collector.listSessions({ data: { limit: 10 }, onFinish: outcome.onFinish });

    assert.ok(outcome.last().payload.sessions[0].endedAt);
    assert.deepEqual(fileWatcher.calls.at(-1), ['unwatch', 's1']);
  });

  it('links a subagent to the Agent call that launched it', async () => {
    const { collector } = buildCollector();

    await ingest(
      collector,
      hook('PreToolUse', {
        tool_name: 'Agent',
        tool_use_id: 'launch-1',
        tool_input: { subagent_type: 'Explore', description: 'map the repo' },
      })
    );
    await ingest(collector, hook('SubagentStart', { agent_id: 'a1', agent_type: 'Explore' }));

    const start = (await eventsOf(collector)).find(event => event.kind === 'agent.start');

    assert.equal(start.parentAgentId, 'main');
    assert.equal(start.data.parentSpanId, 'launch-1');
  });

  it('gives each of two parallel subagents its own launch', async () => {
    const { collector } = buildCollector();

    await ingest(collector, hook('PreToolUse', { tool_name: 'Agent', tool_use_id: 'L1' }));
    await ingest(collector, hook('PreToolUse', { tool_name: 'Agent', tool_use_id: 'L2' }));
    await ingest(collector, hook('SubagentStart', { agent_id: 'a1' }));
    await ingest(collector, hook('SubagentStart', { agent_id: 'a2' }));

    const spans = (await eventsOf(collector))
      .filter(event => event.kind === 'agent.start')
      .map(event => event.data.parentSpanId);

    assert.deepEqual(spans.sort(), ['L1', 'L2']);
  });

  it('answers 503 and logs the location when storing fails', async () => {
    const { collector, db, Logger } = buildCollector();
    db.close();

    const outcome = await ingest(collector, hook('Stop'));

    assert.equal(outcome.name, 'SERVICE_UNAVAILABLE');
    assert.match(Logger.lines.error[0], /Collector::ingestHook/);
  });
});

describe('Collector::recordContainerEvent', () => {
  const container = ts => ({
    kind: 'container.start',
    containerId: 'abc',
    name: 'db',
    image: 'postgres',
    exitCode: null,
    ts,
  });

  it('attributes a container to the session whose docker command just ran', async () => {
    const { collector, clock } = buildCollector();

    await ingest(
      collector,
      hook('PreToolUse', {
        tool_name: 'Bash',
        tool_use_id: 'd1',
        agent_id: 'a9',
        tool_input: { command: 'docker compose up -d' },
      })
    );
    clock.advance(1000);

    const stored = collector.recordContainerEvent(container(clock()));

    assert.equal(stored.sessionId, 's1');
    assert.equal(stored.agentId, 'a9');
    assert.equal(stored.spanId, 'd1');
    assert.equal(stored.data.attributedBy, 'command');
  });

  it('leaves a container nobody started unclaimed', () => {
    const { collector } = buildCollector();
    assert.equal(collector.recordContainerEvent(container('2026-11-26T12:00:00.000Z')), null);
  });

  it('marks a container that died with a non-zero code as an error', async () => {
    const { collector, clock } = buildCollector();
    await ingest(collector, hook('SessionStart'));

    const stored = collector.recordContainerEvent({
      ...container(clock()),
      kind: 'container.die',
      exitCode: 1,
    });

    assert.equal(stored.status, 'error');
    assert.equal(stored.data.attributedBy, 'recency');
  });
});

describe('Collector::recordFileChange', () => {
  it('records a change the hooks did not see', () => {
    const { collector } = buildCollector();

    const stored = collector.recordFileChange({ sessionId: 's1', path: '/repo/gen.ts' });

    assert.equal(stored.kind, 'file.change');
    assert.equal(stored.data.source, 'watcher');
  });

  it('skips the watcher echo of an edit a tool just made', async () => {
    const { collector, clock } = buildCollector();

    await ingest(
      collector,
      hook('PostToolUse', {
        tool_name: 'Write',
        tool_use_id: 'w1',
        tool_input: { file_path: '/repo/a.js' },
        tool_response: {},
      })
    );
    clock.advance(500);

    assert.equal(collector.recordFileChange({ sessionId: 's1', path: '/repo/a.js' }), null);

    clock.advance(10_000);
    assert.ok(collector.recordFileChange({ sessionId: 's1', path: '/repo/a.js' }));
  });
});
